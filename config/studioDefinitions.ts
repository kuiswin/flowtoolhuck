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

// ── 8. Vook風テロップ演出スタイル＆トランジション定義 ──────────────────────
import { TelopStyle, TelopTransition, TelopPosition } from '../types';

export interface TelopStyleDefinition {
  id: TelopStyle;
  name: string;
  description: string;
  badgeColor: string;
  defaultTransition: TelopTransition;
  defaultPosition: TelopPosition;
}

export const TELOP_STYLE_REGISTRY: TelopStyleDefinition[] = [
  {
    id: 'mv-blur-slide',
    name: 'ブラースライド (Vook高速演出)',
    description: '方向性ブラーと急減速イージングで滑らかに流し込むプロ仕様MV演出',
    badgeColor: '#00E5FF',
    defaultTransition: 'blur-slide-left',
    defaultPosition: 'bottom-left'
  },
  {
    id: 'mv-kinetic-pop',
    name: 'キネティック・タイポ (Ado / リリック躍動)',
    description: '単語ごとにスタッガーで跳ね上がり、強調語を巨大化させる段違いダイナミック演出',
    badgeColor: '#FFE600',
    defaultTransition: 'zoom-in-bounce',
    defaultPosition: 'center-stagger'
  },
  {
    id: 'mv-neon-glow',
    name: 'ネオングロー (夜景・サイバー)',
    description: '光彩拡散ブラーと多重グローで、暗がりや夜景にエモーショナルに溶け込む演出',
    badgeColor: '#FF2E93',
    defaultTransition: 'glow-fade',
    defaultPosition: 'bottom-center'
  },
  {
    id: 'cinema-subtle',
    name: 'シネマティック・ミニマル (静寂・AOS風)',
    description: '半透明グラスモーフィズムプレートと繊細な字間による上品な映画字幕演出',
    badgeColor: '#A78BFA',
    defaultTransition: 'aos-fade-soft',
    defaultPosition: 'bottom-center'
  },
  {
    id: 'brush-impact',
    name: '墨文字・ド迫力インパクト (時代劇・覚醒)',
    description: '極太フォントと力強い縁取りで、一撃の重みと気迫を伝える大河ドラマ演出',
    badgeColor: '#F59E0B',
    defaultTransition: 'blur-slide-right',
    defaultPosition: 'bottom-center'
  },
  {
    id: 'mv-vertical-lyric',
    name: 'エモ縦書きリリック (Eve/ヨルシカ・和モダン)',
    description: 'サイドバーに繊細に流れる縦書きタイポグラフィ。視線を遮らず余白を美しく魅せる',
    badgeColor: '#34D399',
    defaultTransition: 'aos-fade-soft',
    defaultPosition: 'vertical-right'
  },
  {
    id: 'mv-center-climax',
    name: '画面中央クライマックス (サビ・GSAP特大炸裂)',
    description: 'サビの決めフレーズを画面中央にズドンと炸裂させる最大インパクト演出',
    badgeColor: '#EC4899',
    defaultTransition: 'animista-slide-bck',
    defaultPosition: 'center-climax'
  }
];

export interface TelopTransitionDefinition {
  id: TelopTransition;
  name: string;
  description: string;
  icon: string;
}

export const TELOP_TRANSITION_REGISTRY: TelopTransitionDefinition[] = [
  { id: 'animista-slide-bck', name: 'Animista奥からズームイン (slide-bck)', description: '3D空間の奥から手前にグッと飛び込む迫真モーション', icon: 'filter_tilt_shift' },
  { id: 'gsap-kinetic-stagger', name: 'GSAP急減速スタッガー (呼吸＆残像)', description: '初速最速・終速ピタ止めと微細な呼吸フローティング', icon: 'speed' },
  { id: 'aos-fade-soft', name: 'AOS上品ソフトフェード (静寂・映画風)', description: '繊細な浮遊感とソフトな透過で情景を邪魔しない', icon: 'opacity' },
  { id: 'blur-slide-left', name: '左からブラースライド (Vook高速)', description: '左から横ブラーを伴い高速スライドイン', icon: 'arrow_forward' },
  { id: 'blur-slide-up', name: '下からブラースライド', description: '下から縦ブラーを伴いフワッと飛び込み', icon: 'arrow_upward' },
  { id: 'blur-slide-right', name: '右からブラースライド', description: '右から駆け抜けるようにスライドイン', icon: 'arrow_back' },
  { id: 'zoom-in-bounce', name: 'ズームイン・バウンス', description: '飛び込んで軽く弾むリズミカルな登場', icon: 'fit_screen' },
  { id: 'glow-fade', name: 'ネオン・グローフェード', description: '光の粒子がにじみ出るように静かに発光', icon: 'flare' },
  { id: 'glitch-pop', name: 'グリッチ・カットイン', description: 'デジタルなカットインで瞬時に切り替え', icon: 'bolt' }
];

export interface TelopPositionDefinition {
  id: TelopPosition;
  name: string;
  description: string;
  icon: string;
}

export const TELOP_POSITION_REGISTRY: TelopPositionDefinition[] = [
  { id: 'bottom-left', name: '下部左寄り (左始まり・ステアステップ)', description: '左下から階段状にリズミカルに並ぶ現代MV風レイアウト', icon: 'align_horizontal_left' },
  { id: 'bottom-right', name: '下部右寄り (右付け・ステアステップ)', description: '右下から内側へ階段状に引き締める端正な右寄せレイアウト', icon: 'align_horizontal_right' },
  { id: 'top-cinema', name: '上部シネマ (空・天井天吊り)', description: '下部・中央のメイン被写体を避け、上空の余白に上品に浮遊', icon: 'vertical_align_top' },
  { id: 'vertical-right', name: '右サイド縦書き (和モダン・エモ)', description: '画面右端に縦書きで流すヨルシカ・Eve風の洗練デザイン', icon: 'format_textdirection_r_to_l' },
  { id: 'vertical-left', name: '左サイド縦書き (雑誌・アンニュイ)', description: '画面左端に縦書きで流す叙情的なタイポグラフィ', icon: 'format_textdirection_l_to_r' },
  { id: 'bottom-center', name: '下部中央 (安定・映画字幕)', description: '最も視認性が高くどんなシーンにも馴染む王道字幕配置', icon: 'align_horizontal_center' }
];

export function resolveTelopStyle(styleId?: string): TelopStyleDefinition {
  return TELOP_STYLE_REGISTRY.find(s => s.id === styleId) || TELOP_STYLE_REGISTRY[0];
}

export function resolveTelopTransition(transId?: string): TelopTransitionDefinition {
  return TELOP_TRANSITION_REGISTRY.find(t => t.id === transId) || TELOP_TRANSITION_REGISTRY[0];
}

export function resolveTelopPosition(posId?: string): TelopPositionDefinition {
  return TELOP_POSITION_REGISTRY.find(p => p.id === posId) || TELOP_POSITION_REGISTRY[0];
}

/**
 * カット番号と世界観に基づいてディレクターの推奨テロップ演出を解決
 * 【鉄則ルール】
 * 1. 2回連続で同じ出し方（トランジション）・同じ配置が出ない完全Anti-Repeat制御
 * 2. 画面中央（メイン被写体）を覆い隠さないため、中央配置を排除し「左始まり」「右付け」「上部」「縦書き」に展開
 * 3. ユーザー絶賛の「左寄りの左始まり」と「右寄りの右付け」をテンポよく交互に展開
 */
/**
 * カット番号、楽曲構造、直前カット情報に基づいて動的に演出を生成する「無限バリエーションAIディレクター」
 * 【数千本の量産に耐える完全ランダム × 音楽構造連動エンジン】
 * 1. 画面中央（メイン被写体）を覆い隠さない安全レイアウト（下部左、下部右、上部、縦書き）
 * 2. 直前カットの「出し方（トランジション）」と「配置構図」を100%除外するAnti-Repeat保証
 * 3. 楽曲パート（Aメロ＝静、Bメロ＝変、サビ＝動★、アウトロ＝余韻）の情緒と盛り上がりを確実に維持
 */
export function resolveRecommendedTelopStaging(
  cutId: number, 
  isMvMode?: boolean, 
  isHistorical?: boolean,
  prevStaging?: { transition?: TelopTransition; position?: TelopPosition; style?: TelopStyle }
): {
  style: TelopStyle;
  transition: TelopTransition;
  position: TelopPosition;
  directorNote: string;
} {
  const normCut = ((cutId - 1) % 12) + 1;

  // 配列から直前と被らない要素をランダム選出するヘルパー
  const pickRandom = <T>(pool: T[], avoid?: T): T => {
    const valid = avoid ? pool.filter(item => item !== avoid) : pool;
    const list = valid.length > 0 ? valid : pool;
    return list[Math.floor(Math.random() * list.length)];
  };

  if (isMvMode) {
    let stylePool: TelopStyle[] = [];
    let transPool: TelopTransition[] = [];
    let posPool: TelopPosition[] = [];
    let sectionName = '';
    let sectionMood = '';

    if (normCut <= 3) {
      // ── 【Aメロ (Verse A: 導入・静寂)】 ──
      sectionName = `Verse A${normCut}`;
      sectionMood = '静寂・導入';
      stylePool = ['cinema-subtle', 'mv-blur-slide'];
      transPool = ['aos-fade-soft', 'blur-slide-left', 'blur-slide-up', 'glow-fade'];
      posPool = ['bottom-left', 'bottom-right'];
    } else if (normCut <= 6) {
      // ── 【Bメロ / Bridge (展開・空間変化・テンポアップ)】 ──
      sectionName = normCut === 6 ? 'Bridge' : `Verse B${normCut - 3}`;
      sectionMood = '空間変化・加速';
      stylePool = ['mv-vertical-lyric', 'mv-blur-slide', 'mv-kinetic-pop'];
      transPool = ['blur-slide-right', 'zoom-in-bounce', 'aos-fade-soft', 'blur-slide-left', 'animista-slide-bck'];
      posPool = ['vertical-right', 'vertical-left', 'top-cinema', 'bottom-left', 'bottom-right'];
    } else if (normCut <= 9) {
      // ── 【サビ (Chorus: クライマックス・動★中央被写体回避)】 ──
      sectionName = `Chorus ${normCut - 6}★`;
      sectionMood = '最高潮・爆発';
      stylePool = ['mv-neon-glow', 'mv-kinetic-pop', 'mv-blur-slide'];
      transPool = ['animista-slide-bck', 'gsap-kinetic-stagger', 'zoom-in-bounce', 'glitch-pop'];
      // 中央はメイン被写体を覆うため排除。左始まり・右付け・上空でド派手に炸裂！
      posPool = ['bottom-left', 'bottom-right', 'top-cinema'];
    } else {
      // ── 【Cメロ / アウトロ (Verse C / Outro: 静寂・余韻)】 ──
      sectionName = normCut === 10 ? 'Verse C (落ちサビ)' : `Outro ${normCut - 10}`;
      sectionMood = '静寂・余韻フェード';
      stylePool = ['mv-neon-glow', 'cinema-subtle', 'mv-vertical-lyric'];
      transPool = ['glow-fade', 'aos-fade-soft', 'blur-slide-left'];
      posPool = ['bottom-left', 'bottom-right', 'vertical-left', 'vertical-right'];
    }

    // 直前カットのトランジション＆配置を除外してランダム選出
    const transition = pickRandom(transPool, prevStaging?.transition);
    const position = pickRandom(posPool, prevStaging?.position);
    const style = pickRandom(stylePool, prevStaging?.style);

    const posLabel = 
      position === 'bottom-left' ? '下部左寄り(左始まり)' :
      position === 'bottom-right' ? '下部右寄り(右付け)' :
      position === 'top-cinema' ? '上部シネマ(天吊り)' :
      position === 'vertical-right' ? '右サイド縦書き' :
      position === 'vertical-left' ? '左サイド縦書き' : '下部配置';

    const transLabel = 
      transition === 'animista-slide-bck' ? 'Animista奥ズーム' :
      transition === 'gsap-kinetic-stagger' ? 'GSAP急減速スタッガー' :
      transition === 'aos-fade-soft' ? 'AOS上品ソフトフェード' :
      transition === 'zoom-in-bounce' ? 'ズームバウンス' :
      transition === 'glitch-pop' ? 'グリッチカットイン' :
      transition === 'glow-fade' ? 'ネオングローフェード' : 'ブラースライド';

    return {
      style,
      transition,
      position,
      directorNote: `[${sectionName}・${sectionMood}] ${posLabel} × ${transLabel}。メイン被写体を遮らず無限のバリエーションで楽曲の感情曲線とシンクロ。`
    };
  }

  if (isHistorical) {
    const style: TelopStyle = 'brush-impact';
    const transPool: TelopTransition[] = ['blur-slide-up', 'animista-slide-bck', 'blur-slide-right', 'aos-fade-soft'];
    const posPool: TelopPosition[] = ['bottom-left', 'bottom-right', 'vertical-right', 'top-cinema'];

    const transition = pickRandom(transPool, prevStaging?.transition);
    const position = pickRandom(posPool, prevStaging?.position);

    return {
      style,
      transition,
      position,
      directorNote: `重厚な歴史考証に基づき、直前と異なる視覚動線（${position} × ${transition}）で物語の威厳を表現。`
    };
  }

  // 一般シネマドラマモード
  const stylePool: TelopStyle[] = ['cinema-subtle', 'mv-blur-slide'];
  const transPool: TelopTransition[] = ['aos-fade-soft', 'blur-slide-up', 'blur-slide-left'];
  const posPool: TelopPosition[] = ['bottom-left', 'bottom-right', 'top-cinema'];

  const transition = pickRandom(transPool, prevStaging?.transition);
  const position = pickRandom(posPool, prevStaging?.position);
  const style = pickRandom(stylePool, prevStaging?.style);

  return {
    style,
    transition,
    position,
    directorNote: `映画字幕風グラスプレート。直前カットと重ならないレイアウト（${position} × ${transition}）で映像への没入感を維持。`
  };
}
