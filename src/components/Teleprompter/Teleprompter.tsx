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
import MainRecordButton from 'components/MainRecordButton';
import PauseButton from 'components/PauseButton';
import ScreenshareSwitchButton from 'components/ScreenshareSwitchButton';
import { useI18n } from 'contexts/i18n';
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
  { nameKey: 'tp.color.white', value: '#ffffff' },
  { nameKey: 'tp.color.warmYellow', value: '#ffe27a' },
  { nameKey: 'tp.color.softGreen', value: '#b5e8a8' },
  { nameKey: 'tp.color.lightCyan', value: '#a6e3ff' },
  { nameKey: 'tp.color.amber', value: '#ffb24d' },
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
// When resizing, leave at least this much visible body above the controls so
// the user doesn't squeeze the text area to 0 px.
const BODY_MIN_VISIBLE_PX = 60;

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
  const { t } = useI18n();
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
  const dragBarRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // The smallest height at which dragBar + controls fit fully. Computed from
  // the actual rendered chrome so wrapping rows / settings panel can't be
  // clipped by overflow: hidden on .content.
  const [chromeMinH, setChromeMinH] = useState(SIZE_MIN_H);

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

  // Track the rendered chrome height (dragBar + controls). The controls block
  // grows when its row wraps at narrow widths or when the settings panel
  // opens, so a static SIZE_MIN_H can't cover every case. We observe and
  // re-clamp size.height whenever it changes.
  useEffect(() => {
    if (isInline) return;
    const controlsEl = controlsRef.current;
    if (!controlsEl) return;

    const recompute = () => {
      const dh = dragBarRef.current?.offsetHeight ?? 0;
      const ch = controlsEl.offsetHeight;
      const next = Math.max(SIZE_MIN_H, dh + ch + BODY_MIN_VISIBLE_PX);
      setChromeMinH((prev) => (prev === next ? prev : next));
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(controlsEl);
    if (dragBarRef.current) ro.observe(dragBarRef.current);
    return () => ro.disconnect();
  }, [isInline, settingsOpen]);

  // When chromeMinH grows past the current height (e.g. user opens settings
  // panel while the box is short), push the box taller so nothing clips.
  useEffect(() => {
    if (isInline) return;
    setSize((s) =>
      s.height < chromeMinH ? { ...s, height: chromeMinH } : s,
    );
  }, [chromeMinH, isInline]);

  // Inline mode: controls are absolutely pinned to the bottom of the box so
  // they can never be pushed out of view by a small PiP window. We reserve
  // matching space at the bottom of the body so its content (textarea / text
  // scroll area) doesn't render behind the controls bar.
  useEffect(() => {
    if (!isInline) return;
    const controlsEl = controlsRef.current;
    const bodyEl = bodyRef.current;
    if (!controlsEl || !bodyEl) return;

    const applyPadding = () => {
      bodyEl.style.paddingBottom = `${controlsEl.offsetHeight}px`;
    };
    applyPadding();
    const ro = new ResizeObserver(applyPadding);
    ro.observe(controlsEl);
    return () => {
      ro.disconnect();
      bodyEl.style.paddingBottom = '';
    };
  }, [isInline, settingsOpen, showInput]);

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
            chromeMinH,
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
    [size.width, size.height, chromeMinH],
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
    ? // backdropFilter on .content establishes a containing block for fixed
      // descendants, which would anchor the controls bar to .content instead
      // of the PiP viewport. Disable it in inline mode so position: fixed
      // really targets the PiP window.
      ({ backdropFilter: 'none', WebkitBackdropFilter: 'none' } as const)
    : { width: size.width, height: size.height };

  const body = (
    <div
      className={`${styles.content} ${isInline ? styles.contentInline : ''}`}
      style={contentStyle}
    >
      {!isInline && (
        <div
          ref={dragBarRef}
          className={styles.dragBar}
          onPointerDown={startDrag}
        >
          <span className={styles.dragGrip} aria-hidden="true">
            <GripHorizontal className="h-4 w-4" />
          </span>
          <button
            className={styles.closeButton}
            onClick={handleClose}
            title={t('tp.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div ref={bodyRef} className={styles.body}>
        {showInput ? (
          <div className={styles.inputContainer}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('tp.placeholder')}
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

      <div
        ref={controlsRef}
        className={styles.controls}
        style={
          isInline
            ? {
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 100,
              }
            : undefined
        }
      >
        {/*
         * Inline (PiP) variant only: the user has the recording target window
         * in front and can't easily reach the main app's footer. Surface the
         * three most common in-recording actions — switch screen source,
         * start/stop record, pause — right above the playback controls.
         * Floating variant skips this since the main footer already has them.
         */}
        {isInline && (
          <div className={styles.actionRow}>
            <ScreenshareSwitchButton />
            <MainRecordButton />
            <PauseButton />
          </div>
        )}
        <div className={styles.controlsRow}>
          <div className={styles.modeToggle} role="tablist">
            <button
              role="tab"
              aria-selected={mode === 'auto'}
              className={`${styles.modeButton} ${mode === 'auto' ? styles.modeButtonActive : ''}`}
              onClick={() => setMode('auto')}
            >
              {t('tp.auto')}
            </button>
            <button
              role="tab"
              aria-selected={mode === 'manual'}
              className={`${styles.modeButton} ${mode === 'manual' ? styles.modeButtonActive : ''}`}
              onClick={() => setMode('manual')}
            >
              {t('tp.manual')}
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
              title={t('tp.slower')}
            >
              <Minus className="h-4 w-4" />
            </button>
            <div className={styles.speedDisplay}>{speedLevel}</div>
            <button
              className={styles.controlButton}
              onClick={() => changeSpeedLevel(1)}
              disabled={speedDisabled}
              title={t('tp.faster')}
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              className={styles.controlButton}
              onClick={resetTeleprompter}
              title={t('tp.reset')}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          <div className={styles.playbackControls}>
            <button
              className={styles.controlButton}
              onClick={() => seek(-1)}
              title={t('tp.rewind')}
            >
              <Rewind className="h-5 w-5" />
            </button>
            <button
              className={styles.controlButton}
              onClick={togglePlay}
              title={mode === 'auto' ? t('tp.playPause') : t('tp.startReading')}
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
              title={t('tp.forward')}
            >
              <FastForward className="h-5 w-5" />
            </button>
            <button
              className={`${styles.controlButton} ${settingsOpen ? styles.controlButtonActive : ''}`}
              onClick={() => setSettingsOpen((s) => !s)}
              title={t('tp.textSettings')}
            >
              <SettingsIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {settingsOpen && (
          <div className={styles.settingsPanel}>
            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>
                <Type className="h-4 w-4" /> {t('tp.size')}
              </span>
              <button
                className={styles.controlButton}
                onClick={() => changeFontSize(-FONT_SIZE_STEP)}
                title={t('tp.smaller')}
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className={styles.fontSizeDisplay}>{fontSize}px</div>
              <button
                className={styles.controlButton}
                onClick={() => changeFontSize(FONT_SIZE_STEP)}
                title={t('tp.larger')}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className={styles.settingsRow}>
              <span className={styles.settingsLabel}>{t('tp.color')}</span>
              <div className={styles.colorSwatches}>
                {COLOR_PRESETS.map((c) => {
                  const colorLabel = t(c.nameKey);
                  return (
                    <button
                      key={c.value}
                      className={`${styles.colorSwatch} ${fontColor === c.value ? styles.colorSwatchActive : ''}`}
                      style={{ background: c.value }}
                      onClick={() => setFontColor(c.value)}
                      title={colorLabel}
                      aria-label={colorLabel}
                    />
                  );
                })}
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
            title={t('tp.resizeWidth')}
          />
          <div
            className={`${styles.resizeHandle} ${styles.resizeBottom}`}
            onPointerDown={startResize('y')}
            title={t('tp.resizeHeight')}
          />
          <div
            className={`${styles.resizeHandle} ${styles.resizeCorner}`}
            onPointerDown={startResize('xy')}
            title={t('tp.resize')}
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
