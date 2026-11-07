import type { Types } from "mongoose";
import { type PhraseDto, type PhraseStatus } from "@shupamom/shared";
import type { Config } from "../config";
import { AudioRecording, Phrase, Translation } from "../models";

/**
 * Content gate — the single place deciding what learners may see.
 * Production: validated only. Development (explicit opt-in): placeholders too, flagged.
 */
export function visibleStatuses(config: Config): PhraseStatus[] {
  return config.SERVE_PLACEHOLDER_CONTENT && !config.isProd ? ["validated", "placeholder"] : ["validated"];
}

/** Audio storage abstraction: local static files in dev, S3-compatible later. */
export interface AudioStorage {
  urlFor(storageKey: string): string;
}
export class LocalAudioStorage implements AudioStorage {
  constructor(private baseUrl: string) {}
  urlFor(storageKey: string) {
    return `${this.baseUrl.replace(/\/$/, "")}/media/${encodeURIComponent(storageKey)}`;
  }
}

/** Builds learner-facing DTOs for Bamoun phrases, with their French translation and audio. */
export async function phraseDtos(config: Config, storage: AudioStorage, ids: Types.ObjectId[]): Promise<PhraseDto[]> {
  const statuses = visibleStatuses(config);
  const phrases = await Phrase.find({ _id: { $in: ids }, status: { $in: statuses } }).lean();
  const byId = new Map(phrases.map((p) => [String(p._id), p]));
  const translations = await Translation.find({ sourcePhraseId: { $in: phrases.map((p) => p._id) }, status: { $in: statuses } }).lean();
  const targets = await Phrase.find({ _id: { $in: translations.map((t) => t.targetPhraseId) } }).lean();
  const targetById = new Map(targets.map((p) => [String(p._id), p]));
  const audios = await AudioRecording.find({ phraseId: { $in: phrases.map((p) => p._id) }, status: { $in: statuses } }).lean();

  return ids
    .map((pid) => byId.get(String(pid)))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => {
      const tr = translations.find((t) => String(t.sourcePhraseId) === String(p._id));
      const target = tr ? targetById.get(String(tr.targetPhraseId)) : undefined;
      const audio = audios.find((a) => String(a.phraseId) === String(p._id));
      const isPlaceholder = p.status !== "validated" || (tr ? tr.status !== "validated" : false);
      return {
        id: String(p._id),
        languageCode: p.languageCode,
        text: p.text,
        script: (p.script as "latin" | "bamum") || "latin",
        translation: target?.text ?? null,
        context: p.context ?? null,
        usageNote: tr?.usageNote ?? null,
        audioUrl: audio ? storage.urlFor(audio.storageKey) : null,
        status: p.status as PhraseStatus,
        isPlaceholder,
      };
    });
}
