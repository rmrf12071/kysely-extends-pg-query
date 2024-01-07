#!/usr/bin/env node
import process from "node:process";
import { parseArgs } from "node:util";
import { migrate, migrateInit } from "./node/migrate.ts";
import parseConfig from "./node/parseConfig.ts";
import {
  MODE,
  MODE_MIGRATE_DOWN,
  MODE_MIGRATE_INIT,
  MODE_MIGRATE_LATEST,
} from "./node/consts.ts";

async function main() {
  // parse command arguments
  const { values: args } = parseArgs({
    options: {
      mode: { type: "string" },
      config: { type: "string" },
    },
  });
  // check arguments and the mode
  if (
    !args.mode || !args.config ||
    !(MODE as ReadonlyArray<string>).includes(args.mode)
  ) {
    usage();
  }

  // check and parse config file
  const config = parseConfig(args);

  // execute command
  switch (args.mode) {
    case MODE_MIGRATE_INIT:
      await migrateInit(config);
      break;
    case MODE_MIGRATE_LATEST:
      await migrate(config, "latest");
      break;
    case MODE_MIGRATE_DOWN:
      await migrate(config, "down");
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
