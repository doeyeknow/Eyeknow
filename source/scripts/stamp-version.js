// Writes lib/build-stamp.ts at build time so the app can show
// its exact version + build in the About-the-creator diagnostics
// (and so a stale in-memory bundle on a phone is easy to spot).
const fs = require("fs");
const path = require("path");
const pkg = require("../package.json");
const id = Math.random().toString(16).slice(2, 8);
const builtAt = new Date().toISOString().slice(0, 10);
const out = `// Generated at build time by scripts/stamp-version.js — do not edit.
export const APP_VERSION = ${JSON.stringify(pkg.version)};
export const BUILD_ID = ${JSON.stringify(id)};
export const BUILT_AT = ${JSON.stringify(builtAt)};
`;
fs.writeFileSync(path.join(__dirname, "..", "lib", "build-stamp.ts"), out);
console.log("stamped version", pkg.version, "build", id, builtAt);
