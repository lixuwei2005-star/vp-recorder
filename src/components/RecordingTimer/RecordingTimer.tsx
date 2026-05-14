import cx from 'classnames';
import { useEffect, useRef, useState } from 'react';

import { useRecording } from 'contexts/recording';

import styles from './RecordingTimer.module.css';

const formatDuration = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
};

const RecordingTimer = () => {
  const { isRecording, isPaused } = useRecording();

  // accumulatedMs holds duration from completed run segments (before the
  // latest pause). runStartedAt is the timestamp when the current running
  // segment began, or null when paused / not recording.
  const accumulatedRef = useRef(0);
  const runStartedAtRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!isRecording) {
      accumulatedRef.current = 0;
      runStartedAtRef.current = null;
      setElapsedMs(0);
      return;
    }

    if (isPaused) {
      if (runStartedAtRef.current !== null) {
        accumulatedRef.current += Date.now() - runStartedAtRef.current;
        runStartedAtRef.current = null;
        setElapsedMs(accumulatedRef.current);
      }
      return;
    }

    runStartedAtRef.current = Date.now();
    const tick = () => {
      const start = runStartedAtRef.current;
      if (start === null) return;
      setElapsedMs(accumulatedRef.current + (Date.now() - start));
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [isRecording, isPaused]);

  if (!isRecording) return null;

  return (
    <div
      className={cx(styles.root, { [styles.paused]: isPaused })}
      aria-live="polite"
      aria-label={`Recording duration ${formatDuration(elapsedMs)}`}
    >
      <span className={styles.dot} />
      <span>{formatDuration(elapsedMs)}</span>
    </div>
  );
};

export default RecordingTimer;
