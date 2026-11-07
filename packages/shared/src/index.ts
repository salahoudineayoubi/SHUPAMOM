import { z } from "zod";

/**
 * SHUPAMOM — shared API contracts (single source of truth for the API and the app).
 *
 * LINGUISTIC RULE: no Bamoun text is ever invented. A phrase reaches learners as
 * reference content only when `status === "validated"` (checked by a competent
 * speaker). Demo/dev content carries `status: "placeholder"` and every DTO that can
 * expose it carries `isPlaceholder`, which the app MUST render with a visible banner.
 */

// ── Enums ────────────────────────────────────────────────────────────────────
export const PHRASE_STATUSES = ["placeholder", "draft", "in_review", "validated", "rejected"] as const;
export const PhraseStatus = z.enum(PHRASE_STATUSES);
export type PhraseStatus = z.infer<typeof PhraseStatus>;

export const SCRIPTS = ["latin", "bamum"] as const;
export const Script = z.enum(SCRIPTS);

export const GOALS = ["famille", "racines", "voyage", "courant"] as const;
export const Goal = z.enum(GOALS);
export type Goal = z.infer<typeof Goal>;

export const LEVELS = ["debutant", "quelques_mots", "intermediaire"] as const;
export const Level = z.enum(LEVELS);

export const EXERCISE_TYPES = ["mcq", "match", "fill_blank", "listen_choose", "dialogue_turn"] as const;
export const ExerciseType = z.enum(EXERCISE_TYPES);
export type ExerciseType = z.infer<typeof ExerciseType>;

/** ISO 639-3 code of Bamoun (shüpamom). */
export const BAMOUN = "bax";
export const FRENCH = "fr";

export const PLACEHOLDER_BANNER_FR = "Contenu de démonstration — expression bamoun non encore validée";

// ── Errors ───────────────────────────────────────────────────────────────────
export const ApiError = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
export type ApiError = z.infer<typeof ApiError>;

// ── Auth ─────────────────────────────────────────────────────────────────────
export const Email = z.string().trim().toLowerCase().email().max(254);
export const Password = z
  .string()
  .min(10, "Au moins 10 caractères")
  .max(128)
  .regex(/[A-Za-z]/, "Au moins une lettre")
  .regex(/[0-9]/, "Au moins un chiffre");

export const RegisterInput = z.object({
  email: Email,
  password: Password,
  displayName: z.string().trim().min(1).max(60),
});
export type RegisterInput = z.infer<typeof RegisterInput>;

export const LoginInput = z.object({ email: Email, password: z.string().min(1).max(128) });
export type LoginInput = z.infer<typeof LoginInput>;

/** Google Sign-In: the ID token from @react-native-google-signin (native) or Google Identity Services (web). */
export const GoogleAuthInput = z.object({ idToken: z.string().min(100).max(8192) });
export type GoogleAuthInput = z.infer<typeof GoogleAuthInput>;

/** Mobile sends the refresh token in the body; web relies on the httpOnly cookie. */
export const RefreshInput = z.object({ refreshToken: z.string().min(20).optional() });

export const AuthTokens = z.object({
  accessToken: z.string(),
  /** Only returned to native clients (web gets an httpOnly cookie). */
  refreshToken: z.string().optional(),
  expiresIn: z.number().int(),
});
export type AuthTokens = z.infer<typeof AuthTokens>;

// ── Me / onboarding ──────────────────────────────────────────────────────────
export const OnboardingInput = z.object({
  nativeLanguage: z.string().min(2).max(8).default(FRENCH),
  learningLanguage: z.string().min(2).max(8).default(BAMOUN),
  level: Level,
  goal: Goal,
});
export type OnboardingInput = z.infer<typeof OnboardingInput>;

export const MePatch = OnboardingInput.partial().extend({
  displayName: z.string().trim().min(1).max(60).optional(),
});

export const Me = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string().nullable(),
  isGuest: z.boolean(),
  nativeLanguage: z.string(),
  learningLanguage: z.string(),
  level: Level.nullable(),
  goal: Goal.nullable(),
  onboarded: z.boolean(),
  roles: z.array(z.string()),
});
export type Me = z.infer<typeof Me>;

export const AuthResponse = z.object({ user: Me, tokens: AuthTokens });
export type AuthResponse = z.infer<typeof AuthResponse>;

// ── Content ──────────────────────────────────────────────────────────────────
export const PhraseDto = z.object({
  id: z.string(),
  languageCode: z.string(),
  text: z.string(),
  script: Script,
  translation: z.string().nullable(),
  context: z.string().nullable(),
  usageNote: z.string().nullable(),
  audioUrl: z.string().nullable(),
  status: PhraseStatus,
  isPlaceholder: z.boolean(),
});
export type PhraseDto = z.infer<typeof PhraseDto>;

/** Exercise as sent to the learner — never includes the answer. */
export const ExerciseDto = z.object({
  id: z.string(),
  type: ExerciseType,
  prompt: z.string(),
  /** For mcq/listen_choose: the options (each references a phrase). */
  options: z.array(z.object({ id: z.string(), label: z.string(), audioUrl: z.string().nullable() })),
  phraseId: z.string().nullable(),
  isPlaceholder: z.boolean(),
});
export type ExerciseDto = z.infer<typeof ExerciseDto>;

export const LessonSummary = z.object({
  id: z.string(),
  title: z.string(),
  objective: z.string(),
  order: z.number().int(),
  estimatedMinutes: z.number().int(),
  completed: z.boolean(),
  bestScore: z.number().nullable(),
});
export type LessonSummary = z.infer<typeof LessonSummary>;

export const PathSummary = z.object({
  slug: z.string(),
  title: z.string(),
  goal: z.string(),
  languageCode: z.string(),
  lessonCount: z.number().int(),
  completedCount: z.number().int(),
});
export type PathSummary = z.infer<typeof PathSummary>;

export const PathDetail = PathSummary.extend({ lessons: z.array(LessonSummary) });
export type PathDetail = z.infer<typeof PathDetail>;

export const LessonDetail = z.object({
  id: z.string(),
  pathSlug: z.string(),
  title: z.string(),
  objective: z.string(),
  phrases: z.array(PhraseDto),
  exercises: z.array(ExerciseDto),
  containsPlaceholder: z.boolean(),
});
export type LessonDetail = z.infer<typeof LessonDetail>;

// ── Attempts ─────────────────────────────────────────────────────────────────
export const AttemptInput = z.object({
  answers: z.array(z.object({ exerciseId: z.string(), optionId: z.string() })).min(1).max(50),
});
export type AttemptInput = z.infer<typeof AttemptInput>;

export const AttemptResult = z.object({
  score: z.number().min(0).max(100),
  correct: z.number().int(),
  total: z.number().int(),
  results: z.array(z.object({ exerciseId: z.string(), correct: z.boolean(), correctOptionId: z.string() })),
  lessonCompleted: z.boolean(),
  pathProgress: z.object({ completed: z.number().int(), total: z.number().int() }),
});
export type AttemptResult = z.infer<typeof AttemptResult>;

// ── Dictionary ───────────────────────────────────────────────────────────────
export const DictionaryQuery = z.object({
  q: z.string().trim().min(1).max(80),
  from: z.string().default(FRENCH),
  to: z.string().default(BAMOUN),
});
export const DictionaryResult = z.object({ query: z.string(), results: z.array(PhraseDto) });
export type DictionaryResult = z.infer<typeof DictionaryResult>;

/** Lower-case, strip diacritics/punctuation — used for dictionary search on both sides. */
export function normalizeForSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
