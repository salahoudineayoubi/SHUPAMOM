import "dotenv/config";
import { z } from "zod";

/** Validated configuration. The process refuses to start with an unsafe config. */
const Env = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().default(4000),
    MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/shupamom"),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    CORS_ORIGINS: z.string().default(""),
    PUBLIC_BASE_URL: z.string().url().default("http://localhost:4000"),
    GOOGLE_WEB_CLIENT_ID: z.string().optional().default(""),
    GOOGLE_ANDROID_CLIENT_ID: z.string().optional().default(""),
    GOOGLE_IOS_CLIENT_ID: z.string().optional().default(""),
    SERVE_PLACEHOLDER_CONTENT: z
      .string()
      .optional()
      .transform((v) => v === "true"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && env.SERVE_PLACEHOLDER_CONTENT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SERVE_PLACEHOLDER_CONTENT must be false in production (non-validated Bamoun must never reach learners).",
      });
    }
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Access and refresh secrets must differ." });
    }
  });

export type Config = z.infer<typeof Env> & { corsOrigins: string[]; isProd: boolean; googleAudiences: string[] };

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid configuration:\n${parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  const env = parsed.data;
  return {
    ...env,
    corsOrigins: env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean),
    isProd: env.NODE_ENV === "production",
    googleAudiences: [env.GOOGLE_WEB_CLIENT_ID, env.GOOGLE_ANDROID_CLIENT_ID, env.GOOGLE_IOS_CLIENT_ID].filter(Boolean),
  };
}
