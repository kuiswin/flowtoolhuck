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
    ? `MANGA/COMIC DIRECTING & AUTONOMOUS PANEL SEQUENCING:
1. Dynamic Comic Storytelling:
Design full-bleed, borderless manga artwork. Include expressive dialogues (Spoken Dialogue), inner thoughts (Monologue), narration, and dramatic onomatopoeia (SFX) smoothly integrated into narrationJp.

2. AUTONOMOUS COMIC PANEL SEQUENCE (CRITICAL):
Analyze this episode's drama. Pick ONE sequence of consecutive cuts (2 to 4 cuts, e.g. Cuts 4-5 for 2 cuts, Cuts 7-9 for 3 cuts, or Cuts 6-9 for 4 cuts) representing the peak action, duel, revelation, or climax.
Select the layout that best fits the mood:
- "diagonal-2" (2 cuts): Dynamic diagonal split action for high-tension duels/standoffs!
- "vertical-2" (2 cuts): 2-panel vertical sequence (overview -> intense reaction)!
- "vertical-3" (3 cuts): 3-panel step-by-step action buildup (approach -> strike -> aftermath)!
- "t-split-3" (3 cuts): Big upper splash + 2 bottom split reaction panels!
- "grid-4" (4 cuts): 2x2 4-panel rapid action/reaction burst!
- OR "spread-splash" (1 to 2 cuts): Epic double-page spread climax that shatters all frames!

For cuts in the chosen sequence:
- Set "comicPanelLayout" to the chosen layout name.
- Set "comicTotalSteps" to the number of cuts in that sequence (2, 3, or 4; for spread-splash use 1 or 2).
- Set "comicParentCutId" to the cut ID of the FIRST cut in this sequence.
- Set "comicStep" sequentially (1 for 1st cut, 2 for 2nd cut, 3 for 3rd cut, 4 for 4th cut).
- The parent cut's basicPlot MUST describe the complete multi-panel composition.
- For all other cuts OUTSIDE the sequence: set "comicPanelLayout": "none", "comicStep": 1, "comicTotalSteps": 1, "comicParentCutId": cutId.`
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
      "highlights": ["ナレーション内の重要語1", "ナレーション内の重要語2"],
      "comicPanelLayout": "none | diagonal-2 | vertical-2 | vertical-3 | t-split-3 | grid-4 | spread-splash",
      "comicStep": 1,
      "comicTotalSteps": 1,
      "comicParentCutId": 1
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
  const mangaNegative = settings.isMangaMode 
    ? 'white border, white margin, white gutter, border, frame, paper margin, comic panel outline, panel border, outer frame, picture frame, blank edge, cropped border, boxed layout, empty spacing, ' 
    : '';
  const baselineNegative = `${illustrationNegative}${mangaNegative}frame, border, picture frame, ornate frame, arch frame, decorative border, pixel art, 8-bit, 16-bit, lowres, worst quality, text, watermark, signature, blurry`;

  // コマ割りレイアウトに応じた作画構図指示
  const comicPanel = (task as any).comicPanel;
  let comicLayoutPrompt = '';
  if (settings.isMangaMode && comicPanel && comicPanel.layout !== 'none') {
    switch (comicPanel.layout) {
      case 'diagonal-2':
        comicLayoutPrompt = 'Dynamic 2-panel diagonal split composition with sharp dynamic dividing angle. Split screen showing two contrasting character actions. Full-bleed edge-to-edge.';
        break;
      case 'vertical-2':
        comicLayoutPrompt = 'Dynamic 2-panel vertically stacked composition with crisp black dividing gutter. Top panel shows establishing moment, bottom panel shows intense climax. Full-bleed edge-to-edge.';
        break;
      case 'vertical-3':
        comicLayoutPrompt = 'Dynamic 3-panel vertically stacked manga composition. 3 distinct sequential moments from top to bottom separated by thin black dividing gutters. Full-bleed edge-to-edge.';
        break;
      case 't-split-3':
        comicLayoutPrompt = 'Dynamic 3-panel manga composition. Large upper splash panel, lower half split into two side-by-side reaction panels. Full-bleed edge-to-edge.';
        break;
      case 'grid-4':
        comicLayoutPrompt = 'Dynamic 4-panel 2x2 grid manga composition. 4 rapid sequential action panels separated by crisp dividing gutters. Full-bleed edge-to-edge.';
        break;
      case 'spread-splash':
        comicLayoutPrompt = 'Breathtaking double-page spread manga climax splash artwork. Monumental epic scale, boundary-breaking dynamic composition bursting across the screen, ultimate visual impact, borderless full-bleed edge-to-edge.';
        break;
    }
  }

  // 漫画演出モード時のプロンプト拡張（余白・枠線を完全排除し画面いっぱいに描画）
  const mangaPromptSuffix = settings.isMangaMode 
    ? `manga style, ${comicLayoutPrompt ? comicLayoutPrompt + ', ' : ''}full-bleed edge-to-edge artwork, borderless composition, filling entire canvas without margins, dynamic pen and ink, screentone, cel shading, intense dramatic expressions, extreme high contrast, bold line art, speed lines` 
    : '';

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

    const finalPrompt = `${masterStylePrefix}. ${masterStylePrompt}. [ACTION: ${prompt}, ${cameraContext}]. ${dynamicAttire}. [REFERENCE MEDIUM: ${styleDna}]. ${mangaPromptSuffix}.${STRICT_STYLE_SUFFIX}`;
    return { finalPrompt, finalNegative, referenceImageMediaIds: [mediaId] };
  } else {
    const finalNegative = [
      antiGulliverAndGoreNegative,
      dynamicForbidden,
      negativePrompt,
      baselineNegative
    ].filter(Boolean).join(', ');

    const finalPrompt = `${masterStylePrefix}. ${masterStylePrompt}. ${cameraContext}. ${prompt}. ${dynamicAttire}. ${mangaPromptSuffix}.${STRICT_STYLE_SUFFIX}`;
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

  const MANGA_SHOT_PRESETS = [
    { scale: 'Splash', angle: 'Massive full-bleed edge-to-edge illustration, dynamic character pose breaking across the entire screen, extreme impact, borderless, speed lines', tag: '見開き大ゴマ(全景)' },
    { scale: 'Close-up', angle: 'Intense macro eye close-up filling the frame, heavy screen tones, speed lines radiating, dramatic monologue expression, borderless', tag: '迫真アップ・モノローグ' },
    { scale: 'Medium', angle: 'Webtoon style vertical flow, character in mid-action, dynamic diagonal angle, bold SFX onomatopoeia, full-bleed composition', tag: 'Webtoon風斜め・SFX' },
    { scale: 'Wide', angle: 'Establishing shot with detailed pen-and-ink architecture, deep shadows, cinematic comic perspective, full-bleed edge-to-edge', tag: '背景描写・トーン表現' },
    { scale: 'Close-up', angle: 'Dutch tilt angular composition, character screaming or reacting with intense emotional distortion, bold line art, borderless', tag: '斜めリアクション' },
    { scale: 'Medium', angle: 'Dramatic high-contrast cel-shaded lighting, character holding a dynamic combat or decisive pose, speed lines, full-bleed', tag: '決めポーズ・集中線' },
    { scale: 'Wide', angle: 'Sweeping manga double-page spread style, multiple focal points, epic environmental scale, detailed crosshatching, borderless edge-to-edge', tag: 'エピック大ゴマ' },
    { scale: 'Medium', angle: 'Intense standoff over-the-shoulder framing, heavy tension, screentone gradients, dramatic shadows, full-bleed', tag: '対峙・緊張感' },
    { scale: 'Close-up', angle: 'Extreme close-up on mouth/jaw with gritted teeth, heavy inking, dramatic stylized emotion, borderless', tag: '口元アップ・SFX' },
    { scale: 'Medium', angle: 'Dynamic leaping/running action, extreme foreshortening, kinetic speed lines, borderless edge-to-edge artwork', tag: 'アクション・遠近法' },
    { scale: 'Close-up', angle: 'Tearful or highly emotional character face, glowing eyes, fine delicate line art, emotional screentones, borderless', tag: '感情爆発・トーン' },
    { scale: 'Wide', angle: 'Cinematic climax splash artwork, full environment integration, spectacular pen and ink mastery, full-bleed borderless', tag: 'クライマックス見開き' }
  ];

  const presetsToUse = settings.isMangaMode ? MANGA_SHOT_PRESETS : CINEMATIC_SHOT_PRESETS;
  const preset = presetsToUse[(cutId - 1) % presetsToUse.length];
  const kenBurnsPresets: KenBurnsPreset[] = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down'];
  // 漫画モード時はカメラを静止（none）にして漫画の紙面クオリティを維持
  const kbPreset = settings.isMangaMode ? 'none' : kenBurnsPresets[(cutId - 1) % kenBurnsPresets.length];

  const directorRole = settings.isMangaMode ? "comic book/manga storyboard artist" : "film director";
  const mangaExtraDirecting = settings.isMangaMode 
    ? "MANDATORY FOR MANGA: Full-bleed edge-to-edge artwork ONLY. Never generate panel borders, white gutters, frames, or blank margins. Fill the entire canvas with dynamic pen-inking, screentones, cel-shading, dynamic facial expressions, and comic-style impact." 
    : "";

  const directorPrompt = `You are a ${directorRole} designing a visual shot for a historical drama.
Context: "${prompt}".
Style: "${rawStyle}".
${characterGuidance}
Requested Framing: ${preset.scale} (${preset.angle}).
Avoid scale errors. If wide shot, character MUST be small and buildings realistic. If close-up, show head/shoulders with natural proportions.
${mangaExtraDirecting}

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