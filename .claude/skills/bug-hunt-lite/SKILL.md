---
name: bug-hunt-lite
description: Diff-scoped, lightweight adversarial bug hunt. Use as Track B of /reviewer on every finished feature, or standalone for a fast security/logic pass over uncommitted changes. For a deep whole-repo sweep use /bug-hunt instead.
---

# Bug-Hunt Lite

A fast, **diff-scoped** adversarial bug hunt meant to run on every finished feature. It is the lightweight sibling of `/bug-hunt`: same core principle, a fraction of the cost.

**The one principle to preserve: adversarial redundancy.** A finding is only trusted after a _separate_ agent — one that never saw the hunter's reasoning — fails to disprove it. Never let the context that produced a finding also confirm it.

Everything else is stripped for speed:

- **Scope = the diff, not the repo.** Only changed files + their immediate blast radius.
- **No disk artifacts.** Findings flow back through messages; nothing is written to `.bug-hunt/`.
- **Few agents.** 2–4 hunters, one batched disprove pass. No recon map, no gapfill loops, no chaining.

If you need whole-repo recon, dependency audits, chaining, or resumable runs, stop and use `/bug-hunt` — this skill deliberately omits them.

---

## Stage 0 — Collect the diff (you, inline)

```bash
git diff HEAD
git status --short
```

If there are no uncommitted changes, fall back to the last commit:

```bash
git show HEAD
```

Read the changed files. Note for each changed hunk: what trust boundary it sits behind (HTTP route, server action, loader, DB query, auth gate) and what newly-reachable input it introduces. This is the only "recon" — keep it in your head, do not write a map.

## Stage 1 — Pick attack classes from the diff (you, inline)

Pick **3–5 classes that the diff actually exposes**. Do not run classes the change doesn't touch. Order by the reviewer attack-surface priority:

1. **Auth / permissions / tenant isolation** — missing ownership or org-scope checks, IDOR on object IDs, server-side filters trusting client IDs, admin paths reachable by a normal session, RLS/policy gaps.
2. **Data loss / corruption / irreversible state** — destructive writes without guards, mass-assignment into DB writes, missing idempotency on create/charge/finalize.
3. **Rollback / retry / partial failure** — non-idempotent handlers, check-then-act on shared state, single-use tokens reusable under parallel requests (invites, resets, coupons).
4. **Race / ordering / stale state** — TOCTOU, missing locks on counters/balances, re-entrancy.
5. **Injection & boundary** — SQL via ORM escape hatches or string-built queries, XSS via `dangerouslySetInnerHTML`/unescaped templating, SSRF on user-controlled fetch URLs, open redirect, path traversal, server-only code/secrets leaking into client bundles.
6. **Empty-state / null / degraded dependency** — unhandled null, timeout, empty-list, or failing-dependency paths that the happy path hides.
7. **Business-logic / workflow bypass** — skipping a step, replaying a stale confirm, negative/zero quantities, validating one field but acting on another.

Lean on the project's `AGENTS.md` and the reviewer's stance: auth, tenant isolation, and irreversible state come first.

## Stage 2 — Hunt (2–4 parallel agents)

Cluster the chosen classes into **2–4 hunters** (one hunter may own 1–2 related classes). Spawn them in a single message, `subagent_type=general-purpose`, all reading the **same diff scope**.

**Hunter prompt — fill braces:**

```
You are adversarially hunting bugs in a code change. Try to DISPROVE that it is correct.

Attack classes (only these): {classes}
Changed files / hunks to focus on:
{file:line list from the diff}

What to do:
1. Read the changed code and just enough surrounding code to trace how input reaches it from a trust boundary (route, server action, loader, webhook).
2. Trace bad inputs, retries, concurrent requests, and partially-completed operations through the changed paths.
3. Look ONLY for the listed classes. Ignore style, naming, and cleanup.
4. Stop after your 3 strongest candidates or when you've read the scope, whichever is first.

Return each candidate in your final message as a compact block (no files written):

[CANDIDATE]
class: <class>
severity: critical|high|medium|low
location: path/to/file.ts:LINES
what: 1–2 sentences — the bug and why it's a bug
trigger: how an attacker/bad input reaches this path from outside
impact: concrete — what is gained or broken (no abstract "could be exploited")
confidence: high|medium|low

Rules:
- Every candidate needs a real file:line. No location, no candidate.
- If under 70% confident, mark confidence low — don't drop it, the next stage will judge it.
- Do NOT edit any source file. Read-only.
- If you find nothing, say "no candidates" — do not invent filler.
```

Collect candidates from the messages. Deduplicate by **root cause** (same fix closes both = one), not by file.

## Stage 3 — Disprove (1 batched adversarial agent)

Spawn **one** `general-purpose` agent whose only job is to refute the candidates. It must not receive the hunters' reasoning — give it only the claim, location, and class.

**Disprove prompt:**

```
Previous agents claimed these bugs exist in a code change. Your job is to DISPROVE each one. Bias toward refutation.

Candidates:
{for each: id, class, severity, location, one-line claim}

For each candidate:
1. Read the cited location and surrounding code independently.
2. Trace whether the trigger path actually exists end-to-end from an external trust boundary.
3. Check for guards the hunter may have missed: middleware, auth/permission helpers, RLS or org-scope filters, type/schema validation, framework escaping, upstream sanitization.

Return one verdict per candidate in your final message:

[VERDICT]
id: <id>
verdict: confirmed | refuted | needs-info
why: one concrete sentence — for refuted, name the specific guard that blocks it ("the org-scope filter at X already constrains this"); for confirmed, the external path that reaches it.
revised_severity: critical|high|medium|low   (only if confirmed)

Rules:
- If you cannot reach the bug from external input, refute it.
- Do not introduce new findings. Do not edit source. Read-only.
```

## Stage 4 — Report (you, inline)

Keep only `confirmed` (and `needs-info` you judge plausible). Emit findings in **Track B's finding bar**, sorted by severity:

- ❌ **FAIL** `file:line` — what can go wrong / why vulnerable / impact / concrete fix
- ⚠️ **WARNING** `file:line` — issue + recommendation
- ✅ **PASS** — if the disprove pass refuted everything, say so plainly with one line of evidence.

For each FAIL, give a one-line concrete fix. List refuted candidates as a single line each ("refuted because …") only if it adds signal — otherwise drop them.

When invoked inside `/reviewer`, return these findings to the reviewer's synthesis step (Step 4) instead of printing a standalone verdict; the reviewer merges them with Track A.

---

## Operational rules

- **Separate discover and disprove agents — always.** This is the whole point; collapsing them defeats the skill.
- **Diff-scoped.** If you find yourself reading the whole repo, you've reached for the wrong skill — use `/bug-hunt`.
- **No filler.** One strong confirmed finding beats five low-confidence guesses. An honest PASS is a valid result.
- **Read-only.** No agent here edits source. Fixing is a separate, human-gated step.
- **No disk artifacts.** Findings stay in messages. (That's the cost trade vs `/bug-hunt`.)

## When NOT to use this skill

- Whole-repo audit, launch/raise prep, dependency or config review → `/bug-hunt`.
- "Is this one function safe?" → just read it.
