# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Quality Gates

- Local full gate: `npm run ci:local`
- Version sync check: `npm run check:versions`
- Git hook install: `npm install` or `npm run hooks:install`
- Commit blocker: `.githooks/pre-commit` runs the full local gate before every commit
- GitHub CI: `.github/workflows/ci.yml`
- GitHub Code Scanning: `.github/workflows/codeql.yml`
- GitHub CD release: update the app version first, then push a matching `v0.1.0` style tag to trigger multi-platform release packaging
- Release workflow blocks if the Git tag and app version files do not match exactly

## Platform Notes

- Windows requires the system `OpenSSH Client`
- Recommended install path on Windows: `Settings > Optional Features > OpenSSH Client`
- PowerShell install command: `Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0`

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
