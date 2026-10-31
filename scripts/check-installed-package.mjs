import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const [mode, directory] = process.argv.slice(2);
assert.ok(directory, "Consumer directory is required");
const consumer = path.resolve(directory);
const run = (command, args) => {
  console.log(`Running: ${command} ${args.join(" ")}`);
  execFileSync(command, args, {
    cwd: consumer,
    stdio: "inherit",
    timeout: 60_000,
  });
};

if (mode === "prepare") {
  mkdirSync(consumer, { recursive: true });
  const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", consumer], {
    cwd: root,
    encoding: "utf8",
    timeout: 60_000,
  }));
  const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
  // Match the repository's resolved peers and compiler, without linking its source.
  const version = (name) => lock.packages[`node_modules/${name}`].version;
  writeFileSync(path.join(consumer, "package.json"), JSON.stringify({
    private: true,
    dependencies: {
      "kysely-extends-pg-query": `file:./${packed[0].filename}`,
      kysely: version("kysely"),
      "pg-pool": version("pg-pool"),
    },
    devDependencies: {
      typescript: version("typescript"),
      "@types/node": version("@types/node"),
    },
  }, null, 2) + "\n");
} else if (mode === "check") {
  const require = createRequire(path.join(consumer, "package.json"));
  const installed = path.dirname(require.resolve("kysely-extends-pg-query/package.json"));
  assert.ok(installed.startsWith(consumer + path.sep));
  writeFileSync(path.join(consumer, "check.cjs"), `
const assert = require("node:assert/strict");
const api = require("kysely-extends-pg-query");
for (const name of ["ExtendsPgQueryPlugin", "executePagination", "executeTotal"]) {
  assert.equal(typeof api[name], "function");
}
`);
  writeFileSync(path.join(consumer, "check.mjs"), `
import assert from "node:assert/strict";
import { ExtendsPgQueryPlugin, executePagination, executeTotal } from "kysely-extends-pg-query";
for (const value of [ExtendsPgQueryPlugin, executePagination, executeTotal]) {
  assert.equal(typeof value, "function");
}
`);
  writeFileSync(path.join(consumer, "check.mts"), `
import { ExtendsPgQueryPlugin, type Pagination, type UtilConfig } from "kysely-extends-pg-query";
interface DB { person: { id: number; detail: { name: string } } }
new ExtendsPgQueryPlugin<DB>({ jsonColumns: ["person.detail"] });
const pagination: Pagination = { currentPage: 1, perPage: 10 };
const config: UtilConfig = { database: "test", owner: { user: "test", password: "test" }, migrate: "migrations" };
`);
  run(process.execPath, ["check.cjs"]);
  run(process.execPath, ["check.mjs"]);
  run(process.execPath, [require.resolve("typescript/bin/tsc"), "--noEmit", "--strict", "--skipLibCheck", "--module", "NodeNext", "--target", "ES2022", "check.mts"]);

  // Test the installed executable and loader without connecting to PostgreSQL.
  run(path.join(consumer, "node_modules/.bin/kysely-extends-pg-query"), []);
  const configPath = path.join(consumer, "config.ts");
  writeFileSync(configPath, `export default { database: "test", owner: { user: "test", password: "test" }, migrate: "migrations" };\n`);
  const parseConfig = require(path.join(installed, "dist/bin/node/parseConfig.js")).default;
  assert.equal(parseConfig({ config: configPath }).database, "test");
  const migrations = path.join(consumer, "migrations");
  mkdirSync(path.join(migrations, "nested"), { recursive: true });
  writeFileSync(path.join(migrations, "001-first.js"), "exports.up = async () => {};\n");
  writeFileSync(path.join(migrations, "nested/002-next.ts"), "export default { up: async (): Promise<void> => {} };\n");
  const { RecursiveFileMigrationProvider } = require(path.join(installed, "dist/bin/node/migrate.js"));
  const { promises: fs } = await import("node:fs");
  const provider = new RecursiveFileMigrationProvider({ fs, path, migrationFolder: migrations });
  const found = await provider.getMigrations();
  assert.deepEqual(Object.keys(found).sort(), ["001-first", path.join(path.sep, "nested", "002-next")].sort());
  for (const migration of Object.values(found)) assert.equal(typeof migration.up, "function");
  console.log(`Installed archive verified on ${process.version}.`);
} else {
  throw new Error("Expected prepare or check");
}
