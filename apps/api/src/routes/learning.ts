import { Router } from "express";
import { Types } from "mongoose";
import {
  AttemptInput,
  DictionaryQuery,
  MePatch,
  normalizeForSearch,
  type AttemptResult,
  type DictionaryResult,
  type ExerciseDto,
  type LessonDetail,
  type PathDetail,
  type PathSummary,
} from "@shupamom/shared";
import type { Config } from "../config";
import { Exercise, LearningPath, Lesson, Phrase, ReviewItem, Translation, User, UserProgress, type UserDoc } from "../models";
import { requireAuth, type AuthedRequest } from "../lib/auth";
import { asyncHandler, notFound, parse } from "../lib/http";
import { sm2 } from "../lib/srs";
import { phraseDtos, visibleStatuses, type AudioStorage } from "../services/content";
import { toMe } from "./auth";

const PASS_SCORE = 70;

export function learningRouter(config: Config, storage: AudioStorage) {
  const r = Router();
  const auth = requireAuth(config);
  const uid = (req: unknown) => new Types.ObjectId((req as AuthedRequest).userId);

  // ── Me / onboarding ────────────────────────────────────────────────────────
  r.get(
    "/me",
    auth,
    asyncHandler(async (req, res) => {
      const user = await User.findById(uid(req)).lean<UserDoc>();
      if (!user) throw notFound("Utilisateur");
      res.json(toMe(user));
    })
  );

  r.patch(
    "/me",
    auth,
    asyncHandler(async (req, res) => {
      const patch = parse(MePatch, req.body);
      const user = await User.findByIdAndUpdate(uid(req), { $set: patch }, { new: true }).lean<UserDoc>();
      if (!user) throw notFound("Utilisateur");
      res.json(toMe(user));
    })
  );

  // ── Paths ──────────────────────────────────────────────────────────────────
  async function completedLessonIds(userId: Types.ObjectId) {
    const done = await UserProgress.find({ userId, completedAt: { $ne: null } }).select("lessonId bestScore").lean();
    return new Map(done.map((d) => [String(d.lessonId), d.bestScore]));
  }

  r.get(
    "/paths",
    auth,
    asyncHandler(async (req, res) => {
      const lang = typeof req.query.lang === "string" ? req.query.lang : "bax";
      const paths = await LearningPath.find({ languageCode: lang }).sort({ order: 1 }).lean();
      const done = await completedLessonIds(uid(req));
      const out: PathSummary[] = paths.map((p) => ({
        slug: p.slug,
        title: p.title,
        goal: p.goal,
        languageCode: p.languageCode,
        lessonCount: p.lessonIds.length,
        completedCount: p.lessonIds.filter((l) => done.has(String(l))).length,
      }));
      res.json(out);
    })
  );

  r.get(
    "/paths/:slug",
    auth,
    asyncHandler(async (req, res) => {
      const path = await LearningPath.findOne({ slug: req.params.slug }).lean();
      if (!path) throw notFound("Parcours");
      const lessons = await Lesson.find({ _id: { $in: path.lessonIds } }).sort({ order: 1 }).lean();
      const progress = await UserProgress.find({ userId: uid(req), lessonId: { $in: path.lessonIds } }).lean();
      const out: PathDetail = {
        slug: path.slug,
        title: path.title,
        goal: path.goal,
        languageCode: path.languageCode,
        lessonCount: lessons.length,
        completedCount: progress.filter((p) => p.completedAt).length,
        lessons: lessons.map((l) => {
          const pr = progress.find((p) => String(p.lessonId) === String(l._id));
          return {
            id: String(l._id),
            title: l.title,
            objective: l.objective,
            order: l.order,
            estimatedMinutes: l.estimatedMinutes,
            completed: Boolean(pr?.completedAt),
            bestScore: pr ? pr.bestScore : null,
          };
        }),
      };
      res.json(out);
    })
  );

  // ── Lessons ────────────────────────────────────────────────────────────────
  r.get(
    "/lessons/:id",
    auth,
    asyncHandler(async (req, res) => {
      if (!Types.ObjectId.isValid(req.params.id)) throw notFound("Leçon");
      const lesson = await Lesson.findById(req.params.id).lean();
      if (!lesson) throw notFound("Leçon");
      const path = await LearningPath.findById(lesson.pathId).lean();
      const phrases = await phraseDtos(config, storage, lesson.phraseIds);
      const visible = new Map(phrases.map((p) => [p.id, p]));
      const exercises = await Exercise.find({ _id: { $in: lesson.exerciseIds } }).lean();

      // Option labels: the Bamoun text of each option phrase. An exercise whose answer
      // or options are not visible (e.g. not validated in production) is dropped.
      const optionIds = exercises.flatMap((e) => e.optionPhraseIds);
      const optionDtos = await phraseDtos(config, storage, optionIds);
      const optById = new Map(optionDtos.map((p) => [p.id, p]));
      const exDtos: ExerciseDto[] = exercises
        .filter((e) => optById.has(String(e.answerPhraseId)) && e.optionPhraseIds.every((o) => optById.has(String(o))))
        .map((e) => ({
          id: String(e._id),
          type: e.type as ExerciseDto["type"],
          prompt: e.prompt,
          phraseId: e.phraseId ? String(e.phraseId) : null,
          options: e.optionPhraseIds.map((o) => {
            const p = optById.get(String(o))!;
            return { id: p.id, label: p.text, audioUrl: p.audioUrl };
          }),
          isPlaceholder: e.optionPhraseIds.some((o) => optById.get(String(o))!.isPlaceholder),
        }));

      const out: LessonDetail = {
        id: String(lesson._id),
        pathSlug: path?.slug ?? "",
        title: lesson.title,
        objective: lesson.objective,
        phrases: lesson.phraseIds.map((p) => visible.get(String(p))).filter((p): p is NonNullable<typeof p> => Boolean(p)),
        exercises: exDtos,
        containsPlaceholder: phrases.some((p) => p.isPlaceholder) || exDtos.some((e) => e.isPlaceholder),
      };
      res.json(out);
    })
  );

  /** Scoring is server-side: the client never receives the answers before submitting. */
  r.post(
    "/lessons/:id/attempts",
    auth,
    asyncHandler(async (req, res) => {
      if (!Types.ObjectId.isValid(req.params.id)) throw notFound("Leçon");
      const lesson = await Lesson.findById(req.params.id).lean();
      if (!lesson) throw notFound("Leçon");
      const input = parse(AttemptInput, req.body);
      const exercises = await Exercise.find({ _id: { $in: lesson.exerciseIds } }).lean();
      const byId = new Map(exercises.map((e) => [String(e._id), e]));

      const results = input.answers
        .filter((a) => byId.has(a.exerciseId))
        .map((a) => {
          const ex = byId.get(a.exerciseId)!;
          return { exerciseId: a.exerciseId, correct: String(ex.answerPhraseId) === a.optionId, correctOptionId: String(ex.answerPhraseId), phraseId: ex.answerPhraseId };
        });
      const total = exercises.length || 1;
      const correct = results.filter((x) => x.correct).length;
      const score = Math.round((correct / total) * 100);
      const passed = score >= PASS_SCORE && results.length === exercises.length;

      const userId = uid(req);
      const prev = await UserProgress.findOne({ userId, lessonId: lesson._id }).lean();
      await UserProgress.updateOne(
        { userId, lessonId: lesson._id },
        {
          $inc: { attempts: 1 },
          $max: { bestScore: score },
          ...(passed && !prev?.completedAt ? { $set: { completedAt: new Date() } } : {}),
        },
        { upsert: true }
      );

      // Spaced repetition: each answered phrase is (re)scheduled.
      for (const r0 of results) {
        const item = await ReviewItem.findOne({ userId, phraseId: r0.phraseId }).lean();
        const next = sm2(item ?? { ease: 2.5, intervalDays: 0, repetitions: 0 }, r0.correct ? 4 : 1);
        await ReviewItem.updateOne(
          { userId, phraseId: r0.phraseId },
          { $set: { ease: next.ease, intervalDays: next.intervalDays, repetitions: next.repetitions, dueAt: new Date(Date.now() + next.dueInDays * 86400_000) } },
          { upsert: true }
        );
      }

      const path = await LearningPath.findById(lesson.pathId).lean();
      const doneCount = path ? await UserProgress.countDocuments({ userId, lessonId: { $in: path.lessonIds }, completedAt: { $ne: null } }) : 0;
      const out: AttemptResult = {
        score,
        correct,
        total: exercises.length,
        results: results.map(({ phraseId: _p, ...rest }) => rest),
        lessonCompleted: Boolean(passed || prev?.completedAt),
        pathProgress: { completed: doneCount, total: path?.lessonIds.length ?? 0 },
      };
      res.json(out);
    })
  );

  // ── Dictionary (validated expressions only — no free translation) ──────────
  r.get(
    "/dictionary",
    auth,
    asyncHandler(async (req, res) => {
      const q = parse(DictionaryQuery, req.query);
      const needle = normalizeForSearch(q.q);
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const statuses = visibleStatuses(config);
      // Search the French side, then map to the Bamoun phrases it translates.
      const french = await Phrase.find({ languageCode: q.from, normalized: { $regex: escaped }, status: { $in: statuses } }).limit(20).lean();
      const trs = await Translation.find({ targetPhraseId: { $in: french.map((f) => f._id) }, status: { $in: statuses } }).lean();
      const results = await phraseDtos(config, storage, trs.map((t) => t.sourcePhraseId));
      const out: DictionaryResult = { query: q.q, results: results.filter((p) => p.languageCode === q.to) };
      res.json(out);
    })
  );

  return r;
}
