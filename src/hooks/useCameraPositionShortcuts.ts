import { useEffect } from 'react';

import { useCameraFraming } from 'contexts/cameraFraming';
import {
  CAMERA_SIZE_MAX,
  CAMERA_SIZE_MIN,
  CameraPresetName,
  clampSize,
  getPresetPosition,
  useCameraPosition,
} from 'contexts/cameraPosition';
import {
  getEffectiveCameraAspectRatio,
  useCameraShape,
} from 'contexts/cameraShape';

const CODE_TO_PRESET: Record<string, CameraPresetName> = {
  Digit1: 'tl',
  Digit2: 'tr',
  Digit3: 'bl',
  Digit4: 'br',
  Digit5: 'center',
};

const DEFAULT_SCREENSHARE_ASPECT = 16 / 9;
const SIZE_SHORTCUT_STEP = 0.02;

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

const useCameraPositionShortcuts = () => {
  const { setPosition, size, setSize, cameraAspectRatio } = useCameraPosition();
  const { shape } = useCameraShape();
  const { resetFraming } = useCameraFraming();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // Ctrl+0 (or Cmd+0) resets framing. Arrow keys are intentionally not
      // bound here to avoid conflicts with slide-deck navigation.
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        !event.altKey &&
        (event.key === '0' || event.code === 'Digit0')
      ) {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        resetFraming();
        return;
      }

      if (!event.shiftKey) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      // Size adjustment shortcuts: Shift+= / Shift++ to grow, Shift+- to shrink.
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setSize(clampSize(size + SIZE_SHORTCUT_STEP));
        return;
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        setSize(clampSize(size - SIZE_SHORTCUT_STEP));
        return;
      }

      const preset = CODE_TO_PRESET[event.code];
      if (!preset) return;
      event.preventDefault();
      const effectiveAspect = getEffectiveCameraAspectRatio(
        shape,
        cameraAspectRatio,
      );
      const sizeFracX = size;
      const sizeFracY = (size * DEFAULT_SCREENSHARE_ASPECT) / effectiveAspect;
      setPosition(getPresetPosition(preset, sizeFracX, sizeFracY));
    };
    document.body.addEventListener('keydown', handler);
    return () => {
      document.body.removeEventListener('keydown', handler);
    };
  }, [setPosition, size, setSize, cameraAspectRatio, shape, resetFraming]);
};

// Re-export size bounds for any caller that wants them.
export { CAMERA_SIZE_MAX, CAMERA_SIZE_MIN };

export default useCameraPositionShortcuts;
