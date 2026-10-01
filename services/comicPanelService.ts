import { ComicPanelMeta, ComicPanelLayout } from '../types';

/**
 * コミックコマ割りのCSS clip-pathを取得
 */
export function getComicClipPath(meta?: ComicPanelMeta): string {
  if (!meta || meta.layout === 'none' || meta.layout === 'spread-splash') {
    return 'none';
  }

  const { layout, step, totalSteps } = meta;

  // 最終ステップは全体オープン
  if (step >= totalSteps) {
    return 'none';
  }

  switch (layout) {
    case 'vertical-2':
      // 上下2分割: 1コマ目は上半分
      return 'inset(0% 0% 50% 0%)';

    case 'diagonal-2':
      // 斜め2分割: 1コマ目は対角線で上半分（ダイナミックな傾斜）
      return 'polygon(0% 0%, 100% 0%, 100% 45%, 0% 62%)';

    case 'vertical-3':
      // 縦3分割: 1コマ目は上1/3、2コマ目は上2/3
      if (step === 1) return 'inset(0% 0% 66.6% 0%)';
      if (step === 2) return 'inset(0% 0% 33.3% 0%)';
      return 'none';

    case 't-split-3':
      // 上大ゴマ + 下2分割: 1コマ目は上半分、2コマ目は上半分＋下段左
      if (step === 1) return 'inset(0% 0% 50% 0%)';
      if (step === 2) return 'polygon(0% 0%, 100% 0%, 100% 50%, 50% 50%, 50% 100%, 0% 100%)';
      return 'none';

    case 'grid-4':
      // 4分割 (2x2): 左上 -> 上段2つ -> 左下追加 -> 全体完成
      if (step === 1) return 'inset(0% 50% 50% 0%)';
      if (step === 2) return 'inset(0% 0% 50% 0%)';
      if (step === 3) return 'polygon(0% 0%, 100% 0%, 100% 50%, 100% 100%, 50% 100%, 50% 50%, 0% 50%)';
      return 'none';

    default:
      return 'none';
  }
}

/**
 * コミックコマ割りのUIバッジラベルを取得
 */
export function getComicPanelBadge(meta?: ComicPanelMeta): string | null {
  if (!meta || meta.layout === 'none') return null;

  if (meta.layout === 'spread-splash') {
    return '📖 見開き大ゴマ';
  }

  const layoutNames: Record<ComicPanelLayout, string> = {
    'none': '',
    'diagonal-2': '斜め2コマ',
    'vertical-2': '縦2コマ',
    'vertical-3': '縦3コマ',
    't-split-3': '変則3コマ',
    'grid-4': '4コマ展開',
    'spread-splash': '見開き大ゴマ'
  };

  const name = layoutNames[meta.layout] || 'コマ割り';
  const isFinal = meta.step >= meta.totalSteps;
  return isFinal 
    ? `📖 ${name} (完成)` 
    : `📖 ${name} [${meta.step}/${meta.totalSteps}]`;
}

/**
 * Canvas描画時にコマ割りクリッピングパスを適用（動画生成用）
 */
export function applyComicCanvasClip(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  meta?: ComicPanelMeta
): boolean {
  if (!meta || meta.layout === 'none' || meta.layout === 'spread-splash') {
    return false;
  }

  const { layout, step, totalSteps } = meta;
  if (step >= totalSteps) {
    return false;
  }

  ctx.save();
  ctx.beginPath();

  switch (layout) {
    case 'vertical-2':
      ctx.rect(0, 0, width, height * 0.5);
      break;

    case 'diagonal-2':
      ctx.moveTo(0, 0);
      ctx.lineTo(width, 0);
      ctx.lineTo(width, height * 0.45);
      ctx.lineTo(0, height * 0.62);
      ctx.closePath();
      break;

    case 'vertical-3':
      if (step === 1) {
        ctx.rect(0, 0, width, height * 0.334);
      } else if (step === 2) {
        ctx.rect(0, 0, width, height * 0.667);
      }
      break;

    case 't-split-3':
      if (step === 1) {
        ctx.rect(0, 0, width, height * 0.5);
      } else if (step === 2) {
        ctx.moveTo(0, 0);
        ctx.lineTo(width, 0);
        ctx.lineTo(width, height * 0.5);
        ctx.lineTo(width * 0.5, height * 0.5);
        ctx.lineTo(width * 0.5, height);
        ctx.lineTo(0, height);
        ctx.closePath();
      }
      break;

    case 'grid-4':
      if (step === 1) {
        ctx.rect(0, 0, width * 0.5, height * 0.5);
      } else if (step === 2) {
        ctx.rect(0, 0, width, height * 0.5);
      } else if (step === 3) {
        ctx.moveTo(0, 0);
        ctx.lineTo(width, 0);
        ctx.lineTo(width, height);
        ctx.lineTo(width * 0.5, height);
        ctx.lineTo(width * 0.5, height * 0.5);
        ctx.lineTo(0, height * 0.5);
        ctx.closePath();
      }
      break;
  }

  ctx.clip();
  return true;
}
