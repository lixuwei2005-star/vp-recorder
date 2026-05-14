import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

// Manual camera framing: lets the user pick which portion of the camera frame
// is visible without changing the physical camera. Used to compensate for an
// off-center mount (e.g. camera clipped to the left edge of the monitor).
//
// Plan B (auto face-centering via MediaPipe) will write into the same state:
// when `framingMode === 'auto'`, an external hook is expected to call
// `setFraming(...)` every frame with the tracked offset. The manual sliders
// must be disabled in that mode.
export type CameraFraming = {
  zoom: number; // [1.0, 2.0], 1.0 = no zoom
  offsetX: number; // [-1, 1], +1 = show right side, -1 = show left side
  offsetY: number; // [-1, 1], +1 = show bottom, -1 = show top
};

export type FramingMode = 'manual' | 'auto';

export type FaceTrackingStatus =
  | 'idle'
  | 'loading'
  | 'tracking'
  | 'no-face'
  | 'error';

export const FRAMING_ZOOM_MIN = 1.0;
export const FRAMING_ZOOM_MAX = 2.0;
export const FRAMING_OFFSET_MIN = -1;
export const FRAMING_OFFSET_MAX = 1;

export const DEFAULT_FRAMING: CameraFraming = {
  zoom: 1.0,
  offsetX: 0,
  offsetY: 0,
};

export const DEFAULT_FRAMING_MODE: FramingMode = 'manual';

const FRAMING_STORAGE_KEY = 'vpr.cameraFraming';
const FRAMING_MODE_STORAGE_KEY = 'vpr.cameraFramingMode';

const clampNumber = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export const clampFraming = (
  partial: Partial<CameraFraming>,
  base: CameraFraming = DEFAULT_FRAMING,
): CameraFraming => {
  const zoom =
    typeof partial.zoom === 'number' && Number.isFinite(partial.zoom)
      ? clampNumber(partial.zoom, FRAMING_ZOOM_MIN, FRAMING_ZOOM_MAX)
      : base.zoom;
  const offsetX =
    typeof partial.offsetX === 'number' && Number.isFinite(partial.offsetX)
      ? clampNumber(partial.offsetX, FRAMING_OFFSET_MIN, FRAMING_OFFSET_MAX)
      : base.offsetX;
  const offsetY =
    typeof partial.offsetY === 'number' && Number.isFinite(partial.offsetY)
      ? clampNumber(partial.offsetY, FRAMING_OFFSET_MIN, FRAMING_OFFSET_MAX)
      : base.offsetY;
  return { zoom, offsetX, offsetY };
};

const readStoredFraming = (): CameraFraming => {
  try {
    const raw = localStorage.getItem(FRAMING_STORAGE_KEY);
    if (!raw) return DEFAULT_FRAMING;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return clampFraming(parsed as Partial<CameraFraming>);
    }
  } catch {
    // fall through
  }
  return DEFAULT_FRAMING;
};

const readStoredFramingMode = (): FramingMode => {
  try {
    const raw = localStorage.getItem(FRAMING_MODE_STORAGE_KEY);
    if (raw === 'manual' || raw === 'auto') return raw;
  } catch {
    // fall through
  }
  return DEFAULT_FRAMING_MODE;
};

type CameraFramingContextType = {
  framing: CameraFraming;
  setFraming: (partial: Partial<CameraFraming>) => void;
  resetFraming: () => void;
  framingRef: React.MutableRefObject<CameraFraming>;
  framingMode: FramingMode;
  setFramingMode: (mode: FramingMode) => void;
  framingModeRef: React.MutableRefObject<FramingMode>;
  // Mutated by VideoStreams when the PiP preview surface mounts. May be a
  // <video> or a <canvas> (canvas when virtual background is active and the
  // preview is being rendered through the segmentation pipeline). Read by
  // the face-tracking hook to push width/height/left/top directly into the
  // DOM each animation frame, bypassing React for performance.
  previewVideoRef: React.MutableRefObject<
    HTMLVideoElement | HTMLCanvasElement | null
  >;
  // Surfaced by the face-tracking hook; consumed by FramingSelect.
  faceTrackingStatus: FaceTrackingStatus;
  setFaceTrackingStatus: (status: FaceTrackingStatus) => void;
};

const CameraFramingContext = createContext<CameraFramingContextType | undefined>(
  undefined,
);

export const CameraFramingProvider = ({ children }: { children: ReactNode }) => {
  const [framing, setFramingState] = useState<CameraFraming>(readStoredFraming);
  const framingRef = useRef<CameraFraming>(framing);
  framingRef.current = framing;

  const [framingMode, setFramingModeState] = useState<FramingMode>(
    readStoredFramingMode,
  );
  const framingModeRef = useRef<FramingMode>(framingMode);
  framingModeRef.current = framingMode;

  const previewVideoRef = useRef<HTMLVideoElement | HTMLCanvasElement | null>(
    null,
  );

  const [faceTrackingStatus, setFaceTrackingStatus] =
    useState<FaceTrackingStatus>('idle');

  useEffect(() => {
    try {
      localStorage.setItem(FRAMING_STORAGE_KEY, JSON.stringify(framing));
    } catch {
      // ignore
    }
  }, [framing]);

  useEffect(() => {
    try {
      localStorage.setItem(FRAMING_MODE_STORAGE_KEY, framingMode);
    } catch {
      // ignore
    }
  }, [framingMode]);

  const setFraming = useCallback((partial: Partial<CameraFraming>) => {
    setFramingState((prev) => clampFraming(partial, prev));
  }, []);

  const resetFraming = useCallback(() => {
    setFramingState(DEFAULT_FRAMING);
  }, []);

  const setFramingMode = useCallback((mode: FramingMode) => {
    setFramingModeState(mode);
  }, []);

  const value = useMemo<CameraFramingContextType>(
    () => ({
      framing,
      setFraming,
      resetFraming,
      framingRef,
      framingMode,
      setFramingMode,
      framingModeRef,
      previewVideoRef,
      faceTrackingStatus,
      setFaceTrackingStatus,
    }),
    [
      framing,
      setFraming,
      resetFraming,
      framingMode,
      setFramingMode,
      faceTrackingStatus,
    ],
  );

  return (
    <CameraFramingContext.Provider value={value}>
      {children}
    </CameraFramingContext.Provider>
  );
};

export const useCameraFraming = () => {
  const ctx = useContext(CameraFramingContext);
  if (!ctx) {
    throw new Error(
      'useCameraFraming must be used within a CameraFramingProvider',
    );
  }
  return ctx;
};
