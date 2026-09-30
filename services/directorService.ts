import { Flow } from 'flow-sdk';
import { Cut, GenerationTask, GeneratorSettings, KenBurnsPreset, SeriesEpisodePlan } from '../types';
import { IMAGE_MODELS, DEFAULT_ASPECT_RATIO, STRICT_STYLE_SUFFIX, TASTES } from '../constants';
import { safeJsonParse, callWithRetry } from '../lib/utils';

/**
 * 時代設定に応じた「存在してはならない不適合要素」を動的に生成
 */
export function getEraSpecificAnachronisms(era: string): { positiveAttire: string; negativeAnachronisms: string } {
  const commonModernNegative = 'headphones, earphones, modern headsets, wrist watch, modern glasses, sneakers, plastic, smartphones';
  
  // 現代設定の場合：時代劇要素（着物、侍、刀など）を禁止
  if (era.includes('現代') || era.includes('令和') || era.includes('平成')) {
    return {
      positiveAttire: 'wearing modern contemporary outfits, stylish casual clothing, or professional office wear.',
      negativeAnachronisms: 'kimono, yukata, samurai, katana, topknot, traditional japanese sandals, medieval weapons, armor, horse-drawn carriage'
    };
  }

  if (era.includes('江戸') || era.includes('幕末')) {
    return {
      positiveAttire: 'wearing strictly authentic Edo-period traditional Japanese attire, historically accurate kimono, obi, and period footwear.',
      negativeAnachronisms: `modern clothing, western clothes, school uniform, sailor suit, blazer, suit, tie, hoodies, jeans, zippers, asphalt, electric poles, skyscraper, ${commonModernNegative}`
    };
  }
  if (era.includes('明治') || era.includes('文明開化')) {
    return {
      positiveAttire: 'wearing authentic Meiji-era attire, traditional hakama, or early Meiji western-japanese hybrid clothing.',
      negativeAnachronisms: `modern casual clothes, modern hoodies, jeans, skyscrapers, asphalt roads, electric power towers, ${commonModernNegative}`
    };
  }
  if (era.includes('大正')) {
    return {
      positiveAttire: 'wearing authentic Taisho-roman style kimono or 1920s vintage retro attire.',
      negativeAnachronisms: `contemporary modern clothes, modern electronics, casual tracksuits, ${commonModernNegative}`
    };
  }
  if (era.includes('昭和') || era.includes('戦後') || era.includes('バブル')) {
    return {
      positiveAttire: 'wearing authentic period-accurate Showa retro fashion and vintage garments.',
      negativeAnachronisms: `flatscreen tv, modern internet devices, modern 2020s fashion, futuristic technology, ${commonModernNegative}`
    };
  }
  return { positiveAttire: '', negativeAnachronisms: '' };
}

/**
 * 時代に応じた服装の追加プロンプトを取得 (レガシー互換)
 */
export function getEraClothing(era: string): string {
  const { positiveAttire } = getEraSpecificAnachronisms(era);
  return positiveAttire || '';
}

/**
 * キャラクター画像からDNA（特徴）を抽出するためのプロンプトを構築
 */
export function buildCharacterScreeningPrompt(era: string, country: string): string {
  return `Analyze the character image for a historical drama set in "${era}", "${country}".\nIf the character in the image wears modern clothing (school uniform, sailor suit, blazer, tie, modern casual, glasses, sneakers), specify traditional clothing (${era}) in characterDna, and strictly put all modern attire keywords into eraNegative to ensure modern clothes are NEVER drawn unless time-slip is explicitly intended.\nOutput JSON: { "characterDna": "...", "styleDna": "...", "antiPoseNegative": "...", "eraNegative": "modern clothing, school uniform, sailor suit, pleated skirt, blazer, necktie, ribbon, modern casual, sneakers, eyeglasses, headphones, earphones" }`;
}

/**
 * シリーズ全体のグランドデザイン（全話プロット）を生成するためのプロンプト
 */
export function buildGrandDesignPrompt(count: number, country: string, era: string, theme: string): string {
  return `Create a full ${count}-episode drama grand design for ${country}, ${era}, ${theme}. Output ONLY valid JSON: { "seriesTitle": "...", "overallSynopsis": "...", "episodesPlan": [ { "epNumber": 1, "titleJp": "...", "titleEn": "...", "summary": "..." } ] }`;
}

/**
 * 各話の脚本（12カット分）を生成するためのプロンプト
 */
export function buildScriptPrompt(epId: number, currentPlan: SeriesEpisodePlan, era: string, country: string, theme: string): string {
  // 設定された時代・国・テーマを動的に埋め込み
  return `Generate a 12-cut drama story skeleton for Episode ${epId} (${currentPlan.titleJp}).
STRICT CONTEXT: Set in "${era}", "${country}". Theme: "${theme}".
You MUST respect the era setting. Never introduce elements that contradict "${era}".

Output ONLY valid JSON matching this exact structure:
{
  "titleJp": "${currentPlan.titleJp}",
  "titleEn": "${currentPlan.titleEn}",
  "summary": "あらすじ",
  "eraAnalysisJp": "時代考証(JP)",
  "forbiddenAnachronisms": ["不適合な要素1", "不適合な要素2"],
  "coverCatchphraseJp": "超ド迫力キャッチコピー",
  "highlightWords": ["キーワード"],
  "cuts": [
    { "id": 1, "basicPlot": "Visual prompt in English describing the scene", "narrationJp": "ナレーション日本語" }
  ]
}`;
}

/**
 * 画像生成用の最終プロンプトとネガティブプロンプトを構築
 */
export function buildImagePromptAndNegative(
  task: GenerationTask,
  settings: GeneratorSettings,
  activeReference: any
): { finalPrompt: string; finalNegative: string; referenceImageMediaIds?: string[] } {
  const { prompt, negativePrompt, styleKey, forbiddenAnachronisms } = task;
  const rawStyle = TASTES[styleKey] || '';
  const eraClothing = getEraClothing(settings.era);
  const { positiveAttire, negativeAnachronisms } = getEraSpecificAnachronisms(settings.era);

  // 画風固定の最優先指示
  const masterStylePrefix = `Masterpiece, authentic ${rawStyle}. Consistent visual art style in ${rawStyle}.`;
  const masterStylePrompt = `[MASTER ART STYLE: ${rawStyle}, strictly maintain identical visual medium and rendering consistency across scenes]`;

  const cameraContext = 'Cinematic composition, natural human anatomy, solid torso, complete upper body, grounded perspective, 8k resolution';
  const antiGulliverAndGoreNegative = 'giant, giantess, floating head, severed body, floating torso, half body cut off by scenery, sitting on rooftop, scale error, dollhouse, diorama, standing straight facing camera, simple mugshot';
  
  // アニメ・イラスト系の場合のネガティブ自動付与
  const isIllustration = styleKey.includes('アニメ') || styleKey.includes('イラスト') || styleKey.includes('マンガ') || styleKey.includes('セル画');
  const illustrationNegative = isIllustration ? 'photorealistic, realistic photo, hyperrealistic photograph, 3d render, cgi, ' : '';
  
  const baselineNegative = `${illustrationNegative}pixel art, 8-bit, 16-bit, lowres, worst quality, text, watermark, signature, blurry`;

  if (activeReference) {
    const { styleDna, antiPoseNegative, eraNegative, mediaId } = activeReference;
    const finalNegative = [
      antiGulliverAndGoreNegative,
      negativeAnachronisms,
      antiPoseNegative,
      eraNegative,
      (forbiddenAnachronisms || []).join(', '),
      negativePrompt,
      baselineNegative
    ].filter(Boolean).join(', ');

    const finalPrompt = `${masterStylePrefix}. ${masterStylePrompt}. [ACTION & POSE: ${prompt}, ${cameraContext}, ${eraClothing}, ${positiveAttire}]. [REFERENCE MEDIUM: ${styleDna}].${STRICT_STYLE_SUFFIX}`;
    return { finalPrompt, finalNegative, referenceImageMediaIds: [mediaId] };
  } else {
    const finalNegative = [
      antiGulliverAndGoreNegative,
      negativeAnachronisms,
      (forbiddenAnachronisms || []).join(', '),
      negativePrompt,
      baselineNegative
    ].filter(Boolean).join(', ');

    const finalPrompt = `${masterStylePrefix}. ${masterStylePrompt}. ${cameraContext}. ${prompt}. ${eraClothing}. ${positiveAttire}.${STRICT_STYLE_SUFFIX}`;
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
  const { epId, cutId, storyContext, prompt, styleKey } = task;
  const era = settings.era;
  const country = settings.country;
  const taste = TASTES[styleKey] || '';
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

  // 演出AIに対しても画風を厳守させる
  const directorPrompt = `Generate cinematic directing data for Cut #${cutId}.
[TARGET ART STYLE]: ${taste}
You MUST NOT describe photographic or photorealistic elements if the style is Anime/Manga.
You MUST NOT describe anime/illustration elements if the style is Photography.

[CAMERA ANGLE GOAL]: ${preset.angle}
[SHOT SCALE REQUIRED]: ${preset.scale}
[ANATOMY & SCALE RULE]: Natural human anatomy! Character must have a solid body (never cut off like a floating ghost head). In Wide shots, character must be realistic small size on the ground.
[CHARACTER GUIDANCE]: ${characterGuidance}
Output ONLY valid JSON:
{
  "promptEn": "Cinematic visual description matching (${preset.angle}) in English, solid complete anatomy",
  "shotScale": "${preset.scale}",
  "kenBurnsPreset": "none|zoom-in|zoom-out|pan-left|pan-right|tilt-up|tilt-down",
  "telop": {
    "fullText": "テロップ文章（15〜20文字程度）",
    "highlights": [ { "word": "最も強調したい2〜3文字のキーワード", "color": "#FFE600", "sizeScale": 1.15 } ]
  }
}
[STORY CONTEXT]: ${storyContext}
[SCENE PLOT]: ${prompt}
[ERA & LOCATION]: ${era}, ${country}`;

  try {
    const result = await callWithRetry(async () => {
      const res = await Flow.generate.text(directorPrompt);
      if (!res?.text || !res.text.includes('{')) throw new Error('Invalid directing data');
      return res;
    }, (attempt, max, delay) => {
      if (addLog) addLog(`Retrying Directing (attempt ${attempt}/${max}) after ${delay} ms...`, 'warning');
    });
    const directed = safeJsonParse(result.text, { promptEn: `${prompt}, ${preset.angle}`, shotScale: preset.scale });
    directed.shotScale = preset.scale;

    const varietyPattern: KenBurnsPreset[] = ['zoom-in', 'pan-right', 'zoom-out', 'pan-left', 'tilt-up', 'pan-right', 'zoom-in', 'zoom-out', 'pan-left', 'tilt-up', 'pan-right', 'zoom-in'];
    directed.kenBurnsPreset = varietyPattern[(cutId - 1) % varietyPattern.length];
    return { ...directed, isDirecting: false };
  } catch (err) {
    if (addLog) addLog(`⚠️ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 演出AIがタイムアウトしたためデフォルト設定を使用します。`, 'warning');
    return { isDirecting: false, shotScale: preset.scale, promptEn: `${prompt}, ${preset.angle}` };
  }
}