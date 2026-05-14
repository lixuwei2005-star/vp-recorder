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

export type CameraPosition = {
  x: number;
  y: number;
};

export type CameraPresetName = 'tl' | 'tr' | 'bl' | 'br' | 'center';

export const PRESET_NAMES: CameraPresetName[] = [
  'tl',
  'tr',
  'bl',
  'br',
  'center',
];

const PRESET_MARGIN = 0.02;
const PRESET_MATCH_TOLERANCE = 0.01;
export const SNAP_DISTANCE = 0.05;
const POSITION_STORAGE_KEY = 'vpr.cameraPosition';
const SIZE_STORAGE_KEY = 'vpr.cameraSize';

export const CAMERA_SIZE_MIN = 0.12;
export const CAMERA_SIZE_MAX = 0.45;
export const CAMERA_SIZE_DEFAULT = 0.22;
export const DEFAULT_CAMERA_ASPECT_RATIO = 4 / 3;

export const clampSize = (value: number) =>
  Math.min(CAMERA_SIZE_MAX, Math.max(CAMERA_SIZE_MIN, value));

export const getPresetPosition = (
  name: CameraPresetName,
  sizeFracX: number,
  sizeFracY: number,
): CameraPosition => {
  switch (name) {
    case 'tl':
      return { x: PRESET_MARGIN, y: PRESET_MARGIN };
    case 'tr':
      return { x: 1 - sizeFracX - PRESET_MARGIN, y: PRESET_MARGIN };
    case 'bl':
      return { x: PRESET_MARGIN, y: 1 - sizeFracY - PRESET_MARGIN };
    case 'br':
      return {
        x: 1 - sizeFracX - PRESET_MARGIN,
        y: 1 - sizeFracY - PRESET_MARGIN,
      };
    case 'center':
      return { x: 0.5 - sizeFracX / 2, y: 0.5 - sizeFracY / 2 };
  }
};

export const matchPreset = (
  pos: CameraPosition,
  sizeFracX: number,
  sizeFracY: number,
): CameraPresetName | null => {
  for (const name of PRESET_NAMES) {
    const target = getPresetPosition(name, sizeFracX, sizeFracY);
    if (
      Math.abs(target.x - pos.x) < PRESET_MATCH_TOLERANCE &&
      Math.abs(target.y - pos.y) < PRESET_MATCH_TOLERANCE
    ) {
      return name;
    }
  }
  return null;
};

const DEFAULT_POSITION: CameraPosition = { x: 0.855, y: 0.756 };

const readStoredPosition = (): CameraPosition => {
  try {
    const raw = localStorage.getItem(POSITION_STORAGE_KEY);
    if (!raw) return DEFAULT_POSITION;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.x === 'number' &&
      typeof parsed?.y === 'number' &&
      parsed.x >= 0 &&
      parsed.x <= 1 &&
      parsed.y >= 0 &&
      parsed.y <= 1
    ) {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_POSITION;
};

const readStoredSize = (): number => {
  try {
    const raw = localStorage.getItem(SIZE_STORAGE_KEY);
    if (!raw) return CAMERA_SIZE_DEFAULT;
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'number' && Number.isFinite(parsed)) {
      return clampSize(parsed);
    }
  } catch {
    // fall through to default
  }
  return CAMERA_SIZE_DEFAULT;
};

type CameraPositionContextType = {
  position: CameraPosition;
  setPosition: (pos: CameraPosition) => void;
  positionRef: React.MutableRefObject<CameraPosition>;
  size: number;
  setSize: (value: number) => void;
  sizeRef: React.MutableRefObject<number>;
  cameraAspectRatio: number;
  setCameraAspectRatio: (value: number) => void;
  cameraAspectRatioRef: React.MutableRefObject<number>;
};

const CameraPositionContext = createContext<
  CameraPositionContextType | undefined
>(undefined);

export const CameraPositionProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [position, setPositionState] = useState<CameraPosition>(
    readStoredPosition,
  );
  const positionRef = useRef<CameraPosition>(position);
  positionRef.current = position;

  const [size, setSizeState] = useState<number>(readStoredSize);
  const sizeRef = useRef<number>(size);
  sizeRef.current = size;

  const [cameraAspectRatio, setCameraAspectRatioState] = useState<number>(
    DEFAULT_CAMERA_ASPECT_RATIO,
  );
  const cameraAspectRatioRef = useRef<number>(cameraAspectRatio);
  cameraAspectRatioRef.current = cameraAspectRatio;

  useEffect(() => {
    try {
      localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position));
    } catch {
      // localStorage may be unavailable; ignore
    }
  }, [position]);

  useEffect(() => {
    try {
      localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(size));
    } catch {
      // ignore
    }
  }, [size]);

  const setSize = useCallback((value: number) => {
    setSizeState(clampSize(value));
  }, []);

  const setCameraAspectRatio = useCallback((value: number) => {
    if (!Number.isFinite(value) || value <= 0) return;
    setCameraAspectRatioState(value);
  }, []);

  const value = useMemo(
    () => ({
      position,
      setPosition: setPositionState,
      positionRef,
      size,
      setSize,
      sizeRef,
      cameraAspectRatio,
      setCameraAspectRatio,
      cameraAspectRatioRef,
    }),
    [position, size, setSize, cameraAspectRatio, setCameraAspectRatio],
  );

  return (
    <CameraPositionContext.Provider value={value}>
      {children}
    </CameraPositionContext.Provider>
  );
};

export const useCameraPosition = () => {
  const ctx = useContext(CameraPositionContext);
  if (!ctx) {
    throw new Error(
      'useCameraPosition must be used within a CameraPositionProvider',
    );
  }
  return ctx;
};
