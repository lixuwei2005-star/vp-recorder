#!/usr/bin/env node
/* eslint-disable no-console */
// Keeps public/mediapipe-wasm/ in sync with the WASM blobs shipped inside
// node_modules/@mediapipe/tasks-vision/wasm/. Runs on every `npm install` so
// upgrading @mediapipe/tasks-vision can't leave stale WASM behind.
//
// The .tflite model is *not* re-fetched here — it's a one-time manual
// download to public/models/. We just check it's still on disk and print a
// helpful curl command if it's gone missing.

import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const SRC_WASM_DIR = join(
  repoRoot,
  'node_modules',
  '@mediapipe',
  'tasks-vision',
  'wasm',
);
const DEST_WASM_DIR = join(repoRoot, 'public', 'mediapipe-wasm');
const MODELS = [
  {
    name: 'face detection',
    path: join(repoRoot, 'public', 'models', 'blaze_face_short_range.tflite'),
    url: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
    feature: 'auto framing',
  },
  {
    name: 'selfie segmentation',
    path: join(repoRoot, 'public', 'models', 'selfie_segmenter.tflite'),
    url: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite',
    feature: 'virtual background',
  },
];

const sha1 = (path) =>
  createHash('sha1').update(readFileSync(path)).digest('hex');

const syncWasm = () => {
  if (!existsSync(SRC_WASM_DIR)) {
    // No tasks-vision installed yet. Postinstall fires before some deps are
    // fully linked in odd npm states — skip rather than fail the install.
    console.log(
      `[sync-mediapipe] ${SRC_WASM_DIR} not found; skipping WASM sync.`,
    );
    return;
  }
  mkdirSync(DEST_WASM_DIR, { recursive: true });

  const sources = readdirSync(SRC_WASM_DIR).filter(
    (name) => name.endsWith('.wasm') || name.endsWith('.js'),
  );
  let copied = 0;
  let upToDate = 0;
  for (const name of sources) {
    const src = join(SRC_WASM_DIR, name);
    const dst = join(DEST_WASM_DIR, name);
    if (existsSync(dst)) {
      const srcStat = statSync(src);
      const dstStat = statSync(dst);
      if (
        srcStat.size === dstStat.size &&
        sha1(src) === sha1(dst)
      ) {
        upToDate += 1;
        continue;
      }
    }
    copyFileSync(src, dst);
    copied += 1;
  }
  if (copied > 0) {
    console.log(
      `[sync-mediapipe] copied ${copied} WASM file(s) to public/mediapipe-wasm/ (${upToDate} already up-to-date)`,
    );
  } else {
    console.log(
      `[sync-mediapipe] WASM up-to-date (${upToDate} files in public/mediapipe-wasm/)`,
    );
  }
};

const checkModels = () => {
  for (const model of MODELS) {
    if (existsSync(model.path)) {
      const { size } = statSync(model.path);
      console.log(
        `[sync-mediapipe] ${model.name} model present (${size} bytes at ${model.path})`,
      );
      continue;
    }
    // Models are a one-time download. We deliberately do *not* fetch them
    // here so `npm install` stays offline-friendly. Surface a clear,
    // copy-pasteable recovery instruction instead.
    console.warn(
      `[sync-mediapipe] ${model.name} model MISSING at ${model.path}`,
    );
    console.warn(
      `[sync-mediapipe] ${model.feature} will fail until you run:`,
    );
    console.warn(
      `[sync-mediapipe]   curl -sSL -o "${model.path}" "${model.url}"`,
    );
  }
};

try {
  syncWasm();
  checkModels();
} catch (err) {
  // Never fail `npm install` over an asset sync hiccup — log and move on.
  console.warn('[sync-mediapipe] non-fatal error:', err?.message ?? err);
}
