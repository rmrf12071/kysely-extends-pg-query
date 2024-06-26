import process from "node:process";
import { register } from "esbuild-register/dist/node";
import { UtilConfig } from "../../src/index.ts";
import { MODE_MIGRATE_INIT } from "./consts.ts";
import { getPath } from "./utils.ts";

export default function parseConfig(
  args: { mode?: string; config?: string },
) {
  if (!args.config) throw new Error("invalid argument");
  const configPath = getPath(args.config);
  register({ sourcefile: configPath });
  try {
    const { default: content } = require(configPath);
    if (typeof content != "object" || !content) {
      throw new Error("invalid config format");
    }
    if (!content.database || typeof content.database != "string") {
      throw new Error("invalid config format: database");
    }
    if (content.host && typeof content.host != "string") {
      throw new Error("invalid config format: host");
    }
    if (content.port && typeof content.port != "number") {
      throw new Error("invalid config format: host");
    }
    if (typeof content.owner != "object") {
      throw new Error("invalid config format: owner");
    }
    if (!content.owner.user || typeof content.owner.user != "string") {
      throw new Error("invalid config format: owner.user");
    }
    if (
      !content.owner.password || typeof content.owner.password != "string"
    ) {
      throw new Error("invalid config format: owner.password");
    }
    if (!content.migrate || typeof content.migrate !== "string") {
      throw new Error("invalid config format: migrate");
    }
    if (content.superUser) {
      if (typeof content.superUser != "object") {
        throw new Error("invalid config format: superUser");
      }
      if (
        !content.superUser.user || typeof content.superUser.user != "string"
      ) {
        throw new Error("invalid config format: superUser.user");
      }
      if (
        !content.superUser.password ||
        typeof content.superUser.password != "string"
      ) {
        throw new Error("invalid config format: superUser.password");
      }
      if (
        !content.superUser.database ||
        typeof content.superUser.database != "string"
      ) {
        throw new Error("invalid config format: superUser.database");
      }
    } else if (args.mode == MODE_MIGRATE_INIT) {
      throw new Error("invalid config format: superUser(required)");
    }
    return content as UtilConfig;
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
