import { Cut, Episode, KenBurnsPreset } from '../types';
import { Output, Mp4OutputFormat, BufferTarget, CanvasSource } from 'mediabunny';
import { renderCoverCanvas } from './exportService';


/**
 * ケンバーンズ効果の文字列をケバブケースに正規化（キャメルケースや旧表記との互換性を確保）
 */
export function normalizeKenBurnsPreset(preset?: string): KenBurnsPreset {
  if (!preset || preset === 'none') return 'none';
  const p = preset.toLowerCase().replace(/_/g, '-');
  if (p === 'zoomin' || p === 'zoom-in' || p === 'subtlezoom' || p === 'subtle-zoom') return 'zoom-in';
  if (p === 'zoomout' || p === 'zoom-out') return 'zoom-out';
  if (p === 'panleft' || p === 'pan-left') return 'pan-left';
  if (p === 'panright' || p === 'pan-right' || p === 'pandiagonal' || p === 'pan-diagonal') return 'pan-right';
  if (p === 'tiltup' || p === 'tilt-up') return 'tilt-up';
  if (p === 'tiltdown' || p === 'tilt-down') return 'tilt-down';
  return 'zoom-in'; // 不明な値の場合はデフォルトで自然なズームイン
}

/**
 * 静止画に対して Ken Burns アフェクトを計算してキャンバスに描画するヘルパー
 */
function drawKenBurnsFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  img: HTMLImageElement | OffscreenCanvas | HTMLCanvasElement,
  width: number,
  height: number,
  preset: string,
  progress: number
) {
  const normPreset = normalizeKenBurnsPreset(preset);
  let scale = 1.0;
  let xOffset = 0;
  let yOffset = 0;

  if (normPreset === 'zoom-in') {
    scale = 1.0 + progress * 0.20;
    yOffset = -(height * 0.08 * progress); 
  } else if (normPreset === 'zoom-out') {
    scale = 1.20 - progress * 0.20;
    yOffset = -(height * 0.08 * (1 - progress));
  } else if (normPreset === 'pan-left') {
    scale = 1.15;
    xOffset = width * 0.05 - (progress * width * 0.1);
  } else if (normPreset === 'pan-right') {
    scale = 1.15;
    xOffset = -(width * 0.05) + (progress * width * 0.1);
  } else if (normPreset === 'tilt-up') {
    scale = 1.15;
    yOffset = height * 0.05 - (progress * height * 0.1);
  } else if (normPreset === 'tilt-down') {
    scale = 1.15;
    yOffset = -(height * 0.05) + (progress * height * 0.1);
  }

  const drawW = width * scale;
  const drawH = height * scale;
  const dx = (width - drawW) / 2 + xOffset;
  const dy = (height - drawH) / 2 + yOffset;

  ctx.drawImage(img as any, dx, dy, drawW, drawH);
}



/**
 * 日本語テキストをスマートに単語・意味ブロックに分割（Ado風リリック単位）
 */
function splitIntoAdoWords(text: string): string[] {
  const clean = text.replace(/^[「『\s]+|[」』\s:：]+$/g, '').trim();
  if (!clean) return [];

  // スペースや読点があればそれで分割
  if (clean.includes(' ') || clean.includes('　') || clean.includes('、')) {
    const rawParts = clean.split(/[\s　、]+/).filter(Boolean);
    if (rawParts.length >= 2) return rawParts.slice(0, 4);
  }

  // 助詞や文字境界でスマートに2〜3語に分割
  const parts: string[] = [];
  let current = '';
  const particles = ['は', 'が', 'を', 'に', 'へ', 'で', 'と', 'から', 'より', 'の', 'て', 'まま', 'けど', 'たら', 'して'];

  for (let i = 0; i < clean.length; i++) {
    current += clean[i];
    const isParticle = particles.some(p => current.endsWith(p));
    if (isParticle && current.length >= 3 && parts.length < 3 && i < clean.length - 2) {
      parts.push(current);
      current = '';
    } else if (current.length >= 6 && parts.length < 3 && i < clean.length - 2) {
      parts.push(current);
      current = '';
    }
  }
  if (current) parts.push(current);
  return parts.length > 0 ? parts : [clean];
}

/**
 * 音楽MVモード用 Ado風キネティック・タイポグラフィ
 * 単語単位で段違いにレイアウトされ、Animate.css風にテンポよく流れるように飛び込み、しっかり読めてから抜ける！
 */
function renderKineticAdoLyrics(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  cut: Cut,
  currentTime: number,
  duration: number,
  width: number,
  height: number
) {
  const rawText = cut.telop?.fullText || cut.narrationJp || '';
  if (!rawText.trim()) return;

  const highlights = cut.telop?.highlights || [];
  const words = splitIntoAdoWords(rawText);
  if (words.length === 0) return;

  // タイムライン進行度 (0.0 〜 1.0)
  const progress = Math.max(0, Math.min(1, currentTime / Math.max(duration, 0.1)));

  // 全体の退場アニメーション（0.84 〜 1.0: zoomOut & fadeOut）
  let globalExitAlpha = 1;
  let globalExitScale = 1;
  if (progress > 0.84) {
    const exitT = (progress - 0.84) / 0.16;
    globalExitAlpha = Math.max(0, 1 - exitT);
    globalExitScale = 1.0 + (exitT * 0.08);
  }

  if (globalExitAlpha <= 0.01) return;

  const baseFontSize = Math.min(width * 0.065, 52);
  const strokeWidth = Math.max(8, baseFontSize * 0.22);
  const lineHeight = baseFontSize * 1.35;

  // 単語数に応じた基準垂直位置（画面下部 70%〜80% に収める）
  const totalHeight = words.length * lineHeight;
  const startY = height * 0.76 - (totalHeight * 0.4);

  // 単語ごとの水平オフセット（Ado風のステアステップ / 段違いレイアウト）
  // 単語0: やや左 (-12%〜-8%), 単語1: 中央付近 (0%), 単語2: やや右 (+8%〜+12%)
  const xOffsets = words.length === 1 ? [0] :
                   words.length === 2 ? [-width * 0.08, width * 0.08] :
                   [-width * 0.11, 0, width * 0.11];

  const angles = [-3.5, 2.0, -2.5, 3.0]; // 単語ごとのわずかな傾きで躍動感を演出

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  words.forEach((wordText, idx) => {
    // 単語ごとの時間差登場（スタッガーアニメーション）
    // 例: 単語0は0.04〜, 単語1は0.18〜, 単語2は0.32〜
    const wordEntryStart = 0.04 + idx * 0.14;
    const wordEntryDuration = 0.15; // 登場にかかる時間

    if (progress < wordEntryStart) return; // まだ登場していない

    let wordAlpha = 1;
    let wordScale = 1;
    let wordOffsetY = 0;

    const timeSinceEntry = progress - wordEntryStart;
    if (timeSinceEntry < wordEntryDuration) {
      // Animate.css "backInUp" バウンス登場
      const t = timeSinceEntry / wordEntryDuration;
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const easeBack = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      wordAlpha = Math.min(1, t * 1.6);
      wordOffsetY = (1 - easeBack) * (height * 0.06); // 下から飛び込み
      wordScale = 0.35 + (easeBack * 0.65);
    } else {
      // 静止ホールド期間（呼吸のようなごく微細なスケール 1.0 -> 1.02）
      const holdProgress = (progress - (wordEntryStart + wordEntryDuration)) / (0.84 - (wordEntryStart + wordEntryDuration));
      wordScale = 1.0 + (Math.max(0, holdProgress) * 0.02);
      wordOffsetY = 0;
      wordAlpha = 1;
    }

    const currentX = (width * 0.5) + (xOffsets[idx] || 0);
    const currentY = startY + idx * lineHeight + wordOffsetY;
    const angle = angles[idx % angles.length];

    // ハイライト判定
    const isHighlighted = highlights.some(h => h.word && (wordText.includes(h.word) || h.word.includes(wordText)));
    const textColor = isHighlighted ? '#FFE600' : '#FFFFFF';
    const highlightSizeBoost = isHighlighted ? 1.18 : 1.0;

    ctx.save();
    ctx.translate(currentX, currentY);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.scale(wordScale * globalExitScale * highlightSizeBoost, wordScale * globalExitScale * highlightSizeBoost);
    ctx.globalAlpha = Math.max(0, Math.min(1, wordAlpha * globalExitAlpha));

    ctx.font = `900 ${baseFontSize}px "Impact", "Montserrat Black", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif`;

    // 1. 強烈なブラックドロップシャドウ
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    // 2. 超極太黒縁取り（どんな背景でも超クッキリ）
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = strokeWidth * (isHighlighted ? 1.2 : 1.0);
    ctx.strokeText(wordText, 0, 0);

    // 3. クッキリ鮮明な文字塗り
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.fillStyle = textColor;
    ctx.fillText(wordText, 0, 0);

    ctx.restore();
  });

  ctx.restore();
}

/**
 * 字幕を「アニメ風ド迫力スタイル」で焼き込む
 */
function drawBakedSubtitles(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, width: number, height: number, cut: Cut, currentTime: number = 0, duration: number = 4, isMvMode: boolean = false) {
  const rawText = cut.telop?.fullText || cut.narrationJp || '';
  if (!rawText.trim()) return;

  if (isMvMode) {
    renderKineticAdoLyrics(ctx, cut, currentTime, duration, width, height);
    return;
  }

  const text = rawText.replace(/^[\s「『]+|[:：\s」』]+$/g, '').slice(0, 36);
  const highlights = cut.telop?.highlights || [];
  const baseFontSize = 38;
  const kanjiScale = 1.06;
  const strokeWidth = 8;
  const letterMargin = 4;
  const maxWidth = width * 0.92;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const highlightIndices = new Map<number, { color: string; sizeScale: number }>();
  highlights.forEach(h => {
    if (!h.word) return;
    let pos = 0;
    while ((pos = text.indexOf(h.word, pos)) !== -1) {
      for (let k = 0; k < h.word.length; k++) {
        highlightIndices.set(pos + k, h);
      }
      pos += 1;
    }
  });

  const charData = text.split('').map((char, index) => {
    const isKanji = /[\u4e00-\u9faf]/.test(char);
    const highlight = highlightIndices.get(index);
    return {
      char,
      isKanji,
      color: highlight ? (highlight.color || '#FFE600') : 'white',
      scale: (highlight ? (highlight.sizeScale || 1.15) : 1.0) * (isKanji ? kanjiScale : 1.0)
    };
  });

  const lines: typeof charData[] = [];
  let currentLine: typeof charData = [];
  let currentLineWidth = 0;

  charData.forEach(d => {
    ctx.font = `900 ${baseFontSize * d.scale}px "Noto Sans JP", sans-serif`;
    const w = ctx.measureText(d.char).width + letterMargin;
    if (currentLineWidth + w > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [d];
      currentLineWidth = w;
    } else {
      currentLine.push(d);
      currentLineWidth += w;
    }
  });
  if (currentLine.length > 0) lines.push(currentLine);

  const lineHeight = baseFontSize * 1.5;
  const totalHeight = lines.length * lineHeight;
  const plateY = height * 0.84;

  // 各行の最大横幅を計測して、座布団サイズを計算
  let maxLineWidth = 0;
  lines.forEach(line => {
    let w = 0;
    line.forEach(d => {
      ctx.font = `900 ${baseFontSize * d.scale}px "Noto Sans JP", sans-serif`;
      w += ctx.measureText(d.char).width + letterMargin;
    });
    if (w > maxLineWidth) maxLineWidth = w;
  });

  const boxWidth = Math.min(width * 0.94, maxLineWidth + 44);
  const boxHeight = totalHeight + 28;
  const boxX = (width - boxWidth) / 2;
  const boxY = plateY - boxHeight / 2;

  // 約20%〜35%後ろが見える半透明座布団プレート（グラスモーフィズム調）
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2;
  if (typeof (ctx as any).roundRect === 'function') {
    ctx.beginPath();
    (ctx as any).roundRect(boxX, boxY, boxWidth, boxHeight, 18);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);
  }
  ctx.restore();

  const startY = plateY - totalHeight / 2;

  lines.forEach((line, lineIdx) => {
    let lineTotalWidth = 0;
    line.forEach(d => {
      ctx.font = `900 ${baseFontSize * d.scale}px "Noto Sans JP", sans-serif`;
      lineTotalWidth += ctx.measureText(d.char).width + letterMargin;
    });

    const y = startY + (lineIdx + 0.5) * lineHeight;
    let currentX = (width - lineTotalWidth) / 2;

    line.forEach(d => {
      const fontSize = baseFontSize * d.scale;
      ctx.font = `900 ${fontSize}px "Noto Sans JP", sans-serif`;
      const charWidth = ctx.measureText(d.char).width;
      const x = currentX + charWidth / 2;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      ctx.strokeStyle = 'black';
      ctx.lineWidth = strokeWidth;
      ctx.strokeText(d.char, x, y);

      ctx.fillStyle = d.color;
      ctx.fillText(d.char, x, y);
      ctx.restore();

      currentX += charWidth + letterMargin;
    });
  });
  ctx.restore();
}

/**
 * エピソード内の全カットを1本に結合してMP4を出力する
 */
export async function renderFullEpisodeMovie(
  episode: Episode, 
  onProgress: (cutIndex: number, total: number) => void
): Promise<Blob> {
  await document.fonts.ready;

  const width = 720;
  const height = 1280;
  const fps = 30;
  const defaultCutDuration = 4;

  const outputCanvas = new OffscreenCanvas(width, height);
  const ctx = outputCanvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  });

  const canvasSource = new CanvasSource(outputCanvas as any, {
    codec: 'avc',
    bitrate: 8000000, 
    frameRate: fps
  } as any);
  output.addVideoTrack(canvasSource);
  await output.start();

  let globalTime = 0;

  try {
    const coverCanvas = await renderCoverCanvas(episode);
    const coverFrames = 2 * fps;
    for (let f = 0; f < coverFrames; f++) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(coverCanvas as any, 0, 0, width, height);
      await canvasSource.add(globalTime, 1 / fps);
      globalTime += 1 / fps;
    }
  } catch (e) {
    console.error('Intro cover render failed', e);
  }

  for (let i = 0; i < episode.cuts.length; i++) {
    const cut = episode.cuts[i];
    onProgress(i + 1, episode.cuts.length);

    if (cut.videoBase64) {
      const video = document.createElement('video');
      video.src = `data:video/mp4;base64,${cut.videoBase64}`;
      video.muted = true;
      video.playsInline = true;
      video.style.position = 'absolute';
      video.style.opacity = '0';
      video.style.pointerEvents = 'none';
      video.style.width = '0';
      video.style.height = '0';
      document.body.appendChild(video);

      await new Promise<void>((resolve) => {
        let settled = false;
        const done = () => { if (!settled) { settled = true; resolve(); } };
        video.onloadeddata = done;
        video.onerror = done;
        setTimeout(done, 8000);
        video.load();
      });

      const duration = video.duration || defaultCutDuration;
      const frames = Math.floor(duration * fps);

      for (let f = 0; f < frames; f++) {
        const time = f / fps;
        video.currentTime = time;
        await new Promise(r => video.onseeked = r);
        
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(video, 0, 0, width, height);
        drawBakedSubtitles(ctx, width, height, cut, time, duration, !!episode.isMvMode);
        
        await canvasSource.add(globalTime, 1 / fps);
        globalTime += 1 / fps;
      }
      document.body.removeChild(video);
    } else if (cut.imageBase64) {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const imgObj = new Image();
        imgObj.onload = () => resolve(imgObj);
        imgObj.onerror = reject;
        imgObj.src = `data:image/png;base64,${cut.imageBase64}`;
      });

      const duration = defaultCutDuration;
      const frames = duration * fps;

      for (let f = 0; f < frames; f++) {
        const progress = f / frames;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);
        
        drawKenBurnsFrame(ctx, img, width, height, cut.kenBurnsPreset || 'none', progress);
        drawBakedSubtitles(ctx, width, height, cut, progress * duration, duration, !!episode.isMvMode);
        
        await canvasSource.add(globalTime, 1 / fps);
        globalTime += 1 / fps;
      }
    }
  }

  canvasSource.close();
  await output.finalize();

  return new Blob([output.target.buffer!], { type: 'video/mp4' });
}

export async function renderKenBurnsVideo(cut: Cut, durationSec: number = 4, isMvMode: boolean = false): Promise<string> {
  await document.fonts.ready;
  if (!cut.imageBase64) throw new Error('Image data missing');

  const width = 720;
  const height = 1280;
  const fps = 30;
  const totalFrames = durationSec * fps;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.src = `data:image/png;base64,${cut.imageBase64}`;
  });

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  });

  const canvasSource = new CanvasSource(canvas as any, { codec: 'avc', frameRate: fps } as any);
  output.addVideoTrack(canvasSource);
  await output.start();

  for (let frame = 0; frame < totalFrames; frame++) {
    const progress = frame / totalFrames;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);
    drawKenBurnsFrame(ctx, img, width, height, cut.kenBurnsPreset || 'none', progress);
    drawBakedSubtitles(ctx, width, height, cut, frame / fps, durationSec, isMvMode);
    await canvasSource.add(frame / fps, 1 / fps);
  }

  canvasSource.close();
  await output.finalize();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(new Blob([output.target.buffer!], { type: 'video/mp4' }));
  });
}