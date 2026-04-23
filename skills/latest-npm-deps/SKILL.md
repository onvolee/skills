---
name: latest-npm-deps
description: Query npm registry for latest stable versions before installing packages. Triggers when adding uninstalled dependencies, creating package.json, or AI-generated code imports packages not in package.json.
compatibility: opencode, claude, gemini, codex
---

## Purpose

Always use **actual latest stable versions** from the npm registry when installing new dependencies — never guess, use outdated knowledge, or leave versions blank.

## When to Trigger

- AI-generated code imports a package that is **not** in `package.json`
- The user asks to add a dependency without specifying a version
- Creating a new `package.json` and adding dependencies for the first time

## When NOT to Trigger

- **Version upgrades** — the user explicitly wants to upgrade an existing dependency (e.g., "upgrade react to latest"). This is outside this skill's scope.
- **Explicit versions** — the user specifies a version (`react@18`, `typescript@^5.7`)
- **Already installed** — the package exists in `package.json` with an acceptable version range
- **Intentional flexibility** — the project uses `*` or `latest` as its version strategy

## Before You Do Anything

1. **Check package.json** — if the package is already listed, use the existing version constraint (don't re-query or install a conflicting newer version).
2. **Check version compatibility** — if the project already pins a related package (e.g., `react@18`), install the compatible sibling (e.g., `react-dom@18.x`), not the absolute latest. Match major versions for packages in the same ecosystem.
3. **Check lock files** — if a lock file (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`) already has the package pinned, that version is sufficient for re-installation.

## How It Works

**Rule: before any `npm install`, `pnpm add`, `yarn add`, or `bun add`, query the npm registry first.**

### Discover the registry

Always use the user's configured npm registry, not a hardcoded URL:

```bash
REGISTRY=$(npm config get registry)
```

Default is `https://registry.npmjs.org/` if no custom registry is set.

### Detect the package manager

Check the project root for lock files to determine the active package manager:

| Lock file | Command |
|-----------|---------|
| `pnpm-lock.yaml` | `pnpm add <pkg>@<version>` |
| `yarn.lock` | `yarn add <pkg>@<version>` |
| `bun.lock` or `bun.lockb` | `bun add <pkg>@<version>` |
| `package-lock.json` | `npm install <pkg>@<version>` |
| None of the above | Use `npm install` |

### Query the registry

**Preferred: use the bundled script** for single or batch queries:

```bash
node scripts/get-latest.mjs <pkg1> <pkg2> <pkg3> ...
```

Example output: `{"resolved":{"vitest":"4.1.5","typescript":"5.8.3"},"failed":[]}`

The script automatically discovers the user's npm registry, URL-encodes scoped packages, and handles timeouts.

**Fallback: curl** (only when Node.js is unavailable):

Scoped packages must have the `/` URL-encoded to `%2F`:

```bash
REGISTRY=$(npm config get registry)
# Single package — scoped packages need %2F instead of /
curl -s "${REGISTRY}vitest/latest" | jq -r '.version'                       # 4.1.5
curl -s "${REGISTRY}@vitest%2Fcoverage-v8/latest" | jq -r '.version'        # 4.1.5
curl -s "${REGISTRY}@types%2Fnode/latest" | jq -r '.version'               # 22.13.0
```

No `jq`? Pure bash fallback:

```bash
curl -s "${REGISTRY}<package-name>/latest" | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4
```

### Prereleases and specific channels

The `/latest` endpoint returns the stable release. For beta/rc/next versions, query the full package info and check `dist-tags`:

```bash
node scripts/get-latest.mjs <pkg>  # returns stable version
# Or for dist-tags via curl:
REGISTRY=$(npm config get registry)
curl -s "${REGISTRY}<package-name>" | jq '.["dist-tags"]'
```

## Handling Failed Lookups

If a package lookup returns `null` or an empty version, the package **may not exist** in the registry. Report this to the user before proceeding — do not attempt to install a package without a valid version. Possible causes:

- Package name is misspelled
- Package was removed from npm (unpublished)
- Private registry does not host this package
- The package only exists under a scoped namespace (e.g., `@org/pkg`)

## Workflow

1. **Identify** all uninstalled packages from imports or commands
2. **Check** existing version constraints in `package.json` and lock files for compatibility
3. **Detect** the package manager from lock files (see "Detect the package manager")
4. **Query** the registry using `node scripts/get-latest.mjs` (preferred) or curl fallback
5. **Validate** — any package returning `null` or empty version should be flagged as "not found"
6. **Install** with exact versions: `<pkg-manager> add <pkg>@<version>` (see detected command above)
7. **Verify** — confirm the installed version matches the queried version:

```bash
# npm:  npm list <pkg> --depth=0
# pnpm: pnpm list <pkg> --depth=0
# yarn: yarn list --pattern <pkg>
# bun:  bun pm ls <pkg>
```

If the installed version does not match the queried latest version, check for peer dependency conflicts or range constraints in `package.json`.

## Example

User says: "Add vitest and @vitest/coverage-v8 to the project"

```bash
# 1. Detect package manager — pnpm-lock.yaml exists, use pnpm
# 2. Query versions:
node scripts/get-latest.mjs vitest @vitest/coverage-v8
# → {"resolved":{"vitest":"4.1.5","@vitest/coverage-v8":"4.1.5"},"failed":[]}
# 3. Install:
pnpm add vitest@4.1.5 @vitest/coverage-v8@4.1.5
# 4. Verify:
pnpm list vitest @vitest/coverage-v8 --depth=0
```
