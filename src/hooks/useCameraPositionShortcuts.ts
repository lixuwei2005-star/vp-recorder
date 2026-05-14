import { useEffect } from 'react';

import {
  CameraPresetName,
  getPresetPosition,
  useCameraPosition,
} from 'contexts/cameraPosition';
import { CAMERA_HEIGHT, CAMERA_WIDTH } from 'services/composer';

const CODE_TO_PRESET: Record<string, CameraPresetName> = {
  Digit1: 'tl',
  Digit2: 'tr',
  Digit3: 'bl',
  Digit4: 'br',
  Digit5: 'center',
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

const useCameraPositionShortcuts = () => {
  const { setPosition } = useCameraPosition();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!event.shiftKey) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const preset = CODE_TO_PRESET[event.code];
      if (!preset) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      // Default screenshare aspect — camera ratio is consistent across the app.
      const sizeFracX = CAMERA_WIDTH / 1920;
      const sizeFracY = CAMERA_HEIGHT / 1080;
      setPosition(getPresetPosition(preset, sizeFracX, sizeFracY));
    };
    document.body.addEventListener('keydown', handler);
    return () => {
      document.body.removeEventListener('keydown', handler);
    };
  }, [setPosition]);
};

export default useCameraPositionShortcuts;
