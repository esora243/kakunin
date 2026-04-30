import { verifyAppJwt, type AppJwtPayload } from "@/lib/auth/jwt";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type AppUser = Database["public"]["Tables"]["users"]["Row"];

export const readBearerToken = (request: Request) => {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return "";
  return header.slice(7);
};

export const requireAppSession = async (request: Request): Promise<AppJwtPayload> => {
  const token = readBearerToken(request);
  if (!token) {
    throw new Error("Unauthorized");
  }
  return verifyAppJwt(token);
};

export const requireAppUser = async (request: Request): Promise<AppUser> => {
  const session = await requireAppSession(request);
  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", session.sub)
    .single();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return user;
};
