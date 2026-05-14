import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type Lang = 'zh' | 'en';

const STORAGE_KEY = 'app:lang';

type Dict = Record<string, string>;

const en: Dict = {
  'app.recordYourScreen': 'Record your screen',
  'app.shareScreen': 'Share screen',
  'layout.screenOnly': 'Screen only',
  'layout.screenAndCamera': 'Screen and camera',
  'teleprompter.show': 'Show teleprompter',
  'teleprompter.hide': 'Hide teleprompter',
  'framing.cameraZoom': 'Camera zoom',
  'framing.horizontalPan': 'Horizontal pan (− left / + right)',
  'framing.verticalPan': 'Vertical pan (− up / + down)',
  'framing.reset': 'Reset framing',
  'framing.autoOn': 'Turn off auto-centering',
  'framing.autoOff': 'Auto-center face',
  'framing.statusLoading': 'Loading model…',
  'framing.statusTracking': 'Auto-centering enabled',
  'framing.statusNoFace': 'No face detected',
  'framing.statusError': 'Detection failed, reverted to manual',
  'mic.noSignal': 'No microphone signal detected',
  'bg.title': 'Background',
  'bg.none': 'None',
  'bg.blur': 'Blur',
  'bg.custom': 'Custom',
  'bg.upload': 'Upload image',
  'bg.virtualBackground': 'Virtual background',
  'bg.loadFailed':
    'Virtual background failed to load and was disabled. Check WebGL / WASM support.',
  'pip.movedHint': 'Preview moved to floating window',
  'record.ready': 'Ready — open preview',
  'record.start': 'Start recording',
  'record.stop': 'Stop recording',
  'lang.label': 'Language',
};

const zh: Dict = {
  'app.recordYourScreen': '录制你的屏幕',
  'app.shareScreen': '共享屏幕',
  'layout.screenOnly': '仅屏幕',
  'layout.screenAndCamera': '屏幕和摄像头',
  'teleprompter.show': '显示提词器',
  'teleprompter.hide': '隐藏提词器',
  'framing.cameraZoom': '画面缩放',
  'framing.horizontalPan': '水平平移(− 左 / + 右)',
  'framing.verticalPan': '垂直平移(− 上 / + 下)',
  'framing.reset': '重置画面',
  'framing.autoOn': '关闭人物自动居中',
  'framing.autoOff': '人物自动居中',
  'framing.statusLoading': '加载模型…',
  'framing.statusTracking': '人物自动居中已启用',
  'framing.statusNoFace': '未检测到人脸',
  'framing.statusError': '检测失败,已回退到手动',
  'mic.noSignal': '未检测到麦克风声音',
  'bg.title': '背景',
  'bg.none': '无',
  'bg.blur': '模糊',
  'bg.custom': '自定义',
  'bg.upload': '上传图片',
  'bg.virtualBackground': '虚拟背景',
  'bg.loadFailed':
    '虚拟背景加载失败,已自动关闭。请检查浏览器是否支持 WebGL / WASM。',
  'pip.movedHint': '预览已移至悬浮窗',
  'record.ready': '就绪 — 打开预览',
  'record.start': '开始录制',
  'record.stop': '停止录制',
  'lang.label': '语言',
};

const DICTS: Record<Lang, Dict> = { zh, en };

function loadLang(): Lang {
  if (typeof window === 'undefined') return 'zh';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'zh' || stored === 'en') return stored;
  } catch {
    /* ignore */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : '';
  return nav.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

type I18nContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState<Lang>(loadLang);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  const value = useMemo<I18nContextType>(() => {
    const dict = DICTS[lang];
    return {
      lang,
      setLang,
      t: (key: string) => dict[key] ?? key,
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextType => {
  const ctx = useContext(I18nContext);
  if (ctx === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
};
