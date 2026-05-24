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
  'screenshare.monitorWarning':
    'Sharing the entire screen records the teleprompter too. Switch to a window/tab share, or drag the teleprompter to another monitor.',
  'screenshare.switchSource': 'Switch source',
  'browser.notSupportedTitle': 'This browser is not yet supported',
  'browser.notSupportedBody':
    'This app requires the following browser APIs which are currently only supported in Chrome:',
  'browser.openChrome': 'Google Chrome',
  'modal.recordingComplete': 'Recording Complete',
  'modal.downloadWebm': 'Download (WebM)',
  'modal.cancel': 'Cancel',
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
  'footer.viewIntro': 'View intro',
  'landing.brand': 'vp-recorder',
  'landing.nav.github': 'GitHub',
  'landing.nav.start': 'Get Started',
  'landing.hero.title': 'Record professional presentations in your browser',
  'landing.hero.subtitle':
    'Screen, camera, teleprompter, and virtual background — all in one, fully local.',
  'landing.hero.cta.primary': 'Get Started',
  'landing.hero.cta.secondary': 'View on GitHub',
  'landing.hero.trust': 'No signup · No download · Video never leaves your browser',
  'landing.features.title': 'Everything you need to record a great take',
  'landing.features.f1.title': 'Dual-stream recording',
  'landing.features.f1.body':
    'Live-composite screen and webcam. The camera overlay is draggable with circle, square, or portrait shapes.',
  'landing.features.f2.title': 'Smart face tracking',
  'landing.features.f2.body':
    'MediaPipe detects your face and keeps it centered — stay on-frame even when you shift in your chair.',
  'landing.features.f3.title': 'Virtual background',
  'landing.features.f3.body':
    'Real-time selfie segmentation: pick blur, a preset, or upload your own image (up to 4 MB).',
  'landing.features.f4.title': 'Floating teleprompter',
  'landing.features.f4.body':
    'Cross-window prompter you can drag to a second monitor. Auto-scroll or manual paging with tunable size, color, and speed.',
  'landing.features.f5.title': 'Privacy first',
  'landing.features.f5.body':
    'Everything happens in your browser. Your recording never leaves your device.',
  'landing.steps.title': 'Five steps to your first recording',
  'landing.steps.s1.title': 'Grant device access',
  'landing.steps.s1.body':
    'The browser will ask for camera and microphone permission — click allow.',
  'landing.steps.s2.title': 'Share your screen',
  'landing.steps.s2.body':
    'Pick a source from the footer: entire screen, an application window, or a browser tab.',
  'landing.steps.s3.title': 'Adjust the layout',
  'landing.steps.s3.body':
    'Choose screen-only or screen+camera. Position and shape the camera, optionally turn on virtual background or auto-framing.',
  'landing.steps.s4.title': 'Start recording',
  'landing.steps.s4.body':
    'Hit the red record button. Pause and resume any time. If the teleprompter is on, drag it to another monitor or share just a window so it stays out of the final video.',
  'landing.steps.s5.title': 'Export',
  'landing.steps.s5.body':
    'When you stop, download the WebM file — no upload involved.',
  'landing.shortcuts.title': 'Keyboard shortcuts',
  'landing.shortcuts.key.shiftNum': 'Shift + 1 — 5',
  'landing.shortcuts.desc.shiftNum':
    'Snap camera to 5 preset positions (four corners + center)',
  'landing.shortcuts.key.shiftSize': 'Shift + = / -',
  'landing.shortcuts.desc.shiftSize':
    'Grow / shrink the camera overlay (mouse wheel works too)',
  'landing.shortcuts.key.space': 'Space',
  'landing.shortcuts.desc.space':
    'Teleprompter play / pause in auto mode; next page in manual mode',
  'landing.shortcuts.key.pageUpDown': '↑ / ↓ · PageUp / PageDown',
  'landing.shortcuts.desc.pageUpDown': 'Teleprompter previous / next page',
  'landing.shortcuts.key.home': 'Home',
  'landing.shortcuts.desc.home': 'Jump teleprompter back to the start',
  'landing.faq.title': 'Frequently asked',
  'landing.faq.q1': 'Does my video get uploaded anywhere?',
  'landing.faq.a1':
    'No. The entire pipeline runs in your browser. Nothing leaves your machine.',
  'landing.faq.q2': 'Which browsers are supported?',
  'landing.faq.a2':
    'Chromium browsers with documentPictureInPicture and MediaStreamTrackProcessor support. The latest Chrome or Edge works; Firefox and Safari are not yet supported.',
  'landing.faq.q3': 'Is there a recording time limit?',
  'landing.faq.a3':
    'No hard limit, but recordings are held in browser memory. Single sessions under 60 minutes are recommended; split long shoots into segments.',
  'landing.faq.q4': 'Can I capture system audio too?',
  'landing.faq.a4':
    'When you share a tab or the entire screen, the browser offers a "share audio" checkbox. Single-window shares typically cannot include system audio.',
  'landing.faq.q5': 'Will the teleprompter be visible in my final video?',
  'landing.faq.a5':
    'Only if you share the entire screen — the app warns you about this. Drag the teleprompter to a second monitor, or share just a window or tab.',
  'landing.cta.bottom.title': 'Ready to record?',
  'landing.cta.bottom.body':
    'No account, no install — your browser is the only thing you need.',
  'landing.footer.credits':
    'Forked from addyosmani/recorder with added floating teleprompter, virtual background, smart face tracking, and bilingual UI.',
  'landing.footer.license': 'MIT License',
  'landing.footer.viewSource': 'View source on GitHub',
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
  'screenshare.monitorWarning':
    '整屏共享会把提词器一起录进去。建议改为共享某个窗口/标签页，或把提词器拖到另一块显示器上。',
  'screenshare.switchSource': '切换来源',
  'browser.notSupportedTitle': '当前浏览器暂不支持',
  'browser.notSupportedBody':
    '此应用需要以下浏览器 API,目前仅 Chrome 支持:',
  'browser.openChrome': 'Google Chrome',
  'modal.recordingComplete': '录制完成',
  'modal.downloadWebm': '下载 WebM',
  'modal.cancel': '取消',
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
  'footer.viewIntro': '查看介绍',
  'landing.brand': 'vp-recorder',
  'landing.nav.github': 'GitHub',
  'landing.nav.start': '开始使用',
  'landing.hero.title': '在浏览器中录制专业演示视频',
  'landing.hero.subtitle':
    '屏幕、摄像头、提词器、虚拟背景 —— 一体化，全本地处理。',
  'landing.hero.cta.primary': '开始使用',
  'landing.hero.cta.secondary': '查看 GitHub',
  'landing.hero.trust': '无需注册 · 无需下载 · 视频不出浏览器',
  'landing.features.title': '一站式完成一次专业录制',
  'landing.features.f1.title': '双流同步录制',
  'landing.features.f1.body':
    '屏幕与摄像头实时合成；摄像头悬浮窗可拖动，圆形 / 方形 / 竖屏三种形状任选。',
  'landing.features.f2.title': '智能脸部追踪',
  'landing.features.f2.body':
    '基于 MediaPipe 自动识别脸部并保持居中，移动时也能稳稳出镜，无需手动调整。',
  'landing.features.f3.title': '虚拟背景',
  'landing.features.f3.body':
    '实时人像分割，支持模糊背景、预设色板或自定义图片背景（最大 4 MB）。',
  'landing.features.f4.title': '浮动提词器',
  'landing.features.f4.body':
    '跨窗口浮动，可拖到副屏。支持自动滚动与手动翻页，字号、颜色、速度全可调。',
  'landing.features.f5.title': '隐私优先',
  'landing.features.f5.body':
    '所有处理都在你的浏览器内完成，视频从不离开本机。',
  'landing.steps.title': '5 步完成第一次录制',
  'landing.steps.s1.title': '授权设备',
  'landing.steps.s1.body':
    '浏览器会请求访问摄像头与麦克风，点击允许。',
  'landing.steps.s2.title': '共享屏幕',
  'landing.steps.s2.body':
    '在底部选择共享源：整个屏幕、应用窗口或浏览器标签页。',
  'landing.steps.s3.title': '调整布局',
  'landing.steps.s3.body':
    '选择"仅屏幕"或"屏幕 + 摄像头"，设置摄像头位置与形状，可选启用虚拟背景或自动脸部追踪。',
  'landing.steps.s4.title': '开始录制',
  'landing.steps.s4.body':
    '点击中央红色录制按钮，可随时暂停 / 继续。启用提词器时，建议把提词器拖到副屏或共享单个窗口，避免被录进画面。',
  'landing.steps.s5.title': '导出',
  'landing.steps.s5.body':
    '录制结束后下载 WebM 文件 —— 全程无上传。',
  'landing.shortcuts.title': '快捷键',
  'landing.shortcuts.key.shiftNum': 'Shift + 1 — 5',
  'landing.shortcuts.desc.shiftNum': '摄像头吸附到 5 个预设位置（四角 + 居中）',
  'landing.shortcuts.key.shiftSize': 'Shift + = / -',
  'landing.shortcuts.desc.shiftSize': '增大 / 缩小摄像头（也可使用鼠标滚轮）',
  'landing.shortcuts.key.space': '空格',
  'landing.shortcuts.desc.space':
    '自动模式：提词器播放 / 暂停；手动模式：下一段',
  'landing.shortcuts.key.pageUpDown': '↑ / ↓ · PageUp / PageDown',
  'landing.shortcuts.desc.pageUpDown': '提词器上一段 / 下一段',
  'landing.shortcuts.key.home': 'Home',
  'landing.shortcuts.desc.home': '提词器回到开头',
  'landing.faq.title': '常见问题',
  'landing.faq.q1': '录制视频会上传到服务器吗？',
  'landing.faq.a1':
    '不会。整个流程都在你的浏览器中完成，视频从不离开本机。',
  'landing.faq.q2': '支持哪些浏览器？',
  'landing.faq.a2':
    '需要支持 documentPictureInPicture 和 MediaStreamTrackProcessor 的 Chromium 浏览器。推荐最新版 Chrome 或 Edge；Firefox / Safari 暂不支持。',
  'landing.faq.q3': '录制时长有限制吗？',
  'landing.faq.a3':
    '没有强制限制，但视频在浏览器内存中暂存。建议单次不超过 60 分钟，长视频可分段录制。',
  'landing.faq.q4': '可以同时录制系统音频吗？',
  'landing.faq.a4':
    '共享标签页或整个屏幕时，浏览器会提供"共享音频"勾选项；共享单个应用窗口时一般不支持。',
  'landing.faq.q5': '共享整个屏幕会把提词器也录进视频吗？',
  'landing.faq.a5':
    '会的，工具检测到这种情况会给出警告。建议把提词器拖到副屏，或改为共享应用窗口 / 标签页。',
  'landing.cta.bottom.title': '准备好录制了吗？',
  'landing.cta.bottom.body': '无需账号、无需安装——你的浏览器就是全部。',
  'landing.footer.credits':
    '派生自 addyosmani/recorder，在其基础上新增了浮动提词器、虚拟背景、智能脸部追踪与中英双语界面。',
  'landing.footer.license': 'MIT 协议',
  'landing.footer.viewSource': '在 GitHub 查看源码',
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
