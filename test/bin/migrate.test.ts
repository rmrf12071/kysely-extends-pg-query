import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";
import PgPool from "pg-pool";

const execute = promisify(execFile);
const root = process.cwd();

test("migration CLI releases connections and exits naturally", async (t) => {
  const folder = await fs.mkdtemp(path.join(tmpdir(), "kysely-cli-"));
  const admin = new PgPool({ host: "127.0.0.1", user: "postgres", database: "postgres" });
  const databases: string[] = [];
  t.after(async () => {
    try {
      for (const database of databases) await admin.query(`drop database if exists "${database}" with (force)`);
    } finally {
      await admin.end();
      await fs.rm(folder, { recursive: true, force: true });
    }
  });
  // Record completed pool shutdowns in the child, including error paths.
  // Requiring the source through esbuild-register exercises the same CJS loader as the build.
  const bootstrap = `
    const { createRequire } = require("node:module");
    const requireFromRepo = createRequire(${JSON.stringify(path.join(root, "package.json"))});
    requireFromRepo("esbuild-register/dist/node").register();
    const PgPool = requireFromRepo("pg-pool");
    const openPools = new Set();
    const query = PgPool.prototype.query;
    PgPool.prototype.query = function (...args) {
      openPools.add(this);
      return query.apply(this, args);
    };
    const end = PgPool.prototype.end;
    PgPool.prototype.end = async function () {
      await end.call(this);
      openPools.delete(this);
      require("node:fs").appendFileSync(process.env.CLI_END_MARKER, "ended\\n");
    };
    process.on("beforeExit", () => {
      if (openPools.size > 0) {
        console.error("Database pools were not closed");
        process.exitCode = 2;
      }
    });
    requireFromRepo(${JSON.stringify(path.join(root, "bin/node.ts"))});
  `;
  async function fixture(migration: string) {
    const database = `kysely_cli_${process.pid}_${databases.length}`;
    await admin.query(`create database "${database}"`);
    databases.push(database);
    const directory = path.join(folder, database);
    const migrations = path.join(directory, "migrations");
    await fs.mkdir(migrations, { recursive: true });
    await fs.writeFile(path.join(migrations, "001-test.ts"), migration);
    const config = path.join(directory, "config.ts");
    await fs.writeFile(config, `export default ${JSON.stringify({
      database, host: "127.0.0.1", owner: { user: "postgres", password: "unused" }, migrate: migrations,
    })};\n`);
    return { database, directory, config, migrations };
  }
  async function run(config: string, directory: string, mode = "migrate-latest", dry = false) {
    const marker = path.join(directory, "ended.txt");
    await fs.rm(marker, { force: true });
    const args = ["-e", bootstrap, "--", "--mode", mode, "--config", config];
    if (dry) args.push("--dry");
    let code = 0;
    let stdout = "";
    let stderr = "";
    try {
      ({ stdout, stderr } = await execute(process.execPath, args, {
        cwd: root, env: { ...process.env, CLI_END_MARKER: marker }, timeout: 15_000,
      }));
    } catch (error) {
      const failure = error as Error & { code: number | string; killed: boolean; stdout: string; stderr: string };
      assert.equal(failure.killed, false, "CLI must finish without timing out");
      assert.equal(typeof failure.code, "number", failure.message);
      code = Number(failure.code);
      stdout = failure.stdout;
      stderr = failure.stderr;
    }
    const ended = await fs.readFile(marker, "utf8").catch(() => "");
    assert.match(ended, /^(ended\n)+$/, `pool shutdown must complete before exit: ${stderr}`);
    return { code, stdout, stderr };
  }
  const migration = `
    export async function up(db: any) { await db.schema.createTable("cli_test").addColumn("id", "integer").execute(); }
    export async function down(db: any) { await db.schema.dropTable("cli_test").execute(); }
  `;
  await t.test("latest, already latest, and down", async () => {
    const f = await fixture(migration);
    const latest = await run(f.config, f.directory);
    assert.equal(latest.code, 0, latest.stderr);
    assert.match(latest.stdout, /executed successfully/);
    const again = await run(f.config, f.directory);
    assert.equal(again.code, 0, again.stderr);
    assert.match(again.stdout, /already latest/);
    const down = await run(f.config, f.directory, "migrate-down");
    assert.equal(down.code, 0, down.stderr);
    assert.match(down.stdout, /executed successfully/);
  });
  await t.test("dry output is complete and target tables are not created", async () => {
    const f = await fixture(`export async function up(db: any) {
      for (let i = 0; i < 300; i++) await db.schema.createTable("dry_table_" + i).addColumn("id", "integer").execute();
    }`);
    const result = await run(f.config, f.directory, "migrate-latest", true);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /create table "dry_table_299"/);
    const pool = new PgPool({ host: "127.0.0.1", user: "postgres", database: f.database });
    try {
      const { rows } = await pool.query("select to_regclass('dry_table_299') as name");
      assert.equal(rows[0].name, null);
    } finally {
      await pool.end();
    }
  });
  await t.test("migration errors roll back and return code 1 in normal and dry mode", async () => {
    for (const dry of [false, true]) {
      const f = await fixture(migration.replace('.addColumn("id", "integer").execute();', '.addColumn("id", "integer").execute(); throw new Error("migration failed deliberately");'));
      const result = await run(f.config, f.directory, "migrate-latest", dry);
      assert.equal(result.code, 1);
      assert.match(result.stderr, /migration failed deliberately/);
      const pool = new PgPool({ host: "127.0.0.1", user: "postgres", database: f.database });
      try {
        const { rows } = await pool.query("select to_regclass('cli_test') as name");
        assert.equal(rows[0].name, null);
      } finally {
        await pool.end();
      }
    }
  });
  await t.test("dry file output succeeds and write errors release connections", async () => {
    const f = await fixture(migration);
    const output = path.join(f.directory, "dry.sql");
    const original = await fs.readFile(f.config, "utf8");
    await fs.writeFile(f.config, original.replace("export default", `const config =`).replace(/;\s*$/, `; export default { ...config, dryMigrateOutput: ${JSON.stringify(output)} };`));
    const success = await run(f.config, f.directory, "migrate-latest", true);
    assert.equal(success.code, 0, success.stderr);
    assert.match(await fs.readFile(output, "utf8"), /create table "cli_test".*\n$/);
    await fs.rm(output);
    await fs.mkdir(output);
    const failure = await run(f.config, f.directory, "migrate-latest", true);
    assert.equal(failure.code, 1);
    assert.match(failure.stderr, /EISDIR/);
  });
});
