<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project context and documentation (maintained by hand, outside the Next.js block above)

- Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) first: what this project is, commands, working rules, current state.
- **Codebase Knowledge Graph:** If present, consult [graphify-out/GRAPH_REPORT.md](graphify-out/GRAPH_REPORT.md) (and `graphify-out/graph.json`) to trace dependencies, call chains, and core components before modifying code or diagnosing bugs.
- Full reference: [DOCUMENTATION.md](DOCUMENTATION.md). The Android app (`../Site-tracker`) shares the same Firebase project and has its own pair of files.
- **Standing instruction:** after any task that changes code, config, schema, env vars, routes or UI behaviour, end the reply with a one-line
  reminder to update `DOCUMENTATION.md` (name the section) and the changelog in `PROJECT_CONTEXT.md`. Details in `PROJECT_CONTEXT.md`.
