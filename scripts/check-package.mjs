import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
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
