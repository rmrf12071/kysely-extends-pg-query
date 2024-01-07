import process from "node:process";

export function getPath(parts: string) {
  return parts.startsWith("/") || parts.match(/^[^:]:\/\//)
    ? parts
    : `${process.cwd().replace(/\\/g, "/")}/${parts}`;
}
