import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { BAMOUN, FRENCH, normalizeForSearch } from "@shupamom/shared";
import { loadConfig } from "./config";
import { Phrase, Translation } from "./models";

/**
 * Imports a Bamoun–French parallel corpus (TSV: bamoun<TAB>french) into the dictionary.
 *   npm run import:corpus -w @shupamom/api -- <file.tsv> <source-id>
 * Phrases are tagged with `source`; idempotent (keyed by a hash of the pair).
 * Corpus content is produced by linguists → imported as `validated` (see docs/DATA_LICENSES.md).
 */
export function parseParallelTsv(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.split("\t").map((c) => c.trim()))
    .filter((cols) => cols.length >= 2 && cols[0] && cols[1])
    .map(([bax, fr]) => ({ bax: bax.normalize("NFC"), fr: fr.normalize("NFC") }));
}

export async function importParallel(rows: { bax: string; fr: string }[], source: string) {
  let n = 0;
  for (const r of rows) {
    const key = crypto.createHash("sha1").update(`${r.bax}\u0000${r.fr}`).digest("hex").slice(0, 16);
    const bax = await Phrase.findOneAndUpdate(
      { contentKey: `${source}.${key}.bax` },
      { $set: { languageCode: BAMOUN, text: r.bax, normalized: normalizeForSearch(r.bax), status: "validated", source, context: "corpus" } },
      { upsert: true, new: true }
    );
    const fr = await Phrase.findOneAndUpdate(
      { contentKey: `${source}.${key}.fr` },
      { $set: { languageCode: FRENCH, text: r.fr, normalized: normalizeForSearch(r.fr), status: "validated", source, context: "corpus" } },
      { upsert: true, new: true }
    );
    await Translation.updateOne({ sourcePhraseId: bax._id, targetPhraseId: fr._id }, { $set: { status: "validated" } }, { upsert: true });
    n++;
  }
  return n;
}

async function main() {
  const [file, source] = process.argv.slice(2);
  if (!file || !source) throw new Error("usage: import:corpus <file.tsv> <source-id>");
  const config = loadConfig();
  await mongoose.connect(config.MONGODB_URI);
  const rows = parseParallelTsv(fs.readFileSync(path.resolve(process.cwd(), file), "utf8"));
  const n = await importParallel(rows, source);
  console.log(`imported ${n} sentence pairs from ${path.basename(file)} as source=${source}`);
  await mongoose.disconnect();
}
if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
