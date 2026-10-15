# Makerkit Loop

A local, document-first workspace for PRDs (product requirements documents) that works **alongside your coding agent**: Claude Code, Codex, OpenCode, Cursor, or any agent that supports MCP.

You plan and build by talking to your own agent. Loop is where you read the plan, adjust it, follow progress and approve finished stories.

```bash
npx @makerkit/loop
```

Run it inside your project. Loop is free, MIT licensed and fully local: no account, no hosted service, and no AI of its own.

Loop is made by [Makerkit](https://makerkit.dev), the team behind the Makerkit SaaS starter kits. You don't need a kit to use it: Loop works in any project. Inside a kit it uses the kit's own MCP server.

> **Status:** early. Loop and the packages it depends on (`@makerkit/prd`, `@makerkit/prd-mcp`) are not on npm yet. Until they are, run Loop from source (see [Development](#development)).

## The workflow: Plan → Build → Review → Ship

1. **Plan.** Ask your agent to run the `shape_prd` prompt. It interviews you round by round and writes every decision into a PRD in `.prds/`.
2. **Build.** Ask your agent to run `implement_story`. It picks the next ready story, builds it, runs your checks and leaves a log of what changed.
3. **Review.** When the agent moves the story to `review`, Loop shows its log, the files it changed and the check results.
4. **Ship.** Approve the story (Loop commits it) or send it back with notes the agent reads next time.

At every step, Loop shows the exact instruction to give your agent, ready to copy, for example:

```
Implement story US004 from notes.json with the implement_story prompt
```

In most agents, the MCP prompts (`shape_prd`, `implement_story`, `review_story`) also appear as slash commands.

## What Loop shows

- **Document**: the PRD as a clean, readable document: overview, problem, solution, scope, glossary, decisions, risks, open questions. Sections can be edited inline.
- **Plan check**: a short list of what the plan is still missing, such as success metrics, acceptance criteria, rollout, or unanswered questions.
- **Stories**: a board by status, grouped by phase in build order, with dependencies, the next ready story and each story's log.
- **Approve**: the review step for stories in `review`. Approving commits the story; sending it back records your notes on it.
- **Connect your agent**: adds the PRD MCP server to your agent's config and checks that it is connected.

## How it works

```
            <project>/.prds/*.json   the shared state (format: @makerkit/prd)
                 ▲                         ▲
            PrdService                PRD MCP server
        (Loop's server functions)    (@makerkit/prd-mcp, or the kit's MCP server)
                 ▲                         ▲
     you ──► Makerkit Loop             your agent (Claude Code, Codex, ...)  ◄── you
          (document, plan check,      (planning chat, writing code)
           stories, approve)
```

- **Loop never runs or wraps your agent.** There is no chat, no agent process and no API keys in Loop. Your agent stays in your own tool, with your own settings and subscription.
- **Loop and the agent share state only through `.prds/`.** The agent reads and updates PRDs with MCP tools. Loop reads and updates the same files through `PrdService`. When the agent changes something, Loop's UI updates live.
- **PRD files are the only state.** Loop keeps no database. PRDs live in your repo and are shared through git.
- **One story at a time.** The agent works in your current checkout.

## PRDs and the MCP server

The PRD format and the MCP server live in the [`makerkit/makerkit`](https://github.com/makerkit/makerkit) monorepo:

| Package                                                                                | What it is                                                                          |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [`@makerkit/prd`](https://github.com/makerkit/makerkit/tree/main/packages/prd)         | The PRD format (types and Zod schemas), `PrdService`, and the MCP tools and prompts |
| [`@makerkit/prd-mcp`](https://github.com/makerkit/makerkit/tree/main/packages/prd-mcp) | A standalone stdio MCP server that exposes those tools to your agent                |

### The PRD format

Each PRD is a JSON file in `.prds/` at the project root, for example `.prds/notes.json`. Files and mockups the PRD refers to live in a folder next to it, `.prds/<prd name>/`.

A PRD holds:

- **The document**: introduction and overview, problem statement and target users, solution and success metrics, non-goals and out of scope, assumptions.
- **Stories** (`userStories`): each with an id (`US001`, ...), title, user story, acceptance criteria, priority (`P0`–`P3`), complexity (`XS`–`XL`), dependencies on other stories, and a status.
- **Phases** (`customPhases`): ordered groups of stories that set the build order.
- **The story log**: hand-off notes the agent writes when it finishes a story: `whatsNew` (what a person can now try), `technicalNotes` (for the next agent) and `deviations` (where the work departed from the plan, and why).
- **Planning detail**: decisions, glossary terms, open questions (with options and a recommended answer), edge cases, risks, design guidance, security considerations, technical contracts, rollout and measurement plans. Parts that don't apply can be marked not applicable with a reason.
- **Metadata**, including a `revision` number incremented on every save.

Text fields may use Markdown. See [`types.ts`](https://github.com/makerkit/makerkit/blob/main/packages/prd/src/types.ts) for the full schema.

### The rules

`PrdService` enforces the same rules for Loop and for the agent:

- **Status workflow**: `not_started → research → in_progress → review → completed`, plus `blocked`.
- **Dependencies**: a story cannot start before its dependencies are completed.
- **Completion check**: a story can only become `completed` when the project's checks pass (by default, the `typecheck` and `lint` scripts in `package.json`, skipped if they don't exist).
- **Revision check**: a write based on an outdated read is rejected, so Loop and the agent never silently overwrite each other.

In Loop, a story becomes `completed` only when you approve it.

### The MCP server

The MCP server gives your agent tools to work with PRDs, including `get_next_story`, `get_story`, `update_story_status`, `add_story_log`, `check_plan`, `add_decision` and `resolve_open_question`, plus the `shape_prd`, `implement_story` and `review_story` prompts.

Loop's **Connect your agent** screen sets this up for you. To do it by hand:

```bash
# Claude Code
claude mcp add prd --scope project -- npx -y @makerkit/prd-mcp

# Codex
codex mcp add prd -- npx -y @makerkit/prd-mcp
```

Any other MCP client (stdio):

```json
{
  "mcpServers": {
    "prd": { "command": "npx", "args": ["-y", "@makerkit/prd-mcp"] }
  }
}
```

Options: `--root <dir>` sets the project directory (default: the current directory), and `--check <script>` sets a `package.json` script that must pass before a story is completed (repeatable).

**In a Makerkit kit**, use the kit's own MCP server instead: it already includes the PRD tools along with the kit's tools. Loop detects it and configures it for you.

## Options

```
npx @makerkit/loop [options]

  --port <number>  Use this port (default: 3000, or the next free one)
  --no-open        Do not open the browser; just print the link
  -h, --help       Show this help
```

## Security

Loop has read and write access to your project, your git repository and your `.prds/` files, so it is locked down to your machine:

- It listens on `127.0.0.1` only.
- Each launch generates a random session token, included in the link Loop opens. Every request must carry it.
- Requests with a `Host` or `Origin` other than Loop's own address are rejected, which blocks other websites (cross-site requests, DNS rebinding) from reaching it.
- No accounts, no remote access, no telemetry.

## Development

Loop is built with [TanStack Start](https://tanstack.com/start) (React 19, Nitro), Tailwind CSS 4 and shadcn/ui. It requires Node 22+ and pnpm.

Until the PRD packages are published, clone the `makerkit/makerkit` monorepo next to this repository and build `@makerkit/prd` there. Loop links its `dist` folder from `../makerkit/packages/prd/dist`.

```bash
pnpm install
pnpm dev               # start Loop on http://localhost:3000
pnpm build             # production build (Nitro output in .output/)
pnpm start             # run the built Loop for the current folder
pnpm test              # unit tests (Vitest)
pnpm typecheck
pnpm lint
pnpm format
```

[`AGENTS.md`](AGENTS.md) describes the architecture and the rules for contributing, for people and coding agents alike. In short:

- Server work (filesystem, git, `PrdService`) happens only in server functions, with Zod-validated input.
- Business logic lives in plain services with injected dependencies, so it can be tested without a server or an agent.
- Never read or write `.prds` files directly: always go through `PrdService`. Changes to the format or the PRD rules belong in `@makerkit/prd`, with tests there.

### Not in scope

Loop is the companion for Plan → Build → Review → Ship and nothing else. Pull requests that add a chat UI, run or steer agents, add AI features, hosted features (accounts, sync, sharing links) or a desktop shell won't be accepted.

## License

MIT © [Makerkit](https://makerkit.dev)
