import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Tiny key-value store. Uses Upstash Redis when configured (production),
 * otherwise an in-process Map so the app runs locally with zero setup.
 */
interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  /** Returns true when the lock was acquired. */
  lock(key: string, ttlMs: number): Promise<boolean>;
  unlock(key: string): Promise<void>;
  incr(key: string, by?: number): Promise<number>;
  zincr(key: string, member: string, by: number): Promise<void>;
  ztop(key: string, n: number): Promise<{ member: string; score: number }[]>;
  sadd(key: string, member: string): Promise<void>;
  scard(key: string): Promise<number>;
}

function memoryKV(): KV {
  const g = globalThis as unknown as { __botchedKV?: Map<string, { v: unknown; exp?: number }> };
  const m = (g.__botchedKV ??= new Map());
  const live = (key: string) => {
    const e = m.get(key);
    if (e && e.exp && e.exp < Date.now()) {
      m.delete(key);
      return undefined;
    }
    return e;
  };
  return {
    async get<T>(key: string) {
      return (structuredClone(live(key)?.v) as T) ?? null;
    },
    async set(key, value, ttl) {
      m.set(key, { v: structuredClone(value), exp: ttl ? Date.now() + ttl * 1000 : undefined });
    },
    async lock(key, ttlMs) {
      if (live(key)) return false;
      m.set(key, { v: 1, exp: Date.now() + ttlMs });
      return true;
    },
    async unlock(key) {
      m.delete(key);
    },
    async incr(key, by = 1) {
      const n = Number(live(key)?.v ?? 0) + by;
      m.set(key, { v: n });
      return n;
    },
    async zincr(key, member, by) {
      const z = (live(key)?.v as Record<string, number>) ?? {};
      z[member] = (z[member] ?? 0) + by;
      m.set(key, { v: z });
    },
    async ztop(key, n) {
      const z = (live(key)?.v as Record<string, number>) ?? {};
      return Object.entries(z)
        .map(([member, score]) => ({ member, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, n);
    },
    async sadd(key, member) {
      const s = new Set((live(key)?.v as string[]) ?? []);
      s.add(member);
      m.set(key, { v: [...s] });
    },
    async scard(key) {
      return ((live(key)?.v as string[]) ?? []).length;
    },
  };
}

function redisKV(redis: Redis): KV {
  return {
    async get<T>(key: string) {
      return (await redis.get<T>(key)) ?? null;
    },
    async set(key, value, ttl) {
      if (ttl) await redis.set(key, value, { ex: ttl });
      else await redis.set(key, value);
    },
    async lock(key, ttlMs) {
      return (await redis.set(key, 1, { nx: true, px: ttlMs })) === "OK";
    },
    async unlock(key) {
      await redis.del(key);
    },
    async incr(key, by = 1) {
      return redis.incrby(key, by);
    },
    async zincr(key, member, by) {
      await redis.zincrby(key, by, member);
    },
    async ztop(key, n) {
      const raw = await redis.zrange<(string | number)[]>(key, 0, n - 1, { rev: true, withScores: true });
      const out: { member: string; score: number }[] = [];
      for (let i = 0; i < raw.length; i += 2) out.push({ member: String(raw[i]), score: Number(raw[i + 1]) });
      return out;
    },
    async sadd(key, member) {
      await redis.sadd(key, member);
    },
    async scard(key) {
      return redis.scard(key);
    },
  };
}

export const kv: KV =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? redisKV(Redis.fromEnv())
    : memoryKV();
