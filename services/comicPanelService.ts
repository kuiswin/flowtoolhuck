import { ComicPanelMeta, ComicPanelLayout, Cut } from '../types';

export interface PanelSlotDef {
  slotIndex: number; // 1-indexed
  clipPath: string;  // CSS clip-path
  label: string;
}

/**
 * レイアウトごとのスロット定義を取得
 */
export function getLayoutSlots(layout: ComicPanelLayout): PanelSlotDef[] {
  switch (layout) {
    case 'vertical-2':
      return [
        { slotIndex: 1, clipPath: 'inset(0% 0% 50.5% 0%)', label: '上段' },
        { slotIndex: 2, clipPath: 'inset(50.5% 0% 0% 0%)', label: '下段' },
      ];

    case 'diagonal-2':
      return [
        { slotIndex: 1, clipPath: 'polygon(0% 0%, 100% 0%, 100% 44%, 0% 60%)', label: '斜め上' },
        { slotIndex: 2, clipPath: 'polygon(0% 61.5%, 100% 45.5%, 100% 100%, 0% 100%)', label: '斜め下' },
      ];

    case 'vertical-3':
      return [
        { slotIndex: 1, clipPath: 'inset(0% 0% 67% 0%)', label: '上段' },
        { slotIndex: 2, clipPath: 'inset(33.8% 0% 33.8% 0%)', label: '中段' },
        { slotIndex: 3, clipPath: 'inset(67% 0% 0% 0%)', label: '下段' },
      ];

    case 't-split-3':
      return [
        { slotIndex: 1, clipPath: 'inset(0% 0% 50.5% 0%)', label: '上大ゴマ' },
        { slotIndex: 2, clipPath: 'polygon(0% 51%, 49.5% 51%, 49.5% 100%, 0% 100%)', label: '左下' },
        { slotIndex: 3, clipPath: 'polygon(50.5% 51%, 100% 51%, 100% 100%, 50.5% 100%)', label: '右下' },
      ];

    case 'grid-4':
      return [
        { slotIndex: 1, clipPath: 'polygon(0% 0%, 49.5% 0%, 49.5% 49.5%, 0% 49.5%)', label: '左上' },
        { slotIndex: 2, clipPath: 'polygon(50.5% 0%, 100% 0%, 100% 49.5%, 50.5% 49.5%)', label: '右上' },
        { slotIndex: 3, clipPath: 'polygon(0% 50.5%, 49.5% 50.5%, 49.5% 100%, 0% 100%)', label: '左下' },
        { slotIndex: 4, clipPath: 'polygon(50.5% 50.5%, 100% 50.5%, 100% 100%, 50.5% 100%)', label: '右下' },
      ];

    case 'spread-splash':
    default:
      return [
        { slotIndex: 1, clipPath: 'none', label: '全画面' },
      ];
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
 * 指定カットのコマ割り画面を構成する各スロットの画像・情報を取得
 */
export function getComicCompositeSlots(
  currentCut: Cut,
  allCuts: Cut[]
): Array<{ slotIndex: number; clipPath: string; label: string; imageSrc?: string; isNew: boolean }> {
  if (!currentCut.comicPanel || currentCut.comicPanel.layout === 'none' || currentCut.comicPanel.layout === 'spread-splash') {
    return [{
      slotIndex: 1,
      clipPath: 'none',
      label: 'メイン',
      imageSrc: currentCut.imageBase64 ? `data:image/png;base64,${currentCut.imageBase64}` : undefined,
      isNew: true
    }];
  }

  const { layout, step, totalSteps, parentCutId } = currentCut.comicPanel;
  const slots = getLayoutSlots(layout);

  return slots.map(slot => {
    // このスロットに対応するカットのID
    const targetCutId = parentCutId + (slot.slotIndex - 1);
    const targetCut = allCuts.find(c => c.id === targetCutId);

    // 現在のステップ（何コマ目か）以前のスロットのみ画像を表示
    const isRevealed = slot.slotIndex <= step;
    const isNew = slot.slotIndex === step;

    let imageSrc: string | undefined = undefined;
    if (isRevealed && targetCut?.imageBase64) {
      imageSrc = `data:image/png;base64,${targetCut.imageBase64}`;
    }

    return {
      slotIndex: slot.slotIndex,
      clipPath: slot.clipPath,
      label: slot.label,
      imageSrc,
      isNew
    };
  });
}

/**
 * Canvas描画時にマルチシーンコマ割り合成を描画（動画生成用）
 */
export function drawComicCompositeOnCanvas(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  currentCut: Cut,
  allCuts: Cut[],
  imagesMap: Map<number, HTMLImageElement>
) {
  if (!currentCut.comicPanel || currentCut.comicPanel.layout === 'none' || currentCut.comicPanel.layout === 'spread-splash') {
    const img = imagesMap.get(currentCut.id);
    if (img) ctx.drawImage(img, 0, 0, width, height);
    return;
  }

  const { layout, step, totalSteps, parentCutId } = currentCut.comicPanel;
  const slots = getLayoutSlots(layout);

  // 背景を黒でクリア
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, width, height);

  for (const slot of slots) {
    const targetCutId = parentCutId + (slot.slotIndex - 1);
    const isRevealed = slot.slotIndex <= step;
    const img = imagesMap.get(targetCutId);

    if (isRevealed && img) {
      ctx.save();
      ctx.beginPath();
      applyCanvasSlotClip(ctx, width, height, layout, slot.slotIndex);
      ctx.clip();
      ctx.drawImage(img, 0, 0, width, height);
      ctx.restore();
    } else {
      // 未開放スロットの黒背景枠
      ctx.save();
      ctx.beginPath();
      applyCanvasSlotClip(ctx, width, height, layout, slot.slotIndex);
      ctx.clip();
      ctx.fillStyle = '#121212';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  // コマ間の黒い仕切りボーダーを描画
  drawComicGutters(ctx, width, height, layout);
}

function applyCanvasSlotClip(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  layout: ComicPanelLayout,
  slotIndex: number
) {
  switch (layout) {
    case 'vertical-2':
      if (slotIndex === 1) ctx.rect(0, 0, width, height * 0.5);
      else ctx.rect(0, height * 0.5, width, height * 0.5);
      break;

    case 'diagonal-2':
      if (slotIndex === 1) {
        ctx.moveTo(0, 0);
        ctx.lineTo(width, 0);
        ctx.lineTo(width, height * 0.44);
        ctx.lineTo(0, height * 0.60);
        ctx.closePath();
      } else {
        ctx.moveTo(0, height * 0.615);
        ctx.lineTo(width, height * 0.455);
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
      }
      break;

    case 'vertical-3':
      if (slotIndex === 1) ctx.rect(0, 0, width, height * 0.33);
      else if (slotIndex === 2) ctx.rect(0, height * 0.335, width, height * 0.33);
      else ctx.rect(0, height * 0.67, width, height * 0.33);
      break;

    case 't-split-3':
      if (slotIndex === 1) {
        ctx.rect(0, 0, width, height * 0.5);
      } else if (slotIndex === 2) {
        ctx.rect(0, height * 0.51, width * 0.495, height * 0.49);
      } else {
        ctx.rect(width * 0.505, height * 0.51, width * 0.495, height * 0.49);
      }
      break;

    case 'grid-4':
      if (slotIndex === 1) ctx.rect(0, 0, width * 0.495, height * 0.495);
      else if (slotIndex === 2) ctx.rect(width * 0.505, 0, width * 0.495, height * 0.495);
      else if (slotIndex === 3) ctx.rect(0, height * 0.505, width * 0.495, height * 0.495);
      else ctx.rect(width * 0.505, height * 0.505, width * 0.495, height * 0.495);
      break;

    default:
      ctx.rect(0, 0, width, height);
      break;
  }
}

function drawComicGutters(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  width: number,
  height: number,
  layout: ComicPanelLayout
) {
  ctx.save();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;

  if (layout === 'vertical-2') {
    ctx.beginPath();
    ctx.moveTo(0, height * 0.5);
    ctx.lineTo(width, height * 0.5);
    ctx.stroke();
  } else if (layout === 'diagonal-2') {
    ctx.beginPath();
    ctx.moveTo(0, height * 0.607);
    ctx.lineTo(width, height * 0.447);
    ctx.stroke();
  } else if (layout === 'vertical-3') {
    ctx.beginPath();
    ctx.moveTo(0, height * 0.332);
    ctx.lineTo(width, height * 0.332);
    ctx.moveTo(0, height * 0.667);
    ctx.lineTo(width, height * 0.667);
    ctx.stroke();
  } else if (layout === 't-split-3') {
    ctx.beginPath();
    ctx.moveTo(0, height * 0.505);
    ctx.lineTo(width, height * 0.505);
    ctx.moveTo(width * 0.5, height * 0.505);
    ctx.lineTo(width * 0.5, height);
    ctx.stroke();
  } else if (layout === 'grid-4') {
    ctx.beginPath();
    ctx.moveTo(0, height * 0.5);
    ctx.lineTo(width, height * 0.5);
    ctx.moveTo(width * 0.5, 0);
    ctx.lineTo(width * 0.5, height);
    ctx.stroke();
  }

  ctx.restore();
}
