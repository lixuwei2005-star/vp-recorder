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

export type CameraShape = 'rectangle' | 'square' | 'circle';

const SHAPE_VALUES: readonly CameraShape[] = ['rectangle', 'square', 'circle'];
const STORAGE_KEY = 'cameraShape';
export const DEFAULT_CAMERA_SHAPE: CameraShape = 'rectangle';

const readStoredShape = (): CameraShape => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && SHAPE_VALUES.includes(raw as CameraShape)) {
      return raw as CameraShape;
    }
  } catch {
    // ignore
  }
  return DEFAULT_CAMERA_SHAPE;
};

export const getEffectiveCameraAspectRatio = (
  shape: CameraShape,
  cameraAspectRatio: number,
): number => {
  if (shape === 'rectangle') {
    return cameraAspectRatio > 0 ? cameraAspectRatio : 4 / 3;
  }
  return 1;
};

type CameraShapeContextType = {
  shape: CameraShape;
  setShape: (shape: CameraShape) => void;
  shapeRef: React.MutableRefObject<CameraShape>;
  // Convenience for legacy callers; true iff shape === 'circle'.
  isCircle: boolean;
};

const CameraShapeContext = createContext<CameraShapeContextType | undefined>(
  undefined,
);

export const CameraShapeProvider = ({ children }: { children: ReactNode }) => {
  const [shape, setShapeState] = useState<CameraShape>(readStoredShape);
  const shapeRef = useRef<CameraShape>(shape);
  shapeRef.current = shape;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, shape);
    } catch {
      // ignore
    }
  }, [shape]);

  const setShape = useCallback((next: CameraShape) => {
    setShapeState(next);
  }, []);

  const value = useMemo<CameraShapeContextType>(
    () => ({
      shape,
      setShape,
      shapeRef,
      isCircle: shape === 'circle',
    }),
    [shape, setShape],
  );

  return (
    <CameraShapeContext.Provider value={value}>
      {children}
    </CameraShapeContext.Provider>
  );
};

export const useCameraShape = () => {
  const context = useContext(CameraShapeContext);
  if (context === undefined) {
    throw new Error('useCameraShape must be used within a CameraShapeProvider');
  }
  return context;
};
