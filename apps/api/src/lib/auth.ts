import crypto from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import type { Config } from "../config";
import { RefreshToken, User } from "../models";
import { HttpError, unauthorized } from "./http";

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_DAYS = 30;
export const REFRESH_COOKIE = "shupamom_rt";
const ISSUER = "shupamom";

export const hashPassword = (pw: string) => argon2.hash(pw, { type: argon2.argon2id });
export const verifyPassword = (hash: string, pw: string) => argon2.verify(hash, pw);

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export function signAccess(config: Config, userId: string, roles: string[]) {
  return jwt.sign({ roles }, config.JWT_ACCESS_SECRET, {
    subject: userId,
    issuer: ISSUER,
    expiresIn: ACCESS_TTL_SECONDS,
    algorithm: "HS256",
  });
}

/** Issues a new opaque refresh token in a (new or existing) rotation family. */
export async function issueRefresh(userId: string, familyId: string = crypto.randomUUID()) {
  const token = crypto.randomBytes(48).toString("base64url");
  await RefreshToken.create({
    userId,
    tokenHash: sha256(token),
    familyId,
    expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86400_000),
  });
  return token;
}

/**
 * Rotation with reuse detection: a refresh token works once. Replaying an already
 * used token revokes its whole family (the token was probably stolen).
 */
export async function rotateRefresh(token: string) {
  const doc = await RefreshToken.findOne({ tokenHash: sha256(token) });
  if (!doc || doc.revokedAt || doc.expiresAt < new Date()) throw unauthorized("Session expirée");
  if (doc.usedAt) {
    await RefreshToken.updateMany({ familyId: doc.familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    throw new HttpError(401, "REFRESH_REUSED", "Session révoquée pour raison de sécurité");
  }
  const claimed = await RefreshToken.updateOne({ _id: doc._id, usedAt: null }, { $set: { usedAt: new Date() } });
  if (claimed.modifiedCount !== 1) throw new HttpError(401, "REFRESH_REUSED", "Session révoquée pour raison de sécurité");
  const next = await issueRefresh(String(doc.userId), doc.familyId);
  return { userId: String(doc.userId), refreshToken: next };
}

export async function revokeRefresh(token: string) {
  const doc = await RefreshToken.findOne({ tokenHash: sha256(token) });
  if (doc) await RefreshToken.updateMany({ familyId: doc.familyId }, { $set: { revokedAt: new Date() } });
}

export type AuthedRequest = Request & { userId: string; roles: string[] };

export function requireAuth(config: Config) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : null;
      if (!token) throw unauthorized();
      let payload: jwt.JwtPayload;
      try {
        payload = jwt.verify(token, config.JWT_ACCESS_SECRET, { issuer: ISSUER, algorithms: ["HS256"] }) as jwt.JwtPayload;
      } catch {
        throw new HttpError(401, "TOKEN_INVALID", "Jeton invalide ou expiré");
      }
      const exists = await User.exists({ _id: payload.sub });
      if (!exists) throw unauthorized();
      (req as AuthedRequest).userId = String(payload.sub);
      (req as AuthedRequest).roles = (payload.roles as string[]) || [];
      next();
    } catch (e) {
      next(e);
    }
  };
}

/** Native clients identify themselves so they get the refresh token in the body. */
export const isNativeClient = (req: Request) => req.headers["x-client"] === "native";

export function setRefreshCookie(res: Response, config: Config, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? "strict" : "lax",
    path: "/v1/auth",
    maxAge: REFRESH_TTL_DAYS * 86400_000,
  });
}
