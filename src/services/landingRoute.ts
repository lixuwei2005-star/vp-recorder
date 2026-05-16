export type View = 'landing' | 'app';

const STORAGE_KEY = 'app:seen-intro';

export function getInitialView(): View {
  if (typeof window === 'undefined') return 'app';
  const params = new URLSearchParams(window.location.search);
  if (params.get('intro') === '1') return 'landing';
  if (params.get('app') === '1') return 'app';
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
      ? 'app'
      : 'landing';
  } catch {
    return 'landing';
  }
}

export function enterApp(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    /* ignore */
  }
  window.location.assign('/?app=1');
}

export function showIntro(): void {
  window.location.assign('/?intro=1');
}
