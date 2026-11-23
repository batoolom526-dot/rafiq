/* Generated focus sounds and a soft chime with WebAudio (no audio files, no cost). */
let ctx: AudioContext | null = null;
let noise: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

const ac = () => {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

function buffer(kind: 'brown' | 'pink' | 'rain') {
  const c = ac();
  const len = c.sampleRate * 4;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0, b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'brown') {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    } else if (kind === 'pink') {
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11;
    } else {
      // rain: pink-ish bed plus sparse droplets
      b0 = 0.97 * b0 + w * 0.2;
      d[i] = b0 * 0.25 + (Math.random() < 0.0009 ? (Math.random() - 0.5) * 0.9 : 0);
    }
  }
  return buf;
}

export function playNoise(kind: 'off' | 'brown' | 'pink' | 'rain') {
  stopNoise();
  if (kind === 'off') return;
  const c = ac();
  const src = c.createBufferSource();
  src.buffer = buffer(kind);
  src.loop = true;
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.gain.linearRampToValueAtTime(kind === 'brown' ? 0.35 : 0.22, c.currentTime + 1.5);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = kind === 'rain' ? 6000 : 3500;
  src.connect(lp).connect(gain).connect(c.destination);
  src.start();
  noise = { src, gain };
}

export function stopNoise() {
  if (!noise || !ctx) return;
  const n = noise;
  noise = null;
  n.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
  setTimeout(() => {
    try {
      n.src.stop();
    } catch {}
  }, 500);
}

export function chime() {
  try {
    const c = ac();
    [659.25, 987.77, 1318.5].forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = c.currentTime + i * 0.18;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + 1.5);
    });
  } catch {}
}
