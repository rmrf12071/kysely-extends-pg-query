import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { ExtendsPgQueryPlugin, executePagination, executeTotal } from "../dist/src/index.js";

const require = createRequire(import.meta.url);
const cjs = require("..");
const esm = await import("../dist/src/index.js");

assert.equal(typeof ExtendsPgQueryPlugin, "function");
assert.equal(typeof executePagination, "function");
assert.equal(typeof executeTotal, "function");
for (const [name, value] of Object.entries(cjs)) {
  if (name === "__esModule") continue;
  assert.equal(esm[name], value, `ESM named export: ${name}`);
}
assert.equal(esm.default, cjs);
const metadata = require("../package.json");
assert.ok(readFileSync(new URL(`../${metadata.types}`, import.meta.url), "utf8").includes("ExtendsPgQueryPlugin"));
console.log("CommonJS, ESM imports, and type declaration entry point verified.");

// Exercise the compiled CLI provider against real recursive Dirent entries.
const { RecursiveFileMigrationProvider } = require("../dist/bin/node/migrate.js");
const folder = await fs.mkdtemp(path.join(tmpdir(), "kysely-migrations-"));
try {
  await fs.mkdir(path.join(folder, "nested"));
  await fs.writeFile(path.join(folder, "001-first.js"), "exports.up = async () => {};\n");
  await fs.writeFile(path.join(folder, "nested", "002-next.ts"),
    "export default { up: async (): Promise<void> => {} };\n");
  await fs.writeFile(path.join(folder, "ignored.d.ts"), "export declare const up: () => void;\n");
  const provider = new RecursiveFileMigrationProvider({ fs, path, migrationFolder: folder });
  const migrations = await provider.getMigrations();
  assert.deepEqual(Object.keys(migrations).sort(), ["001-first", path.join(path.sep, "nested", "002-next")].sort());
  for (const migration of Object.values(migrations)) {
    assert.equal(typeof migration.up, "function");
  }
  console.log("Recursive JS/TS migration discovery verified.");
} finally {
  await fs.rm(folder, { recursive: true, force: true });
}
