import type { GradientSpec } from 'services/virtualBackground';

// Canvas-generated gradient presets — no external image files, no licensing
// concerns, and the data ships with the JS bundle for free. Visual goal:
// suggest the look of a typical "office / studio / warm room" background
// without distracting from the speaker.

export type GradientPreset = {
  id: string;
  label: string;
  gradient: GradientSpec;
};

export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: 'office-blue',
    label: 'Office Blue',
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
    label: 'Sunset',
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
    label: 'Mint',
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
    label: 'Midnight',
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
  label: string;
  color: string;
};

export const COLOR_PRESETS: ColorPreset[] = [
  { id: 'studio-grey', label: 'Studio Grey', color: '#3a3a3a' },
  { id: 'pure-white', label: 'White', color: '#f4f4f4' },
];
