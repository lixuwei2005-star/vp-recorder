import createCache from '@emotion/cache';
import { CacheProvider, EmotionCache } from '@emotion/react';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  CSSProperties,
  SyntheticEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { Teleprompter } from 'components/Teleprompter/Teleprompter';
import { computeVideoFramingStyle } from 'components/VideoStreams/VideoStreams';
import { useCameraFraming } from 'contexts/cameraFraming';
import { useCameraPosition } from 'contexts/cameraPosition';
import { useCameraShape } from 'contexts/cameraShape';
import { useI18n } from 'contexts/i18n';
import { useLayout } from 'contexts/layout';
import { useStreams } from 'contexts/streams';
import { useTeleprompter } from 'contexts/teleprompter';
import { useVirtualBackground } from 'contexts/virtualBackground';
import useVideoSource from 'hooks/useVideoSource';
import useVirtualBackgroundPreview from 'hooks/useVirtualBackgroundPreview';

import styles from './PiPWindow.module.css';

type PiPWindowProps = {
  pipWindow: Window;
};

const COLLAPSE_STORAGE_KEY = 'pip-sections:v1';

type CollapseState = {
  cameraCollapsed: boolean;
  teleprompterCollapsed: boolean;
};

const DEFAULT_COLLAPSE: CollapseState = {
  cameraCollapsed: false,
  teleprompterCollapsed: false,
};

function loadCollapse(): CollapseState {
  if (typeof window === 'undefined') return DEFAULT_COLLAPSE;
  try {
    const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (!raw) return DEFAULT_COLLAPSE;
    const parsed = JSON.parse(raw);
    return {
      cameraCollapsed: !!parsed?.cameraCollapsed,
      teleprompterCollapsed: !!parsed?.teleprompterCollapsed,
    };
  } catch {
    return DEFAULT_COLLAPSE;
  }
}

function saveCollapse(state: CollapseState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / disabled — ignore */
  }
}

// Approximate body heights (px) for each expanded section, used to size the
// PiP window so its content fits without scrollbars. The user may freely
// resize after; we only programmatically adjust on collapse toggles.
const CAMERA_BODY_FALLBACK_PX = 320;
const TELEPROMPTER_BODY_PX = 460;
const HEADER_PX = 32;
const PIP_WIDTH = 480;

const PiPWindow = ({ pipWindow }: PiPWindowProps) => {
  const { layout } = useLayout();

  const { cameraStream } = useStreams();
  const { shape } = useCameraShape();
  const { framing, previewVideoRef } = useCameraFraming();
  const { cameraAspectRatio, setCameraAspectRatio } = useCameraPosition();
  const {
    option: backgroundOption,
    imageElement,
    setOption: setBackgroundOption,
    setLoadError: setBackgroundLoadError,
  } = useVirtualBackground();
  const { enabled: teleprompterEnabled, setEnabled: setTeleprompterEnabled } =
    useTeleprompter();
  const { t } = useI18n();

  const [collapse, setCollapse] = useState<CollapseState>(loadCollapse);
  useEffect(() => {
    saveCollapse(collapse);
  }, [collapse]);

  const cameraVisible = layout !== 'screenOnly';
  const cameraExpanded = cameraVisible && !collapse.cameraCollapsed;
  const teleprompterExpanded =
    teleprompterEnabled && !collapse.teleprompterCollapsed;

  // Programmatically size the PiP window to fit the visible sections.
  // The user can still resize freely after this fires — we only call resizeTo
  // when section expansion changes (or on first mount). Document PiP API:
  // https://developer.mozilla.org/en-US/docs/Web/API/DocumentPictureInPicture
  useEffect(() => {
    // Camera body height: square/circle is 1:1, rectangle uses aspect ratio.
    // Falls back to a sensible default before the first onResize fires.
    let cameraBodyPx = CAMERA_BODY_FALLBACK_PX;
    if (shape === 'square' || shape === 'circle') {
      cameraBodyPx = PIP_WIDTH;
    } else if (cameraAspectRatio > 0) {
      cameraBodyPx = Math.round(PIP_WIDTH / cameraAspectRatio);
    }

    let h = 0;
    if (cameraVisible) h += cameraExpanded ? cameraBodyPx + HEADER_PX : HEADER_PX;
    if (teleprompterEnabled)
      h += teleprompterExpanded ? TELEPROMPTER_BODY_PX + HEADER_PX : HEADER_PX;
    // Minimum so the window doesn't disappear entirely.
    h = Math.max(h, 80);
    try {
      pipWindow.resizeTo(PIP_WIDTH, h);
    } catch {
      /* Some browsers may refuse — silently fall back to user resize. */
    }
  }, [
    pipWindow,
    cameraVisible,
    cameraExpanded,
    teleprompterEnabled,
    teleprompterExpanded,
    shape,
    cameraAspectRatio,
  ]);

  // Run the VB preview pipeline inside the PiP window when a non-none
  // background is selected. The in-page VideoStreams pipeline is gated on
  // `!pipWindow`, so it goes idle while we're mounted — only one pipeline
  // runs at a time.
  const virtualBackgroundActive =
    backgroundOption.kind !== 'none' && cameraStream != null;

  const updateCameraSource = useVideoSource(
    virtualBackgroundActive ? null : cameraStream,
  );

  const { setCanvas: setVbCanvas, videoDim: vbVideoDim } =
    useVirtualBackgroundPreview({
      enabled: virtualBackgroundActive,
      cameraStream,
      option: backgroundOption,
      imageElement,
      onError: (err) => {
        // eslint-disable-next-line no-console
        console.warn('[VirtualBG/PiP] preview pipeline failed:', err);
        setBackgroundLoadError(t('bg.loadFailed'));
        setBackgroundOption({ kind: 'none' });
      },
    });

  const [cameraVideoDim, setCameraVideoDim] = useState<{
    w: number;
    h: number;
  } | null>(null);

  const onCameraResize = (event: SyntheticEvent<HTMLVideoElement>) => {
    const { videoWidth, videoHeight } = event.currentTarget;
    if (videoWidth > 0 && videoHeight > 0) {
      setCameraAspectRatio(videoWidth / videoHeight);
      setCameraVideoDim((prev) =>
        prev && prev.w === videoWidth && prev.h === videoHeight
          ? prev
          : { w: videoWidth, h: videoHeight },
      );
    }
  };

  const effectiveCameraVideoDim = virtualBackgroundActive
    ? vbVideoDim
    : cameraVideoDim;

  const previewVideoStyle = effectiveCameraVideoDim
    ? computeVideoFramingStyle({
        shape,
        zoom: framing.zoom,
        offsetX: framing.offsetX,
        offsetY: framing.offsetY,
        videoW: effectiveCameraVideoDim.w,
        videoH: effectiveCameraVideoDim.h,
        mirror: true,
      })
    : null;

  const cameraFrameStyle: CSSProperties & Record<string, string | number> = {
    '--camera-aspect-ratio':
      cameraAspectRatio > 0 ? `${cameraAspectRatio}` : '4 / 3',
  };

  const attachPreviewVideo = useCallback(
    (node: HTMLVideoElement | null) => {
      previewVideoRef.current = node;
      updateCameraSource(node);
    },
    [previewVideoRef, updateCameraSource],
  );
  const attachPreviewCanvas = useCallback(
    (node: HTMLCanvasElement | null) => {
      previewVideoRef.current = node;
      setVbCanvas(node);
    },
    [previewVideoRef, setVbCanvas],
  );

  const cssCacheRef = useRef<EmotionCache | null>(null);
  if (!cssCacheRef.current) {
    cssCacheRef.current = createCache({
      key: 'external',
      container: pipWindow.document.body,
    });
  }

  const toggleCamera = useCallback(
    () =>
      setCollapse((s) => ({ ...s, cameraCollapsed: !s.cameraCollapsed })),
    [],
  );
  const toggleTeleprompter = useCallback(
    () =>
      setCollapse((s) => ({
        ...s,
        teleprompterCollapsed: !s.teleprompterCollapsed,
      })),
    [],
  );

  return createPortal(
    <CacheProvider value={cssCacheRef.current}>
      <div
        className={styles.root}
        data-teleprompter-active={teleprompterExpanded ? 'true' : 'false'}
      >
        {cameraVisible && (
          <section
            className={`${styles.section} ${styles.cameraSection}`}
            data-expanded={cameraExpanded ? 'true' : 'false'}
          >
            <header className={styles.sectionHeader}>
              <button
                type="button"
                className={styles.collapseToggle}
                onClick={toggleCamera}
                title={cameraExpanded ? 'Collapse camera' : 'Expand camera'}
              >
                {cameraExpanded ? (
                  <ExpandMoreIcon fontSize="small" />
                ) : (
                  <ChevronRightIcon fontSize="small" />
                )}
                <span>Camera</span>
              </button>
            </header>
            {cameraExpanded && (
              <div className={`${styles.sectionBody} ${styles.cameraBody}`}>
                <div
                  className={styles.cameraFrame}
                  data-shape={shape}
                  style={cameraFrameStyle}
                >
                  {virtualBackgroundActive ? (
                    <canvas
                      ref={attachPreviewCanvas}
                      style={previewVideoStyle ?? undefined}
                    />
                  ) : (
                    <video
                      ref={attachPreviewVideo}
                      style={previewVideoStyle ?? undefined}
                      autoPlay
                      playsInline
                      muted
                      controls={false}
                      // eslint-disable-next-line react/no-unknown-property
                      onResize={onCameraResize}
                    />
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {teleprompterEnabled && (
          <section
            className={styles.section}
            data-expanded={teleprompterExpanded ? 'true' : 'false'}
          >
            <header className={styles.sectionHeader}>
              <button
                type="button"
                className={styles.collapseToggle}
                onClick={toggleTeleprompter}
                title={
                  teleprompterExpanded
                    ? 'Collapse teleprompter'
                    : 'Expand teleprompter'
                }
              >
                {teleprompterExpanded ? (
                  <ExpandMoreIcon fontSize="small" />
                ) : (
                  <ChevronRightIcon fontSize="small" />
                )}
                <span>Teleprompter</span>
              </button>
            </header>
            {teleprompterExpanded && (
              <div className={styles.sectionBody}>
                <Teleprompter
                  variant="inline"
                  onClose={() => setTeleprompterEnabled(false)}
                />
              </div>
            )}
          </section>
        )}
      </div>
    </CacheProvider>,
    pipWindow.document.body,
  );
};

export default PiPWindow;
