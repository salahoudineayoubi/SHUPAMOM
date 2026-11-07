import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type ZodTypeAny, type z } from "zod";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const notFound = (what = "Ressource") => new HttpError(404, "NOT_FOUND", `${what} introuvable`);
export const unauthorized = (msg = "Authentification requise") => new HttpError(401, "UNAUTHORIZED", msg);
export const forbidden = (msg = "Accès refusé") => new HttpError(403, "FORBIDDEN", msg);

/** Wraps async handlers so rejections reach the error middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  return schema.parse(data);
}

/** Uniform JSON errors: { error: { code, message } }. Internal details never leak. */
export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction) {
  // `instanceof` is not enough: @shupamom/shared bundles its own zod copy.
  if (err instanceof ZodError || (err as { name?: string })?.name === "ZodError") {
    const first = (err as ZodError).issues[0];
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: first ? `${first.path.join(".") || "body"}: ${first.message}` : "Données invalides" },
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if ((err as { type?: string })?.type === "entity.parse.failed") {
    return res.status(400).json({ error: { code: "BAD_JSON", message: "JSON invalide" } });
  }
  (req as Request & { log?: { error: (o: unknown, m: string) => void } }).log?.error({ err }, "unhandled error");
  return res.status(500).json({ error: { code: "INTERNAL", message: "Erreur interne" } });
}
