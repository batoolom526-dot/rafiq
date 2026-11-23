/* AI provider layer.
 * 1. Claude through the artifact `sample` capability (free for the user inside claude.ai)
 * 2. Google Gemini with the user's own free API key (works when self-hosted)
 * 3. Nothing: callers fall back to built-in logic. */
import { cap, type SampleFn } from './platform';
import { useApp } from './store';

export type Provider = 'claude' | 'gemini' | null;

export class AIError extends Error {
  constructor(public code: 'off' | 'denied' | 'rate' | 'fail' | 'cancelled', msg: string = code) {
    super(msg);
  }
}

let claudeAvailable: boolean | null = null;
export async function detectClaude() {
  if (claudeAvailable !== null) return claudeAvailable;
  const s = await cap<SampleFn>('sample');
  claudeAvailable = !!s;
  return claudeAvailable;
}

export function activeProvider(): Provider {
  const s = useApp.getState().data.settings;
  if (s.aiProvider === 'off') return null;
  if (s.aiProvider === 'claude') return claudeAvailable ? 'claude' : null;
  if (s.aiProvider === 'gemini') return s.geminiKey ? 'gemini' : null;
  if (claudeAvailable) return 'claude';
  if (s.geminiKey) return 'gemini';
  return null;
}

export const aiReady = () => activeProvider() !== null;

interface AskOpts {
  onText?: (t: string) => void;
  signal?: AbortSignal;
  quick?: boolean;
  history?: { role: 'user' | 'assistant'; content: string }[];
}

async function gemini(prompt: string, opts: AskOpts, json: boolean): Promise<string> {
  const s = useApp.getState().data.settings;
  const contents = [
    ...(opts.history || []).map((h) => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })),
    { role: 'user', parts: [{ text: prompt }] },
  ];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.geminiModel || 'gemini-2.5-flash')}:generateContent`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': s.geminiKey },
      body: JSON.stringify({
        contents,
        generationConfig: json ? { responseMimeType: 'application/json' } : undefined,
      }),
      signal: opts.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new AIError('cancelled');
    throw new AIError('fail', 'network');
  }
  if (res.status === 429) throw new AIError('rate');
  if (res.status === 401 || res.status === 403) throw new AIError('denied');
  if (!res.ok) throw new AIError('fail', 'http ' + res.status);
  const body = await res.json();
  const text: string = body?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || '';
  if (!text) throw new AIError('fail', 'empty');
  opts.onText?.(text);
  return text;
}

function mapClaudeError(e: any): AIError {
  const c = e?.code;
  if (c === 'cancelled') return new AIError('cancelled');
  if (c === 'not_granted' || c === 'sampling_disabled' || c === 'not_declared') return new AIError('denied');
  if (c === 'rate_limited' || c === 'queue_overflow') return new AIError('rate');
  return new AIError('fail', c || 'error');
}

export async function ask(prompt: string, opts: AskOpts = {}): Promise<string> {
  const p = activeProvider();
  if (!p) throw new AIError('off');
  if (p === 'gemini') return gemini(prompt, opts, false);
  const sample = (await cap<SampleFn>('sample'))!;
  const input = opts.history?.length ? [...opts.history, { role: 'user' as const, content: prompt }] : prompt;
  try {
    const { text } = await sample(input, {
      onText: opts.onText ? ({ text }: { text: string }) => opts.onText!(text) : undefined,
      signal: opts.signal,
      modelTier: opts.quick ? 'quick' : 'default',
      cache: opts.history ? false : undefined,
    });
    return text;
  } catch (e) {
    throw mapClaudeError(e);
  }
}

export async function askJSON<T>(prompt: string, opts: AskOpts = {}): Promise<T> {
  const p = activeProvider();
  if (!p) throw new AIError('off');
  if (p === 'gemini') {
    const text = await gemini(prompt + '\n\nReply with JSON only.', opts, true);
    return parseLoose<T>(text);
  }
  const sample = (await cap<SampleFn>('sample'))!;
  try {
    return await sample.json<T>(prompt, { signal: opts.signal, modelTier: opts.quick ? 'quick' : 'default' });
  } catch (e) {
    throw mapClaudeError(e);
  }
}

function parseLoose<T>(text: string): T {
  try {
    return JSON.parse(text);
  } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {}
  }
  const a = text.search(/[\[{]/);
  const b = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (a >= 0 && b > a) return JSON.parse(text.slice(a, b + 1));
  throw new AIError('fail', 'json');
}

export const aiErrorKey = (e: unknown) => {
  const c = (e as AIError)?.code;
  if (c === 'off') return 'aiOff';
  if (c === 'denied') return 'aiDenied';
  if (c === 'rate') return 'aiRate';
  return 'aiFail';
};

/** Language instruction so answers match the user. */
export const langLine = () => {
  const d = useApp.getState().data;
  return d.profile.lang === 'ar'
    ? 'Answer in Arabic. If the user writes in a dialect, mirror their dialect naturally.'
    : 'Answer in the language the user writes in (default English).';
};
