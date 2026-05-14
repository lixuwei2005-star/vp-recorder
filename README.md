# vp-recorder

浏览器内的演讲录制工具。屏幕和摄像头同时录制,摄像头以可拖动的悬浮窗叠在画面上;自带人脸自动居中取景、虚拟背景、跨窗口悬浮提词器。全部在浏览器本地运行,不上传任何数据。

本项目是基于 [addyosmani/recorder](https://github.com/addyosmani/recorder) 的二次开发(后者又是 [contrastio/recorder](https://github.com/contrastio/recorder) 的 fork)。

## 主要功能

- **屏幕 + 摄像头合成录制** —— 录屏幕、浏览器标签页或单个窗口,同时把摄像头叠加到最终视频里。
- **可拖动多形状摄像头悬浮窗** —— 圆形 / 方形 / 竖屏比例,自由拖动或吸附到 4 个角落预设,预览和最终录制都保持一致。
- **智能取景与人脸自动居中** —— 人脸跟踪实时把你框在画面中心,移动时自动跟随;支持多档变焦/取景预设。
- **虚拟背景** —— 浏览器内通过 MediaPipe 做人像分割,可选背景图片或背景虚化。
- **跨窗口悬浮提词器** —— 提词在独立的置顶窗口播放,这样你看着屏幕共享的目标画面时也能读稿。可调速度和字号。
- **MP4 导出** —— 通过 FFmpeg.wasm 在浏览器内把 WebM 转成 MP4。
- 麦克风电平表、暂停/继续、录制计时、多语言界面。

## 本地运行

需要 Node 18+ 和 Yarn。

```bash
yarn
yarn dev
```

`postinstall` 会自动把 MediaPipe WASM 运行时同步到 `public/mediapipe-wasm/`。需要的 `.tflite` 模型已直接提交在 `public/models/` 下。

生产构建:

```bash
yarn build
```

## 浏览器兼容性

仅支持 Chromium 内核浏览器(Chrome、Edge、Arc、Brave)。依赖 `getDisplayMedia`、`MediaStreamTrackProcessor` 等 API,目前 Firefox / Safari 还没完整支持。

## 致谢

- 原始项目 [Recorder](https://github.com/contrastio/recorder) by [Contrast](https://getcontrast.io)。
- 被 [addyosmani](https://github.com/addyosmani/recorder) fork 并大量增强 —— 提词器、MP4 转换、摄像头形状切换等。
- 本 fork(vp-recorder)在此之上增加了:可拖动多形状悬浮窗、智能取景与人脸自动居中、虚拟背景、跨窗口提词器、带电平表的音频混合器,以及若干 UX / 性能优化。

## 许可

MIT —— 见 [LICENSE](LICENSE)。

---

# vp-recorder (English)

In-browser presentation recorder. Capture your screen and webcam together, with a draggable camera overlay, auto face-centering, virtual background, and a cross-window floating teleprompter. Everything runs locally in the browser — no upload, no server.

This project is a second-stage fork based on [addyosmani/recorder](https://github.com/addyosmani/recorder) (itself a fork of [contrastio/recorder](https://github.com/contrastio/recorder)).

## Features

- **Screen + camera composite recording** — record your screen, browser tab, or window, with the webcam overlaid into the final video.
- **Draggable multi-shape camera overlay** — circle/square/portrait shapes, drag freely or snap to 4 corner presets, persists across preview and recording.
- **Smart framing with auto face-centering** — face-tracking keeps you centered as you move; multiple zoom/framing presets.
- **Virtual background** — selfie segmentation runs in-browser via MediaPipe; pick a background image or blur.
- **Cross-window floating teleprompter** — script playback in a separate always-on-top window so you can read while looking at the screen-share target. Adjustable speed and font size.
- **MP4 export** — convert the WebM recording to MP4 in-browser via FFmpeg.wasm.
- Mic level meter, pause/resume, recording timer, multi-language UI.

## Run locally

Requires Node 18+ and Yarn.

```bash
yarn
yarn dev
```

A `postinstall` step copies the MediaPipe WASM runtime into `public/mediapipe-wasm/`. The required `.tflite` models are committed under `public/models/`.

Build for production:

```bash
yarn build
```

## Browser support

Chromium-based browsers only (Chrome, Edge, Arc, Brave). Uses `getDisplayMedia`, `MediaStreamTrackProcessor`, and other APIs not yet broadly available in Firefox/Safari.

## Credits

- Original [Recorder](https://github.com/contrastio/recorder) by [Contrast](https://getcontrast.io).
- Forked and significantly extended by [addyosmani](https://github.com/addyosmani/recorder) — teleprompter, MP4 conversion, camera shape toggle, and more.
- This fork (vp-recorder) adds the draggable multi-shape overlay, framing/auto face-centering, virtual background, cross-window teleprompter, audio mixer with mic level meter, and a number of UX/perf improvements.

## License

MIT — see [LICENSE](LICENSE).
