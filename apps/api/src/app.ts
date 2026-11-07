import path from "node:path";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import pino from "pino";
import type { Config } from "./config";
import { authRouter } from "./routes/auth";
import { learningRouter } from "./routes/learning";
import { errorMiddleware, notFound } from "./lib/http";
import { LocalAudioStorage, type AudioStorage } from "./services/content";
import type { GoogleVerifier } from "./lib/google";

export const MEDIA_DIR = path.resolve(__dirname, "../../../content/bamoun/audio");

export function createApp(config: Config, deps: { storage?: AudioStorage; verifyGoogle?: GoogleVerifier } = {}) {
  const storage = deps.storage ?? new LocalAudioStorage(config.PUBLIC_BASE_URL);
  const logger = pino({ level: config.NODE_ENV === "test" ? "silent" : "info", redact: ["req.headers.authorization", "req.headers.cookie"] });

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
      credentials: true,
    })
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(pinoHttp({ logger }));

  app.get("/v1/health", (_req, res) => res.json({ ok: true, service: "shupamom-api" }));
  app.use("/v1/auth", authRouter(config, deps.verifyGoogle));
  app.use("/v1", learningRouter(config, storage));
  // Dev audio storage (S3-compatible storage replaces this in production).
  app.use("/media", express.static(MEDIA_DIR, { maxAge: "7d", immutable: true, fallthrough: false }));

  app.use((_req, _res, next) => next(notFound("Route")));
  app.use(errorMiddleware);
  return app;
}
