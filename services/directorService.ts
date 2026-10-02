import { Flow } from 'flow-sdk';
import { Cut, GenerationTask, GeneratorSettings, KenBurnsPreset, SeriesEpisodePlan } from '../types';
import { IMAGE_MODELS, DEFAULT_ASPECT_RATIO, STRICT_STYLE_SUFFIX, TASTES } from '../constants';
import { safeJsonParse, callWithRetry } from './utils';

/**
 * 舞台設定が歴史・時代劇かどうかを判定（時代・テーマ双方から判定）
 */
export function checkIsHistorical(era: string = '', theme: string = ''): boolean {
  const combined = `${era} ${theme}`;
  // 現代・近過去・SNS・現代ビジネス系は非歴史
  if (
    combined.includes('現代') || 
    combined.includes('令和') || 
    combined.includes('平成') || 
    combined.includes('バブル') || 
    combined.includes('SNS') || 
    combined.includes('ブラック企業') || 
    combined.includes('社内不倫') || 
    combined.includes('タワマン') || 
    combined.includes('推し活') || 
    combined.includes('マッチングアプリ')
  ) {
    return false;
  }
  // 歴史・時代劇キーワード
  return (
    combined.includes('江戸') || combined.includes('幕末') || combined.includes('明治') || 
    combined.includes('大正') || combined.includes('戦後') || combined.includes('昭和') || 
    combined.includes('戦国') || combined.includes('平安') || combined.includes('鎌倉') || 
    combined.includes('室町') || combined.includes('安土桃山') || combined.includes('古代') || 
    combined.includes('中世') || combined.includes('大河') || combined.includes('吉原') || 
    combined.includes('新選組') || combined.includes('浪人') || combined.includes('大名') || 
    combined.includes('武士') || combined.includes('侍') || combined.includes('寺子屋') || 
    combined.includes('飛脚') || combined.includes('岡っ引き') || combined.includes('火消し') ||
    combined.includes('屋台めし') || combined.includes('薬売り') || combined.includes('鉄火場') ||
    combined.includes('鼠小僧')
  );
}

/**
 * キャラクター画像からDNA（特徴）を抽出するためのプロンプトを構築
 */
export function buildCharacterScreeningPrompt(era: string = '', country: string = '', isMvMode?: boolean, theme: string = ''): string {
  const isHistorical = checkIsHistorical(era, theme);
  
  if (isMvMode) {
    return `Analyze the character image for an indie aesthetic music video visual set in "${era || 'Modern'}", "${country || 'Japan'}".
Identify facial features, hairstyles, expression, and distinctive aesthetic characteristics.
Output JSON: {
  "characterDna": "Description of facial features, hair, eyes, and physical traits",
  "styleDna": "Consistent artistic rendering medium (e.g. anime illustration, cel shading, pop art)",
  "antiPoseNegative": "awkward pose, unnatural anatomy, stiff posture",
  "eraNegative": "out-of-character fantasy armor, medieval props"
}`;
  }

  if (isHistorical) {
    return `Analyze the character image for a historical drama set in "${era || 'Historical Japan'}", "${country || 'Japan'}".
Identify facial features, hairstyles, and iconic characteristics.
Strictly ensure modern attire (school uniform, blazer, necktie, casual wear, sneakers, glasses, headphones) is converted to authentic period clothing for "${era || 'the era'}".
Output JSON: {
  "characterDna": "Description of facial features and body traits",
  "styleDna": "Consistent artistic rendering medium",
  "antiPoseNegative": "awkward pose, unnatural anatomy, stiff posture",
  "eraNegative": "modern clothing, school uniform, sailor suit, blazer, necktie, modern casual, sneakers, eyeglasses, headphones, wristwatch, smartphone"
}`;
  }

  return `Analyze the character image for a visual drama set in "${era || 'Contemporary'}", "${country || 'Japan'}".
Identify facial features, hairstyles, clothing style, and iconic characteristics.
Output JSON: {
  "characterDna": "Description of facial features, hair, and distinct physical traits",
  "styleDna": "Consistent artistic rendering medium",
  "antiPoseNegative": "awkward pose, unnatural anatomy, stiff posture",
  "eraNegative": "anachronistic armor, historic kimono in modern setting, out-of-place fantasy props"
}`;
}

/**
 * シリーズ全体のグランドデザイン（全話プロット）を生成するためのプロンプト
 */
export function buildGrandDesignPrompt(count: number, country: string, theme: string, era?: string, isMangaMode?: boolean, isMvMode?: boolean): string {
  const worldSetting = era && era !== theme ? `${theme} (時代: ${era}, 地域: ${country})` : `${theme} (${country})`;
  if (isMvMode) {
    return `Create a ${count}-track music video visual series grand design with Concept & Theme: "${worldSetting}".
Analyze the atmospheric mood, ambient lighting, nostalgic or serene emotion, and visual continuity suitable for an aesthetic music video.
Keep the mood subdued, ennui, and poetic without dramatic conflicts or chaotic action.
Output ONLY valid JSON:
{
  "seriesTitle": "Aesthetic MV Concept Collection",
  "overallSynopsis": "Overview of the musical and visual atmosphere across all parts",
  "episodesPlan": [
    { "epNumber": 1, "titleJp": "日本語トラック/情景タイトル", "titleEn": "English Track Title", "summary": "情景と空気感の描写（日本語2〜3行）" }
  ]
}
`;
  }
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

export interface LyricSegment {
  text: string;
  isHighlight: boolean;
  color?: string;
}

export interface LyricLine {
  text: string;
  segments: LyricSegment[];
  hasHighlight: boolean;
}

/**
 * 日本語リリックテキストを自然な文節行に分割し、
 * 各行の中でハイライト指定単語「だけ」を正確にセグメント化する（助詞や他単語の誤着色を防止）
 */
export function buildLyricLines(fullText: string, highlights: Array<{ word: string; color?: string }>): LyricLine[] {
  const clean = (fullText || '').replace(/^[「『\s]+|[」』\s:：]+$/g, '').trim();
  if (!clean) return [];

  // 1. 行の分割
  let lines: string[] = [];

  if (clean.includes('\n')) {
    lines = clean.split('\n').map(s => s.trim()).filter(Boolean);
  } else if (clean.includes('、') || clean.includes(' ') || clean.includes('　')) {
    lines = clean.split(/[\s　、]+/).map(s => s.trim()).filter(Boolean);
  }

  // もし区切り文字がないか1行だけの場合、形態素・助詞の切れ目で自然に2〜3行に分割
  if (lines.length <= 1) {
    const raw = lines[0] || clean;
    const particles = [
      'ながら', 'まま', 'のに', 'ので', 'ても', 'でも', 'から', 'より', 'けど', 'たら', 'して', 'まで', 
      'ば', 'は', 'が', 'を', 'に', 'へ', 'で', 'と', 'の', 'て'
    ];
    
    // キーワードを分断しないためのキーワード保護境界
    const keywordRanges: Array<[number, number]> = [];
    highlights.forEach(h => {
      if (!h.word) return;
      let pos = 0;
      while ((pos = raw.indexOf(h.word, pos)) !== -1) {
        keywordRanges.push([pos, pos + h.word.length]);
        pos += 1;
      }
    });

    const isInsideKeyword = (index: number) => {
      return keywordRanges.some(([start, end]) => index > start && index < end);
    };

    const tempLines: string[] = [];
    let cur = '';

    for (let i = 0; i < raw.length; i++) {
      cur += raw[i];
      const matchedParticle = particles.find(p => cur.endsWith(p));
      const canBreak = matchedParticle && 
                       cur.length >= 3 && 
                       !isInsideKeyword(i + 1) && 
                       (raw.length - i - 1) >= 3;

      if (canBreak && tempLines.length < 3) {
        tempLines.push(cur);
        cur = '';
      }
    }
    if (cur) tempLines.push(cur);
    lines = tempLines.length > 0 ? tempLines : [raw];
  }

  // 最大4行に制限
  lines = lines.slice(0, 4);

  // 2. 各行の中で、ハイライト単語「だけ」を抽出してセグメント化
  // 長い単語を優先してマッチング
  const sortedHighlights = [...highlights].filter(h => h.word).sort((a, b) => b.word.length - a.word.length);

  return lines.map(lineText => {
    const charHighlight = new Array<{ isHighlight: boolean; color?: string }>(lineText.length);
    for (let i = 0; i < lineText.length; i++) {
      charHighlight[i] = { isHighlight: false };
    }

    sortedHighlights.forEach(h => {
      if (!h.word) return;
      let pos = 0;
      while ((pos = lineText.indexOf(h.word, pos)) !== -1) {
        // すでに別のハイライトが割り当てられていなければ設定
        let canSet = true;
        for (let k = 0; k < h.word.length; k++) {
          if (charHighlight[pos + k]?.isHighlight) {
            canSet = false;
            break;
          }
        }
        if (canSet) {
          for (let k = 0; k < h.word.length; k++) {
            charHighlight[pos + k] = { isHighlight: true, color: h.color || '#FFE600' };
          }
        }
        pos += 1;
      }
    });

    // 連続する文字をセグメントにまとめる
    const segments: LyricSegment[] = [];
    let curSegText = '';
    let curIsHigh = false;
    let curColor = '#FFE600';

    for (let i = 0; i < lineText.length; i++) {
      const hInfo = charHighlight[i];
      if (i === 0) {
        curSegText = lineText[i];
        curIsHigh = hInfo.isHighlight;
        curColor = hInfo.color || '#FFE600';
      } else if (hInfo.isHighlight === curIsHigh && (!curIsHigh || hInfo.color === curColor)) {
        curSegText += lineText[i];
      } else {
        segments.push({
          text: curSegText,
          isHighlight: curIsHigh,
          color: curIsHigh ? curColor : undefined
        });
        curSegText = lineText[i];
        curIsHigh = hInfo.isHighlight;
        curColor = hInfo.color || '#FFE600';
      }
    }
    if (curSegText) {
      segments.push({
        text: curSegText,
        isHighlight: curIsHigh,
        color: curIsHigh ? curColor : undefined
      });
    }

    const hasHighlight = segments.some(s => s.isHighlight);

    return {
      text: lineText,
      segments,
      hasHighlight
    };
  });
}

/**
 * 各話の脚本（12カット分）および時代考証をAIに動的生成させるプロンプト
 * （世界観・テーマからGeminiが時代考証・衣装・NG要素およびカットごとの金文字強調キーワードを自律生成）
 */
export function buildScriptPrompt(
  epId: number, 
  currentPlan: SeriesEpisodePlan, 
  country: string, 
  theme: string, 
  era?: string, 
  isMangaMode?: boolean,
  isMvMode?: boolean
): string {
  const worldSetting = era && era !== theme ? `${theme} (時代: ${era}, 地域: ${country})` : `${theme} (${country})`;
  
  const isHistorical = checkIsHistorical(era, theme);
  
  const directorRole = isMvMode
    ? "world-class music video (MV) director and visual poet"
    : isMangaMode 
      ? "world-class comic/manga author and storyboard artist" 
      : isHistorical
        ? "world-class historical drama director"
        : "world-class cinematic drama director";
    
  const mangaInstructions = isMangaMode 
    ? `MANGA/COMIC DIRECTING:
1. Dynamic Comic Storytelling:
Design full-bleed, borderless manga artwork filling the entire frame. Include expressive dialogues (Spoken Dialogue), inner thoughts (Monologue), narration, and dramatic onomatopoeia (SFX) smoothly integrated into narrationJp.
2. Dramatic Comic Compositions:
Direct each cut with striking manga visual dynamics (epic splash double spreads, intense eye close-ups, dynamic action poses, deep screentone shadows).`
    : "";

  const mvInstructions = isMvMode
    ? `MUSIC VIDEO (MV) CONTINUITY & LYRIC DIRECTING:
1. Seamless Visual Flow in the Same World:
This is an authentic music video sequence where the visual is a cinematic aesthetic backdrop to a song.
Maintain a steady, atmospheric, nostalgic, or melancholic mood (e.g. city nightlights, walking through wind-swept fields, neon dusk, subway platform, rain on windows).
The 12 cuts must form a seamless, cohesive visual universe.

2. AUTHENTIC SONG LYRICS (REAL J-POP / VOCALOID / INDIE ROCK LYRICS):
CRITICAL: Do NOT write third-person scenery narration (e.g. "ふと立ち止まり振り返れば...").
Instead, narrationJp MUST be REAL EMOTIONAL SONG LYRICS (楽曲の歌詞そのもの) as if sung by Ado, Yorushika, ZUTOMAYO, YOASOBI, or Vaundy!
The 12 cuts MUST tell a musical story like a single complete hit song:
- Cuts 1-3 (Verse A): Quiet restlessness, unvoiced emotions, solitary late night. (e.g., "言えない言葉ばかりが部屋に積もってく", "掠れた声のまま夜を数えてた")
- Cuts 4-6 (Verse B): Rising tempo, running through the dusk, heartbeats accelerating. (e.g., "曖昧な境界線を塗り潰してゆく", "滲んだ街灯の先へ走り出す")
- Cuts 7-9 (Chorus / Drop): Emotional climax, powerful punchy lyrical hooks! (e.g., "叫べない夜の向こう側まで連れてって", "息を切らした僕らの居場所はここにある")
- Cuts 10-12 (Outro / Epilogue): Lingering resonance, quiet dawn, resolved heartbeat. (e.g., "朝焼けが全てを染め直す前に", "風が止んだ空白に君の名前を呼ぶ")
Each cut's narrationJp must be 15-28 characters, punchy, lyrical, and catchy.

3. Aesthetic Subtitle Highlights:
For EACH cut, select 1 to 2 key emotional words (which MUST be EXACTLY present in narrationJp, e.g. "夜", "境界線", "息", "朝焼け", "名前") for the highlights array.`
    : "";

  const contextTitle = isMvMode ? "Music Video Sequence" : isMangaMode ? "Comic Episode" : isHistorical ? "Historical Drama Episode" : "Drama Episode";

  return `You are a ${directorRole} and visual researcher.
Create a 12-cut ${contextTitle} for Episode ${epId} ("${currentPlan.titleJp}").
World Theme & Setting: "${worldSetting}".

${isMvMode ? mvInstructions : mangaInstructions}

${isMvMode ? 'ATMOSPHERIC & VISUAL HARMONY:' : (isHistorical ? 'STRICT HISTORICAL ACCURACY:' : 'AUTHENTIC SETTING & CULTURAL ACCURACY:')}
Dynamically analyze the period, setting, and atmosphere implied by "${worldSetting}". Determine authentic aesthetic attire and identify elements that would break the mood and must NEVER appear.

CRITICAL SUBTITLE HIGHLIGHTS:
For EACH cut, select 1 to 2 key terms (which MUST BE EXACTLY present in narrationJp) for the "highlights" array to be highlighted in gold text.

Output ONLY valid JSON matching this exact structure:
{
  "titleJp": "${currentPlan.titleJp}",
  "titleEn": "${currentPlan.titleEn}",
  "summary": "${isMvMode ? '楽曲の世界観・全体の雰囲気（日本語2〜3行）' : '話のあらすじ（日本語）'}",
  "eraAnalysisJp": "${isMvMode ? 'MVのビジュアルコンセプトと情緒の解説（日本語）' : '時代背景と舞台設定の考証解説（日本語）'}",
  "authenticAttireEn": "Detailed English prompt for natural attire and wardrobe matching ${worldSetting}",
  "forbiddenKeywordsEn": "${isMvMode ? 'screaming, angry, weapon, battle, aggressive combat, chaotic destruction, theatrical over-acting' : 'Comma-separated English negative keywords for anachronisms that must NEVER appear in ' + worldSetting}",
  "forbiddenAnachronisms": ["${isMvMode ? '激しい叫びや戦闘' : '日本語の禁止要素1'}", "${isMvMode ? '過剰な劇的演出' : '日本語の禁止要素2'}"],
  "coverCatchphraseJp": "${isMvMode ? '楽曲に寄り添うエモーショナルなフレーズ' : '超ド迫力キャッチコピー'}",
  "highlightWords": ["代表キーワード1", "代表キーワード2"],
  "cuts": [
    { 
      "id": 1, 
      "basicPlot": "Cinematic visual description of the cut in English", 
      "narrationJp": "${isMvMode ? '楽曲の歌詞・リリック（1曲の歌として繋がるエモい歌詞20文字前後）' : '重厚なナレーション（日本語）'}",
      "highlights": ["ナレーション内の重要語1", "ナレーション内の重要語2"]
    }
  ]
}
`;
}
import { 
  buildDynamicAntiPreviousNegative, 
  getStoryboardPreset, 
  buildFinalCinematicPromptAndNegative, 
  PreviousShotContext 
} from './promptEngine';
import { resolveCameraWork, resolveRecommendedTelopStaging } from '../config/studioDefinitions';

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
    ? `Protagonist: ${activeReference.characterDna}. NOTE: Adopt only the character's appearance and distinctive features (face, hair, eyes); DO NOT copy reference pose.` 
    : 'No specific reference asset.';

  // 定義テーブルから本カットの演出プリセットを取得
  const preset = getStoryboardPreset(cutId, settings.isMvMode, settings.isMangaMode);
  const kbPreset: KenBurnsPreset = settings.isMangaMode 
    ? 'none' 
    : resolveCameraWork(preset.tag).recommendedKenBurns;

  const directorRole = settings.isMvMode ? "music video (MV) visual director" : settings.isMangaMode ? "comic book/manga storyboard artist" : "film director";
  const mvExtraDirecting = settings.isMvMode ? "MANDATORY FOR MV MODE: Atmospheric, ambient, and seamless continuity. Subdued, introspective, and aesthetic expression. No shouting, no melodramatic action poses, no theatrical over-acting. Natural, gentle movements or contemplative gaze matching the background mood." : "";
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

  const isHistorical = checkIsHistorical(settings.era, settings.theme);
  const genreDesc = settings.isMvMode 
    ? "an aesthetic music video" 
    : settings.isMangaMode 
      ? "a dramatic comic/manga series" 
      : isHistorical 
        ? "a historical drama" 
        : "a cinematic visual drama";

  const wardrobeDesc = settings.isMvMode
    ? "stylish aesthetic wardrobe matching the music video theme"
    : isHistorical
      ? "authentic historical period attire"
      : "natural character attire matching the setting";

  const defaultTelop = resolveRecommendedTelopStaging(cutId, settings.isMvMode, isHistorical);

  const directorPrompt = `You are a ${directorRole} designing a visual shot and motion-graphics telop staging for ${genreDesc}.
Context: "${prompt}".
Style: "${rawStyle}".
${characterGuidance}
${previousContrastMandate}

Avoid scale errors. If wide shot, character MUST be small and background realistic. If close-up, show head/shoulders with natural proportions.
${mangaExtraDirecting}
${mvExtraDirecting}

Output ONLY valid JSON:
{
  "enhancedPrompt": "Extremely detailed scene description in English including lighting, props, ${wardrobeDesc}, atmosphere, shot angle, and distinct character pose/action",
  "cameraWork": "${preset.tag}",
  "cinematicAngle": "${preset.angle}",
  "shotScale": "${preset.scale}",
  "telopStyle": "${defaultTelop.style}",
  "telopTransition": "${defaultTelop.transition}",
  "directorTelopNote": "${defaultTelop.directorNote}"
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
        telop: {
          fullText: '',
          style: parsed.telopStyle || defaultTelop.style,
          transition: parsed.telopTransition || defaultTelop.transition,
          position: defaultTelop.position,
          directorNote: parsed.directorTelopNote || defaultTelop.directorNote
        }
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
    telop: {
      fullText: '',
      style: defaultTelop.style,
      transition: defaultTelop.transition,
      position: defaultTelop.position,
      directorNote: defaultTelop.directorNote
    }
  };
}