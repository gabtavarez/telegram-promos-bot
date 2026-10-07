import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PostedDealsStore } from "../src/storage/PostedDealsStore.js";

const temporaryDirectories: string[] = [];

async function createStore(): Promise<PostedDealsStore> {
  const directory = await mkdtemp(join(tmpdir(), "telegram-promos-store-"));
  temporaryDirectories.push(directory);
  const store = new PostedDealsStore(join(directory, "posted.json"));
  await store.initialize();
  return store;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("diagnosticos persistentes", () => {
  it("salva e recupera a saude dos provedores", async () => {
    const store = await createStore();
    const health = [{
      name: "Shopee",
      lastAttemptAt: "2026-10-06T12:00:00.000Z",
      lastSuccessAt: "2026-10-06T12:00:00.000Z",
      durationMs: 1250,
      received: 20,
      qualityApproved: 12,
      promotable: 7,
      newDeals: 3,
    }];

    await store.saveProviderHealth(health);
    expect(await store.getProviderHealth()).toEqual(health);
  });

  it("cria uma linha de base silenciosa e retorna somente cupons novos", async () => {
    const store = await createStore();

    expect(await store.syncActiveCouponKeys(["a", "b"])).toEqual([]);
    expect(await store.syncActiveCouponKeys(["a", "b"])).toEqual([]);
    expect(await store.syncActiveCouponKeys(["b", "c"])).toEqual(["c"]);
    expect(await store.syncActiveCouponKeys(["c"])).toEqual([]);
  });
});
