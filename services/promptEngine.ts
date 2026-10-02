import { GeneratorSettings, GenerationTask } from '../types';
import { TASTES, STRICT_STYLE_SUFFIX } from '../constants';
import { 
  SHOT_SCALE_REGISTRY, 
  POSE_CONTRAST_RULES, 
  TWELVE_CUT_STORYBOARD_PRESETS, 
  BASELINE_NEGATIVE_TOKENS,
  StoryShotPreset 
} from '../config/studioDefinitions';

export interface PreviousShotContext {
  scale?: string;
  angle?: string;
  prompt?: string;
  tag?: string;
}

/**
 * 直前カットの情報に基づいて、構図・ポーズ・アングルの重複を排除するネガティブプロンプトを自動生成
 * （ロジック定義テーブル POSE_CONTRAST_RULES および SHOT_SCALE_REGISTRY を参照）
 */
export function buildDynamicAntiPreviousNegative(previous?: PreviousShotContext): string {
  if (!previous) return '';

  const antiTokens: string[] = [];

  // 1. 直前のスケールに基づく除外トークン
  if (previous.scale && SHOT_SCALE_REGISTRY[previous.scale]) {
    antiTokens.push(...SHOT_SCALE_REGISTRY[previous.scale].antiRepeatNegatives);
    antiTokens.push(`identical ${previous.scale} framing`, `same shot scale as previous scene`);
  } else if (previous.scale) {
    if (previous.scale.toLowerCase().includes('close')) {
      antiTokens.push('extreme close-up', 'macro face', 'zoomed in headshot');
    } else if (previous.scale.toLowerCase().includes('wide')) {
      antiTokens.push('distant tiny figure', 'extreme wide shot', 'panoramic view');
    } else if (previous.scale.toLowerCase().includes('medium')) {
      antiTokens.push('standard medium shot', 'static bust portrait');
    }
  }

  // 2. 直前のカメラアングルに基づく除外トークン
  if (previous.angle) {
    const lowerAngle = previous.angle.toLowerCase();
    if (lowerAngle.includes('high-angle') || lowerAngle.includes('downward') || lowerAngle.includes('俯瞰')) {
      antiTokens.push('high angle looking down', 'overhead camera perspective');
    } else if (lowerAngle.includes('low-angle') || lowerAngle.includes('worm') || lowerAngle.includes('煽り')) {
      antiTokens.push('low angle looking up', 'worm-eye perspective');
    }
  }

  // 3. 直前のポーズ・姿勢（床座り、立ち等）に基づく動的除外（POSE_CONTRAST_RULES を検索）
  if (previous.prompt) {
    const lowerPrompt = previous.prompt.toLowerCase();
    for (const rule of POSE_CONTRAST_RULES) {
      if (rule.triggerKeywords.some(keyword => lowerPrompt.includes(keyword))) {
        antiTokens.push(...rule.antiRepeatNegatives);
      }
    }
  }

  // 4. 一般的な重複防止ガード
  antiTokens.push(
    'identical composition to previous cut',
    'repeating previous scene composition',
    'same camera angle as previous cut',
    'monotonous repetitive pose'
  );

  return Array.from(new Set(antiTokens)).join(', ');
}

/**
 * 各カット番号に対応するストーリーボード演出プリセットを取得
 * （シネマ / 音楽MV / 漫画モードを自動切り替え）
 */
export function getStoryboardPreset(
  cutId: number, 
  isMvMode?: boolean, 
  isMangaMode?: boolean
): { scale: string; angle: string; tag: string } {
  const index = Math.max(0, cutId - 1) % TWELVE_CUT_STORYBOARD_PRESETS.length;
  const def = TWELVE_CUT_STORYBOARD_PRESETS[index];
  
  let angle = def.cinematicAngle;
  if (isMvMode) {
    angle = def.mvAngle;
  } else if (isMangaMode) {
    angle = def.mangaAngle;
  }

  return {
    scale: def.scale,
    angle: angle,
    tag: def.tag
  };
}

/**
 * 6層レイヤーに基づき、プロンプトとネガティブプロンプトを完全合成
 * （音楽MVモード時はアンニュイ情景美と穏やかなライティングを注入し、激しいアクション・叫びを完全排除）
 */
export function buildFinalCinematicPromptAndNegative(
  task: GenerationTask,
  settings: GeneratorSettings,
  activeReference?: any
): { finalPrompt: string; finalNegative: string; referenceImageMediaIds?: string[] } {
  const { prompt, negativePrompt, styleKey, forbiddenAnachronisms, authenticAttireEn, forbiddenKeywordsEn } = task;
  const rawStyle = TASTES[styleKey] || '';
  const isMv = settings.isMvMode || task.isMvMode;

  // Layer 1: Master Style Anchor
  const masterStylePrefix = `Masterpiece, authentic ${rawStyle}. Consistent visual art style in ${rawStyle}.`;
  const masterStylePrompt = `[MASTER ART STYLE: ${rawStyle}, strictly maintain identical visual medium and rendering consistency across scenes]`;

  const isNonPhoto = styleKey.includes('アニメ') || styleKey.includes('イラスト') || styleKey.includes('マンガ') || styleKey.includes('セル画') || styleKey.includes('ドット') || styleKey.includes('ピクセル') || styleKey.includes('水彩') || styleKey.includes('油絵') || styleKey.includes('版画');

  // Layer 2 & 3: Camera Context & Action
  const cameraContext = isMv 
    ? (isNonPhoto 
        ? 'Candid atmospheric indie music video visual still, serene breathing space, aesthetic cinematic color grading, beautiful artistic composition' 
        : 'Candid atmospheric indie music video still, natural human anatomy, unposed natural posture, soft rim lighting, serene breathing space, cinematic 35mm photography aesthetic, 8k resolution')
    : 'Cinematic composition, dynamic natural pose, natural human anatomy, solid torso, complete body framing, grounded perspective, 8k resolution';
  
  // Layer 4: Period Attire
  const dynamicAttire = authenticAttireEn ? `[PERIOD ATTIRE: ${authenticAttireEn}]` : '';

  // Layer 5: Mode Suffix (MVアンニュイ情景 または 漫画演出)
  let modePromptSuffix = '';
  if (isMv) {
    modePromptSuffix = 'poetic indie music video visual, contemplative atmosphere, gentle ambient wind, quiet emotion, cinematic color grading, beautiful subtle mood, no dramatic conflict';
  } else if (settings.isMangaMode) {
    modePromptSuffix = 'manga style, full-bleed edge-to-edge artwork, borderless composition, filling entire canvas without margins, dynamic pen and ink, screentone, cel shading, intense dramatic expressions, extreme high contrast, bold line art, speed lines';
  }

  // Layer 6: Negative Rules (厳密な優先度で結合)
  const illustrationNegative = isNonPhoto ? 'photorealistic, realistic photo, hyperrealistic photograph, real life, live-action, 35mm photograph, DSLR, camera photo, 3d render, cgi' : '';

  const dynamicForbidden = forbiddenKeywordsEn || (forbiddenAnachronisms || []).join(', ');

  // MVモード専用アンチネガティブ（叫び、劇的な怒り、過剰アクション、武器を排除）
  const mvAntiDramaticNegative = isMv 
    ? 'violent action, aggressive shouting, screaming mouth wide open, intense crying, dynamic combat, weapons, explosion, exaggerated action pose, heroic flexing'
    : '';

  const negativeLayers: string[] = [
    BASELINE_NEGATIVE_TOKENS.anatomicalIntegrity,
    BASELINE_NEGATIVE_TOKENS.antiReferenceStiffness,
    mvAntiDramaticNegative,
    dynamicForbidden,
    illustrationNegative,
    BASELINE_NEGATIVE_TOKENS.antiFrameAndBorder,
    negativePrompt || '', // 直前構図ネガティブ（最重要）
    BASELINE_NEGATIVE_TOKENS.renderingQuality
  ];

  if (activeReference) {
    const { styleDna, antiPoseNegative, eraNegative, mediaId } = activeReference;
    if (antiPoseNegative) negativeLayers.push(antiPoseNegative);
    if (eraNegative) negativeLayers.push(eraNegative);

    const finalNegative = negativeLayers.filter(Boolean).join(', ');
    const finalPrompt = `${masterStylePrefix}. ${masterStylePrompt}. [ACTION: ${prompt}, ${cameraContext}]. ${dynamicAttire}. [REFERENCE MEDIUM: ${styleDna || ''}]. ${modePromptSuffix}.${STRICT_STYLE_SUFFIX}`;

    return {
      finalPrompt,
      finalNegative,
      referenceImageMediaIds: mediaId ? [mediaId] : undefined
    };
  } else {
    const finalNegative = negativeLayers.filter(Boolean).join(', ');
    const finalPrompt = `${masterStylePrefix}. ${masterStylePrompt}. ${cameraContext}. ${prompt}. ${dynamicAttire}. ${modePromptSuffix}.${STRICT_STYLE_SUFFIX}`;

    return {
      finalPrompt,
      finalNegative
    };
  }
}
