import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { loadConfig } from "./config";
import { loadContent } from "./content_loader";

/** npm run import:content -- <file.json> */
async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("usage: import:content <content-file.json>");
  const config = loadConfig();
  await mongoose.connect(config.MONGODB_URI);
  const abs = path.resolve(process.cwd(), file);
  const res = await loadContent(JSON.parse(fs.readFileSync(abs, "utf8")));
  console.log(`imported ${res.phrases} phrases, ${res.paths} paths from ${path.basename(abs)}`);
  await mongoose.disconnect();
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
