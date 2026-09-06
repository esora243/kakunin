const HOSTNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

export function parseImageAllowedRemoteHosts(value, { required = false } = {}) {
  const raw = value?.trim() ?? "";
  if (!raw) {
    if (required) throw new Error("IMAGE_ALLOWED_REMOTE_HOSTS is required outside local development");
    return [];
  }

  const hosts = raw.split(",").map((hostname) => hostname.trim());
  if (hosts.some((hostname) => !HOSTNAME_PATTERN.test(hostname))) {
    throw new Error("IMAGE_ALLOWED_REMOTE_HOSTS must contain only comma-separated DNS hostnames");
  }
  return [...new Set(hosts.map((hostname) => hostname.toLowerCase()))];
}
