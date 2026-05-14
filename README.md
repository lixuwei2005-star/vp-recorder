# vp-recorder

In-browser presentation recorder. Capture your screen and webcam together, with a draggable camera overlay, auto face-centering, virtual background, and a cross-window floating teleprompter. Everything runs locally in the browser — no upload, no server.

This project is a second-stage fork based on [addyosmani/recorder](https://github.com/addyosmani/recorder) (itself a fork of [contrastio/recorder](https://github.com/contrastio/recorder)).

## Features

- **Screen + camera composite recording** — record your screen, browser tab, or window, with the webcam overlaid into the final video.
- **Draggable multi-shape camera overlay** — circle/square/portrait shapes, drag freely or snap to 4 corner presets, persists across preview and recording.
- **Smart framing with auto face-centering** — face-tracking keeps you centered as you move; multiple zoom/framing presets.
- **Virtual background** — selfie segmentation runs in-browser via MediaPipe; pick a background image or blur.
- **Cross-window floating teleprompter** — script playback in a separate always-on-top window so you can read while looking at the screen-share target. Adjustable speed and font size.
- **MP4 export** — convert the WebM recording to MP4 in-browser via FFmpeg.wasm.
- **Mic level meter, pause/resume, recording timer, multi-language UI.**

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
