export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

export function getSupabaseRestConfig() {
  // 末尾の改行や見えないスペースを強制削除
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new SupabaseConfigError("Supabase URL or Anon Key is missing in environment variables");
  }

  return { url: url.replace(/\/$/, ""), anonKey };
}

// ★ここが修正ポイント: method と body を許可する型（Type）を明記
export interface SupabaseFetchOptions {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: any;
}

// 引数の型を SupabaseFetchOptions に変更
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
    // bodyが存在する場合のみJSON形式に変換して送信
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Supabase Error] ${response.status} on /${path}:`, errorText);
    throw new Error(`Supabase request failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}