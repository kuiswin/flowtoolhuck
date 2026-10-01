import { ArtStyle, Genre, PageLayoutStyle, FontStyle } from './types';

export const ART_STYLES: ArtStyle[] = [
  'High-Impact Colored Manga',
  'Black & White Manga',
  'Clean Polished Webtoon',
  'Dark Noir Comic'
];

export const GENRES: Genre[] = [
  'Follow Script / Auto',
  'Action / Adventure',
  'Mystery / Thriller / Horror',
  'Romance / Drama'
];

export const PAGE_LAYOUT_STYLES: PageLayoutStyle[] = [
  'Modern Cinematic Story Flow',
  'Dynamic Action Aura Flow'
];

export const FONT_STYLES: FontStyle[] = [
  'Clean Manga Dialogue Font'
];

export const DEFAULT_LAYOUT_MAPPING: Record<Genre, { layout: PageLayoutStyle }> = {
  'Follow Script / Auto': { layout: 'Modern Cinematic Story Flow' },
  'Action / Adventure': { layout: 'Dynamic Action Aura Flow' },
  'Mystery / Thriller / Horror': { layout: 'Modern Cinematic Story Flow' },
  'Romance / Drama': { layout: 'Modern Cinematic Story Flow' }
};

export const MODELS = [
  '🍌 Nano Banana 2',
  '🍌 Nano Banana Pro'
];

export const STYLE_DESCRIPTIONS: Record<ArtStyle, string> = {
  'Black & White Manga': 'Full-bleed, borderless, premium high-detail ink drawing. Powerful manga line art, strong black-and-white contrast, rich screentone and crosshatching, expressive faces, dramatic eyes. Edge-to-edge artwork with no white margins or gutters. Cinematic flow with no boxed structures.',
  'High-Impact Colored Manga': 'Full-bleed, borderless, high-quality full color manga illustration. Bold line art, sharp cel shading, dramatic lighting, vivid palette, expressive anime faces. Completely edge-to-edge visuals. No white space or traditional comic borders.',
  'Clean Polished Webtoon': 'Borderless Korean manhwa/webtoon style, clean digital art, edge-to-edge smooth gradients, polished faces, softer lighting. Zero white margins or panel separators.',
  'Dark Noir Comic': 'Full-bleed shadow-heavy cinematic comic look. Dramatic lighting, mystery/crime atmosphere, stylish dark composition flowing edge-to-edge without borders.'
};

export const GENRE_RULES: Record<Genre, string> = {
  'Follow Script / Auto': 'Follow the natural vibe of the script. Maintain a borderless, cinematic flow.',
  'Action / Adventure': 'Borderless kinetic movement, faster pacing, dramatic energy, impact moments, aura-heavy scenes flowing edge-to-edge.',
  'Mystery / Thriller / Horror': 'Borderless suspense, dark mood, tension, heavy shadows, cinematic reveals with zero white margins.',
  'Romance / Drama': 'Borderless emotional close-ups, softer pacing, expressive character moments flowing seamlessly edge-to-edge.'
};