import { OAuth2Client } from "google-auth-library";
import { HttpError } from "./http";

/** Verified identity extracted from a Google ID token. */
export type GoogleIdentity = { sub: string; email: string; name: string; picture: string | null };
export type GoogleVerifier = (idToken: string) => Promise<GoogleIdentity>;

/**
 * Same rules as KolayExpress (backend/.../login_customer.js):
 * - the token must be issued for one of OUR OAuth clients (web / Android / iOS);
 * - the e-mail must be verified by Google (otherwise anyone could claim any address).
 */
export function googleVerifier(audiences: string[]): GoogleVerifier {
  const client = new OAuth2Client();
  return async (idToken) => {
    if (audiences.length === 0) throw new HttpError(503, "GOOGLE_NOT_CONFIGURED", "Connexion Google indisponible");
    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: audiences });
      payload = ticket.getPayload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/audience|recipient/i.test(msg)) throw new HttpError(401, "INVALID_AUDIENCE", "Jeton Google non destiné à Shupamom");
      throw new HttpError(401, "INVALID_ID_TOKEN", "Jeton Google invalide");
    }
    if (!payload?.sub || !payload.email) throw new HttpError(401, "INVALID_ID_TOKEN", "Jeton Google invalide");
    if (payload.email_verified !== true) throw new HttpError(401, "EMAIL_NOT_VERIFIED", "E-mail Google non vérifié");
    const name = (payload.name || payload.given_name || payload.email.split("@")[0]).trim();
    return { sub: payload.sub, email: payload.email.toLowerCase(), name, picture: payload.picture ?? null };
  };
}
