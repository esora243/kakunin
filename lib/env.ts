const read = (key: string, required = true) => {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value ?? "";
};

const readFirst = (keys: string[], required = true) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }

  if (required) {
    throw new Error(`Missing environment variable: ${keys.join(" or ")}`);
  }

  return "";
};

const normalizeUrl = (value: string) => {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `https://${value}`;
};

export const env = {
  supabaseUrl: () => readFirst(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]),
  supabaseAnonKey: () => readFirst(["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"]),
  supabaseServiceRoleKey: () => read("SUPABASE_SERVICE_ROLE_KEY"),
  supabaseJwtSecret: () => read("SUPABASE_JWT_SECRET", false),
  sessionSecret: () =>
    readFirst(["SESSION_SECRET", "NEXTAUTH_SECRET", "LINE_CHANNEL_SECRET", "SUPABASE_SERVICE_ROLE_KEY"]),
  lineLiffId: () => readFirst(["NEXT_PUBLIC_LINE_LIFF_ID", "NEXT_PUBLIC_LIFF_ID"], false),
  lineClientId: () => readFirst(["NEXT_PUBLIC_LINE_CLIENT_ID", "LINE_CHANNEL_ID"], false),
  lineChannelSecret: () => read("LINE_CHANNEL_SECRET", false),
  appUrl: () => normalizeUrl(readFirst(["NEXT_PUBLIC_APP_URL", "APP_URL", "VERCEL_URL"], false)),
  siteUrl: () => normalizeUrl(readFirst(["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL", "APP_URL", "VERCEL_URL"], false)),
  enableDevLogin: process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true",
};
