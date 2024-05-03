// stash changes
let command = new Deno.Command("git", { args: ["stash", "-u"] });
await command.output();

// update "import" to transplie
async function updateImport(filePath: string) {
  const decorder = new TextDecoder("utf-8");
  const content = decorder.decode(await Deno.readFile(filePath));
  const encoder = new TextEncoder();
  const data = encoder.encode(
    content.split("\n").map((line) =>
      line.replace(/from "([^"]*)\.ts"/, `from "$1.js"`)
    ).join("\n"),
  );
  await Deno.writeFile(filePath, data);
}
await updateImport("./bin/node.ts");
await updateImport("./bin/node/migrate.ts");
await updateImport("./bin/node/parseConfig.ts");
await updateImport("./src/index.ts");
await updateImport("./src/utils/executePagination.ts");

// transpile to javascript
await Deno.remove("./dist", { recursive: true });
const tsc = Deno.build.os == "windows"
  ? ".\\node_modules\\.bin\\tsc.cmd"
  : "./node_modules/.bin/tsc";
command = new Deno.Command(tsc);
const { code, stdout, stderr } = await command.output();
console.log(code == 0 ? "success to transpile!" : "failed to transpile!!\n");
console.log(new TextDecoder().decode(stdout));
console.log(new TextDecoder().decode(stderr));

// remove type files from bin
await Deno.remove("./dist/bin/node.d.ts");
for await (const entry of Deno.readDir("./dist/bin/node")) {
  if (!entry.name.endsWith("d.ts")) continue;
  await Deno.remove(`./dist/bin/node/${entry.name}`);
}

// pop stash
command = new Deno.Command("git", { args: ["checkout", "."] });
await command.output();
command = new Deno.Command("git", { args: ["stash", "pop"] });
await command.output();
