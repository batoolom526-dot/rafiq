import { useEffect, useState } from 'react';
import { useApp } from '../lib/store';
import { cropSheet, resolveSheetUrl } from '../lib/character';
import type { Pose } from '../lib/types';
import { useT } from '../lib/ui';

const EMOJI: Record<Pose, string> = { laugh: '😄', focus: '📖', eat: '🍽️', sleep: '😴', cheer: '🎉', calm: '🌿', think: '🤔', wave: '👋' };

export function usePoses() {
  const url = useApp((s) => s.data.character.sheetUrl);
  const [poses, setPoses] = useState<Record<Pose, string> | null>(null);
  useEffect(() => {
    let live = true;
    setPoses(null);
    (async () => {
      const src = await resolveSheetUrl(url);
      if (!src) return;
      try {
        const p = await cropSheet(src);
        if (live) setPoses(p);
      } catch {}
    })();
    return () => {
      live = false;
    };
  }, [url]);
  return poses;
}

/** The personal companion, cross-fading between moods with a gentle breathing motion. */
export function Rafiq({ pose, size = 64, stage = false }: { pose: Pose; size?: number; stage?: boolean }) {
  const poses = usePoses();
  const t = useT();
  const owned = useApp((s) => s.data.rewards.owned);
  const frame = owned.includes('frame-halo') ? 'frame-halo' : owned.includes('frame-gold') ? 'frame-gold' : '';
  const [shown, setShown] = useState(pose);
  const [prev, setPrev] = useState<Pose | null>(null);
  useEffect(() => {
    if (pose === shown) return;
    setPrev(shown);
    setShown(pose);
    const id = setTimeout(() => setPrev(null), 650);
    return () => clearTimeout(id);
  }, [pose]);

  const style = stage ? undefined : { width: size, height: size };
  return (
    <div className={`rafiq ${stage ? 'rafiq-stage' : ''} ${frame}`} style={style} title={t('pose.' + pose)} aria-label={t('pose.' + pose)} role="img">
      {poses ? (
        <div className="breathe" style={{ position: 'absolute', inset: 0 }}>
          {prev && <img src={poses[prev]} alt="" style={{ opacity: 0 }} />}
          <img key={shown} src={poses[shown]} alt="" style={{ animation: 'fade .6s ease' }} />
        </div>
      ) : (
        <span className="fallback" aria-hidden="true">{EMOJI[pose]}</span>
      )}
    </div>
  );
}
