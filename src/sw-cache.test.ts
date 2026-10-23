import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

describe("cache do aplicativo", () => {
  it("não intercepta APIs privadas e descarta o cache antigo", async () => {
    const handlers = new Map<string, (event: any) => void>();
    const deleted: string[] = [];
    const self = {
      location: { origin: "https://www.adocebrigaderia.com.br" },
      addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler),
      clients: { claim: () => undefined },
      skipWaiting: () => undefined,
    };
    const caches = {
      keys: async () => ["clube-adoce-v5", "clube-adoce-v6"],
      delete: async (key: string) => { deleted.push(key); return true; },
    };
    runInNewContext(source, { self, caches, URL });

    let intercepted = false;
    const event = (path: string) => ({
      request: { method: "GET", url: `https://www.adocebrigaderia.com.br${path}`, mode: "cors" },
      respondWith: () => { intercepted = true; },
    });
    handlers.get("fetch")!(event("/api/whatsapp/support?view=active"));
    expect(intercepted).toBe(false);
    handlers.get("fetch")!(event("/.netlify/functions/whatsapp-support"));
    expect(intercepted).toBe(false);

    let activation: Promise<unknown> | undefined;
    handlers.get("activate")!({ waitUntil: (promise: Promise<unknown>) => { activation = promise; } });
    await activation;
    expect(deleted).toEqual(["clube-adoce-v5"]);
  });
});
