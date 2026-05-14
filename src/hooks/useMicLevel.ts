import { useEffect, useRef, useState } from 'react';

import { getAudioMixer } from 'services/audioMixer';

const SILENCE_RMS_THRESHOLD = 0.008;
const SILENCE_HOLD_MS = 3000;

type UseMicLevelResult = {
  getAnalyser: () => AnalyserNode | null;
  noSignal: boolean;
};

// The analyser lives on the shared audio mixer graph (so the level meter
// reflects exactly the signal that gets recorded — after mute / mic swap).
// `stream` is only used to know whether a mic is currently connected:
// when null we report no analyser (the meter component hides itself).
const useMicLevel = (stream: MediaStream | null): UseMicLevelResult => {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [noSignal, setNoSignal] = useState(false);

  useEffect(() => {
    if (!stream) {
      analyserRef.current = null;
      setNoSignal(false);
      return;
    }

    const analyser = getAudioMixer().getAnalyserNode();
    analyserRef.current = analyser;
    const timeBuf = new Uint8Array(analyser.fftSize);
    let rafId = 0;
    let silenceStart: number | null = null;
    let lastNoSignal = false;

    const tick = () => {
      analyser.getByteTimeDomainData(timeBuf);
      let sumSq = 0;
      for (let i = 0; i < timeBuf.length; i++) {
        const v = (timeBuf[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / timeBuf.length);
      const now = performance.now();
      if (rms < SILENCE_RMS_THRESHOLD) {
        if (silenceStart === null) silenceStart = now;
        if (!lastNoSignal && now - silenceStart >= SILENCE_HOLD_MS) {
          lastNoSignal = true;
          setNoSignal(true);
        }
      } else {
        silenceStart = null;
        if (lastNoSignal) {
          lastNoSignal = false;
          setNoSignal(false);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      analyserRef.current = null;
    };
  }, [stream]);

  return {
    getAnalyser: () => analyserRef.current,
    noSignal,
  };
};

export default useMicLevel;
