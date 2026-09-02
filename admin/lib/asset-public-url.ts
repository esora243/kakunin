export function requiredEnv(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function publicAssetUrlFor(objectPath: string, env: NodeJS.ProcessEnv = process.env): string {
  const baseUrl = requiredEnv("GCS_PUBLIC_ASSET_BASE_URL", env);
  return `${baseUrl.replace(/\/+$/, "")}/${objectPath}`;
}

export function isManagedPublicAssetUrl(url: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const configuredBase = env.GCS_PUBLIC_ASSET_BASE_URL?.trim();
  if (!configuredBase) return false;
  try {
    const candidate = new URL(url);
    const base = new URL(`${configuredBase.replace(/\/+$/, "")}/`);
    return candidate.protocol === "https:"
      && candidate.origin === base.origin
      && candidate.pathname.startsWith(base.pathname)
      && candidate.pathname.length > base.pathname.length;
  } catch {
    return false;
  }
}
