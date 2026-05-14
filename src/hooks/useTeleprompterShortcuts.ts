import { useEffect } from 'react';

export type TeleprompterMode = 'auto' | 'manual';

interface UseTeleprompterShortcutsArgs {
  enabled: boolean;
  mode: TeleprompterMode;
  onTogglePlay: () => void;
  onNudge: (dir: -1 | 1) => void;
  onPage: (dir: -1 | 1) => void;
  onHome: () => void;
  onSpeedDelta: (delta: -1 | 1) => void;
  /**
   * When set, the same handler is also bound to this document. Used to wire
   * the shortcut into the Document PiP window so it works when focus is
   * inside the PiP, not just the main page. Pass `null` (not undefined) to
   * be explicit when no extra document is available.
   */
  extraDocument?: Document | null;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

export function useTeleprompterShortcuts({
  enabled,
  mode,
  onTogglePlay,
  onNudge,
  onPage,
  onHome,
  onSpeedDelta,
  extraDocument,
}: UseTeleprompterShortcutsArgs) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      switch (event.key) {
        case ' ':
        case 'Spacebar': {
          event.preventDefault();
          if (mode === 'auto') onTogglePlay();
          else onPage(1);
          return;
        }
        case 'ArrowUp': {
          event.preventDefault();
          onNudge(-1);
          return;
        }
        case 'ArrowDown': {
          event.preventDefault();
          onNudge(1);
          return;
        }
        case 'PageUp': {
          event.preventDefault();
          onPage(-1);
          return;
        }
        case 'PageDown': {
          event.preventDefault();
          onPage(1);
          return;
        }
        case 'Home': {
          event.preventDefault();
          onHome();
          return;
        }
        case '[': {
          if (mode !== 'auto') return;
          event.preventDefault();
          onSpeedDelta(-1);
          return;
        }
        case ']': {
          if (mode !== 'auto') return;
          event.preventDefault();
          onSpeedDelta(1);
          return;
        }
        default:
          return;
      }
    };

    const docs: Document[] = [document];
    if (extraDocument && extraDocument !== document) docs.push(extraDocument);
    for (const d of docs) d.addEventListener('keydown', handler);
    return () => {
      for (const d of docs) d.removeEventListener('keydown', handler);
    };
  }, [
    enabled,
    mode,
    onTogglePlay,
    onNudge,
    onPage,
    onHome,
    onSpeedDelta,
    extraDocument,
  ]);
}

export default useTeleprompterShortcuts;
