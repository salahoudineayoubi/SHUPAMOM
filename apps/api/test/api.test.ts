import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { loadConfig, type Config } from "../src/config";
import { createApp } from "../src/app";
import { loadContent } from "../src/content_loader";
import { importParallel, parseParallelTsv } from "../src/import_corpus";
import { HttpError } from "../src/lib/http";
import { sm2 } from "../src/lib/srs";
import type { GoogleVerifier } from "../src/lib/google";
import { Exercise } from "../src/models";

const DEMO = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../content/bamoun/demo_placeholder.json"), "utf8"));

const baseEnv = {
  NODE_ENV: "test",
  MONGODB_URI: "unused",
  JWT_ACCESS_SECRET: "a".repeat(40),
  JWT_REFRESH_SECRET: "b".repeat(40),
  CORS_ORIGINS: "http://localhost:8081",
  PUBLIC_BASE_URL: "http://localhost:4000",
  SERVE_PLACEHOLDER_CONTENT: "true",
};

/** Fake Google verifier: "good-<email>" tokens are valid; mirrors the real error codes. */
const fakeGoogle: GoogleVerifier = async (token) => {
  if (token.startsWith("unverified")) throw new HttpError(401, "EMAIL_NOT_VERIFIED", "E-mail Google non vérifié");
  const m = /^good-([^:]+):/.exec(token);
  if (!m) throw new HttpError(401, "INVALID_ID_TOKEN", "Jeton Google invalide");
  return { sub: `sub-${m[1]}`, email: m[1], name: "Awa Njoya", picture: null };
};
const gtoken = (email: string) => `good-${email}:`.padEnd(120, "x");

let mongo: MongoMemoryServer;
let config: Config;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  config = loadConfig(baseEnv as NodeJS.ProcessEnv);
  app = createApp(config, { verifyGoogle: fakeGoogle });
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
  await loadContent(DEMO);
});

const native = { "x-client": "native" };
async function guest() {
  const res = await request(app).post("/v1/auth/guest").set(native).expect(201);
  return res.body as { user: { id: string }; tokens: { accessToken: string; refreshToken: string } };
}

describe("config", () => {
  it("refuses to start in production with placeholder content enabled", () => {
    expect(() => loadConfig({ ...baseEnv, NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(/SERVE_PLACEHOLDER_CONTENT/);
  });
  it("requires distinct secrets", () => {
    expect(() => loadConfig({ ...baseEnv, JWT_REFRESH_SECRET: baseEnv.JWT_ACCESS_SECRET } as NodeJS.ProcessEnv)).toThrow(/differ/);
  });
});

describe("auth", () => {
  it("registers, logs in, and rejects bad credentials with a generic error", async () => {
    await request(app).post("/v1/auth/register").send({ email: "A@Ex.com", password: "motdepasse1", displayName: "Awa" }).expect(201);
    await request(app).post("/v1/auth/register").send({ email: "a@ex.com", password: "motdepasse1", displayName: "Awa" }).expect(409);
    const bad = await request(app).post("/v1/auth/login").send({ email: "a@ex.com", password: "wrongpass99" }).expect(401);
    expect(bad.body.error.code).toBe("INVALID_CREDENTIALS");
    const unknown = await request(app).post("/v1/auth/login").send({ email: "nobody@ex.com", password: "wrongpass99" }).expect(401);
    expect(unknown.body.error.code).toBe("INVALID_CREDENTIALS");
    const ok = await request(app).post("/v1/auth/login").set(native).send({ email: "a@ex.com", password: "motdepasse1" }).expect(200);
    expect(ok.body.tokens.accessToken).toBeTruthy();
    expect(ok.body.tokens.refreshToken).toBeTruthy();
  });

  it("rejects weak passwords", async () => {
    const res = await request(app).post("/v1/auth/register").send({ email: "b@ex.com", password: "court", displayName: "B" }).expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("web clients get the refresh token as an httpOnly cookie, not in the body", async () => {
    const res = await request(app).post("/v1/auth/guest").expect(201);
    expect(res.body.tokens.refreshToken).toBeUndefined();
    expect(String(res.headers["set-cookie"])).toMatch(/shupamom_rt=.*HttpOnly/i);
  });

  it("rotates refresh tokens and revokes the family on reuse", async () => {
    const g = await guest();
    const r1 = await request(app).post("/v1/auth/refresh").set(native).send({ refreshToken: g.tokens.refreshToken }).expect(200);
    const replay = await request(app).post("/v1/auth/refresh").set(native).send({ refreshToken: g.tokens.refreshToken }).expect(401);
    expect(replay.body.error.code).toBe("REFRESH_REUSED");
    // The legitimate newer token is revoked too (whole family).
    await request(app).post("/v1/auth/refresh").set(native).send({ refreshToken: r1.body.refreshToken }).expect(401);
  });

  it("requires a valid access token", async () => {
    await request(app).get("/v1/me").expect(401);
    await request(app).get("/v1/me").set("authorization", "Bearer nope").expect(401);
  });
});

describe("Google sign-in", () => {
  it("creates an account from a verified Google identity, then signs back in", async () => {
    const a = await request(app).post("/v1/auth/google").send({ idToken: gtoken("awa@gmail.com") }).expect(201);
    expect(a.body.user.email).toBe("awa@gmail.com");
    expect(a.body.user.isGuest).toBe(false);
    const b = await request(app).post("/v1/auth/google").send({ idToken: gtoken("awa@gmail.com") }).expect(200);
    expect(b.body.user.id).toBe(a.body.user.id);
  });

  it("links to an existing password account with the same e-mail", async () => {
    const reg = await request(app).post("/v1/auth/register").send({ email: "awa@gmail.com", password: "motdepasse1", displayName: "Awa" }).expect(201);
    const g = await request(app).post("/v1/auth/google").send({ idToken: gtoken("awa@gmail.com") }).expect(200);
    expect(g.body.user.id).toBe(reg.body.user.id);
  });

  it("upgrades the festival guest and keeps its progress", async () => {
    const g = await guest();
    const auth = { authorization: `Bearer ${g.tokens.accessToken}` };
    const path0 = await request(app).get("/v1/paths/parler-a-ma-grand-mere").set(auth).expect(200);
    const lessonId = path0.body.lessons[0].id;
    const lesson = await request(app).get(`/v1/lessons/${lessonId}`).set(auth).expect(200);
    const answers = lesson.body.exercises.map((e: { id: string; options: { id: string }[] }) => ({ exerciseId: e.id, optionId: e.options[0].id }));
    await request(app).post(`/v1/lessons/${lessonId}/attempts`).set(auth).send({ answers }).expect(200);

    const up = await request(app).post("/v1/auth/google").set(auth).send({ idToken: gtoken("kid@gmail.com") }).expect(200);
    expect(up.body.user.id).toBe(g.user.id);
    expect(up.body.user.isGuest).toBe(false);
    const after = await request(app).get("/v1/paths/parler-a-ma-grand-mere").set({ authorization: `Bearer ${up.body.tokens.accessToken}` }).expect(200);
    expect(after.body.lessons[0].bestScore).not.toBeNull();
  });

  it("refuses unverified e-mails and invalid tokens", async () => {
    const u = await request(app).post("/v1/auth/google").send({ idToken: "unverified".padEnd(120, "x") }).expect(401);
    expect(u.body.error.code).toBe("EMAIL_NOT_VERIFIED");
    const i = await request(app).post("/v1/auth/google").send({ idToken: "garbage".padEnd(120, "x") }).expect(401);
    expect(i.body.error.code).toBe("INVALID_ID_TOKEN");
  });
});

describe("learning flow", () => {
  it("onboarding, path, lesson (no answers leaked), attempt scoring, progress", async () => {
    const g = await guest();
    const auth = { authorization: `Bearer ${g.tokens.accessToken}` };
    const me = await request(app).patch("/v1/me").set(auth).send({ level: "debutant", goal: "famille" }).expect(200);
    expect(me.body.onboarded).toBe(true);

    const paths = await request(app).get("/v1/paths").set(auth).expect(200);
    expect(paths.body[0].slug).toBe("parler-a-ma-grand-mere");

    const detail = await request(app).get("/v1/paths/parler-a-ma-grand-mere").set(auth).expect(200);
    const lessonId = detail.body.lessons[0].id;
    const lesson = await request(app).get(`/v1/lessons/${lessonId}`).set(auth).expect(200);
    expect(lesson.body.containsPlaceholder).toBe(true);
    expect(lesson.body.phrases.every((p: { isPlaceholder: boolean }) => p.isPlaceholder)).toBe(true);
    expect(JSON.stringify(lesson.body)).not.toMatch(/answerPhraseId|correct/);

    // Answer correctly using the stored answers (the client never receives them).
    const stored = await Exercise.find({ lessonId }).lean();
    const answers = stored.map((e) => ({ exerciseId: String(e._id), optionId: String(e.answerPhraseId) }));
    const res = await request(app).post(`/v1/lessons/${lessonId}/attempts`).set(auth).send({ answers }).expect(200);
    expect(res.body.total).toBe(3);
    expect(res.body.score).toBe(100);
    expect(res.body.lessonCompleted).toBe(true);
    expect(res.body.pathProgress).toEqual({ completed: 1, total: 4 });
  });

  it("production configuration never serves placeholder content", async () => {
    const prodConfig = { ...config, isProd: true, SERVE_PLACEHOLDER_CONTENT: false, NODE_ENV: "production" as const };
    const prodApp = createApp(prodConfig, { verifyGoogle: fakeGoogle });
    const g = await request(prodApp).post("/v1/auth/guest").set(native).expect(201);
    const auth = { authorization: `Bearer ${g.body.tokens.accessToken}` };
    const detail = await request(prodApp).get("/v1/paths/parler-a-ma-grand-mere").set(auth).expect(200);
    const lesson = await request(prodApp).get(`/v1/lessons/${detail.body.lessons[0].id}`).set(auth).expect(200);
    expect(lesson.body.phrases).toHaveLength(0);
    expect(lesson.body.exercises).toHaveLength(0);
    const dict = await request(prodApp).get("/v1/dictionary").query({ q: "bonjour" }).set(auth).expect(200);
    expect(dict.body.results).toHaveLength(0);
  });
});

describe("dictionary + corpus", () => {
  it("imports a parallel TSV as validated, sourced phrases searchable from French", async () => {
    const rows = parseParallelTsv("Test A\tBonjour à tous\nligne sans tabulation\nTest B\tMerci infiniment\n");
    expect(rows).toHaveLength(2);
    expect(await importParallel(rows, "test-corpus")).toBe(2);
    expect(await importParallel(rows, "test-corpus")).toBe(2); // idempotent
    const g = await guest();
    const res = await request(app).get("/v1/dictionary").query({ q: "infiniment" }).set({ authorization: `Bearer ${g.tokens.accessToken}` }).expect(200);
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0]).toMatchObject({ text: "Test B", translation: "Merci infiniment", isPlaceholder: false, status: "validated" });
  });
});

describe("spaced repetition (SM-2)", () => {
  it("grows the interval on success and resets on failure", () => {
    const s1 = sm2({ ease: 2.5, intervalDays: 0, repetitions: 0 }, 4);
    const s2 = sm2(s1, 4);
    const s3 = sm2(s2, 4);
    expect([s1.intervalDays, s2.intervalDays]).toEqual([1, 6]);
    expect(s3.intervalDays).toBeGreaterThan(6);
    expect(sm2(s3, 1)).toMatchObject({ intervalDays: 1, repetitions: 0 });
  });
});
