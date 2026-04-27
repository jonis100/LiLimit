import { useState, useEffect, useCallback, useRef } from 'react';

interface TipEntry {
  text: string;
  isFeature: boolean;
}

const tips: string[] = [
  'Got feedback? Email us at LiLimit@protonmail.com',
  'You can leave time or visits empty to apply only one limit',
  'Enter either a full URL or just the hostname',
  'Visit limits reset every day at midnight',
  'Time limits apply per visit to the website',
  'Use the Live Stats tab to track your usage',
  'Search for websites in the All Limits tab',
  'Click the refresh icon to update your stats',
];

const featureTips: string[] = [
  'Enable "Daily time limit" in Settings to track total time spent across all visits today',
];

const FEATURE_TIP_WEIGHT = 3;

const tipPool: TipEntry[] = [
  ...tips.map((t) => ({ text: t, isFeature: false })),
  ...featureTips.flatMap((t) =>
    Array.from({ length: FEATURE_TIP_WEIGHT }, () => ({ text: t, isFeature: true }))
  ),
];

export function useTips() {
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * tipPool.length));
  const [fading, setFading] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const advanceTip = useCallback(() => {
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    setFading(true);
    fadeTimerRef.current = setTimeout(() => {
      setTipIndex((i) => (i + 1) % tipPool.length);
      setFading(false);
    }, 300);
  }, []);

  useEffect(() => {
    const interval = setInterval(advanceTip, 10000);
    return () => {
      clearInterval(interval);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [advanceTip]);

  return { tip: tipPool[tipIndex], fading, advanceTip };
}
