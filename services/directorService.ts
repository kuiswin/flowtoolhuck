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
export function buildGrandDesignPrompt(count: number, country: string, theme: string, era?: string, isMangaMode?: boolean): string {
  const worldSetting = era && era !== theme ? `${theme} (時代: ${era}, 地域: ${country})` : `${theme} (${country})`;
  const mangaInstruction = isMangaMode 
    ? "Design the pacing and narrative structure specifically for a highly dynamic comic/manga serialization (including dramatic cliffhangers and fast-paced story development)." 
    : "";
  return `Create a full ${count}-episode drama grand design with World Theme & Setting: "${worldSetting}".
Analyze the authentic era, cultural background, human drama, and visual atmosphere directly from this theme.
${mangaInstruction}
Output ONLY valid JSON:
{
  "seriesTitle": "Dramatic Series Title",
  "overallSynopsis": "Overview of the entire narrative arc",
  "episodesPlan": [
    { "epNumber": 1, "titleJp": "日本語タイトル", "titleEn": "English Title", "summary": "話のあらすじ" }
  ]
}
`;
}

/**
 * 続編エピソード（第N話）のプロットを自律策定するためのプロンプト
 */
export function buildNextEpisodePlanPrompt(
  nextEpId: number,
  seriesTitle: string,
  overallSynopsis: string,
  previousEpisodes: Array<{ epNumber: number; titleJp: string; summary?: string }>,
  country: string,
  theme: string,
  era?: string,
  isMangaMode?: boolean
): string {
  const worldSetting = era && era !== theme ? `${theme} (時代: ${era}, 地域: ${country})` : `${theme} (${country})`;
  const prevSummary = previousEpisodes
    .map(p => `第${p.epNumber}話「${p.titleJp}」: ${p.summary || ''}`)
    .join('\n');
  const mangaInstruction = isMangaMode 
    ? "Design with intense comic/manga cliffhangers, high emotional stakes, and dynamic story pacing." 
    : "";

  return `You are a world-class drama director and screenwriter.
We are continuing the serialization of the drama series "${seriesTitle}".
World Theme & Setting: "${worldSetting}".
Overall Synopsis: "${overallSynopsis}".

Previous Episodes Narrative History:
${prevSummary}

Now, create the compelling story outline for the NEXT episode (Episode ${nextEpId}).
It must naturally build upon the climax of the previous episodes and introduce exciting developments.
${mangaInstruction}

Output ONLY valid JSON:
{
  "epNumber": ${nextEpId},
  "titleJp": "日本語サブタイトル",
  "titleEn": "English Title",
  "summary": "第${nextEpId}話のあらすじ・展開（日本語2〜3行）"
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
export function buildScriptPrompt(epId: number, currentPlan: SeriesEpisodePlan, country: string, theme: string, era?: string, isMangaMode?: boolean): string {
  const worldSetting = era && era !== theme ? `${theme} (時代: ${era}, 地域: ${country})` : `${theme} (${country})`;
  
  const directorRole = isMangaMode 
    ? "world-class comic/manga author and storyboard artist" 
    : "world-class historical drama director";
    
  const mangaInstructions = isMangaMode 
    ? `MANGA/COMIC DIRECTING:
1. Dynamic Comic Storytelling:
Design full-bleed, borderless manga artwork filling the entire frame. Include expressive dialogues (Spoken Dialogue), inner thoughts (Monologue), narration, and dramatic onomatopoeia (SFX) smoothly integrated into narrationJp.
2. Dramatic Comic Compositions:
Direct each cut with striking manga visual dynamics (epic splash double spreads, intense eye close-ups, dynamic action poses, deep screentone shadows).`
    : "";

  return `You are a ${directorRole} and historical researcher.
Create a 12-cut drama story skeleton for Episode ${epId} ("${currentPlan.titleJp}").
World Theme & Setting: "${worldSetting}".

${mangaInstructions}

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
import { 
  buildDynamicAntiPreviousNegative, 
  getStoryboardPreset, 
  buildFinalCinematicPromptAndNegative, 
  PreviousShotContext 
} from './promptEngine';
import { resolveCameraWork } from '../config/studioDefinitions';

export type { PreviousShotContext as PreviousShotInfo };

/**
 * 直前のカットの構図・ポーズ・アングルを排除するための動的ネガティブプロンプト
 * （promptEngine の定義駆動ロジックに委譲）
 */
export function buildAntiPreviousCompositionNegative(
  prevScale?: string,
  prevAngle?: string,
  prevPrompt?: string
): string {
  return buildDynamicAntiPreviousNegative({
    scale: prevScale,
    angle: prevAngle,
    prompt: prevPrompt,
  });
}

/**
 * 画像生成用の最終プロンプトとネガティブプロンプトを構築
 * （Media Vault 6層レイヤー＆定義駆動エンジンに委譲）
 */
export const buildImagePromptAndNegative = buildFinalCinematicPromptAndNegative;

/**
 * カットごとの演出データ（構図、テロップ、ケンバーン効果）をAIで決定
 * （studioDefinitions および promptEngine に基づく宣言的ロジック駆動）
 */
export async function directShot(
  task: GenerationTask,
  settings: GeneratorSettings,
  activeReference: any,
  previousShotInfo?: PreviousShotContext,
  addLog?: (msg: string, type?: any) => void
): Promise<Partial<Cut>> {
  const { cutId, prompt, styleKey } = task;
  const rawStyle = TASTES[styleKey] || '';
  const characterGuidance = activeReference 
    ? `Protagonist: ${activeReference.characterDna}. She is the central heroine. NOTE: Adopt only her appearance (face, hair, eyes); DO NOT copy her reference pose.` 
    : 'No specific reference asset.';

  // 定義テーブルから本カットの演出プリセットを取得
  const preset = getStoryboardPreset(cutId, settings.isMangaMode);
  const kbPreset: KenBurnsPreset = settings.isMangaMode 
    ? 'none' 
    : resolveCameraWork(preset.tag).recommendedKenBurns;

  const directorRole = settings.isMangaMode ? "comic book/manga storyboard artist" : "film director";
  const mangaExtraDirecting = settings.isMangaMode 
    ? "MANDATORY FOR MANGA: Full-bleed edge-to-edge artwork ONLY. Never generate panel borders, white gutters, frames, or blank margins. Fill the entire canvas with dynamic pen-inking, screentones, cel-shading, dynamic facial expressions, and comic-style impact." 
    : "";

  const previousContrastMandate = previousShotInfo?.scale
    ? `CRITICAL CINEMATIC CONTRAST MANDATE:
The PREVIOUS CUT (Cut ${cutId - 1}) was framed as: [${previousShotInfo.scale}] with angle: "${previousShotInfo.angle || previousShotInfo.tag || ''}".
Context of previous cut: "${previousShotInfo.prompt?.slice(0, 120) || ''}".
MANDATORY RULE: This Cut ${cutId} MUST BE RADICALLY DIFFERENT from the previous cut!
- If the previous cut was seated or on the floor, THIS CUT MUST BE standing, walking, in motion, or a dramatic bust portrait!
- NEVER repeat the same camera distance, angle, or character posture as the previous cut.
- Requested Framing for THIS cut is: ${preset.scale} (${preset.angle}).`
    : `Requested Framing: ${preset.scale} (${preset.angle}).`;

  const directorPrompt = `You are a ${directorRole} designing a visual shot for a historical drama.
Context: "${prompt}".
Style: "${rawStyle}".
${characterGuidance}
${previousContrastMandate}

Avoid scale errors. If wide shot, character MUST be small and buildings realistic. If close-up, show head/shoulders with natural proportions.
${mangaExtraDirecting}

Output ONLY valid JSON:
{
  "enhancedPrompt": "Extremely detailed scene description in English including lighting, props, historical attire, atmosphere, shot angle, and distinct character pose/action",
  "cameraWork": "${preset.tag}",
  "cinematicAngle": "${preset.angle}",
  "shotScale": "${preset.scale}"
}`;

  // 定義テーブルに基づき直前構図を自動除外するネガティブ文字列を生成
  const antiPreviousNegative = buildDynamicAntiPreviousNegative(previousShotInfo);

  try {
    const res = await Flow.generate.text(directorPrompt);
    const resText = typeof res === 'string' ? res : (res?.text || res);
    const parsed = safeJsonParse<any>(resText, {});
    if (parsed && parsed.enhancedPrompt) {
      return {
        promptEn: parsed.enhancedPrompt,
        negativePrompt: antiPreviousNegative,
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
    negativePrompt: antiPreviousNegative,
    cameraWork: preset.tag,
    cinematicAngle: preset.angle,
    shotScale: preset.scale,
    kenBurnsPreset: kbPreset,
  };
}