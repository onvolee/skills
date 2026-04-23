#!/usr/bin/env node

/**
 * Batch query npm registry for latest stable versions.
 *
 * Usage: node get-latest.mjs <pkg1> <pkg2> <pkg3> ...
 * Output: JSON object with "resolved" and "failed" keys:
 *   {
 *     "resolved": {"pkg1": "x.y.z", "pkg2": "a.b.c"},
 *     "failed": [{"package": "bad-pkg", "error": "not found"}]
 *   }
 *
 * Respects the user's npm registry configuration (npm config get registry).
 */

const packages = process.argv.slice(2);

if (packages.length === 0) {
  console.error("Usage: node get-latest.mjs <pkg1> [pkg2] ...");
  console.error("Example: node get-latest.mjs react typescript vitest");
  process.exit(1);
}

async function getRegistry() {
  try {
    const { execSync } = await import("node:child_process");
    const registry = execSync("npm config get registry", { encoding: "utf-8" }).trim();
    // Ensure trailing slash
    return registry.endsWith("/") ? registry : `${registry}/`;
  } catch {
    return "https://registry.npmjs.org/";
  }
}

async function getLatestVersion(pkgName, registry) {
  const url = `${registry}${encodeURIComponent(pkgName)}/latest`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });

  if (res.status === 404) {
    return { version: null, error: `package "${pkgName}" not found in registry` };
  }
  if (!res.ok) {
    return { version: null, error: `HTTP ${res.status} from registry` };
  }

  const data = await res.json();
  if (!data.version) {
    return { version: null, error: `registry response missing version for "${pkgName}"` };
  }
  return { version: data.version, error: null };
}

async function main() {
  const registry = await getRegistry();

  const results = await Promise.all(
    packages.map(async (pkg) => {
      const result = await getLatestVersion(pkg, registry);
      return [pkg, result];
    })
  );

  const resolved = {};
  const failed = [];

  for (const [pkg, result] of results) {
    if (result.version) {
      resolved[pkg] = result.version;
    } else {
      failed.push({ package: pkg, error: result.error });
    }
  }

  console.log(JSON.stringify({ resolved, failed }));

  // Exit non-zero if any package failed, so callers can detect it
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
