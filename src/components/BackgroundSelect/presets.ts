import type { GradientSpec } from 'services/virtualBackground';

// Canvas-generated gradient presets — no external image files, no licensing
// concerns, and the data ships with the JS bundle for free. Visual goal:
// suggest the look of a typical "office / studio / warm room" background
// without distracting from the speaker.

export type GradientPreset = {
  id: string;
  labelKey: string;
  gradient: GradientSpec;
};

export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: 'office-blue',
    labelKey: 'bg.preset.officeBlue',
    gradient: {
      type: 'linear',
      angle: 160,
      stops: [
        { offset: 0, color: '#2a4d7a' },
        { offset: 1, color: '#0b1d33' },
      ],
    },
  },
  {
    id: 'sunset',
    labelKey: 'bg.preset.sunset',
    gradient: {
      type: 'linear',
      angle: 200,
      stops: [
        { offset: 0, color: '#f6a06b' },
        { offset: 0.5, color: '#d6627a' },
        { offset: 1, color: '#4d2a5a' },
      ],
    },
  },
  {
    id: 'mint',
    labelKey: 'bg.preset.mint',
    gradient: {
      type: 'linear',
      angle: 145,
      stops: [
        { offset: 0, color: '#dff5e8' },
        { offset: 1, color: '#3aa177' },
      ],
    },
  },
  {
    id: 'midnight',
    labelKey: 'bg.preset.midnight',
    gradient: {
      type: 'radial',
      stops: [
        { offset: 0, color: '#3b2a6a' },
        { offset: 1, color: '#0a0a1a' },
      ],
    },
  },
];

export type ColorPreset = {
  id: string;
  labelKey: string;
  color: string;
};

export const COLOR_PRESETS: ColorPreset[] = [
  { id: 'studio-grey', labelKey: 'bg.preset.studioGrey', color: '#3a3a3a' },
  { id: 'pure-white', labelKey: 'bg.preset.white', color: '#f4f4f4' },
];
