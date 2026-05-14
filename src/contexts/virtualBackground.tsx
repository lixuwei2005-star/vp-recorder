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

import type { GradientSpec } from 'services/virtualBackground';

// The serialisable surface of a background choice (what we persist in
// localStorage and what UI components select). The richer
// `BackgroundChoice` from services/virtualBackground.ts includes resolved
// CanvasImageSource refs that can't be serialised — we materialise those
// from `imageDataUrl` at runtime.
export type BackgroundOption =
  | { kind: 'none' }
  | { kind: 'blur'; strength?: number }
  | { kind: 'color'; id: string; color: string }
  | { kind: 'gradient'; id: string; gradient: GradientSpec }
  | { kind: 'image'; id: string; imageDataUrl: string };

export const DEFAULT_BACKGROUND: BackgroundOption = { kind: 'none' };

const STORAGE_KEY = 'vpr.virtualBackground';
// Stored uploaded image, separately so it survives across reloads if the
// user picked a non-image option mid-session.
const UPLOAD_STORAGE_KEY = 'vpr.virtualBackground.upload';

const readStored = (): BackgroundOption => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BACKGROUND;
    const parsed = JSON.parse(raw) as BackgroundOption;
    if (parsed && typeof parsed === 'object' && 'kind' in parsed) {
      // For image, we don't persist the dataURL inside the main key so the
      // selection record stays small. Read upload separately.
      if (parsed.kind === 'image') {
        try {
          const upload = localStorage.getItem(UPLOAD_STORAGE_KEY);
          if (upload) {
            return { kind: 'image', id: parsed.id, imageDataUrl: upload };
          }
        } catch {
          /* fall through */
        }
        return DEFAULT_BACKGROUND;
      }
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_BACKGROUND;
};

const readStoredUpload = (): string | null => {
  try {
    return localStorage.getItem(UPLOAD_STORAGE_KEY);
  } catch {
    return null;
  }
};

type VirtualBackgroundContextValue = {
  option: BackgroundOption;
  setOption: (option: BackgroundOption) => void;
  /** Always-live mirror for non-React consumers (composer). */
  optionRef: React.MutableRefObject<BackgroundOption>;
  /** Most recent user-uploaded image (dataURL). May be null. */
  uploadedImage: string | null;
  setUploadedImage: (dataUrl: string | null) => void;
  /**
   * Materialised <img> element for the currently selected image background,
   * shared by the preview and recording composer so we only decode the
   * uploaded dataURL once. Null when option is not 'image' or the image is
   * still loading.
   */
  imageElement: HTMLImageElement | null;
  imageElementRef: React.MutableRefObject<HTMLImageElement | null>;
  /**
   * Set by the preview pipeline when MediaPipe fails to load (WASM error,
   * model download error, GPU init error). UI surfaces this so users know
   * VB isn't available; auto-falls back to 'none'.
   */
  loadError: string | null;
  setLoadError: (error: string | null) => void;
};

const VirtualBackgroundContext = createContext<
  VirtualBackgroundContextValue | undefined
>(undefined);

export const VirtualBackgroundProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [option, setOptionState] = useState<BackgroundOption>(readStored);
  const optionRef = useRef<BackgroundOption>(option);
  optionRef.current = option;

  const [uploadedImage, setUploadedImageState] = useState<string | null>(
    readStoredUpload,
  );

  // Decoded <img> element kept in sync with `option` + `uploadedImage`.
  // Lives in the context so preview + composer share one decode pass instead
  // of each materialising the dataURL separately.
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(
    null,
  );
  const imageElementRef = useRef<HTMLImageElement | null>(null);
  imageElementRef.current = imageElement;

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (option.kind !== 'image' || !uploadedImage) {
      setImageElement(null);
      return undefined;
    }
    const img = new Image();
    let cancelled = false;
    img.onload = () => {
      if (!cancelled) setImageElement(img);
    };
    img.onerror = () => {
      if (!cancelled) setImageElement(null);
    };
    img.src = uploadedImage;
    return () => {
      cancelled = true;
    };
  }, [option, uploadedImage]);

  useEffect(() => {
    try {
      if (option.kind === 'image') {
        // Persist a slim selection record; the heavy dataURL lives under its
        // own key so other selections don't bloat the main entry.
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ kind: 'image', id: option.id }),
        );
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(option));
      }
    } catch {
      /* localStorage may be full or unavailable — ignore */
    }
  }, [option]);

  useEffect(() => {
    try {
      if (uploadedImage) {
        localStorage.setItem(UPLOAD_STORAGE_KEY, uploadedImage);
      } else {
        localStorage.removeItem(UPLOAD_STORAGE_KEY);
      }
    } catch {
      /* dataURL can exceed quota for large images — silently skip */
    }
  }, [uploadedImage]);

  const setOption = useCallback((next: BackgroundOption) => {
    setOptionState(next);
  }, []);

  const setUploadedImage = useCallback((dataUrl: string | null) => {
    setUploadedImageState(dataUrl);
  }, []);

  const value = useMemo<VirtualBackgroundContextValue>(
    () => ({
      option,
      setOption,
      optionRef,
      uploadedImage,
      setUploadedImage,
      imageElement,
      imageElementRef,
      loadError,
      setLoadError,
    }),
    [
      option,
      setOption,
      uploadedImage,
      setUploadedImage,
      imageElement,
      loadError,
    ],
  );

  return (
    <VirtualBackgroundContext.Provider value={value}>
      {children}
    </VirtualBackgroundContext.Provider>
  );
};

export const useVirtualBackground = () => {
  const ctx = useContext(VirtualBackgroundContext);
  if (!ctx) {
    throw new Error(
      'useVirtualBackground must be used within a VirtualBackgroundProvider',
    );
  }
  return ctx;
};
