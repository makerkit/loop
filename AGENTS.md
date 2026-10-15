# Makerkit Loop

Makerkit Loop is a local, document-first workspace for PRDs (product requirements documents). It works **alongside the user's coding agent**: Claude Code, Codex, OpenCode, Cursor or any agent that supports MCP. It is a companion, not a replacement. The user plans and builds by talking to their own agent; Loop is where they read the plan, adjust it, follow progress and approve finished stories.

Users start it inside their own project with `npx @makerkit/loop`. It is free, MIT licensed and fully local: no account, no hosted service, no AI of its own.

## What Loop shows

Loop is small on purpose. Its MVP has these views:

1. **Document**: a PRD as a clean, readable document anyone can review or share: overview, problem, solution, scope (non-goals, out of scope), glossary, decisions, risks, open questions. Sections can be edited inline.
2. **Plan check**: a short checklist of what the plan is still missing (success metrics, acceptance criteria, rollout, unanswered questions), built from `getImprovementSuggestions` in `@makerkit/prd`.
3. **Stories**: the stories as a board by status, grouped by phase in build order, with dependencies, the next ready story, and each story's log ("what's new").
4. **Ask your agent**: at every step, the exact instruction to give the agent, ready to copy (e.g. "Implement the next story from `notes.json`"). MCP prompts such as `shape_prd` and `implement_story` also appear as slash commands in most agents.
5. **Approve**: when the agent moves a story to `review`, show its log, the files it changed and the check results. The user approves it (committing the story) or sends it back with notes the agent reads next time.
6. **Connect your agent**: setup that adds the PRD MCP server to the user's agent and checks it is connected.

This follows the Makerkit Loop workflow, **Plan → Build → Review → Ship**: the user plans with `shape_prd` in their agent, builds with `implement_story`, reviews in Loop, and ships by approving.

Full diff review and an embedded live preview are not in the MVP. The Makerkit kits' Dev Tools app is the place for the richer review inside a kit.

## Architecture

```
            <project>/.prds/*.json   the shared state (format: @makerkit/prd)
                 ▲                         ▲
            PrdService                PRD MCP server
        (Loop's server functions)    (@makerkit/prd-mcp, or the kit's MCP server)
                 ▲                         ▲
   user ──► Makerkit Loop             user's agent (Claude Code, Codex, ...)  ◄── user
          (document, plan check,      (planning chat, writing code)
           stories, approve)
```

- **Loop never runs, drives or wraps the agent.** There is no chat UI, no agent process, no ACP client and no permission handling in Loop. The agent stays in the user's own tool with its own UI, settings and subscription.
- **Loop and the agent share state only through `.prds/`.** The agent reads and updates PRDs with MCP tools (`get_next_story`, `get_story`, `update_story_status`, `add_story_log`, ...). Loop reads and updates the same files through `PrdService`. Neither talks to the other directly.
  - **Loop to agent:** write into the PRD (a story's status and notes, review feedback, plan edits). The agent picks it up the next time it calls `get_story` or `get_next_story`.
  - **Agent to Loop:** Loop watches `.prds/` and updates the UI live when the agent changes something.
- **PRD files are the only state.** Loop keeps no database.
- **Never read or write `.prds` files directly.** Use `PrdService` from `@makerkit/prd`. It enforces:
  - the story status workflow
  - dependencies (a story cannot start before its dependencies are completed)
  - the completion check (the project's checks must pass)
  - the revision check (a write based on an outdated read is rejected; re-read and retry, never overwrite)
- **Connecting the agent is part of setup.** Loop helps the user add the PRD MCP server to their agent (e.g. `claude mcp add`, Codex's `config.toml`, OpenCode's config) and checks that it is connected.
  - In a Makerkit kit, use the kit's own MCP server: it already includes the PRD tools along with the kit tools.
  - Elsewhere, use `@makerkit/prd-mcp`.
- **Tell the user what to ask their agent.** At each step, show the next instruction as text the user can copy (e.g. "Implement the next story from `notes.json`"). MCP prompts such as `implement_story` also appear as slash commands in most agents.
- **One story at a time.** The agent works in the user's current checkout. There are no parallel runs, worktrees or merges.
- **The project root** is the directory Loop was started in. Resolve it once on the server; never trust a path sent by the browser.

### Sibling packages

These live in the `makerkit/makerkit` monorepo (`~/Code/makerkit`):

| Package             | Status                                   | Used for                                              |
| ------------------- | ---------------------------------------- | ----------------------------------------------------- |
| `@makerkit/prd`     | In `packages/prd`; not published yet     | The PRD format, `PrdService`, `createNodePrdDeps`     |
| `@makerkit/prd-mcp` | In `packages/prd-mcp`; not published yet | The MCP server Loop helps connect to the user's agent |

Until they are published, link the local copies: `pnpm add ../makerkit/packages/prd`. If a change belongs in the format or the PRD rules, make it in `@makerkit/prd` with tests there. Don't work around it in Loop.

### Not in scope

Loop is the companion for Plan → Build → Review → Ship and nothing else. Don't add:

- **Anything that replaces the agent:** a chat UI, running or steering agents, AI writing features of its own, agent integrations or output parsers, model or API-key settings.
- **Anything hosted:** accounts, sync, sharing links, a cloud workspace. PRDs live in the repo and are shared through git.
- **Kit management** (env vars, translations, emails, database tools, plugins, kit updates): the kit's own Dev Tools app and MCP server cover it.
- **A desktop shell** (Tauri or Electron), auto-updates or code signing.

### Porting from the earlier desktop app

`~/Code/makerkit-desktop-app` was an earlier attempt at this product (Tauri, abandoned in 2026). It tried to replace the agent, which is the opposite of Loop's design, so leave its agent, chat and ACP code behind. These framework-free pieces are still useful. Swap Tauri's shell plugin for Node's `child_process`, keep the tests, and split files over ~400 lines while porting.

- Git (changed files for a story, the approval commit): `src/features/git/utils/git-status-parser.ts`, `services/git-checkpoint-service.ts`
- Setup: the prerequisite checker in `src/features/prerequisites/services/prerequisite-checker.ts`
- Safety: `src/lib/validators/shell-safety.ts`, `src/lib/error-sanitizer.ts`

## Stack

- **TanStack Start** (React 19, file-based routing) with **Nitro** as the server adapter
- **Tailwind CSS 4**
- **shadcn/ui** on Base UI (`base-nova` style), with lucide icons
- **pnpm**, TypeScript in strict mode

### Read the docs before writing TanStack code

Your training data about TanStack Start, Router and Table is likely outdated. The installed packages ship their own guides, so read the relevant one before writing code:

- `node_modules/@tanstack/react-start/skills/react-start/SKILL.md` (and `server-components/`)
- `node_modules/@tanstack/react-table/skills/*/SKILL.md` (v9, which differs from v8)
- `node_modules/@tanstack/devtools-vite/skills/*/SKILL.md`
- `node_modules/@tanstack/match-sorter-utils/skills/*/SKILL.md`

## Code layout

| Path                   | Contents                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/routes/`          | File-based routes. `__root.tsx` is the document shell.                                                                  |
| `src/routeTree.gen.ts` | Generated by TanStack Router. Never edit it.                                                                            |
| `src/components/ui/`   | shadcn components. Add new ones with `pnpm dlx shadcn@latest add <name>` instead of writing them by hand.               |
| `src/components/`      | Loop's own components, grouped by feature (e.g. `stories/`, `runs/`).                                                   |
| `src/lib/`             | Shared helpers. For class names use `cn` from the `cn` package (shadcn's class merger), which `#/lib/utils` re-exports. |
| `src/hooks/`           | React hooks.                                                                                                            |

Imports use the `#/` alias for `src/`, e.g. `import { Button } from '#/components/ui/button'`.

## Rules

- **Server work happens in server functions.** Filesystem access, git, child processes and `PrdService` run only on the server, through `createServerFn`. Never import `node:*` modules or `@makerkit/prd/node` from client components.
- Use the service builder pattern (skill) for building reusable, testable, composable services
- **Validate server function input** with Zod. The browser is untrusted even on localhost.
- **Loop is localhost-only.** It runs on the user's machine with read and write access to their project, git and the `.prds/` files. Bind to `127.0.0.1`. Don't add remote access, accounts or telemetry.
- **Assume any website can reach Loop's server.** A page open in another tab can send requests to localhost (cross-site requests, DNS rebinding). Every server function and API route must:
  - require the random session token Loop generates at launch and puts in the URL it opens;
  - reject requests whose `Host` is not `127.0.0.1:<port>` or `localhost:<port>`;
  - reject requests whose `Origin` is present and is not that same address.

  This applies to read-only endpoints too, since they expose project files.

- **Business logic goes in plain services** with injected dependencies (filesystem, clock, process runner), so it can be unit-tested without a server or a real agent. Routes and components only call services and render.
- **Use the PRD vocabulary from `@makerkit/prd` in code**: PRD, story, phase, status (`not_started`, `research`, `in_progress`, `review`, `completed`, `blocked`), dependency, story log (`whatsNew`, `technicalNotes`), decision, glossary term. Don't invent synonyms like "task", "ticket" or "card" for a story. Loop is for non-technical users too, so UI labels may use plainer words; those labels are not decided yet, so ask before introducing them.
- **UI copy is literal and short.** Say what a button does ("Approve story", "Send back", "Copy instruction"). No marketing language inside the app.
- **Status changes go through `PrdService`.** A story becomes `completed` only through the review step, never automatically when an agent finishes.

## Commands

```bash
pnpm dev               # start Loop on http://localhost:3000
pnpm build             # production build (Nitro output in .output/)
pnpm generate-routes   # regenerate src/routeTree.gen.ts
```

## Verification

After implementation, always run:

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm format
4. Run /reviewer skill
