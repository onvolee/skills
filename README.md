# Skills

Claude Code agent skills.

## Installation

### Install from git repository

```bash
npx skills add https://github.com/onvolee/skills --skill latest-npm-deps
```

### Verify

Run `What skills are available?` in Claude Code, or type `/` to see the skill appear in the autocomplete list.

---

## latest-npm-deps

Query the npm registry for the latest stable versions before installing packages.

### What it does

When adding new dependencies, this skill ensures you always install the **actual latest stable version** from the npm registry — never guessed, outdated, or blank versions.

### Workflow

1. Detects uninstalled packages from imports or user requests
2. Checks existing `package.json` and lock files for compatibility
3. Detects the active package manager from lock files
4. Queries the npm registry for latest versions
5. Installs with exact pinned versions
6. Verifies the installed version matches

### Features

- Respects the user's configured npm registry (`npm config get registry`)
- Handles scoped packages with correct URL encoding
- Batch queries multiple packages in a single call
- Graceful fallback when `jq` is unavailable
- Peer dependency and ecosystem version compatibility checks
