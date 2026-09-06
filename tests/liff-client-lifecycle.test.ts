import assert from "node:assert/strict";
import test from "node:test";

type FakeLiff = {
  init: () => Promise<void>;
  isLoggedIn: () => boolean;
  login: () => void;
  logout: () => void;
};

const clientModulePath = require.resolve("../lib/liff/client");
const liffModulePath = require.resolve("@line/liff");
const originalLiffModule = require.cache[liffModulePath];

function installBrowser() {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { href: "https://example.test/school", search: "", hash: "" },
      navigator: { userAgent: "Line/15.0" },
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    },
  });
}

function loadClientWith(fakeLiff: FakeLiff) {
  delete require.cache[clientModulePath];
  require.cache[liffModulePath] = {
    id: liffModulePath,
    filename: liffModulePath,
    loaded: true,
    exports: fakeLiff,
    children: [],
    paths: [],
  } as unknown as NodeModule;
  return require(clientModulePath) as typeof import("../lib/liff/client");
}

test.after(() => {
  delete require.cache[clientModulePath];
  if (originalLiffModule) {
    require.cache[liffModulePath] = originalLiffModule;
  } else {
    delete require.cache[liffModulePath];
  }
  delete process.env.NEXT_PUBLIC_LIFF_ID;
  Reflect.deleteProperty(globalThis, "window");
});

test("logout is reflected by initLiff and same-page login remains available", async () => {
  installBrowser();
  process.env.NEXT_PUBLIC_LIFF_ID = "test-liff-id";
  let loggedIn = true;
  let loginCalls = 0;
  const client = loadClientWith({
    init: async () => undefined,
    isLoggedIn: () => loggedIn,
    login: () => {
      loginCalls += 1;
    },
    logout: () => {
      loggedIn = false;
    },
  });

  assert.deepEqual(await client.initLiff(), { isConfigured: true, isLoggedIn: true });
  await client.logoutFromLiff();
  assert.deepEqual(await client.initLiff(), { isConfigured: true, isLoggedIn: false });

  await client.loginWithLiff();
  assert.equal(loginCalls, 1);
});

test("a rejected SDK initialization can be retried", async () => {
  installBrowser();
  process.env.NEXT_PUBLIC_LIFF_ID = "test-liff-id";
  let initCalls = 0;
  const client = loadClientWith({
    init: async () => {
      initCalls += 1;
      if (initCalls === 1) throw new Error("temporary initialization failure");
    },
    isLoggedIn: () => true,
    login: () => undefined,
    logout: () => undefined,
  });

  await assert.rejects(client.initLiff(), /temporary initialization failure/);
  assert.deepEqual(await client.initLiff(), { isConfigured: true, isLoggedIn: true });
  assert.equal(initCalls, 2);
});
