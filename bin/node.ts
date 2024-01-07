#!/usr/bin/env node
import process from "node:process";
import { parseArgs } from "node:util";
import { migrateInit } from "./node/migrate.ts";
import parseConfig from "./node/parseConfig.ts";
import { MODE, MODE_MIGRATE_INIT } from "./node/consts.ts";

async function main() {
  const { values: args } = parseArgs({
    options: {
      mode: { type: "string" },
      config: { type: "string" },
    },
  });
  // check mode
  if (
    !args.mode || !args.config ||
    !(MODE as ReadonlyArray<string>).includes(args.mode)
  ) {
    usage();
  }

  // check and parse config file
  const config = parseConfig(args);

  switch (args.mode) {
    case MODE_MIGRATE_INIT:
      await migrateInit(config);
      break;
    default:
      usage();
  }
}

function usage(): never {
  console.log(
    `usage: ${process.argv[0]} ${process.argv[1]} --mode [${
      MODE.join("/")
    }] --config config.js`,
  );
  process.exit(0);
}

main();

export default {};
