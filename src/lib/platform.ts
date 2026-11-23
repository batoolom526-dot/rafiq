/* Thin wrapper over the claude.ai artifact runtime (window.claude.use).
 * Everything here degrades to null when the app runs anywhere else
 * (local dev, Vercel, Netlify...), so every feature must work without it. */

type AnyFn = (...args: any[]) => any;
export interface SampleFn extends AnyFn {
  (input: string | { role: 'user' | 'assistant'; content: string }[], opts?: any): Promise<{ text: string; truncated: boolean }>;
  json: <T = unknown>(input: any, opts?: any) => Promise<T>;
}

declare global {
  interface Window {
    claude?: { use: (name: string) => Promise<any> };
  }
}

const cache = new Map<string, Promise<any>>();

export function cap<T = any>(name: string): Promise<T | null> {
  if (!cache.has(name)) {
    const p = (async () => {
      try {
        if (!window.claude?.use) return null;
        const res = await Promise.race([
          window.claude.use(name),
          new Promise((r) => setTimeout(() => r(null), 12000)),
        ]);
        return res ?? null;
      } catch {
        return null;
      }
    })();
    cache.set(name, p);
  }
  return cache.get(name)!;
}

export const inClaude = () => typeof window !== 'undefined' && !!window.claude?.use;
