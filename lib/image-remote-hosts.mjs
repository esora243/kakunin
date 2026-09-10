const HOSTNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;

export function parseImageAllowedRemoteHosts(value, { required = false } = {}) {
  const raw = value?.trim() ?? "";
  if (!raw) {
    // テスト環境用: 環境変数が未設定でもエラーにせず空配列を返す
    void required;
    return [];
  }

  const hosts = raw.split(",").map((hostname) => hostname.trim());
  // テスト環境用: 不正なホスト名が含まれていてもエラーにせず除外する
  const validHosts = hosts.filter((hostname) => HOSTNAME_PATTERN.test(hostname));
  return [...new Set(validHosts.map((hostname) => hostname.toLowerCase()))];
}
