import { normalizeForSearch, PHRASE_STATUSES, BAMOUN, FRENCH } from "@shupamom/shared";
import { z } from "zod";
import { Consent, Exercise, Language, LearningPath, Lesson, Phrase, Translation, AudioRecording, Speaker } from "./models";

/**
 * Content file format (content/bamoun/*.json) — filled by native-speaker validators.
 * See content/bamoun/README.md. Idempotent: re-importing updates by `key`.
 */
export const ContentFile = z.object({
  language: z.literal(BAMOUN),
  speakers: z
    .array(
      z.object({
        pseudonym: z.string().min(2),
        ageBand: z.enum(["18-29", "30-49", "50-69", "70+"]),
        region: z.string().optional(),
        consent: z.object({ version: z.string(), givenAt: z.string(), scopes: z.array(z.enum(["publish_audio", "train_models", "research", "feedback"])) }),
      })
    )
    .default([]),
  phrases: z.array(
    z.object({
      key: z.string().regex(/^[a-z0-9_.-]+$/),
      bamoun: z.string().min(1),
      french: z.string().min(1),
      status: z.enum(PHRASE_STATUSES),
      context: z.string().optional(),
      register: z.enum(["respect", "familier", "neutre"]).optional(),
      usageNote: z.string().optional(),
      audio: z.object({ file: z.string(), speaker: z.string() }).optional(),
    })
  ),
  paths: z.array(
    z.object({
      slug: z.string(),
      title: z.string(),
      goal: z.string(),
      order: z.number().int().default(0),
      lessons: z.array(
        z.object({
          key: z.string(),
          title: z.string(),
          objective: z.string(),
          estimatedMinutes: z.number().int().default(3),
          phrases: z.array(z.string()),
          exercises: z.array(
            z.object({
              type: z.literal("mcq"),
              prompt: z.string(),
              answer: z.string(),
              options: z.array(z.string()).min(2).max(6),
            })
          ),
        })
      ),
    })
  ),
});
export type ContentFile = z.infer<typeof ContentFile>;

export async function loadContent(raw: unknown) {
  const file = ContentFile.parse(raw);
  await Language.updateOne({ code: BAMOUN }, { $set: { code: BAMOUN, name: "Shüpamom (bamoun)", scripts: ["latin", "bamum"], active: true } }, { upsert: true });
  await Language.updateOne({ code: FRENCH }, { $set: { code: FRENCH, name: "Français", scripts: ["latin"], active: true } }, { upsert: true });

  const speakerIds = new Map<string, unknown>();
  for (const s of file.speakers) {
    const consent = await Consent.findOneAndUpdate(
      { subjectType: "speaker", subjectRef: s.pseudonym, version: s.consent.version },
      { $set: { scopes: s.consent.scopes, givenAt: new Date(s.consent.givenAt) } },
      { upsert: true, new: true }
    );
    const sp = await Speaker.findOneAndUpdate(
      { pseudonym: s.pseudonym },
      { $set: { ageBand: s.ageBand, region: s.region ?? null, consentId: consent._id } },
      { upsert: true, new: true }
    );
    speakerIds.set(s.pseudonym, { speakerId: sp._id, consentId: consent._id, canPublish: s.consent.scopes.includes("publish_audio") });
  }

  const phraseIds = new Map<string, unknown>();
  for (const p of file.phrases) {
    const bax = await Phrase.findOneAndUpdate(
      { contentKey: `${p.key}.bax` },
      { $set: { languageCode: BAMOUN, text: p.bamoun, normalized: normalizeForSearch(p.bamoun), status: p.status, context: p.context ?? null, register: p.register ?? "neutre" } },
      { upsert: true, new: true }
    );
    const fr = await Phrase.findOneAndUpdate(
      { contentKey: `${p.key}.fr` },
      { $set: { languageCode: FRENCH, text: p.french, normalized: normalizeForSearch(p.french), status: p.status, context: p.context ?? null } },
      { upsert: true, new: true }
    );
    await Translation.updateOne(
      { sourcePhraseId: bax._id, targetPhraseId: fr._id },
      { $set: { status: p.status, usageNote: p.usageNote ?? null } },
      { upsert: true }
    );
    if (p.audio) {
      const sp = speakerIds.get(p.audio.speaker) as { speakerId: unknown; consentId: unknown; canPublish: boolean } | undefined;
      if (!sp) throw new Error(`Phrase ${p.key}: unknown speaker ${p.audio.speaker}`);
      if (!sp.canPublish) throw new Error(`Phrase ${p.key}: speaker ${p.audio.speaker} has not consented to publish_audio`);
      const audio = await AudioRecording.findOneAndUpdate(
        { phraseId: bax._id, storageKey: p.audio.file },
        { $set: { speakerId: sp.speakerId, consentId: sp.consentId, status: p.status } },
        { upsert: true, new: true }
      );
      await Phrase.updateOne({ _id: bax._id }, { $addToSet: { audioIds: audio._id } });
    }
    phraseIds.set(p.key, bax._id);
  }

  const need = (key: string) => {
    const v = phraseIds.get(key);
    if (!v) throw new Error(`Unknown phrase key "${key}"`);
    return v;
  };

  for (const path of file.paths) {
    const lp = await LearningPath.findOneAndUpdate(
      { slug: path.slug },
      { $set: { languageCode: BAMOUN, title: path.title, goal: path.goal, order: path.order } },
      { upsert: true, new: true }
    );
    const lessonIds = [];
    for (const [i, l] of path.lessons.entries()) {
      const lesson = await Lesson.findOneAndUpdate(
        { pathId: lp._id, title: l.title },
        { $set: { objective: l.objective, order: i, estimatedMinutes: l.estimatedMinutes, phraseIds: l.phrases.map(need) } },
        { upsert: true, new: true }
      );
      await Exercise.deleteMany({ lessonId: lesson._id });
      const exIds = [];
      for (const e of l.exercises) {
        const ex = await Exercise.create({
          lessonId: lesson._id,
          type: e.type,
          prompt: e.prompt,
          phraseId: need(e.answer),
          answerPhraseId: need(e.answer),
          optionPhraseIds: e.options.map(need),
        });
        exIds.push(ex._id);
      }
      await Lesson.updateOne({ _id: lesson._id }, { $set: { exerciseIds: exIds } });
      lessonIds.push(lesson._id);
    }
    await LearningPath.updateOne({ _id: lp._id }, { $set: { lessonIds } });
  }
  return { phrases: file.phrases.length, paths: file.paths.length };
}
