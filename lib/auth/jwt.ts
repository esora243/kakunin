import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

export type AppJwtPayload = {
  sub: string;
  role: "authenticated";
  line_uid: string;
};

const getSecret = () => new TextEncoder().encode(env.supabaseJwtSecret() || env.sessionSecret());

export const signAppJwt = async (payload: AppJwtPayload) => {
  return new SignJWT({ role: payload.role, line_uid: payload.line_uid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
};

export const verifyAppJwt = async (token: string) => {
  const { payload } = await jwtVerify(token, getSecret());
  return {
    sub: String(payload.sub || ""),
    role: (payload.role || "authenticated") as "authenticated",
    line_uid: String(payload.line_uid || ""),
  } satisfies AppJwtPayload;
};
