import { Flow } from 'flow-sdk';
import JSZip from 'jszip';
import { Episode, SeriesManifest } from '../types';
import { LogEntry } from '../components/StudioLogs';
import { renderFullEpisodeMovie } from './browserVideoService';
import { extractHighlights } from './directorService';

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
  logs?: LogEntry[],
  onReady?: (info: { filename: string; blobUrl: string; sizeStr: string }) => void
): Promise<{ filename: string; blobUrl: string; sizeStr: string } | null> => {
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
    
    // ※向こう（CT192）側で音声実尺に合わせて高画質結合・焼き直しを行うため、
    // 未結合の各カット素材（cut_*.png / cut_*.mp4）と script.json のみを同梱し、不要な結合動画は完全カットして爆速化
    
    const scriptJson = {
      id: ep.id,
      productionMode: ep.productionMode || (ep.isMvMode ? 'mv' : 'episodes'),
      titleJp: ep.titleJp,
      titleEn: ep.titleEn,
      summary: ep.summary || '',
      theme: ep.theme || '',
      taste: ep.taste || '',
      catchphrase: { jp: ep.coverCatchphraseJp, en: ep.coverCatchphraseEn },
      historicalIntelligence: {
        eraAnalysis: ep.eraAnalysis || '',
        forbiddenAnachronisms: ep.forbiddenAnachronisms || []
      },
      cuts: ep.cuts.map(c => {
        const narration = c.narrationJp || '';
        const hl = (c.telop?.highlights && c.telop.highlights.length > 0)
          ? c.telop.highlights
          : extractHighlights(narration);
        const hlWords = hl.map(h => h.word);

        return {
          id: c.id,
          dialogue: narration,
          narrationJp: narration,
          narrationEn: c.narrationEn || '',
          prompt: c.promptEn || '',
          shotScale: c.shotScale || 'Wide',
          cameraWork: c.cameraWork || 'static',
          cameraMotion: c.cameraMotion || '',
          kenBurnsPreset: c.kenBurnsPreset || 'none',
          telop: {
            fullText: c.telop?.fullText || narration,
            highlightKeywords: hlWords,
            highlights: hl,
            style: c.telop?.style || 'cinema-subtle',
            transition: c.telop?.transition || 'aos-fade-soft',
            position: c.telop?.position || 'bottom-center',
            directorNote: c.telop?.directorNote || ''
          }
        };
      })
    };
    folder.file('script.json', JSON.stringify(scriptJson, null, 2));

    if (manifest) {
      folder.file('series_manifest.json', JSON.stringify(manifest, null, 2));
    }

    const logLines = logs ? logs.map(l => l.message) : [];
    logLines.push(`[${new Date().toLocaleTimeString('ja-JP')}] 📦 パッケージング完了`);
    folder.file('production_logs.txt', logLines.join('\n'));

    addLog(`📦 ZIPアーカイブを圧縮中...`, 'process');
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const safeTitle = (ep.titleJp || '無題').replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 25);
    const filename = `${timestamp}_${safeTitle}.zip`;
    const sizeMb = (zipBlob.size / (1024 * 1024)).toFixed(1);
    const sizeStr = `${sizeMb} MB`;

    const blobUrl = URL.createObjectURL(zipBlob);

    // 1. Google Flow Tools 公式 Flow.download を最優先実行（大容量ZIPも対応・一時エラー自動リトライ）
    let flowSuccess = false;
    if (typeof Flow !== 'undefined' && typeof Flow.download === 'function') {
      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(zipBlob);
          });

          await Flow.download({ base64, mimeType: 'application/zip', filename });
          addLog(`✅ パッケージ「${filename}」(${sizeStr}) をダウンロードしました。`, 'success');
          flowSuccess = true;
          break;
        } catch (flowErr: any) {
          console.warn(`Flow.download attempt ${attempt} failed:`, flowErr);
          if (attempt < maxRetries) {
            addLog(`⏳ Flow API が一時ビジーです。1.5秒後に自動再試行します (${attempt}/${maxRetries})...`, 'process');
            await new Promise(r => setTimeout(r, 1500));
          } else {
            addLog(`⚠️ Flow API が応答しないため、ブラウザ直接保存リンクを準備しました: ${flowErr.message}`, 'warning');
          }
        }
      }
    }

    // 2. Flow 環境外（ローカルViteなど）または Flow.download が3回失敗した場合のブラウザ直接ダウンロード試行
    if (!flowSuccess) {
      try {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (e) {
        console.warn('DOM download attempt ignored by browser sandbox:', e);
      }
    }

    const result = { filename, blobUrl, sizeStr, flowSuccess };
    // 画面上の保存バナー・モーダル通知（Flow.downloadが失敗した時の救済、または再保存用）
    if (onReady) {
      onReady(result);
    }
    return result;
  } catch (err: any) { 
    addLog(`❌ ZIP生成エラー: ${err.message}`, 'error'); 
    return null;
  }
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