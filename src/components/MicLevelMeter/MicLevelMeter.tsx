import Tooltip from '@mui/material/Tooltip';
import { useEffect, useRef } from 'react';

import { useI18n } from 'contexts/i18n';
import useMicLevel from 'hooks/useMicLevel';

import styles from './MicLevelMeter.module.css';

type MicLevelMeterProps = {
  stream: MediaStream | null;
};

const BAR_COUNT = 5;
const MIN_SCALE = 0.15;
const LERP = 0.3;

const MicLevelMeter = ({ stream }: MicLevelMeterProps) => {
  const { getAnalyser, noSignal } = useMicLevel(stream);
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (!stream) return;
    let rafId = 0;
    const current = new Array<number>(BAR_COUNT).fill(MIN_SCALE);
    let freqBuf: Uint8Array | null = null;

    const draw = () => {
      const analyser = getAnalyser();
      if (analyser) {
        if (!freqBuf || freqBuf.length !== analyser.frequencyBinCount) {
          freqBuf = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(freqBuf);

        // Skip the very bottom bins (DC / room rumble), focus on speech band.
        const start = 2;
        const usable = Math.min(freqBuf.length, 96) - start;
        const perBar = Math.floor(usable / BAR_COUNT);

        for (let b = 0; b < BAR_COUNT; b++) {
          let sum = 0;
          const from = start + b * perBar;
          const to = from + perBar;
          for (let i = from; i < to; i++) sum += freqBuf[i];
          const avg = sum / perBar / 255;
          // Slight curve so quiet speech still shows movement.
          const target = Math.min(1, Math.max(MIN_SCALE, Math.pow(avg, 0.7) * 1.4));
          current[b] += (target - current[b]) * LERP;

          const el = barRefs.current[b];
          if (el) {
            el.style.transform = `scaleY(${current[b].toFixed(3)})`;
            if (current[b] > 0.92) {
              el.style.backgroundColor = '#ffb74d';
            } else {
              el.style.backgroundColor = '';
            }
          }
        }
      } else {
        for (let b = 0; b < BAR_COUNT; b++) {
          current[b] += (MIN_SCALE - current[b]) * LERP;
          const el = barRefs.current[b];
          if (el) el.style.transform = `scaleY(${current[b].toFixed(3)})`;
        }
      }
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [stream, getAnalyser]);

  if (!stream) return null;

  return (
    <Tooltip
      title={noSignal ? t('mic.noSignal') : ''}
      placement="top"
      arrow
    >
      <div
        ref={containerRef}
        className={`${styles.root} ${noSignal ? styles.noSignal : ''}`}
        aria-label={noSignal ? 'No microphone signal detected' : 'Microphone level'}
      >
        {Array.from({ length: BAR_COUNT }).map((_, i) => (
          <span
            key={i}
            className={styles.bar}
            ref={(el) => {
              barRefs.current[i] = el;
            }}
          />
        ))}
        {noSignal && <span className={styles.warningDot} aria-hidden="true" />}
      </div>
    </Tooltip>
  );
};

export default MicLevelMeter;
