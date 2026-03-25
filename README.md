# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Quality Gates

- Local full gate: `npm run ci:local`
- Git hook install: `npm install` or `npm run hooks:install`
- Commit blocker: `.githooks/pre-commit` runs the full local gate before every commit
- GitHub CI: `.github/workflows/ci.yml`
- GitHub Code Scanning: `.github/workflows/codeql.yml`
- GitHub CD release: push tag `v0.1.0` style tag to trigger multi-platform release packaging

## Docs

- [Auto Update Setup](docs/auto-update.md)

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
