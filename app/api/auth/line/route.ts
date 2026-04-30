import { NextResponse } from "next/server";
import { verifyLineIdentity } from "@/lib/auth/line";
import { signAppJwt } from "@/lib/auth/jwt";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      idToken?: string;
      accessToken?: string;
      devLogin?: boolean;
      profile?: {
        displayName?: string;
      };
    };

    const identity = body.devLogin && env.enableDevLogin
      ? {
          lineUid: "dev-user",
          name: body.profile?.displayName || "Dev User",
          picture: undefined,
        }
      : await verifyLineIdentity({
          idToken: body.idToken,
          accessToken: body.accessToken,
        });

    const { data: existingUser, error: findError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("line_uid", identity.lineUid)
      .maybeSingle();

    if (findError) {
      throw findError;
    }

    const isNewUser = !existingUser;

    const payload = {
      line_uid: identity.lineUid,
      name: existingUser?.name || identity.name || body.profile?.displayName || null,
      avatar_url: existingUser?.avatar_url || identity.picture || null,
      updated_at: new Date().toISOString(),
    };

    const { data: user, error: upsertError } = await supabaseAdmin
      .from("users")
      .upsert(payload, { onConflict: "line_uid" })
      .select("*")
      .single();

    if (upsertError || !user) {
      throw upsertError || new Error("User upsert failed");
    }

    const token = await signAppJwt({
      sub: user.id,
      role: "authenticated",
      line_uid: identity.lineUid,
    });

    const needsOnboarding = isNewUser || !user.grade || !user.university;

    return NextResponse.json({
      token,
      user,
      needsOnboarding,
    });
  } catch (error) {
    console.error("/api/auth/line failed", error);
    return NextResponse.json({ error: "LINE認証に失敗しました" }, { status: 401 });
  }
}
