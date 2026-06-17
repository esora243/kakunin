export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

export function getSupabaseRestConfig() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new SupabaseConfigError("Supabase URL or Anon Key is missing in environment variables");
  }

  if (!url.startsWith("http")) {
    url = "https://" + url;
  }

  return { url: url.replace(/\/$/, ""), anonKey };
}

export interface SupabaseFetchOptions {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: any;
}

export async function supabaseRestFetch<T>(options: SupabaseFetchOptions): Promise<T> {
  const config = getSupabaseRestConfig();
  const { path, method = "GET", body } = options;

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method,
    headers: {
      "apikey": config.anonKey,
      "Authorization": `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store", // ★ここを追加：古いデータを取り続けるキャッシュを強制破壊
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Supabase Error] ${response.status} on /${path}:`, errorText);
    throw new Error(`Supabase request failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}