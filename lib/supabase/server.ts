import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

const readBearerToken = () => {
  const authHeader = headers().get("authorization") || headers().get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return "";
  return authHeader.slice(7);
};

export const createServerSupabaseClient = (accessToken?: string) => {
  const token = accessToken || readBearerToken();

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: token
      ? {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      : undefined,
  });
};
