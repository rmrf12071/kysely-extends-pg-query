import { chmodSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = resolve(root, "tsconfig.json");
const config = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);

// Rewrite relative module specifiers in memory; leave source files untouched.
const host = ts.createCompilerHost(parsed.options);
const readFile = host.readFile.bind(host);
host.readFile = (fileName) => {
  const text = readFile(fileName);
  if (text === undefined || !fileName.endsWith(".ts") || fileName.endsWith(".d.ts")) {
    return text;
  }
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const edits: { start: number; end: number; text: string }[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!specifier || !ts.isStringLiteral(specifier)) continue;
    if (!specifier.text.startsWith(".") || !specifier.text.endsWith(".ts")) continue;
    edits.push({
      start: specifier.getStart(source) + 1,
      end: specifier.getEnd() - 1,
      text: specifier.text.slice(0, -3) + ".js",
    });
  }
  return edits.reverse().reduce(
    (result, edit) => result.slice(0, edit.start) + edit.text + result.slice(edit.end),
    text,
  );
};

const program = ts.createProgram(parsed.fileNames, {
  ...parsed.options,
  noEmitOnError: true,
}, host);
const diagnostics = [
  ...(config.error ? [config.error] : []),
  ...parsed.errors,
  ...ts.getPreEmitDiagnostics(program),
];

function report(errors: readonly ts.Diagnostic[]) {
  console.error(ts.formatDiagnosticsWithColorAndContext(errors, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => root,
    getNewLine: () => "\n",
  }));
  process.exitCode = 1;
}

if (diagnostics.length > 0) {
  report(diagnostics);
} else {
  rmSync(resolve(root, "dist"), { recursive: true, force: true });
  // CLI declarations are not part of the public API.
  const result = program.emit(undefined, (fileName, data) => {
    if (fileName.endsWith(".d.ts") && fileName.startsWith(resolve(root, "dist/bin") + sep)) return;
    host.writeFile(fileName, data, false);
  });
  if (result.emitSkipped || result.diagnostics.length > 0) {
    report(result.diagnostics);
  } else {
    writeFileSync(resolve(root, "dist/package.json"), '{"type":"commonjs"}\n');
    chmodSync(resolve(root, "dist/bin/node.js"), 0o755);
    console.log("Build completed.");
  }
}
