import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { loadConfig } from "./config";
import { loadContent } from "./content_loader";

/** Development seed: the placeholder demo path « Parler à ma grand-mère ». Refuses to run in production. */
async function main() {
  const config = loadConfig();
  if (config.isProd) throw new Error("seed is development-only (placeholder content must never reach production)");
  await mongoose.connect(config.MONGODB_URI);
  const file = path.resolve(__dirname, "../../../content/bamoun/demo_placeholder.json");
  const res = await loadContent(JSON.parse(fs.readFileSync(file, "utf8")));
  console.log(`seeded ${res.phrases} placeholder phrases, ${res.paths} path(s)`);
  await mongoose.disconnect();
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
