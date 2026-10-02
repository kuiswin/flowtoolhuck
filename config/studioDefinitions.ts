import { KenBurnsPreset, VideoModelType } from '../types';

/**
 * =======================================================================
 * STUDIO PRO: ロジック駆動型・統合定義ファイル (Single Source of Truth)
 * =======================================================================
 * すべてのモデル、構図ルール、カメラワーク、プロンプトパイプライン、
 * ネガティブ除外ルールをこの定義データに集約します。
 * コード側での個別ハードコードを完全排除し、この定義から自動駆動させます。
 */

// ── 1. 画像生成モデル定義 ─────────────────────────────────────────────
export interface ImageModelDefinition {
  id: string;
  name: string;
  label: string;
  description: string;
  isDefault?: boolean;
}

export const IMAGE_MODELS_REGISTRY: ImageModelDefinition[] = [
  { 
    id: 'banana-2-lite', 
    name: '🍌 Nano Banana 2 Lite', 
    label: '🍌 2 Lite（超爆速 / 0pt）', 
    description: '下書き・大量プレビュー確認向け' 
  },
  { 
    id: 'banana-2', 
    name: '🍌 Nano Banana 2', 
    label: '🍌 Banana 2（高速・高画質 / 0pt）★推奨', 
    description: '速度と描画精度のバランスが最も優れた標準モデル',
    isDefault: true
  },
  { 
    id: 'banana-pro', 
    name: '🍌 Nano Banana Pro', 
    label: '🍌 Banana Pro（最高峰シネマ / 0pt）', 
    description: '圧倒的ディテールとライティング。キメカット向け' 
  }
];

export function resolveImageModel(keyOrLabel?: string): ImageModelDefinition {
  const defaultModel = IMAGE_MODELS_REGISTRY.find(m => m.isDefault) || IMAGE_MODELS_REGISTRY[1];
  if (!keyOrLabel) return defaultModel;
  return IMAGE_MODELS_REGISTRY.find(m => m.id === keyOrLabel || m.label === keyOrLabel || m.name === keyOrLabel) || defaultModel;
}

// ── 2. 動画生成モデル定義 ─────────────────────────────────────────────
export interface VideoModelDefinition {
  id: VideoModelType;
  name: string;
  label: string;
  defaultDuration: number;
  costPoints: number;
  isDefault?: boolean;
}

export const VIDEO_MODELS_REGISTRY: VideoModelDefinition[] = [
  { 
    id: 'veo-lite', 
    name: 'Veo 3.1 - Lite', 
    label: 'Veo 3.1 Lite（8秒 / 5pt）★コスパ最強', 
    defaultDuration: 8, 
    costPoints: 5,
    isDefault: true 
  },
  { 
    id: 'omni-flash', 
    name: 'Omni 1.1 Flash', 
    label: 'Omni 1.1 Flash（4秒 / 15pt）⚡高速', 
    defaultDuration: 4, 
    costPoints: 15 
  },
  { 
    id: 'veo-fast', 
    name: 'Veo 3.1 - Fast', 
    label: 'Veo 3.1 Fast（8秒 / 10pt）🚀高速シネマ', 
    defaultDuration: 8, 
    costPoints: 10 
  }
];

export function resolveVideoModel(idOrName?: string): VideoModelDefinition {
  const defaultModel = VIDEO_MODELS_REGISTRY.find(m => m.isDefault) || VIDEO_MODELS_REGISTRY[0];
  if (!idOrName) return defaultModel;
  return VIDEO_MODELS_REGISTRY.find(m => m.id === idOrName || m.name === idOrName || m.label === idOrName) || defaultModel;
}

// ── 3. カメラワーク・カメラモーション定義 ──────────────────────────────
export interface CameraWorkDefinition {
  id: string;
  label: string;
  motionPrompt: string;
  recommendedKenBurns: KenBurnsPreset;
}

export const CAMERA_WORK_REGISTRY: CameraWorkDefinition[] = [
  { 
    id: 'static', 
    label: '固定（フィックス）', 
    motionPrompt: 'Static camera, perfectly still cinematic frame, stable perspective',
    recommendedKenBurns: 'none'
  },
  { 
    id: 'zoom-in', 
    label: 'ゆっくりズームイン', 
    motionPrompt: 'Slow cinematic zoom in towards the subject, dramatic emotional tension',
    recommendedKenBurns: 'zoom-in'
  },
  { 
    id: 'zoom-out', 
    label: 'ゆっくりズームアウト', 
    motionPrompt: 'Slow cinematic zoom out revealing the expansive atmosphere and surrounding environment',
    recommendedKenBurns: 'zoom-out'
  },
  { 
    id: 'pan-left', 
    label: 'パン（左へ流す）', 
    motionPrompt: 'Smooth horizontal camera pan movement from right to left',
    recommendedKenBurns: 'pan-left'
  },
  { 
    id: 'pan-right', 
    label: 'パン（右へ流す）', 
    motionPrompt: 'Smooth horizontal camera pan movement from left to right',
    recommendedKenBurns: 'pan-right'
  },
  { 
    id: 'tilt-up', 
    label: 'ティルト（見上げる）', 
    motionPrompt: 'Slow cinematic vertical camera tilt moving upwards towards the sky',
    recommendedKenBurns: 'tilt-up'
  },
  { 
    id: 'tilt-down', 
    label: 'ティルト（見下ろす）', 
    motionPrompt: 'Slow cinematic vertical camera tilt moving downwards from overhead',
    recommendedKenBurns: 'tilt-down'
  },
  { 
    id: 'handheld', 
    label: '手持ち風（微細な揺れ）', 
    motionPrompt: 'Realistic handheld camera style, subtle organic breathing camera shake, cinema verite realism',
    recommendedKenBurns: 'zoom-in'
  },
  { 
    id: 'tracking', 
    label: '被写体を追従（トラッキング）', 
    motionPrompt: 'Dynamic camera tracking shot smoothly following the character in motion',
    recommendedKenBurns: 'pan-left'
  }
];

export function resolveCameraWork(labelOrMotion?: string): CameraWorkDefinition {
  if (!labelOrMotion) return CAMERA_WORK_REGISTRY[0];
  return CAMERA_WORK_REGISTRY.find(c => c.label === labelOrMotion || c.motionPrompt === labelOrMotion || c.id === labelOrMotion) || CAMERA_WORK_REGISTRY[0];
}

// ── 4. 構図スケール＆直前カット対比ルール定義（Rule-based Contrast） ─────
export interface ShotScaleDefinition {
  scale: string;
  tag: string;
  cinematicAngle: string;
  mangaAngle: string;
  // この構図が直前に使われた場合に次カットへ自動注入されるネガティブワード
  antiRepeatNegatives: string[];
  // 直前がこの構図だった場合に推奨される対比スケール候補
  suggestedContrastScales: string[];
}

export const SHOT_SCALE_REGISTRY: Record<string, ShotScaleDefinition> = {
  'Wide': {
    scale: 'Wide',
    tag: '引き・世界観',
    cinematicAngle: 'Cinematic wide horizontal shot, street-level atmospheric perspective with environment and props',
    mangaAngle: 'Establishing shot with detailed pen-and-ink architecture, deep shadows, cinematic comic perspective, full-bleed edge-to-edge',
    antiRepeatNegatives: [
      'extreme wide shot', 'distant landscape', 'tiny distant character', 
      'bird eye view', 'panoramic wide shot', 'distant miniature figure'
    ],
    suggestedContrastScales: ['Close-up', 'Medium']
  },
  'Close-up': {
    scale: 'Close-up',
    tag: '迫真アップ',
    cinematicAngle: 'Dramatic low-angle worm\'s-eye view looking up from below, intense cinematic perspective showing head and shoulders firmly grounded, dynamic sky background',
    mangaAngle: 'Intense macro eye close-up filling the frame, heavy screen tones, speed lines radiating, dramatic monologue expression, borderless',
    antiRepeatNegatives: [
      'extreme close-up', 'macro face', 'zoomed-in headshot', 
      'cropped face filling screen', 'tight headshot portrait'
    ],
    suggestedContrastScales: ['Wide', 'Medium', 'Splash']
  },
  'Medium': {
    scale: 'Medium',
    tag: '上半身・対峙',
    cinematicAngle: 'Looking back over the shoulder while walking away, dynamic three-quarter view, candid emotional glance',
    mangaAngle: 'Dramatic high-contrast cel-shaded lighting, character holding a dynamic combat or decisive standing pose, speed lines, full-bleed',
    antiRepeatNegatives: [
      'standard medium shot', 'static bust portrait', 'waist-up centered portrait', 
      'neutral mid-shot'
    ],
    suggestedContrastScales: ['Close-up', 'Wide']
  },
  'Splash': {
    scale: 'Splash',
    tag: '見開き大ゴマ',
    cinematicAngle: 'Epic wide cinematic climax view, panoramic environmental composition',
    mangaAngle: 'Massive full-bleed edge-to-edge illustration, dynamic character pose breaking across the entire screen, extreme impact, borderless, speed lines',
    antiRepeatNegatives: [
      'splash double spread', 'extreme wide environmental view', 'distant panoramic landscape'
    ],
    suggestedContrastScales: ['Close-up', 'Medium']
  }
};

// ── 5. アクション・姿勢の対比ルール（Pose Contrast Rule） ─────────────
export const POSE_CONTRAST_RULES: Array<{
  triggerKeywords: string[];
  antiRepeatNegatives: string[];
}> = [
  {
    triggerKeywords: ['sit', 'sitting', 'floor', 'ground', 'tatami', 'cross-legged', 'seated'],
    antiRepeatNegatives: [
      'sitting on floor', 'sitting down', 'seated', 'crossed legs', 
      'kneeling', 'squatting', 'floor sitting pose', 'looking up from floor', 
      'sitting on tatami', 'floor seating posture'
    ]
  },
  {
    triggerKeywords: ['stand', 'standing', 'stiff', 'upright'],
    antiRepeatNegatives: [
      'stiff standing pose', 'static upright standing', 'motionless standing'
    ]
  },
  {
    triggerKeywords: ['walk', 'walking', 'run', 'running'],
    antiRepeatNegatives: [
      'walking away repetition', 'running pose repetition'
    ]
  }
];

// ── 6. 音楽MV用テーマ定義（10選） ────────────────────────────────────
export const MV_THEMES = [
  '🌿 草原の風と夕暮れ（あてもなく歩く帰り道・揺れる草木と黄金の光）',
  '☕ 雨の日の純喫茶（曇った窓ガラス・温かい珈琲の湯気・静かな読書）',
  '🌃 深夜2時の部屋（薄暗い間接照明・青白いPC画面・ベッドサイドのチル）',
  '🚗 都会の夜間ドライブ（雨に濡れた高速道路・流れるテールランプ・首都高）',
  '🏖️ 誰もいない晩夏の砂浜（静かに寄せては返す波・夕凪・足跡）',
  '🚉 夕暮れのローカル線無人駅（吹き抜ける風・夕日差すベンチ・遠い鉄橋）',
  '🌆 ビルの屋上・街を見下ろす微風（茜色から紫へのマジックアワー・佇む背中）',
  '🏙️ 霧が立ち込める早朝の街（まだ誰もいない静まり返った交差点・朝露）',
  '🌌 満天の星空と焚き火（静寂の森・揺らめく小さな炎・火の粉と夜空）',
  '🎨 木漏れ日のアトリエ（白いカーテンの揺れ・散らかったパレット・午後の光）'
];

// ── 7. 12カット・ストーリー展開プリセット（シネマ・漫画・音楽MV） ────────
export interface StoryShotPreset {
  scale: string;
  tag: string;
  cinematicAngle: string;
  mangaAngle: string;
  mvAngle: string;
}

export const TWELVE_CUT_STORYBOARD_PRESETS: StoryShotPreset[] = [
  {
    scale: 'Wide',
    tag: '引き・世界観',
    cinematicAngle: 'High-angle landscape view looking down from above, character is an active figure in the townscape / environmental setting, sweeping atmospheric background',
    mangaAngle: 'Massive full-bleed edge-to-edge opening splash illustration, grand world setting, extreme atmospheric depth, speed lines',
    mvAngle: 'Cinematic establishing wide landscape, atmospheric natural scenery, subject walking or standing naturally in the distance, gentle wind, beautiful natural light, serene music video opening'
  },
  {
    scale: 'Medium',
    tag: '佇まい・アンニュイ',
    cinematicAngle: 'Dramatic low-angle worm\'s-eye view looking up from below, intense cinematic perspective showing head and shoulders firmly grounded, dynamic sky background',
    mangaAngle: 'Intense macro eye close-up filling the frame, heavy screen tones, speed lines radiating, dramatic monologue expression, borderless',
    mvAngle: 'Relaxed medium shot, subject in contemplative quiet pose, looking away calmly, soft natural rim lighting, unposed candid aesthetic'
  },
  {
    scale: 'Close-up',
    tag: '情緒的ディテール',
    cinematicAngle: 'Looking back over the shoulder while walking away, dynamic three-quarter view, candid emotional glance',
    mangaAngle: 'Webtoon style vertical flow, character in mid-action, dynamic diagonal angle, bold SFX onomatopoeia, full-bleed composition',
    mvAngle: 'Artistic detail close-up, focusing on hands, feet walking, gently swaying grass, or atmospheric texture, emotional shallow depth of field'
  },
  {
    scale: 'Wide',
    tag: '逆光・光の移ろい',
    cinematicAngle: 'Cinematic wide horizontal shot, street-level atmospheric perspective with environment and props, character interacting with setting',
    mangaAngle: 'Establishing shot with detailed pen-and-ink architecture, deep shadows, cinematic comic perspective, full-bleed edge-to-edge',
    mvAngle: 'Wide horizontal shot with golden hour backlight or moody dusk glow, warm rim illumination, quiet environmental harmony'
  },
  {
    scale: 'Medium',
    tag: '後ろ姿・風情',
    cinematicAngle: 'Dutch tilt angled close-up, dramatic diagonal framing focusing on eyes and expression',
    mangaAngle: 'Dutch tilt angular composition, character reacting with intense emotional distortion, bold line art, borderless',
    mvAngle: 'Over-the-shoulder or three-quarter back view, hair and clothes gently swaying in the breeze, gazing into the vast open horizon'
  },
  {
    scale: 'Close-up',
    tag: '伏し目・静寂',
    cinematicAngle: 'Low-angle medium shot looking up towards character standing strong, solid upper body posture',
    mangaAngle: 'Dramatic high-contrast cel-shaded lighting, character holding a decisive standing pose, speed lines, full-bleed',
    mvAngle: 'Gentle side profile close-up, downcast tranquil gaze, subtle melancholic expression, soft cinematic bokeh, quiet emotion'
  },
  {
    scale: 'Wide',
    tag: '風景・呼吸感',
    cinematicAngle: 'High-angle downward view from balcony or hill, character walking naturally among townspeople on the ground',
    mangaAngle: 'Sweeping manga double-page spread style, multiple focal points, epic environmental scale, detailed crosshatching, borderless edge-to-edge',
    mvAngle: 'Expansive environmental composition, subject integrated as a small harmonious part of the scenery, vast sky, breathing space'
  },
  {
    scale: 'Medium',
    tag: '小休止・自然体',
    cinematicAngle: 'Over-the-shoulder perspective looking past the character towards the scene ahead, tense atmosphere',
    mangaAngle: 'Intense standoff over-the-shoulder framing, heavy tension, screentone gradients, dramatic shadows, full-bleed',
    mvAngle: 'Casual candid medium framing, pausing naturally, sitting peacefully or leaning gently, neutral serene vibe, no dramatic tension'
  },
  {
    scale: 'Close-up',
    tag: 'マクロ・テクスチャ',
    cinematicAngle: 'Side profile close-up silhouette with warm lantern rim light, dramatic lighting',
    mangaAngle: 'Extreme close-up on mouth/jaw with gritted teeth, heavy inking, dramatic stylized emotion, borderless',
    mvAngle: 'Atmospheric macro focus, dappled sunlight, soft shadows, raindrops, or gentle light leak reflection, evocative visual texture'
  },
  {
    scale: 'Medium',
    tag: '歩き出し・流れる時',
    cinematicAngle: 'Centered cinematic medium portrait, dramatic side-lighting, dignified cinematic presence',
    mangaAngle: 'Dynamic leaping/running action, extreme foreshortening, kinetic speed lines, borderless edge-to-edge artwork',
    mvAngle: 'Smooth moving perspective, walking forward at a gentle pace, natural relaxed gait, candid indie music video frame'
  },
  {
    scale: 'Close-up',
    tag: 'アンニュイ表情',
    cinematicAngle: 'Macro emotional close-up capturing intense gaze and lip expression',
    mangaAngle: 'Tearful or highly emotional character face, glowing eyes, fine delicate line art, emotional screentones, borderless',
    mvAngle: 'Subtle expressive close-up, calm peaceful face, soft diffused ambient lighting, neutral gentle aura, serene beauty'
  },
  {
    scale: 'Wide',
    tag: '余韻・アウトロ',
    cinematicAngle: 'Epic wide cinematic climax view, panoramic environmental composition',
    mangaAngle: 'Cinematic climax splash artwork, full environment integration, spectacular pen and ink mastery, full-bleed borderless',
    mvAngle: 'Epic serene wide lingering view, subject melting into the vast landscape, fading twilight, timeless poetic stillness'
  }
];

// ── 7. 基本ネガティブプロンプト規約 ────────────────────────────────────
export const BASELINE_NEGATIVE_TOKENS = {
  anatomicalIntegrity: 'giant, giantess, floating head, severed body, floating torso, half body cut off by scenery, scale error, diorama, simple mugshot, bad anatomy, deformed fingers',
  antiReferenceStiffness: 'identical pose as reference image, repeating reference image pose, static mugshot pose, repeating reference angle',
  antiAnachronisms: 'modern clothing, wristwatch, eyeglasses, sneakers, smartphone, headphones, electricity pole, asphalt road',
  antiFrameAndBorder: 'frame, border, picture frame, ornate frame, arch frame, decorative border, white border, white margin, white gutter, paper margin, comic panel outline, panel border, outer frame, blank edge, cropped border, boxed layout, empty spacing',
  renderingQuality: 'lowres, worst quality, text, watermark, signature, blurry, artifact, jpeg artifacts, poorly rendered'
};
