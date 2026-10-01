export interface Character {
  id: string;
  name: string;
  description: string;
  personality: string;
  outfit: string;
  outfitDescription?: string;
  outfitLocked?: boolean;
  referenceMediaId?: string;
  referenceBase64?: string;
}

export interface LocationReference {
  id: string;
  name: string;
  mediaId: string;
  base64: string;
}

export interface StyleReference {
  id: string;
  mediaId: string;
  base64: string;
}

export type StyleStrength = 'Low' | 'Medium' | 'High';

export type ArtStyle = 
  | 'Black & White Manga'
  | 'High-Impact Colored Manga'
  | 'Clean Polished Webtoon'
  | 'Dark Noir Comic';

export type Genre = 
  | 'Follow Script / Auto'
  | 'Action / Adventure'
  | 'Mystery / Thriller / Horror'
  | 'Romance / Drama';

export type PageLayoutStyle = 
  | 'Modern Cinematic Story Flow'
  | 'Dynamic Action Aura Flow';

export type FontStyle = 'Clean Manga Dialogue Font';

export interface Panel {
  description: string;
}

export type PageStatus = 'not_generated' | 'generated' | 'skipped' | 'needs_review' | 'rejected';

export interface ComicPageData {
  pageNumber: number;
  chapterTitle?: string;
  scriptSection: string;
  summary: string;
  characters: string[];
  location: string;
  panels: Panel[];
  status: PageStatus;
  mood?: string;
  keyAction?: string;
  notes?: string;
  specialInstructions?: string;
  textGuide?: string; // Classified text guide for the AI model
}

export interface GeneratedPage {
  id: string;
  pageNumber: number;
  base64: string;
  mimeType: string;
  mediaId: string;
  isRejected?: boolean;
  history?: Omit<GeneratedPage, 'history' | 'pendingVersion' | 'isRejected'>[];
  pendingVersion?: Omit<GeneratedPage, 'history' | 'pendingVersion' | 'isRejected'>;
}

export interface ComicProject {
  title: string;
  script: string;
  improveStory: boolean;
  style: ArtStyle;
  genre: Genre;
  layoutStyle: PageLayoutStyle;
  fontStyle: FontStyle;
  model: string;
  characters: Character[];
  locationReferences: LocationReference[];
  styleReferences: StyleReference[];
  styleStrength: StyleStrength;
}