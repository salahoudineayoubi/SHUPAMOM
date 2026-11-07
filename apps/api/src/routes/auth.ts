import { Router } from "express";
import rateLimit from "express-rate-limit";
import { GoogleAuthInput, LoginInput, RefreshInput, RegisterInput, type AuthResponse, type Me } from "@shupamom/shared";
import type { Config } from "../config";
import { User, type UserDoc } from "../models";
import {
  ACCESS_TTL_SECONDS,
  REFRESH_COOKIE,
  hashPassword,
  isNativeClient,
  issueRefresh,
  requireAuth,
  revokeRefresh,
  rotateRefresh,
  setRefreshCookie,
  signAccess,
  verifyPassword,
  type AuthedRequest,
} from "../lib/auth";
import { HttpError, asyncHandler, parse, unauthorized } from "../lib/http";
import { googleVerifier, type GoogleVerifier } from "../lib/google";

export function toMe(u: UserDoc): Me {
  return {
    id: String(u._id),
    displayName: u.displayName,
    email: u.email ?? null,
    isGuest: Boolean(u.isGuest),
    nativeLanguage: u.nativeLanguage ?? "fr",
    learningLanguage: u.learningLanguage ?? "bax",
    level: (u.level as Me["level"]) ?? null,
    goal: (u.goal as Me["goal"]) ?? null,
    onboarded: Boolean(u.level && u.goal),
    roles: u.roles ?? ["learner"],
  };
}

export function authRouter(config: Config, verifyGoogle: GoogleVerifier = googleVerifier(config.googleAudiences)) {
  const r = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: config.NODE_ENV === "test" ? 1000 : 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Trop de tentatives, réessayez plus tard" } },
  });

  async function respond(req: Parameters<typeof isNativeClient>[0], res: import("express").Response, user: UserDoc, status = 200) {
    const refreshToken = await issueRefresh(String(user._id));
    const body: AuthResponse = {
      user: toMe(user),
      tokens: { accessToken: signAccess(config, String(user._id), user.roles ?? []), expiresIn: ACCESS_TTL_SECONDS },
    };
    if (isNativeClient(req)) body.tokens.refreshToken = refreshToken;
    else setRefreshCookie(res, config, refreshToken);
    res.status(status).json(body);
  }

  /** Guest session for the no-account festival demo. Upgradable to a real account. */
  r.post(
    "/guest",
    limiter,
    asyncHandler(async (req, res) => {
      const user = await User.create({ displayName: "Invité", isGuest: true });
      await respond(req, res, user.toObject() as UserDoc, 201);
    })
  );

  /**
   * Register. If called with a guest access token, the guest account is upgraded in
   * place so the progress made during the demo is kept.
   */
  r.post(
    "/register",
    limiter,
    asyncHandler(async (req, res) => {
      const input = parse(RegisterInput, req.body);
      if (await User.exists({ email: input.email })) throw new HttpError(409, "EMAIL_TAKEN", "Cet e-mail est déjà utilisé");
      const passwordHash = await hashPassword(input.password);

      const guest = await guestFromRequest(req, res);
      if (guest) {
        guest.set({ email: input.email, passwordHash, displayName: input.displayName, isGuest: false });
        await guest.save();
        return respond(req, res, guest.toObject() as UserDoc, 201);
      }
      const user = await User.create({ email: input.email, passwordHash, displayName: input.displayName });
      await respond(req, res, user.toObject() as UserDoc, 201);
    })
  );

  /** Optional bearer token of a guest session (festival demo) to upgrade in place. */
  async function guestFromRequest(req: import("express").Request, res: import("express").Response) {
    if (!req.headers.authorization) return null;
    let guestId: string | null = null;
    await new Promise<void>((resolve) =>
      requireAuth(config)(req, res, (err?: unknown) => {
        if (!err) guestId = (req as AuthedRequest).userId;
        resolve();
      })
    );
    if (!guestId) return null;
    const guest = await User.findById(guestId);
    return guest?.isGuest ? guest : null;
  }

  /**
   * Google Sign-In (same flow as KolayExpress): verify the ID token server-side, then
   * 1) the Google account is already linked → sign in;
   * 2) an account exists with that (Google-verified) e-mail → link and sign in;
   * 3) the caller is a guest → upgrade the guest (keeps demo progress);
   * 4) otherwise create the account.
   */
  r.post(
    "/google",
    limiter,
    asyncHandler(async (req, res) => {
      const { idToken } = parse(GoogleAuthInput, req.body);
      const g = await verifyGoogle(idToken);
      let user = await User.findOne({ googleSub: g.sub });
      if (!user) {
        user = await User.findOne({ email: g.email });
        if (user) {
          user.set({ googleSub: g.sub, avatarUrl: user.avatarUrl ?? g.picture });
          await user.save();
        }
      }
      if (!user) {
        const guest = await guestFromRequest(req, res);
        if (guest) {
          guest.set({ email: g.email, googleSub: g.sub, displayName: g.name, avatarUrl: g.picture, isGuest: false });
          await guest.save();
          user = guest;
        }
      }
      const created = !user;
      if (!user) user = await User.create({ email: g.email, googleSub: g.sub, displayName: g.name, avatarUrl: g.picture });
      await respond(req, res, user.toObject() as UserDoc, created ? 201 : 200);
    })
  );

  r.post(
    "/login",
    limiter,
    asyncHandler(async (req, res) => {
      const input = parse(LoginInput, req.body);
      const user = await User.findOne({ email: input.email }).lean<UserDoc>();
      // Same error for unknown e-mail and wrong password (no account enumeration).
      const ok = user?.passwordHash ? await verifyPassword(user.passwordHash, input.password) : false;
      if (!user || !ok) throw new HttpError(401, "INVALID_CREDENTIALS", "E-mail ou mot de passe incorrect");
      await respond(req, res, user);
    })
  );

  r.post(
    "/refresh",
    limiter,
    asyncHandler(async (req, res) => {
      const body = parse(RefreshInput, req.body ?? {});
      const token = body.refreshToken || req.cookies?.[REFRESH_COOKIE];
      if (!token) throw unauthorized("Session expirée");
      const { userId, refreshToken } = await rotateRefresh(token);
      const user = await User.findById(userId).lean<UserDoc>();
      if (!user) throw unauthorized();
      const out: { accessToken: string; expiresIn: number; refreshToken?: string } = {
        accessToken: signAccess(config, userId, user.roles ?? []),
        expiresIn: ACCESS_TTL_SECONDS,
      };
      if (isNativeClient(req)) out.refreshToken = refreshToken;
      else setRefreshCookie(res, config, refreshToken);
      res.json(out);
    })
  );

  r.post(
    "/logout",
    asyncHandler(async (req, res) => {
      const body = parse(RefreshInput, req.body ?? {});
      const token = body.refreshToken || req.cookies?.[REFRESH_COOKIE];
      if (token) await revokeRefresh(token);
      res.clearCookie(REFRESH_COOKIE, { path: "/v1/auth" });
      res.status(204).end();
    })
  );

  return r;
}
