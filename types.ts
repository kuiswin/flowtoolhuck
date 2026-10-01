export type VideoModelType = 'veo-lite' | 'omni-flash' | 'veo-fast' | 'browser-0pt';
export type ProductionMode = 'episodes' | 'style-matrix';
export type RecommendationModel = VideoModelType | 'none';
export type VideoRatio = 'none' | '30%' | '50%' | '100%';

export type KenBurnsPreset = 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'tilt-up' | 'tilt-down';

export type ComicPanelLayout = 
  | 'none'              // 通常の1枚絵
  | 'diagonal-2'        // 斜め2分割
  | 'vertical-2'        // 上下2分割
  | 'vertical-3'        // 縦3分割
  | 't-split-3'         // 上大ゴマ + 下2分割
  | 'grid-4'            // 2x2 4分割
  | 'spread-splash';    // 超特大見開きスプラッシュ

export interface ComicPanelMeta {
  layout: ComicPanelLayout;
  step: number;        // 1-indexed (例: 1, 2, 3)
  totalSteps: number;  // 2, 3, 4, または 1 (spread-splash)
  parentCutId: number; // 親となる画像生成カットの cutId
  panelLabel?: string; // 例: '1コマ目(上段)', '2コマ目(中段)', '完成(全コマ)'
}

export interface ReferenceAsset {
  id?: number;
  name: string;
  base64: string;
  mimeType: string;
  mediaId?: string; 
  styleAnalysis?: string;
  characterAnalysis?: string;
  createdAt: string;
}

export interface Cut {
  id: number;
  promptEn: string;
  narrationJp: string;
  narrationEn?: string;
  negativePrompt?: string; 
  
  shotScale?: string;
  kenBurnsPreset?: KenBurnsPreset; 
  cameraMotion?: string;
  comicPanel?: ComicPanelMeta;

  summary?: string;
  isKeyScene?: boolean;

  imageMediaId?: string;
  imageBase64?: string;
  videoMediaId?: string;
  videoBase64?: string;
  videoModelUsed?: string;
  videoDuration?: number;

  telop?: {
    fullText: string;
    highlights?: Array<{ word: string; color: string; sizeScale: number }>;
  };

  isDirecting: boolean; 
  isGeneratingImage: boolean;
  isGeneratingVideo: boolean;
  isQueued: boolean;
  isSelectedForVideo: boolean;
  targetVideoModel: RecommendationModel;
  error?: string;
  bgmMediaId?: string;
  voiceId?: string;
}

export interface Episode {
  id: number;
  internalId: string;
  titleJp: string;
  titleEn: string;
  summary?: string;
  eraAnalysis?: string;
  forbiddenAnachronisms?: string[];
  authenticAttireEn?: string;
  forbiddenKeywordsEn?: string;
  highlightWords?: string[];

  coverCatchphraseJp?: string;
  coverCatchphraseEn?: string;
  coverBase64?: string;
  
  cuts: Cut[];
  isGenerating: boolean;
  isGeneratingRemainingImages: boolean;
  isBatchGeneratingVideos: boolean;
  isExportingMovie?: boolean; 
  fullMovieBase64?: string;   
  isPreviewDone: boolean;
  isDone: boolean;
  error?: string;

  // 時代・画風の固定用
  taste?: string;
  era?: string;
  theme?: string;
}

export interface GeneratorSettings {
  productionMode: ProductionMode; 
  country: string;
  customCountry?: string;
  era?: string;
  customEra?: string;
  theme: string;
  customTheme?: string;
  taste: string;
  customTaste?: string;
  isMangaMode?: boolean;
  imageModel: string;
  defaultVideoModel: string;
  videoRatio: VideoRatio;
  episodeCount: number;
  previewCutCount: number; 
  parallelCount: number;
  autoVideo: boolean;
  autoDownload: boolean;
  selectedAssetId?: number;
}

export interface GenerationTask {
  epId: number;
  cutId: number;
  prompt: string;
  negativePrompt?: string;
  styleKey: string;
  imageModel: string;
  eraAnalysis?: string;
  forbiddenAnachronisms?: string[];
  authenticAttireEn?: string;
  forbiddenKeywordsEn?: string;
  referenceImageMediaId?: string;
  storyContext?: string;
}

/** 
 * 大河ドラマ・全話グランドデザイン用 
 */
export interface SeriesEpisodePlan {
  epNumber: number;
  titleJp: string;
  titleEn: string;
  summary: string;
}

/** 
 * シリーズ全体のマニフェスト（レジューム用）
 */
export interface SeriesManifest {
  seriesTitle: string;
  totalEpisodes: number;
  currentEpisodeId: number;
  completedEpisodeIds: number[];
  overallSynopsis: string;
  episodesPlan: SeriesEpisodePlan[];
  referenceAsset?: {
    name: string;
    base64: string;
    mimeType: string;
    characterDna?: string;
    styleDna?: string;
    antiPoseNegative?: string;
    eraNegative?: string;
  };
  settings?: Partial<GeneratorSettings>;
}