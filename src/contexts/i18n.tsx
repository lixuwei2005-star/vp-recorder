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
  'framing.ariaHorizontal': 'Horizontal framing offset',
  'framing.ariaVertical': 'Vertical framing offset',
  'framing.ariaAutoToggle': 'Toggle auto face centering',
  'mic.noSignal': 'No microphone signal detected',
  'mic.level': 'Microphone level',
  'bg.title': 'Background',
  'bg.none': 'None',
  'bg.blur': 'Blur',
  'bg.custom': 'Custom',
  'bg.upload': 'Upload image',
  'bg.virtualBackground': 'Virtual background',
  'bg.loadFailed':
    'Virtual background failed to load and was disabled. Check WebGL / WASM support.',
  'bg.errChooseImage': 'Please choose an image file.',
  'bg.errTooLarge': 'Image is too large (max 4 MB).',
  'bg.errReadFailed': 'Failed to read image.',
  'bg.altCustom': 'Custom background',
  'bg.removeUpload': 'Remove uploaded background',
  'bg.preset.officeBlue': 'Office Blue',
  'bg.preset.sunset': 'Sunset',
  'bg.preset.mint': 'Mint',
  'bg.preset.midnight': 'Midnight',
  'bg.preset.studioGrey': 'Studio Grey',
  'bg.preset.white': 'White',
  'pip.movedHint': 'Preview moved to floating window',
  'record.ready': 'Ready — open preview',
  'record.start': 'Start recording',
  'record.stop': 'Stop recording',
  'lang.label': 'Language',
  'screenshare.switch': 'Switch shared screen',
  'browser.notSupportedTitle': 'This browser is not yet supported',
  'browser.notSupportedBody':
    'This app requires the following browser APIs which are currently only supported in Chrome:',
  'browser.openChrome': 'Google Chrome',
  'modal.recordingComplete': 'Recording Complete',
  'modal.convertMp4': 'Convert (MP4)',
  'modal.downloadWebm': 'Download (WebM)',
  'modal.initializingEncoder': 'Initializing encoder...',
  'modal.convertingVideo': 'Converting video... {p}%',
  'modal.loadingFfmpeg': 'Loading FFmpeg libraries...',
  'modal.processingInput': 'Processing input file...',
  'modal.startingConversion': 'Starting conversion...',
  'modal.readingFile': 'Reading converted file...',
  'modal.errorPrefix': 'Error: {msg}',
  'shape.rectangle': 'Rectangle',
  'shape.square': 'Square',
  'shape.circle': 'Circle',
  'position.topLeft': 'Top left',
  'position.topRight': 'Top right',
  'position.bottomLeft': 'Bottom left',
  'position.bottomRight': 'Bottom right',
  'position.center': 'Center',
  'position.cameraSize': 'Camera size',
  'device.noCameras': 'No cameras available',
  'device.noMicrophones': 'No microphones available',
  'pause.startFirst': 'Start recording first',
  'pause.resume': 'Resume',
  'pause.pause': 'Pause',
  'pause.resumeRecording': 'Resume recording',
  'pause.pauseRecording': 'Pause recording',
  'github.starOnGitHub': 'Star on GitHub',
  'tp.close': 'Close',
  'tp.placeholder': 'Start typing or paste text here...',
  'tp.auto': 'Auto',
  'tp.manual': 'Manual',
  'tp.slower': 'Slower ([)',
  'tp.faster': 'Faster (])',
  'tp.reset': 'Reset',
  'tp.rewind': 'Rewind (PgUp)',
  'tp.playPause': 'Play / Pause (Space)',
  'tp.startReading': 'Start reading',
  'tp.forward': 'Forward (PgDn)',
  'tp.textSettings': 'Text settings',
  'tp.size': 'Size',
  'tp.smaller': 'Smaller',
  'tp.larger': 'Larger',
  'tp.color': 'Color',
  'tp.color.white': 'White',
  'tp.color.warmYellow': 'Warm Yellow',
  'tp.color.softGreen': 'Soft Green',
  'tp.color.lightCyan': 'Light Cyan',
  'tp.color.amber': 'Amber',
  'tp.resizeWidth': 'Drag to resize width',
  'tp.resizeHeight': 'Drag to resize height',
  'tp.resize': 'Drag to resize',
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
  'framing.ariaHorizontal': '水平画面偏移',
  'framing.ariaVertical': '垂直画面偏移',
  'framing.ariaAutoToggle': '切换人物自动居中',
  'mic.noSignal': '未检测到麦克风声音',
  'mic.level': '麦克风音量',
  'bg.title': '背景',
  'bg.none': '无',
  'bg.blur': '模糊',
  'bg.custom': '自定义',
  'bg.upload': '上传图片',
  'bg.virtualBackground': '虚拟背景',
  'bg.loadFailed':
    '虚拟背景加载失败,已自动关闭。请检查浏览器是否支持 WebGL / WASM。',
  'bg.errChooseImage': '请选择一张图片文件。',
  'bg.errTooLarge': '图片过大(最大 4 MB)。',
  'bg.errReadFailed': '读取图片失败。',
  'bg.altCustom': '自定义背景',
  'bg.removeUpload': '移除已上传的背景',
  'bg.preset.officeBlue': '办公蓝',
  'bg.preset.sunset': '日落',
  'bg.preset.mint': '薄荷',
  'bg.preset.midnight': '午夜',
  'bg.preset.studioGrey': '影棚灰',
  'bg.preset.white': '白色',
  'pip.movedHint': '预览已移至悬浮窗',
  'record.ready': '就绪 — 打开预览',
  'record.start': '开始录制',
  'record.stop': '停止录制',
  'lang.label': '语言',
  'screenshare.switch': '切换共享屏幕',
  'browser.notSupportedTitle': '当前浏览器暂不支持',
  'browser.notSupportedBody':
    '此应用需要以下浏览器 API,目前仅 Chrome 支持:',
  'browser.openChrome': 'Google Chrome',
  'modal.recordingComplete': '录制完成',
  'modal.convertMp4': '转换为 MP4',
  'modal.downloadWebm': '下载 WebM',
  'modal.initializingEncoder': '正在初始化编码器…',
  'modal.convertingVideo': '正在转换视频… {p}%',
  'modal.loadingFfmpeg': '正在加载 FFmpeg 库…',
  'modal.processingInput': '正在处理输入文件…',
  'modal.startingConversion': '开始转换…',
  'modal.readingFile': '正在读取转换后的文件…',
  'modal.errorPrefix': '错误: {msg}',
  'shape.rectangle': '矩形',
  'shape.square': '方形',
  'shape.circle': '圆形',
  'position.topLeft': '左上',
  'position.topRight': '右上',
  'position.bottomLeft': '左下',
  'position.bottomRight': '右下',
  'position.center': '居中',
  'position.cameraSize': '摄像头尺寸',
  'device.noCameras': '没有可用的摄像头',
  'device.noMicrophones': '没有可用的麦克风',
  'pause.startFirst': '请先开始录制',
  'pause.resume': '继续',
  'pause.pause': '暂停',
  'pause.resumeRecording': '继续录制',
  'pause.pauseRecording': '暂停录制',
  'github.starOnGitHub': '在 GitHub 上 Star',
  'tp.close': '关闭',
  'tp.placeholder': '在此输入或粘贴文本…',
  'tp.auto': '自动',
  'tp.manual': '手动',
  'tp.slower': '减速 ([)',
  'tp.faster': '加速 (])',
  'tp.reset': '重置',
  'tp.rewind': '后退 (PgUp)',
  'tp.playPause': '播放 / 暂停 (空格)',
  'tp.startReading': '开始朗读',
  'tp.forward': '前进 (PgDn)',
  'tp.textSettings': '文本设置',
  'tp.size': '字号',
  'tp.smaller': '更小',
  'tp.larger': '更大',
  'tp.color': '颜色',
  'tp.color.white': '白色',
  'tp.color.warmYellow': '暖黄',
  'tp.color.softGreen': '柔绿',
  'tp.color.lightCyan': '浅青',
  'tp.color.amber': '琥珀',
  'tp.resizeWidth': '拖动调整宽度',
  'tp.resizeHeight': '拖动调整高度',
  'tp.resize': '拖动调整大小',
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
  t: (key: string, vars?: Record<string, string | number>) => string;
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
      t: (key, vars) => {
        const raw = dict[key] ?? key;
        if (!vars) return raw;
        return raw.replace(/\{(\w+)\}/g, (_, name) =>
          vars[name] !== undefined ? String(vars[name]) : `{${name}}`,
        );
      },
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
