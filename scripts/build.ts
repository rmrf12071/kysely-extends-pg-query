// stash changes
let command = new Deno.Command("git", { args: ["stash", "-u"] });
await command.output();

// update "import" of index.ts
const filePath = "./src/index.ts";
const decorder = new TextDecoder("utf-8");
const content = decorder.decode(await Deno.readFile(filePath));
const encoder = new TextEncoder();
const data = encoder.encode(
  content.split("\n").map((line) =>
    line.replace(/from "([^"]*)\.ts"/, `from "$1.js"`)
  ).join("\n"),
);
await Deno.writeFile(filePath, data);

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

// pop stash
command = new Deno.Command("git", { args: ["checkout", "."] });
await command.output();
command = new Deno.Command("git", { args: ["stash", "pop"] });
await command.output();
