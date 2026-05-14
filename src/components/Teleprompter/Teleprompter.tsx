'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { motion, useDragControls } from 'framer-motion';
import {
  X,
  Play,
  Pause,
  Rewind,
  FastForward,
  Minus,
  Plus,
  RotateCcw,
  Settings as SettingsIcon,
  Type,
  GripHorizontal,
} from 'lucide-react';
import { usePictureInPicture } from 'contexts/pictureInPicture';
import styles from './Teleprompter.module.css';
import useTeleprompterShortcuts, {
  TeleprompterMode,
} from 'hooks/useTeleprompterShortcuts';

const STORAGE_KEY = 'teleprompter:v1';

const SPEED_LEVEL_MIN = 1;
const SPEED_LEVEL_MAX = 10;
const DEFAULT_SPEED_LEVEL = 3;
const speedLevelToPxPerFrame = (level: number) => level * 0.25;

const FONT_SIZE_MIN = 16;
const FONT_SIZE_MAX = 56;
const FONT_SIZE_STEP = 4;
const DEFAULT_FONT_SIZE = 32;

const COLOR_PRESETS = [
  { name: 'White', value: '#ffffff' },
  { name: 'Warm Yellow', value: '#ffe27a' },
  { name: 'Soft Green', value: '#b5e8a8' },
  { name: 'Light Cyan', value: '#a6e3ff' },
  { name: 'Amber', value: '#ffb24d' },
] as const;
const DEFAULT_COLOR = COLOR_PRESETS[0].value;

const NUDGE_PX = 40;
const PAGE_FRACTION = 0.9;
const SEEK_FRACTION = 0.1;

const SIZE_MIN_W = 320;
const SIZE_MAX_W = 1400;
const SIZE_MIN_H = 240;
const SIZE_MAX_H = 1000;
const DEFAULT_WIDTH = 600;
const DEFAULT_HEIGHT = 480;

type PersistedShape = {
  text: string;
  mode: TeleprompterMode;
  speedLevel: number;
  fontSize: number;
  fontColor: string;
  width: number;
  height: number;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function loadPersisted(): Partial<PersistedShape> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function savePersisted(state: PersistedShape) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / disabled — ignore */
  }
}

type ResizeAxis = 'x' | 'y' | 'xy';

export type TeleprompterVariant = 'floating' | 'inline';

interface TeleprompterProps {
  onClose: () => void;
  variant?: TeleprompterVariant;
}

export function Teleprompter({
  onClose,
  variant = 'floating',
}: TeleprompterProps) {
  const isInline = variant === 'inline';
  const { pipWindow } = usePictureInPicture();
  const persisted = useMemo(loadPersisted, []);
  const [text, setText] = useState<string>(persisted.text ?? '');
  const [mode, setMode] = useState<TeleprompterMode>(
    persisted.mode === 'manual' ? 'manual' : 'auto',
  );
  const [speedLevel, setSpeedLevel] = useState<number>(
    clamp(
      persisted.speedLevel ?? DEFAULT_SPEED_LEVEL,
      SPEED_LEVEL_MIN,
      SPEED_LEVEL_MAX,
    ),
  );
  const [fontSize, setFontSize] = useState<number>(
    clamp(persisted.fontSize ?? DEFAULT_FONT_SIZE, FONT_SIZE_MIN, FONT_SIZE_MAX),
  );
  const [fontColor, setFontColor] = useState<string>(
    persisted.fontColor ?? DEFAULT_COLOR,
  );
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: clamp(persisted.width ?? DEFAULT_WIDTH, SIZE_MIN_W, SIZE_MAX_W),
    height: clamp(persisted.height ?? DEFAULT_HEIGHT, SIZE_MIN_H, SIZE_MAX_H),
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [showInput, setShowInput] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollAccumRef = useRef(0);
  const dragControls = useDragControls();

  // Persistence ----------------------------------------------------------
  useEffect(() => {
    savePersisted({
      text,
      mode,
      speedLevel,
      fontSize,
      fontColor,
      width: size.width,
      height: size.height,
    });
  }, [text, mode, speedLevel, fontSize, fontColor, size]);

  // Auto-scroll rAF loop -------------------------------------------------
  useEffect(() => {
    if (mode !== 'auto' || !isPlaying || showInput) return;
    const el = scrollRef.current;
    if (!el) return;
    scrollAccumRef.current = el.scrollTop;

    let raf = 0;
    const tick = () => {
      const node = scrollRef.current;
      if (!node) return;
      if (Math.abs(scrollAccumRef.current - node.scrollTop) > 2) {
        scrollAccumRef.current = node.scrollTop;
      }
      scrollAccumRef.current += speedLevelToPxPerFrame(speedLevel);
      node.scrollTop = scrollAccumRef.current;

      const max = node.scrollHeight - node.clientHeight;
      if (node.scrollTop >= max - 0.5) {
        setIsPlaying(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, isPlaying, speedLevel, showInput]);

  useEffect(() => {
    if (mode === 'manual' && isPlaying) setIsPlaying(false);
  }, [mode, isPlaying]);

  // Actions --------------------------------------------------------------
  const startReading = useCallback(() => {
    setShowInput(false);
    if (mode === 'auto') setIsPlaying(true);
  }, [mode]);

  const togglePlay = useCallback(() => {
    if (showInput) {
      startReading();
      return;
    }
    if (mode === 'auto') setIsPlaying((p) => !p);
  }, [showInput, mode, startReading]);

  const resetTeleprompter = useCallback(() => {
    setSpeedLevel(DEFAULT_SPEED_LEVEL);
    setIsPlaying(false);
    setShowInput(true);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  const handleClose = useCallback(() => {
    setIsPlaying(false);
    setShowInput(true);
    onClose();
  }, [onClose]);

  const scrollByPx = useCallback((delta: number, smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ top: delta, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const scrollPage = useCallback(
    (dir: -1 | 1) => {
      const el = scrollRef.current;
      if (!el) return;
      scrollByPx(dir * el.clientHeight * PAGE_FRACTION);
    },
    [scrollByPx],
  );

  const scrollHome = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const seek = useCallback(
    (dir: -1 | 1) => {
      const el = scrollRef.current;
      if (!el) return;
      const total = el.scrollHeight - el.clientHeight;
      scrollByPx(dir * total * SEEK_FRACTION);
    },
    [scrollByPx],
  );

  const changeSpeedLevel = useCallback((delta: -1 | 1) => {
    setSpeedLevel((s) => clamp(s + delta, SPEED_LEVEL_MIN, SPEED_LEVEL_MAX));
  }, []);

  const changeFontSize = useCallback((delta: number) => {
    setFontSize((s) => clamp(s + delta, FONT_SIZE_MIN, FONT_SIZE_MAX));
  }, []);

  // Drag handle ----------------------------------------------------------
  const startDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isInline) return;
      // Don't drag if pointer started on a button inside the bar.
      if ((event.target as HTMLElement).closest('button')) return;
      dragControls.start(event);
    },
    [dragControls, isInline],
  );

  // Resize handles -------------------------------------------------------
  const startResize = useCallback(
    (axis: ResizeAxis) => (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startY = event.clientY;
      const startW = size.width;
      const startH = size.height;

      const onMove = (mv: PointerEvent) => {
        const next = { width: startW, height: startH };
        if (axis === 'x' || axis === 'xy') {
          next.width = clamp(
            startW + (mv.clientX - startX),
            SIZE_MIN_W,
            SIZE_MAX_W,
          );
        }
        if (axis === 'y' || axis === 'xy') {
          next.height = clamp(
            startH + (mv.clientY - startY),
            SIZE_MIN_H,
            SIZE_MAX_H,
          );
        }
        setSize(next);
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [size.width, size.height],
  );

  // Keyboard shortcuts ---------------------------------------------------
  // Bind to main document and (when PiP is open) the PiP document, so the
  // shortcuts work whether focus is in the main page or the PiP window.
  useTeleprompterShortcuts({
    enabled: !showInput,
    mode,
    onTogglePlay: togglePlay,
    onNudge: (dir) => scrollByPx(dir * NUDGE_PX),
    onPage: scrollPage,
    onHome: scrollHome,
    onSpeedDelta: changeSpeedLevel,
    extraDocument: pipWindow?.document ?? null,
  });

  // ---------------------------------------------------------------------

  const speedDisabled = mode !== 'auto';

  const contentStyle = isInline
    ? undefined
    : { width: size.width, height: size.height };

  const body = (
    <div
      className={`${styles.content} ${isInline ? styles.contentInline : ''}`}
      style={contentStyle}
    >
      {!isInline && (
        <div className={styles.dragBar} onPointerDown={startDrag}>
          <span className={styles.dragGrip} aria-hidden="true">
            <GripHorizontal className="h-4 w-4" />
          </span>
          <button
            className={styles.closeButton}
            onClick={handleClose}
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className={styles.body}>
        {showInput ? (
          <div className={styles.inputContainer}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Start typing or paste text here..."
              className={styles.textarea}
              spellCheck="false"
            />
          </div>
        ) : (
          <div
            ref={scrollRef}
            className={styles.scrollContainer}
            tabIndex={-1}
          >
            <div
              className={styles.textContent}
              style={{ fontSize: `${fontSize}px`, color: fontColor }}
            >
              {text}
            </div>
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <div className={styles.controlsRow}>
          <div className={styles.modeToggle} role="tablist">
            <button
              role="tab"
              aria-selected={mode === 'auto'}
              className={`${styles.modeButton} ${mode === 'auto' ? styles.modeButtonActive : ''}`}
              onClick={() => setMode('auto')}
            >
              Auto
            </button>
            <button
              role="tab"
              aria-selected={mode === 'manual'}
              className={`${styles.modeButton} ${mode === 'manual' ? styles.modeButtonActive : ''}`}
              onClick={() => setMode('manual')}
            >
              Manual
            </button>
          </div>

          <div
            className={`${styles.speedControls} ${speedDisabled ? styles.dimmed : ''}`}
            aria-hidden={speedDisabled}
          >
            <button
              className={styles.controlButton}
              onClick={() => changeSpeedLevel(-1)}
              disabled={speedDisabled}
              title="Slower ([)"
            >
              <Minus className="h-4 w-4" />
            </button>
            <div className={styles.speedDisplay}>{speedLevel}</div>
            <button
              className={styles.controlButton}
              onClick={() => changeSpeedLevel(1)}
              disabled={speedDisabled}
              title="Faster (])"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              className={styles.controlButton}
              onClick={resetTeleprompter}
              title="Reset"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          <div className={styles.playbackControls}>
            <button
              className={styles.controlButton}
              onClick={() => seek(-1)}
              title="Rewind (PgUp)"
            >
              <Rewind className="h-5 w-5" />
            </button>
            <button
              className={styles.controlButton}
              onClick={togglePlay}
              title={mode === 'auto' ? 'Play / Pause (Space)' : 'Start reading'}
            >
              {isPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6" />
              )}
            </button>
            <button
              className={styles.controlButton}
              onClick={() => seek(1)}
              title="Forward (PgDn)"
            >
              <FastForward className="h-5 w-5" />
            </button>
            <button
              className={`${styles.controlButton} ${settingsOpen ? styles.controlButtonActive : ''}`}
              onClick={() => setSettingsOpen((s) => !s)}
              title="Text settings"
            >
              <SettingsIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {settingsOpen && (
          <div className={styles.settingsPanel}>
            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>
                <Type className="h-4 w-4" /> Size
              </span>
              <button
                className={styles.controlButton}
                onClick={() => changeFontSize(-FONT_SIZE_STEP)}
                title="Smaller"
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className={styles.fontSizeDisplay}>{fontSize}px</div>
              <button
                className={styles.controlButton}
                onClick={() => changeFontSize(FONT_SIZE_STEP)}
                title="Larger"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>Color</span>
              <div className={styles.colorSwatches}>
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c.value}
                    className={`${styles.colorSwatch} ${fontColor === c.value ? styles.colorSwatchActive : ''}`}
                    style={{ background: c.value }}
                    onClick={() => setFontColor(c.value)}
                    title={c.name}
                    aria-label={c.name}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {!isInline && (
        <>
          <div
            className={`${styles.resizeHandle} ${styles.resizeRight}`}
            onPointerDown={startResize('x')}
            title="Drag to resize width"
          />
          <div
            className={`${styles.resizeHandle} ${styles.resizeBottom}`}
            onPointerDown={startResize('y')}
            title="Drag to resize height"
          />
          <div
            className={`${styles.resizeHandle} ${styles.resizeCorner}`}
            onPointerDown={startResize('xy')}
            title="Drag to resize"
          />
        </>
      )}
    </div>
  );

  if (isInline) {
    return <div className={styles.inlineContainer}>{body}</div>;
  }

  return (
    <motion.div
      drag
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      className={styles.container}
      draggable="false"
      style={{ touchAction: 'none', userSelect: 'none' }}
    >
      {body}
    </motion.div>
  );
}
