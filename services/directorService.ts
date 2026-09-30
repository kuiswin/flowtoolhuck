import { Flow } from 'flow-sdk';
import { Cut, GenerationTask, GeneratorSettings, KenBurnsPreset, SeriesEpisodePlan } from '../types';
import { IMAGE_MODELS, DEFAULT_ASPECT_RATIO, STRICT_STYLE_SUFFIX, TASTES } from '../constants';
import { safeJsonParse, callWithRetry } from './utils';

/**
 * キャラクター画像からDNA（特徴）を抽出するためのプロンプトを構築
 */
export function buildCharacterScreeningPrompt(era: string, country: string): string {
  return `Analyze the character image for a historical drama set in "${era}", "${country}".
Identify facial features, hairstyles, and iconic characteristics.
Strictly ensure modern attire (school uniform, blazer, necktie, casual wear, sneakers, glasses, headphones) is converted to authentic period clothing for "${era}".
Output JSON: {
  "characterDna": "Description of facial features and body traits",
  "styleDna": "Consistent artistic rendering medium",
  "antiPoseNegative": "awkward pose, unnatural anatomy",
  "eraNegative": "modern clothing, school uniform, sailor suit, blazer, necktie, modern casual, sneakers, eyeglasses, headphones, wristwatch, smartphone"
}`;
}

/**
 * シリーズ全体のグランドデザイン（全話プロット）を生成するためのプロンプト
 */
/**
 * シリーズ全体のグランドデザイン（全話プロット）を生成するためのプロンプト
 */
export function buildGrandDesignPrompt(count: number, country: string, theme: string, era?: string): string {
  const worldSetting = era && era !== theme ? `${theme} (時代: ${era}, 地域: ${country})` : `${theme} (${country})`;
  return `Create a full ${count}-episode drama grand design with World Theme & Setting: "${worldSetting}".
Analyze the authentic era, cultural background, human drama, and visual atmosphere directly from this theme.
Output ONLY valid JSON:
{
  "seriesTitle": "Dramatic Series Title",
  "overallSynopsis": "Overview of the entire narrative arc",
  "episodesPlan": [
    { "epNumber": 1, "titleJp": "日本語タイトル", "titleEn": "English Title", "summary": "話のあらすじ" }
  ]
}`;
}

/**
 * ナレーションから強調すべき重要キーワード（2〜4文字の漢字熟語等）を抽出・確定
 * （AIやユーザー指定の単語を優先し、本文に実在する単語だけを厳密に採用。空なら本文から自動抽出して確実に色付けを点灯させる）
 */
export function extractHighlights(narrationText: string, suggestedWords: string[] = []): Array<{ word: string; color: string; sizeScale: number }> {
  if (!narrationText || !narrationText.trim()) return [];
  const validHighlights: Array<{ word: string; color: string; sizeScale: number }> = [];

  // 1. 指定された単語のうち、ナレーション本文に確実に含まれているものを採用
  for (const rawWord of suggestedWords) {
    const word = (rawWord || '').trim();
    if (word && narrationText.includes(word) && word.length >= 1 && word.length <= 6) {
      if (!validHighlights.some(h => h.word === word)) {
        validHighlights.push({ word, color: '#FFE600', sizeScale: 1.1 });
      }
    }
  }

  // 2. もし本文に合致する指定単語が0件なら、ナレーション本文から漢字熟語（2〜4文字）を自動抽出
  if (validHighlights.length === 0) {
    const kanjiMatches = narrationText.match(/[\u4e00-\u9faf]{2,4}/g);
    if (kanjiMatches && kanjiMatches.length > 0) {
      // 重複を除去し、登場順に有力な熟語を最大2つピックアップ
      const candidates = Array.from(new Set(kanjiMatches)).filter(w => w.length >= 2 && w.length <= 4);
      for (const word of candidates.slice(0, 2)) {
        validHighlights.push({ word, color: '#FFE600', sizeScale: 1.1 });
      }
    }
  }

  // 3. それでも0件なら（ひらがな中心などの場合）、カタカナ単語または文中の代表語
  if (validHighlights.length === 0) {
    const katakanaMatches = narrationText.match(/[\u30a1-\u30f6]{2,6}/g);
    if (katakanaMatches && katakanaMatches.length > 0) {
      for (const word of Array.from(new Set(katakanaMatches)).slice(0, 2)) {
        validHighlights.push({ word, color: '#FFE600', sizeScale: 1.1 });
      }
    }
  }

  return validHighlights;
}

/**
 * 各話の脚本（12カット分）および時代考証をAIに動的生成させるプロンプト
 * （世界観・テーマからGeminiが時代考証・衣装・NG要素およびカットごとの金文字強調キーワードを自律生成）
 */
export function buildScriptPrompt(epId: number, currentPlan: SeriesEpisodePlan, country: string, theme: string, era?: string): string {
  const worldSetting = era && era !== theme ? `${theme} (時代: ${era}, 地域: ${country})` : `${theme} (${country})`;
  return `You are a world-class historical drama director and historical researcher.
Create a 12-cut drama story skeleton for Episode ${epId} ("${currentPlan.titleJp}").
World Theme & Setting: "${worldSetting}".

STRICT HISTORICAL ACCURACY:
Dynamically analyze the period, setting, and atmosphere implied by "${worldSetting}". Determine authentic period attire and identify modern anachronisms that must NEVER appear.

CRITICAL SUBTITLE HIGHLIGHTS:
For EACH cut, select 1 to 2 dramatic key terms (2 to 4 characters each, which MUST BE EXACTLY present in narrationJp) for the "highlights" array to be highlighted in gold text.

Output ONLY valid JSON matching this exact structure:
{
  "titleJp": "${currentPlan.titleJp}",
  "titleEn": "${currentPlan.titleEn}",
  "summary": "話のあらすじ（日本語）",
  "eraAnalysisJp": "時代背景と舞台設定の考証解説（日本語）",
  "authenticAttireEn": "Detailed English prompt for authentic historical costume and attire of ${worldSetting}",
  "forbiddenKeywordsEn": "Comma-separated English negative keywords for anachronisms that must NEVER appear in ${worldSetting} (e.g. smartphones, wristwatches, modern glasses, sneakers, modern clothing, electricity poles, asphalt)",
  "forbiddenAnachronisms": ["日本語の禁止要素1", "日本語の禁止要素2"],
  "coverCatchphraseJp": "超ド迫力キャッチコピー",
  "highlightWords": ["代表キーワード1", "代表キーワード2"],
  "cuts": [
    { 
      "id": 1, 
      "basicPlot": "Cinematic visual description of the cut in English", 
      "narrationJp": "重厚なナレーション（日本語）",
      "highlights": ["ナレーション内の重要語1", "ナレーション内の重要語2"]
    }
  ]
}`;
}

/**
 * 画像生成用の最終プロンプトとネガティブプロンプトを構築
 * （AIが動的考証した衣装と禁止ワードを反映）
 */
export function buildImagePromptAndNegative(
  task: GenerationTask,
  settings: GeneratorSettings,
  activeReference: any
): { finalPrompt: string; finalNegative: string; referenceImageMediaIds?: string[] } {
  const { prompt, negativePrompt, styleKey, forbiddenAnachronisms, authenticAttireEn, forbiddenKeywordsEn } = task as any;
  const rawStyle = TASTES[styleKey] || '';

  // 画風固定の最優先指示
  const masterStylePrefix = `Masterpiece, authentic ${rawStyle}. Consistent visual art style in ${rawStyle}.`;
  const masterStylePrompt = `[MASTER ART STYLE: ${rawStyle}, strictly maintain identical visual medium and rendering consistency across scenes]`;

  const cameraContext = 'Cinematic composition, natural human anatomy, solid torso, complete upper body, grounded perspective, 8k resolution';
  const antiGulliverAndGoreNegative = 'giant, giantess, floating head, severed body, floating torso, half body cut off by scenery, scale error, diorama, simple mugshot';
  
  // アニメ・イラスト系の場合のネガティブ自動付与
  const isIllustration = styleKey.includes('アニメ') || styleKey.includes('イラスト') || styleKey.includes('マンガ') || styleKey.includes('セル画');
  const illustrationNegative = isIllustration ? 'photorealistic, realistic photo, hyperrealistic photograph, 3d render, cgi, ' : '';
  const baselineNegative = `${illustrationNegative}pixel art, 8-bit, 16-bit, lowres, worst quality, text, watermark, signature, blurry`;

  // AIが動的考証した時代衣装・除外ワード
  const dynamicAttire = authenticAttireEn ? `[PERIOD ATTIRE: ${authenticAttireEn}]` : '';
  const dynamicForbidden = forbiddenKeywordsEn || (forbiddenAnachronisms || []).join(', ');

  if (activeReference) {
    const { styleDna, antiPoseNegative, eraNegative, mediaId } = activeReference;
    const finalNegative = [
      antiGulliverAndGoreNegative,
      dynamicForbidden,
      antiPoseNegative,
      eraNegative,
      negativePrompt,
      baselineNegative
    ].filter(Boolean).join(', ');

    const finalPrompt = `${masterStylePrefix}. ${masterStylePrompt}. [ACTION: ${prompt}, ${cameraContext}]. ${dynamicAttire}. [REFERENCE MEDIUM: ${styleDna}].${STRICT_STYLE_SUFFIX}`;
    return { finalPrompt, finalNegative, referenceImageMediaIds: [mediaId] };
  } else {
    const finalNegative = [
      antiGulliverAndGoreNegative,
      dynamicForbidden,
      negativePrompt,
      baselineNegative
    ].filter(Boolean).join(', ');

    const finalPrompt = `${masterStylePrefix}. ${masterStylePrompt}. ${cameraContext}. ${prompt}. ${dynamicAttire}.${STRICT_STYLE_SUFFIX}`;
    return { finalPrompt, finalNegative };
  }
}

/**
 * カットごとの演出データ（構図、テロップ、ケンバーン効果）をAIで決定
 */
export async function directShot(
  task: GenerationTask,
  settings: GeneratorSettings,
  activeReference: any,
  previousShotScale?: string,
  addLog?: (msg: string, type?: any) => void
): Promise<Partial<Cut>> {
  const { cutId, prompt, styleKey } = task;
  const rawStyle = TASTES[styleKey] || '';
  const characterGuidance = activeReference 
    ? `Protagonist: ${activeReference.characterDna}. She is the central heroine.` 
    : 'No specific reference asset.';

  const CINEMATIC_SHOT_PRESETS = [
    { scale: 'Wide', angle: 'High-angle landscape view looking down from the sky, character is a tiny figure walking on the ground road, realistic building proportions, sweeping historic townscape', tag: '俯瞰・遠景(人物小)' },
    { scale: 'Close-up', angle: 'Dramatic low-angle worm\'s-eye view looking up from below, intense cinematic perspective showing head and shoulders firmly grounded, dynamic sky background', tag: '煽り・クローズアップ' },
    { scale: 'Medium', angle: 'Looking back over the shoulder from behind, dynamic three-quarter view, candid emotional glance', tag: '見返り・背後視点' },
    { scale: 'Wide', angle: 'Cinematic wide horizontal shot, street-level atmospheric perspective with environment and props', tag: '引き・世界観' },
    { scale: 'Close-up', angle: 'Dutch tilt angled close-up, dramatic diagonal framing focusing on eyes and expression', tag: '斜めドアップ' },
    { scale: 'Medium', angle: 'Low-angle medium shot looking up towards character, solid upper body posture', tag: '煽り・上半身' },
    { scale: 'Wide', angle: 'High-angle downward view from balcony or hill, character walking naturally among townspeople on the ground', tag: '俯瞰・群衆' },
    { scale: 'Medium', angle: 'Centered cinematic medium portrait, dramatic side-lighting, dignified historic presence', tag: '正面(1話1回)' },
    { scale: 'Close-up', angle: 'Side profile close-up silhouette with warm lantern rim light', tag: '横顔・陰影' },
    { scale: 'Medium', angle: 'Over-the-shoulder perspective looking past the character towards the scene ahead', tag: '肩越し・対峙' },
    { scale: 'Close-up', angle: 'Macro emotional close-up capturing intense gaze and lip expression', tag: '迫真アップ' },
    { scale: 'Wide', angle: 'Epic wide cinematic climax view, panoramic environmental composition', tag: '大団円・全景' }
  ];

  const preset = CINEMATIC_SHOT_PRESETS[(cutId - 1) % CINEMATIC_SHOT_PRESETS.length];
  const kenBurnsPresets: KenBurnsPreset[] = ['zoomIn', 'zoomOut', 'panLeft', 'panRight', 'subtleZoom', 'panDiagonal'];
  const kbPreset = kenBurnsPresets[(cutId - 1) % kenBurnsPresets.length];

  const directorPrompt = `You are a film director designing a visual shot for a historical drama.
Context: "${prompt}".
Style: "${rawStyle}".
${characterGuidance}
Requested Framing: ${preset.scale} (${preset.angle}).
Avoid scale errors. If wide shot, character MUST be small and buildings realistic. If close-up, show head/shoulders with natural proportions.

Output ONLY valid JSON:
{
  "enhancedPrompt": "Extremely detailed scene description in English including lighting, props, historical attire, atmosphere, shot angle",
  "cameraWork": "${preset.tag}",
  "cinematicAngle": "${preset.angle}",
  "shotScale": "${preset.scale}"
}`;

  try {
    const res = await Flow.generate.text(directorPrompt);
    const resText = typeof res === 'string' ? res : (res?.text || res);
    const parsed = safeJsonParse<any>(resText, {});
    if (parsed && parsed.enhancedPrompt) {
      return {
        promptEn: parsed.enhancedPrompt,
        cameraWork: parsed.cameraWork || preset.tag,
        cinematicAngle: parsed.cinematicAngle || preset.angle,
        shotScale: parsed.shotScale || preset.scale,
        kenBurnsPreset: kbPreset,
      };
    }
  } catch (err) {
    if (addLog) addLog(`演出AIの生成をスキップしプリセットを適用します: ${err}`, 'warning');
  }

  return {
    promptEn: `${preset.angle}. ${prompt}`,
    cameraWork: preset.tag,
    cinematicAngle: preset.angle,
    shotScale: preset.scale,
    kenBurnsPreset: kbPreset,
  };
}