type SupabaseFetchOptions = {
  path: string;
  init?: RequestInit;
};

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

export function getSupabaseRestConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new SupabaseConfigError("Supabase URL or anon key is not configured");
  }

  return { url: url.replace(/\/$/, ""), anonKey };
}

export async function supabaseRestFetch<T>({ path, init }: SupabaseFetchOptions): Promise<T> {
  const { url, anonKey } = getSupabaseRestConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase REST request failed: ${response.status} ${body}`);
  }

  return (await response.json()) as T;
}
