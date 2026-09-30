import { Flow } from 'flow-sdk';
import JSZip from 'jszip';
import { Episode, SeriesManifest } from '../types';
import { LogEntry } from '../components/StudioLogs';
import { renderFullEpisodeMovie } from './browserVideoService';

/**
 * 動画や扉絵用にタイトル文字列をクリーン化
 */
const cleanTitle = (title: string) => {
  return (title || '無題').replace(/\s*\(Ep\.\s*\d+\)/gi, '').trim();
};

/**
 * SRT形式のタイムコード生成 (HH:MM:SS,mmm)
 */
function formatSRTTime(seconds: number): string {
  const date = new Date(0);
  date.setMilliseconds(seconds * 1000);
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const mm = date.getUTCMinutes().toString().padStart(2, '0');
  const ss = date.getUTCSeconds().toString().padStart(2, '0');
  const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
  return `${hh}:${mm}:${ss},${ms}`;
}

/**
 * EpisodeデータからSRT字幕ファイルを生成
 */
function generateSRT(ep: Episode): string {
  let srt = '';
  let currentTime = 2.0; // 冒頭2秒の扉絵分をオフセット

  ep.cuts.forEach((cut, index) => {
    const duration = cut.videoDuration || 4;
    const startTime = formatSRTTime(currentTime);
    const endTime = formatSRTTime(currentTime + duration);

    srt += `${index + 1}\n`;
    srt += `${startTime} --> ${endTime}\n`;
    srt += `${cut.narrationJp || ''}\n\n`;

    currentTime += duration;
  });

  return srt;
}

/**
 * 9:16のインパクト扉絵をキャンバスにレンダリングする
 */
export async function renderCoverCanvas(ep: Episode): Promise<OffscreenCanvas | HTMLCanvasElement> {
  const width = 720;
  const height = 1280;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  const cut1Base64 = ep.cuts[0]?.imageBase64;
  if (cut1Base64) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Image load failed'));
        i.src = `data:image/png;base64,${cut1Base64}`;
      });

      const zoomScale = 1.2; 
      const sw = img.width / zoomScale;
      const sh = img.height / zoomScale;
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2.5;

      ctx.save();
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
      ctx.restore();
    } catch (e) {
      console.warn('Cover image render failed', e);
    }
  }

  const topGrad = ctx.createLinearGradient(0, 0, 0, 240);
  topGrad.addColorStop(0, 'rgba(0,0,0,0.9)');
  topGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, 240);

  const bottomGrad = ctx.createLinearGradient(0, height - 280, 0, height);
  bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
  bottomGrad.addColorStop(0.3, 'rgba(0,0,0,0.85)');
  bottomGrad.addColorStop(1, 'rgba(0,0,0,0.95)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, height - 280, width, 280);

  const drawSuperImpactText = (
    text: string, 
    x: number, 
    y: number, 
    fontSize: number, 
    options: { 
      highlights?: string[]; 
      forceColor?: string; 
      strokeWidth?: number;
    } = {}
  ) => {
    const { highlights = [], forceColor, strokeWidth = 16 } = options;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const segments: { text: string; isHighlight: boolean }[] = [];
    if (highlights.length > 0) {
      const regex = new RegExp(`(${highlights.join('|')})`, 'g');
      const parts = text.split(regex);
      parts.forEach(p => {
        if (highlights.includes(p)) segments.push({ text: p, isHighlight: true });
        else if (p) segments.push({ text: p, isHighlight: false });
      });
    } else {
      segments.push({ text, isHighlight: false });
    }

    let totalWidth = 0;
    segments.forEach(seg => {
      ctx.font = `900 ${seg.isHighlight ? fontSize * 1.1 : fontSize}px sans-serif`;
      totalWidth += ctx.measureText(seg.text).width;
    });

    const maxWidth = 660;
    const finalScale = totalWidth > maxWidth ? maxWidth / totalWidth : 1.0;

    ctx.translate(x, y);
    ctx.scale(finalScale, finalScale);
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;

    let currentX = -totalWidth / 2;
    segments.forEach(seg => {
      const fSize = seg.isHighlight ? fontSize * 1.1 : fontSize;
      ctx.font = `900 ${fSize}px sans-serif`;
      const segWidth = ctx.measureText(seg.text).width;
      
      let color = 'white';
      if (forceColor) {
        color = forceColor;
      } else if (seg.isHighlight) {
        color = ep.id % 2 === 0 ? '#FFE600' : '#FF2E4D';
      }

      ctx.strokeStyle = 'black';
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = 'round';
      ctx.strokeText(seg.text, currentX + segWidth / 2, 0);

      ctx.fillStyle = color;
      ctx.fillText(seg.text, currentX + segWidth / 2, 0);

      currentX += segWidth;
    });

    ctx.restore();
  };

  const title = cleanTitle(ep.titleJp);
  drawSuperImpactText(title, width / 2, 110, 58);

  const fullCp = ep.coverCatchphraseJp || '';
  if (fullCp) {
    let line1 = fullCp;
    let line2 = '';
    const splitPoint = fullCp.indexOf('、') !== -1 ? fullCp.indexOf('、') + 1 : 
                       fullCp.indexOf(' ') !== -1 ? fullCp.indexOf(' ') : 
                       Math.floor(fullCp.length / 2);
    
    if (splitPoint > 0 && splitPoint < fullCp.length) {
      line1 = fullCp.slice(0, splitPoint).trim();
      line2 = fullCp.slice(splitPoint).trim();
    }

    drawSuperImpactText(line1, width / 2, height - 320, 60, { 
      highlights: ep.highlightWords,
      strokeWidth: 16 
    });

    if (line2) {
      drawSuperImpactText(line2, width / 2, height - 200, 82, { 
        forceColor: '#FFE600',
        strokeWidth: 20 
      });
    }
  }

  return canvas;
}

/**
 * パッケージのダウンロード
 */
export const downloadZip = async (
  ep: Episode, 
  addLog: (msg: string, type?: any) => void, 
  manifest?: SeriesManifest,
  logs?: LogEntry[]
) => {
  addLog(`📦 Ep.${ep.id} パッケージング中...`, 'process');
  try {
    const zip = new JSZip();
    const folder = zip.folder(`Episode_${ep.id}_Package`);
    if (!folder) throw new Error('ZIP creation failed');

    ep.cuts.forEach(c => {
      if (c.imageBase64) folder.file(`cut_${c.id}.png`, c.imageBase64, { base64: true });
      if (c.videoBase64) folder.file(`cut_${c.id}.mp4`, c.videoBase64, { base64: true });
    });
    
    addLog(`📝 SRT字幕ファイルを生成中...`, 'info');
    folder.file('subtitles.srt', generateSRT(ep));

    addLog(`🖼️ YouTube用超ド迫力扉絵を合成中...`, 'info');
    const coverCanvas = await renderCoverCanvas(ep);
    const coverBlob = await (coverCanvas instanceof OffscreenCanvas 
      ? coverCanvas.convertToBlob({ type: 'image/png' }) 
      : new Promise<Blob>(r => (coverCanvas as HTMLCanvasElement).toBlob(b => r(b!), 'image/png')));
    folder.file('cover.png', coverBlob);

    const hasMedia = ep.cuts.some(c => !!c.imageBase64 || !!c.videoBase64);
    if (hasMedia) {
      addLog(`🎞️ 結合動画（扉絵入り）をレンダリング中...`, 'info');
      const movieBlob = await renderFullEpisodeMovie(ep, () => {});
      folder.file('full_movie.mp4', movieBlob);
    }
    
    const scriptJson = {
      id: ep.id,
      titleJp: ep.titleJp,
      titleEn: ep.titleEn,
      summary: ep.summary || '',
      catchphrase: { jp: ep.coverCatchphraseJp, en: ep.coverCatchphraseEn },
      historicalIntelligence: {
        eraAnalysis: ep.eraAnalysis || '',
        forbiddenAnachronisms: ep.forbiddenAnachronisms || []
      },
      cuts: ep.cuts.map(c => ({
        id: c.id,
        narrationJp: c.narrationJp || '',
        narrationEn: c.narrationEn || '',
        prompt: c.promptEn || '',
        shotScale: c.shotScale || 'Wide',
        cameraMotion: c.kenBurnsPreset || 'none'
      }))
    };
    folder.file('script.json', JSON.stringify(scriptJson, null, 2));

    if (manifest) {
      folder.file('series_manifest.json', JSON.stringify(manifest, null, 2));
    }

    const logLines = logs ? logs.map(l => l.message) : [];
    logLines.push(`[${new Date().toLocaleTimeString('ja-JP')}] 📦 パッケージング完了`);
    folder.file('production_logs.txt', logLines.join('\n'));

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    // ダウンロード完了を確実に待機するためPromise化
    await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const now = new Date();
          const pad = (n: number) => String(n).padStart(2, '0');
          const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
          const safeTitle = (ep.titleJp || '無題').replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 25);
          const filename = `${timestamp}_${safeTitle}.zip`;

          await Flow.download({ base64, mimeType: 'application/zip', filename });
          addLog(`✅ パッケージ「${filename}」をダウンロードしました。`, 'success');
          resolve(true);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(zipBlob);
    });
  } catch (err: any) { addLog(`❌ ZIP生成エラー: ${err.message}`, 'error'); }
};

/**
 * series_manifest.json 単体のダウンロード (レジューム用バックアップ)
 */
export const downloadManifestFile = async (manifest: SeriesManifest, addLog: (msg: string, type?: any) => void) => {
  try {
    const jsonStr = JSON.stringify(manifest, null, 2);
    const bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    const filename = `series_manifest_Ep${manifest.currentEpisodeId}.json`;
    await Flow.download({ base64, mimeType: 'application/json', filename });
    addLog(`📄 レジューム用設定ファイル「${filename}」を保存しました。`, 'info');
  } catch (e: any) {
    console.warn('Manifest download failed', e);
  }
};