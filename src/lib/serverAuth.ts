import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Server-only. Confirms a request really comes from a signed-in, active owner
 * without needing any Firebase secret: the sign-in token is verified against
 * Google's public keys, then the person's profile is read with that same token
 * (so Firestore's own rules apply to the read).
 */
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const KEYS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

/** An error that carries the HTTP status to answer with. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export const firestoreUrl = (path: string) =>
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;

export const bearer = (idToken: string) => ({ authorization: `Bearer ${idToken}` });

interface ProfileFields {
  appRole?: { stringValue?: string };
  active?: { booleanValue?: boolean };
}

/** Resolves with the owner's uid, or throws an HttpError (401 not signed in, 403 not an owner). */
export async function requireOwner(idToken: string): Promise<string> {
  if (!PROJECT_ID) throw new HttpError(500, "Firebase isn't configured on the server.");

  let uid: string;
  try {
    const { payload } = await jwtVerify(idToken, KEYS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    if (!payload.sub) throw new Error("no subject");
    uid = payload.sub;
  } catch {
    throw new HttpError(401, "Sign in again.");
  }

  const response = await fetch(firestoreUrl(`people/${uid}`), { headers: bearer(idToken), cache: "no-store" });
  if (!response.ok) throw new HttpError(403, "Couldn't confirm that you're an admin.");
  const fields = ((await response.json()) as { fields?: ProfileFields }).fields ?? {};
  const isOwner = fields.appRole?.stringValue === "owner" && fields.active?.booleanValue !== false;
  if (!isOwner) throw new HttpError(403, "Only an active owner can delete photos.");
  return uid;
}
