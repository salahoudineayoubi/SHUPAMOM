import { Schema, model, Types, type InferSchemaType } from "mongoose";
import { EXERCISE_TYPES, GOALS, LEVELS, PHRASE_STATUSES, SCRIPTS } from "@shupamom/shared";

/**
 * Data model — see docs/ARCHITECTURE.md §3.
 * A phrase is shown to learners as reference content only when status === "validated".
 */
const id = Schema.Types.ObjectId;

// ── Linguistic content ───────────────────────────────────────────────────────
const LanguageSchema = new Schema(
  {
    code: { type: String, required: true, unique: true }, // ISO 639-3 (bax) / 639-1 (fr)
    name: { type: String, required: true },
    scripts: [{ type: String, enum: SCRIPTS }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const PhraseSchema = new Schema(
  {
    languageCode: { type: String, required: true, index: true },
    text: { type: String, required: true },
    script: { type: String, enum: SCRIPTS, default: "latin" },
    normalized: { type: String, required: true },
    context: { type: String, default: null },
    register: { type: String, enum: ["respect", "familier", "neutre"], default: "neutre" },
    dialectNote: { type: String, default: null },
    status: { type: String, enum: PHRASE_STATUSES, required: true, index: true },
    audioIds: [{ type: id, ref: "AudioRecording" }],
    tags: [String],
    /** Origin of the phrase, e.g. "iadh-bamun-french-v1" or "shupamom-validators". */
    source: { type: String, default: null, index: true },
    /** Stable key used by the content importer (idempotent re-imports). */
    contentKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);
PhraseSchema.index({ languageCode: 1, normalized: 1 });

const TranslationSchema = new Schema(
  {
    sourcePhraseId: { type: id, ref: "Phrase", required: true, index: true },
    targetPhraseId: { type: id, ref: "Phrase", required: true, index: true },
    literalGloss: { type: String, default: null },
    usageNote: { type: String, default: null },
    status: { type: String, enum: PHRASE_STATUSES, required: true },
  },
  { timestamps: true }
);

const SpeakerSchema = new Schema(
  {
    pseudonym: { type: String, required: true, unique: true }, // never a real name
    ageBand: { type: String, enum: ["18-29", "30-49", "50-69", "70+"], required: true },
    gender: { type: String, default: null },
    region: { type: String, default: null },
    consentId: { type: id, ref: "Consent", required: true },
  },
  { timestamps: true }
);

const AudioRecordingSchema = new Schema(
  {
    phraseId: { type: id, ref: "Phrase", required: true, index: true },
    speakerId: { type: id, ref: "Speaker", required: true },
    storageKey: { type: String, required: true },
    durationMs: { type: Number, default: null },
    format: { type: String, default: "audio/mpeg" },
    consentId: { type: id, ref: "Consent", required: true },
    status: { type: String, enum: PHRASE_STATUSES, required: true },
  },
  { timestamps: true }
);

const LinguisticValidationSchema = new Schema(
  {
    targetType: { type: String, enum: ["phrase", "translation", "audio"], required: true },
    targetId: { type: id, required: true, index: true },
    validatorId: { type: id, ref: "User", required: true },
    decision: { type: String, enum: ["approved", "changes_requested", "rejected"], required: true },
    comment: { type: String, default: null },
  },
  { timestamps: true }
);

const ConsentSchema = new Schema(
  {
    subjectType: { type: String, enum: ["speaker", "user"], required: true },
    subjectRef: { type: String, required: true },
    scopes: [{ type: String, enum: ["publish_audio", "train_models", "research", "feedback"] }],
    version: { type: String, required: true },
    givenAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// ── Pedagogy ─────────────────────────────────────────────────────────────────
const LearningPathSchema = new Schema(
  {
    languageCode: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    goal: { type: String, required: true },
    lessonIds: [{ type: id, ref: "Lesson" }],
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const LessonSchema = new Schema(
  {
    pathId: { type: id, ref: "LearningPath", required: true, index: true },
    title: { type: String, required: true },
    objective: { type: String, required: true },
    phraseIds: [{ type: id, ref: "Phrase" }],
    exerciseIds: [{ type: id, ref: "Exercise" }],
    order: { type: Number, default: 0 },
    estimatedMinutes: { type: Number, default: 3 },
  },
  { timestamps: true }
);

const ExerciseSchema = new Schema(
  {
    lessonId: { type: id, ref: "Lesson", required: true, index: true },
    type: { type: String, enum: EXERCISE_TYPES, required: true },
    prompt: { type: String, required: true },
    /** Phrase the exercise is about (e.g. the French prompt's Bamoun counterpart). */
    phraseId: { type: id, ref: "Phrase", default: null },
    /** Options reference phrases; label is resolved at read time. */
    optionPhraseIds: [{ type: id, ref: "Phrase" }],
    answerPhraseId: { type: id, ref: "Phrase", required: true },
    difficulty: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// ── Users & progress ─────────────────────────────────────────────────────────
const UserSchema = new Schema(
  {
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: null },
    /** Google account id (`sub` claim) — set on first Google sign-in. */
    googleSub: { type: String, unique: true, sparse: true },
    avatarUrl: { type: String, default: null },
    displayName: { type: String, required: true },
    isGuest: { type: Boolean, default: false },
    nativeLanguage: { type: String, default: "fr" },
    learningLanguage: { type: String, default: "bax" },
    level: { type: String, enum: [...LEVELS, null], default: null },
    goal: { type: String, enum: [...GOALS, null], default: null },
    roles: { type: [String], default: ["learner"] },
  },
  { timestamps: true }
);

/** Refresh tokens are stored hashed; a family is revoked when a used token is replayed. */
const RefreshTokenSchema = new Schema(
  {
    userId: { type: id, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const UserProgressSchema = new Schema(
  {
    userId: { type: id, ref: "User", required: true },
    lessonId: { type: id, ref: "Lesson", required: true },
    attempts: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);
UserProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

/** SM-2 spaced repetition item. */
const ReviewItemSchema = new Schema(
  {
    userId: { type: id, ref: "User", required: true },
    phraseId: { type: id, ref: "Phrase", required: true },
    ease: { type: Number, default: 2.5 },
    intervalDays: { type: Number, default: 0 },
    repetitions: { type: Number, default: 0 },
    dueAt: { type: Date, required: true },
  },
  { timestamps: true }
);
ReviewItemSchema.index({ userId: 1, phraseId: 1 }, { unique: true });
ReviewItemSchema.index({ userId: 1, dueAt: 1 });

const FeedbackSchema = new Schema(
  {
    userId: { type: id, ref: "User", default: null },
    targetType: { type: String, enum: ["phrase", "translation", "audio", "app"], required: true },
    targetId: { type: id, default: null },
    kind: { type: String, enum: ["bug", "translation_doubt", "suggestion"], required: true },
    message: { type: String, required: true, maxlength: 2000 },
  },
  { timestamps: true }
);

export const Language = model("Language", LanguageSchema);
export const Phrase = model("Phrase", PhraseSchema);
export const Translation = model("Translation", TranslationSchema);
export const Speaker = model("Speaker", SpeakerSchema);
export const AudioRecording = model("AudioRecording", AudioRecordingSchema);
export const LinguisticValidation = model("LinguisticValidation", LinguisticValidationSchema);
export const Consent = model("Consent", ConsentSchema);
export const LearningPath = model("LearningPath", LearningPathSchema);
export const Lesson = model("Lesson", LessonSchema);
export const Exercise = model("Exercise", ExerciseSchema);
export const User = model("User", UserSchema);
export const RefreshToken = model("RefreshToken", RefreshTokenSchema);
export const UserProgress = model("UserProgress", UserProgressSchema);
export const ReviewItem = model("ReviewItem", ReviewItemSchema);
export const Feedback = model("Feedback", FeedbackSchema);

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: Types.ObjectId };
export type PhraseDoc = InferSchemaType<typeof PhraseSchema> & { _id: Types.ObjectId };
