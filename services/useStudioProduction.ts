import { useState, useRef, useEffect, useCallback } from 'react';
import { Flow } from 'flow-sdk';
import { Episode, Cut, GeneratorSettings, VideoModelType, GenerationTask, SeriesManifest, ComicPanelLayout } from '../types';
import { IMAGE_MODELS, VIDEO_MODELS, DEFAULT_ASPECT_RATIO, CUTS_PER_EPISODE, TASTES } from '../constants';
import { safeJsonParse, callWithRetry, formatErrorMessage, createDefaultCut } from './utils';
import { saveStory, getAllReferenceAssets, saveReferenceAsset } from './db';
import { downloadZip } from './exportService';
import { 
  directShot, 
  buildImagePromptAndNegative, 
  buildCharacterScreeningPrompt, 
  buildGrandDesignPrompt, 
  buildScriptPrompt,
  extractHighlights
} from './directorService';
import { LogEntry } from '../components/StudioLogs';

interface UseStudioProductionProps {
  settings: GeneratorSettings;
  logs: LogEntry[];
  addLog: (message: string, type?: LogEntry['type']) => void;
  refreshStories: () => Promise<void>;
}

export function useStudioProduction({ settings, logs, addLog, refreshStories }: UseStudioProductionProps) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [isProducing, setIsProducing] = useState(false);
  const isAbortedRef = useRef(false);
  const queueRef = useRef<GenerationTask[]>([]);
  const episodesRef = useRef<Episode[]>([]);

  const logsRef = useRef(logs);
  logsRef.current = logs;

  const seriesManifestRef = useRef<SeriesManifest | null>(null);
  const currentAssetRef = useRef<{ name: string; base64: string; mimeType: string } | null>(null);

  const activeReferenceRef = useRef<{
    mediaId: string;
    characterDna: string;
    styleDna: string;
    antiPoseNegative: string;
    eraNegative: string;
  } | null>(null);

  useEffect(() => {
    episodesRef.current = episodes;
  }, [episodes]);

  const updateCut = useCallback((epId: number, cutId: number, updates: Partial<Cut>) => {
    setEpisodes(prev => prev.map(ep =>
      ep.id === epId
        ? { ...ep, cuts: ep.cuts.map(c => c.id === cutId ? { ...c, ...updates } : c) }
        : ep
    ));
  }, []);

  const updateEpisode = useCallback((epId: number, updates: Partial<Episode>) => {
    setEpisodes(prev => prev.map(ep => ep.id === epId ? { ...ep, ...updates } : ep));
  }, []);

  const abortProduction = useCallback(() => {
    isAbortedRef.current = true;
    queueRef.current = [];
    setIsProducing(false);
    addLog('🛑 制作プロセスを中断しました。', 'warning');
  }, [addLog]);

  const resumeSeries = useCallback(async (manifest: SeriesManifest, onAssetRestored?: (assetId: number) => void) => {
    seriesManifestRef.current = manifest;
    addLog(`📂 シリーズ「${manifest.seriesTitle}」の設計図を読込（全${manifest.totalEpisodes}話中 ${manifest.completedEpisodeIds?.length || 0}話完了済み）。`, 'process');
    
    const resumedEpisodes: Episode[] = manifest.episodesPlan.map(p => {
      const isDone = manifest.completedEpisodeIds.includes(p.epNumber);
      return {
        id: p.epNumber,
        internalId: crypto.randomUUID(),
        titleJp: p.titleJp,
        titleEn: p.titleEn,
        summary: p.summary,
        cuts: Array.from({ length: CUTS_PER_EPISODE }, (_, j) => createDefaultCut(j + 1, isDone ? '制作完了' : '待機中...', '', false)),
        isGenerating: false,
        isGeneratingRemainingImages: false,
        isBatchGeneratingVideos: false,
        isPreviewDone: isDone,
        isDone: isDone,
        taste: manifest.settings?.taste,
        era: manifest.settings?.era,
        theme: manifest.settings?.theme
      };
    });
    setEpisodes(resumedEpisodes);

    if (manifest.referenceAsset && manifest.referenceAsset.base64) {
      try {
        const assets = await getAllReferenceAssets();
        let matched = assets.find(a => a.name === manifest.referenceAsset!.name && a.base64.slice(0, 50) === manifest.referenceAsset!.base64.slice(0, 50));
        let assetId = matched?.id;
        if (!assetId) {
          assetId = await saveReferenceAsset({
            name: manifest.referenceAsset.name || 'Restored_Character',
            base64: manifest.referenceAsset.base64,
            mimeType: manifest.referenceAsset.mimeType || 'image/png',
            createdAt: new Date().toISOString()
          });
          addLog(`✨ キャラクター画像を保管庫(Vault)に自動復元しました。`, 'success');
        }

        currentAssetRef.current = {
          name: manifest.referenceAsset.name || 'Character',
          base64: manifest.referenceAsset.base64,
          mimeType: manifest.referenceAsset.mimeType || 'image/png'
        };

        if (manifest.referenceAsset.characterDna) {
          const uploadRes = await Flow.upload({
            base64: manifest.referenceAsset.base64,
            mimeType: (manifest.referenceAsset.mimeType || 'image/png') as any,
            name: `Ref: ${manifest.referenceAsset.name || 'Character'}`
          });
          activeReferenceRef.current = {
            mediaId: uploadRes.mediaId,
            characterDna: manifest.referenceAsset.characterDna,
            styleDna: manifest.referenceAsset.styleDna || '',
            antiPoseNegative: manifest.referenceAsset.antiPoseNegative || '',
            eraNegative: manifest.referenceAsset.eraNegative || ''
          };
          addLog(`✨ キャラクターDNAと画風DNAを完全復元しました。`, 'success');
        }

        if (assetId && onAssetRestored) onAssetRestored(assetId);
      } catch (err: any) {
        addLog(`⚠️ 画像・DNAの復元スキップ: ${err.message}`, 'warning');
      }
    }

    const nextEpNumber = (manifest.completedEpisodeIds && manifest.completedEpisodeIds.length > 0)
      ? Math.max(...manifest.completedEpisodeIds) + 1
      : 1;
    addLog(`🚀 第 ${nextEpNumber} 話から自動再開できます。「生成開始」を押してください。`, 'info');
  }, [addLog]);

  const handleGenerateRemaining = async (epId: number) => {
    const ep = episodesRef.current.find(e => e.id === epId);
    if (!ep) return;
    const remainingCuts = ep.cuts.filter(c => !c.imageBase64);
    if (remainingCuts.length === 0) {
      addLog(`Ep.${epId}: すべての画像が生成済みです。`, 'info');
      return;
    }
    updateEpisode(epId, { isGeneratingRemainingImages: true });
    addLog(`🎨 Ep.${epId}: 残り ${remainingCuts.length} 枚の画像生成を開始...`, 'process');
    const tasks: GenerationTask[] = remainingCuts.map(c => ({
      epId, cutId: c.id, prompt: c.promptEn, styleKey: settings.taste, imageModel: settings.imageModel, storyContext: ep.summary || '', eraAnalysis: ep.eraAnalysis, forbiddenAnachronisms: ep.forbiddenAnachronisms, authenticAttireEn: ep.authenticAttireEn, forbiddenKeywordsEn: ep.forbiddenKeywordsEn
    }));
    await runTasks(tasks);
    updateEpisode(epId, { isGeneratingRemainingImages: false });
    addLog(`✅ Ep.${epId}: すべての画像生成が完了しました。`, 'success');
    if (settings.autoVideo && !isAbortedRef.current) {
      handleBulkBrowserVideo(epId);
    }
  };

  const handleExportFullMovie = async (epId: number) => {
    const ep = episodesRef.current.find(e => e.id === epId);
    if (!ep) return;
    addLog(`🎬 Ep.${epId}: 映像結合を開始...`, 'process');
    updateEpisode(epId, { isExportingMovie: true });
    try {
      const movieBlob = await renderFullEpisodeMovie(ep, (idx, total) => {
        addLog(`🎞️ 映像レンダリング中... ${idx}/${total}`, 'info');
      });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        updateEpisode(epId, { fullMovieBase64: base64 });
        await Flow.download({ base64, mimeType: 'video/mp4', filename: `Episode_${epId}_Export.mp4` });
        addLog(`✅ Ep.${epId}: 動画の出力に成功しました。`, 'success');
      };
      reader.readAsDataURL(movieBlob);
    } catch (err) {
      addLog(`❌ レンダリング失敗: ${formatErrorMessage(err)}`, 'error');
    } finally {
      updateEpisode(epId, { isExportingMovie: false });
    }
  };

  const runTasks = async (tasks: GenerationTask[]) => {
    queueRef.current = [...tasks];
    const concurrency = Math.max(1, settings.parallelCount || 2);
    let lastAssignedScale = '';
    const workers = Array(concurrency).fill(null).map(async () => {
      while (queueRef.current.length > 0) {
        if (isAbortedRef.current) break;
        const task = queueRef.current.shift();
        if (!task) break;
        const cCut = episodesRef.current.find(e => e.id === task.epId)?.cuts.find(c => c.id === task.cutId);
        const taskWithComic = { ...task, comicPanel: cCut?.comicPanel };
        updateCut(task.epId, task.cutId, { isDirecting: true });
        addLog(`🎬 Ep.${task.epId} C${task.cutId.toString().padStart(2, '0')}: 構図演出・プロンプト最適化中...`, 'info');
        const directedUpdates = await directShot(taskWithComic, settings, activeReferenceRef.current, lastAssignedScale, addLog);
        if (directedUpdates.shotScale) lastAssignedScale = directedUpdates.shotScale;
        updateCut(task.epId, task.cutId, directedUpdates);
        await generateImage({ ...taskWithComic, prompt: directedUpdates.promptEn || task.prompt });
      }
    });
    await Promise.all(workers);
  };

  const generateImage = async (task: GenerationTask) => {
    if (isAbortedRef.current) return;
    const { epId, cutId } = task;
    updateCut(epId, cutId, { isGeneratingImage: true });

    const currentEp = episodesRef.current.find(e => e.id === epId);
    const currentCut = currentEp?.cuts.find(c => c.id === cutId);

    if (currentCut?.comicPanel && currentCut.comicPanel.layout !== 'none') {
      addLog(`🎨 Ep.${epId} C${cutId.toString().padStart(2, '0')}: 漫画コマ [${currentCut.comicPanel.step}/${currentCut.comicPanel.totalSteps}] の個別シーンを作画中 [${settings.imageModel}]...`, 'process');
    } else {
      addLog(`🎨 Ep.${epId} C${cutId.toString().padStart(2, '0')}: 画像生成中 [${settings.imageModel}]...`, 'process');
    }

    try {
      const modelInfo = IMAGE_MODELS.find(m => m.label === settings.imageModel) || IMAGE_MODELS[1];
      const { finalPrompt, finalNegative, referenceImageMediaIds } = buildImagePromptAndNegative(task, settings, activeReferenceRef.current);
      
      const res = await callWithRetry(
        () => Flow.generate.image({ prompt: finalPrompt, negativePrompt: finalNegative, modelDisplayName: modelInfo.name, aspectRatio: DEFAULT_ASPECT_RATIO as any, referenceImageMediaIds }),
        (attempt, max, delay) => addLog(`Retrying Image (attempt ${attempt}/${max}) after ${delay} ms...`, 'warning'),
        5, 90000
      );
      updateCut(epId, cutId, { imageMediaId: res.mediaId, imageBase64: res.base64, isGeneratingImage: false });
      addLog(`✨ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 画像生成完了`, 'success');
    } catch (err) {
      updateCut(epId, cutId, { isGeneratingImage: false, error: '生成失敗' });
      addLog(`❌ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 画像失敗 - ${formatErrorMessage(err)}`, 'error');
    }
  };

  const generateVideo = async (epId: number, cutId: number, modelType: VideoModelType) => {
    const cut = episodesRef.current.find(e => e.id === epId)?.cuts.find(c => c.id === cutId);
    if (!cut?.imageMediaId) {
      addLog(`⚠️ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 画像がないため動画生成をスキップ`, 'warning');
      return;
    }
    const modelInfo = VIDEO_MODELS.find(m => m.id === modelType) || VIDEO_MODELS[0];
    updateCut(epId, cutId, { isGeneratingVideo: true, videoModelUsed: modelInfo.name });
    addLog(`🎥 Ep.${epId} C${cutId.toString().padStart(2, '0')}: 動画生成開始 (${modelInfo.name})`, 'info');

    try {
      const res = await callWithRetry(
        () => Flow.generate.video({ prompt: cut.promptEn, firstFrameImageMediaId: cut.imageMediaId, modelDisplayName: modelInfo.name, durationSeconds: modelInfo.defaultDuration, aspectRatio: DEFAULT_ASPECT_RATIO as any }),
        (attempt, max, delay) => addLog(`Retrying Video (attempt ${attempt}/${max}) after ${delay} ms...`, 'warning'),
        5, 180000, '動画生成'
      );
      updateCut(epId, cutId, { videoBase64: res.base64, videoMediaId: res.mediaId, isGeneratingVideo: false, videoDuration: modelInfo.defaultDuration });
      addLog(`🎬 Ep.${epId} C${cutId.toString().padStart(2, '0')}: 動画生成完了 (${modelInfo.defaultDuration}s)`, 'success');
    } catch (err) {
      updateCut(epId, cutId, { isGeneratingVideo: false, error: '動画失敗' });
      addLog(`❌ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 動画失敗 - ${formatErrorMessage(err)}`, 'error');
    }
  };

  const generateBrowserVideo = async (epId: number, cutId: number) => {
    const cut = episodesRef.current.find(e => e.id === epId)?.cuts.find(c => c.id === cutId);
    if (!cut?.imageBase64) return;
    updateCut(epId, cutId, { isGeneratingVideo: true, videoModelUsed: 'Browser (0pt)' });
    try {
      const base64 = await renderKenBurnsVideo(cut, 4);
      updateCut(epId, cutId, { videoBase64: base64, isGeneratingVideo: false, videoDuration: 4 });
      addLog(`🎬 Ep.${epId} C${cutId.toString().padStart(2, '0')}: ブラウザ動画化完了`, 'success');
    } catch (err) { updateCut(epId, cutId, { isGeneratingVideo: false, error: '失敗' }); }
  };

  const handleBulkVideo = async (epId: number) => {
    const ep = episodesRef.current.find(e => e.id === epId);
    if (!ep) return;
    setIsProducing(true);
    updateEpisode(epId, { isBatchGeneratingVideos: true });
    for (const cut of ep.cuts) {
      if (cut.isSelectedForVideo && !cut.videoMediaId) await generateVideo(epId, cut.id, 'veo-lite');
    }
    updateEpisode(epId, { isBatchGeneratingVideos: false });
    setIsProducing(false);
  };

  const handleBulkBrowserVideo = async (epId: number) => {
    const ep = episodesRef.current.find(e => e.id === epId);
    if (!ep) return;
    const targets = ep.cuts.filter(c => !c.videoBase64);
    setIsProducing(true);
    updateEpisode(epId, { isBatchGeneratingVideos: true });
    for (const cut of targets) await generateBrowserVideo(epId, cut.id);
    updateEpisode(epId, { isBatchGeneratingVideos: false });
    setIsProducing(false);
  };

  const startProduction = async () => {
    if (isProducing) return;
    setIsProducing(true);
    isAbortedRef.current = false;

    if (settings.selectedAssetId && !activeReferenceRef.current) {
      try {
        const assets = await getAllReferenceAssets();
        const asset = assets.find(a => a.id === settings.selectedAssetId);
        if (asset) {
          currentAssetRef.current = { name: asset.name, base64: asset.base64, mimeType: asset.mimeType };
          addLog('🔍 キャラクターDNA抽出中...', 'process');
          const uploadRes = await Flow.upload({ base64: asset.base64, mimeType: asset.mimeType as any, name: `Ref: ${asset.name}` });
          const screeningPrompt = buildCharacterScreeningPrompt(settings.era, settings.country);
          const screenRes = await callWithRetry(
            () => Flow.generate.text(screeningPrompt, { images: [{ base64: asset.base64, mimeType: asset.mimeType }] }),
            (attempt, max, delay) => addLog(`Retrying DNA Analysis (attempt ${attempt}/${max}) after ${delay} ms...`, 'warning'),
            5
          );
          const screening = safeJsonParse(screenRes.text, { characterDna: '', styleDna: '', antiPoseNegative: '', eraNegative: '' });
          activeReferenceRef.current = {
            mediaId: uploadRes.mediaId,
            characterDna: screening.characterDna,
            styleDna: screening.styleDna,
            antiPoseNegative: screening.antiPoseNegative,
            eraNegative: screening.eraNegative
          };
          addLog('✨ DNA確立完了。', 'success');
        }
      } catch (err) { addLog('⚠️ DNA解析失敗。', 'warning'); }
    }

    try {
      if (settings.productionMode === 'style-matrix') {
        const allTasteKeys = Object.keys(TASTES);
        const targetTastes = allTasteKeys.slice(0, settings.episodeCount);
        addLog(`🎨 【画風比較モード】同じ物語で ${targetTastes.length} 種類の画風を同時生成・比較します！`, 'process');

        // 既存エピソードが存在するか確認（画面上にあるエピソードの脚本を最優先で100%流用）
        const existingEp = episodesRef.current.find(e => e.cuts && e.cuts.some(c => c.narrationJp || c.promptEn));
        
        let sharedScript: any = null;
        let baseCutsData: any[] = [];

        const ratio = settings.videoRatio;
        const getIsSelected = (idx: number) => {
          if (ratio === 'none') return false;
          if (ratio === '30%') return [0, 4, 8, 11].includes(idx);
          if (ratio === '50%') return [0, 2, 4, 6, 8, 10].includes(idx);
          if (ratio === '100%') return true;
          return false;
        };

        if (existingEp) {
          // 既存エピソードから【画風名】等のプレフィックスを取り除いた純粋なタイトルを取得
          const cleanTitleJp = existingEp.titleJp.replace(/^【.*?】\s*/, '');
          addLog(`📖 画面上のエピソード『${cleanTitleJp}』の脚本（全${existingEp.cuts.length}カット）をそのまま各画風へ展開します！`, 'success');

          sharedScript = {
            titleJp: cleanTitleJp,
            titleEn: existingEp.titleEn || 'The Story',
            summary: existingEp.summary || '',
            eraAnalysisJp: existingEp.eraAnalysis || '',
            forbiddenAnachronisms: existingEp.forbiddenAnachronisms || [],
            authenticAttireEn: existingEp.authenticAttireEn || '',
            forbiddenKeywordsEn: existingEp.forbiddenKeywordsEn || '',
            coverCatchphraseJp: existingEp.coverCatchphraseJp || '',
            coverCatchphraseEn: existingEp.coverCatchphraseEn || '',
            highlightWords: existingEp.highlightWords || []
          };

          baseCutsData = existingEp.cuts.map((c, j) => ({
            id: c.id,
            narration: c.narrationJp,
            plot: c.promptEn || c.scenePlot || '',
            isSelected: c.isSelectedForVideo ?? getIsSelected(j),
            highlights: c.telop?.highlights || extractHighlights(c.narrationJp, existingEp.highlightWords || [])
          }));
        } else {
          // 画面にエピソードがない場合は、選択中のテーマに沿った本格脚本を新規策定
          addLog(`📖 テーマ『${settings.theme}』に合わせた比較用脚本（12カット）をAIに執筆依頼中...`, 'process');
          
          const planPrompt = `Create a compelling episode 1 title and synopsis based on:
Country: ${settings.country}
Theme: ${settings.theme}
Era: ${settings.era}
Output JSON ONLY:
{
  "titleJp": "Japanese Episode Title",
  "titleEn": "English Episode Title",
  "summary": "Short 2-line summary"
}`;
          const planRes = await callWithRetry(
            () => Flow.generate.text(planPrompt),
            undefined, 4
          );
          const generatedPlan = safeJsonParse(planRes.text, {
            titleJp: settings.theme.split('（')[0].replace(/^[^\w\s\u4e00-\u9faf]+/, '').trim() || '運命の物語',
            titleEn: 'The Tale of Destiny',
            summary: `${settings.theme}の世界観で描かれるドラマ`
          });

          const scriptPrompt = buildScriptPrompt(1, generatedPlan as any, settings.country, settings.theme, settings.era, settings.isMangaMode);
          const scriptRes = await callWithRetry(
            () => Flow.generate.text(scriptPrompt),
            (attempt, max, delay) => addLog(`Retrying Script Plot (attempt ${attempt}/${max}) after ${delay} ms...`, 'warning'),
            5
          );
          const parsed = safeJsonParse(scriptRes.text, { titleJp: generatedPlan.titleJp, titleEn: generatedPlan.titleEn, cuts: [] });
          sharedScript = {
            ...parsed,
            titleJp: parsed.titleJp || generatedPlan.titleJp,
            titleEn: parsed.titleEn || generatedPlan.titleEn
          };
          addLog(`✨ テーマに即した共通脚本が完成！『${sharedScript.titleJp}』（全${targetTastes.length}画風へ展開開始）`, 'success');

          const rawCuts = Array.isArray(sharedScript.cuts) ? sharedScript.cuts : (Array.isArray(sharedScript.scenes) ? sharedScript.scenes : []);
          baseCutsData = Array.from({ length: CUTS_PER_EPISODE }, (_, j) => {
            const cutData = rawCuts[j] || {};
            const narration = cutData.narrationJp || cutData.narration || '';
            const plot = cutData.basicPlot || cutData.promptEn || cutData.prompt || '';
            const cutHighlights = cutData.highlights || sharedScript.highlightWords || [];
            const comicLayout = (cutData.comicPanelLayout || 'none') as ComicPanelLayout;
            const comicStep = Number(cutData.comicStep) || 1;
            const comicTotalSteps = Number(cutData.comicTotalSteps) || 1;
            const comicParentCutId = Number(cutData.comicParentCutId) || (j + 1);

            return {
              id: j + 1,
              narration,
              plot,
              isSelected: getIsSelected(j),
              highlights: extractHighlights(narration, cutHighlights),
              comicPanel: settings.isMangaMode && comicLayout !== 'none' ? {
                layout: comicLayout,
                step: comicStep,
                totalSteps: comicTotalSteps,
                parentCutId: comicParentCutId
              } : undefined
            };
          });
        }

        // 各画風のエピソードカードを並列展開
        const matrixEpisodes: Episode[] = targetTastes.map((tasteKey, idx) => {
          const epId = idx + 1;
          const shortTaste = tasteKey.split(' (')[0].trim();
          return {
            id: epId,
            internalId: crypto.randomUUID(),
            titleJp: `【${shortTaste}】${sharedScript.titleJp}`,
            titleEn: sharedScript.titleEn,
            summary: sharedScript.summary,
            eraAnalysis: sharedScript.eraAnalysisJp,
            forbiddenAnachronisms: sharedScript.forbiddenAnachronisms,
            authenticAttireEn: sharedScript.authenticAttireEn,
            forbiddenKeywordsEn: sharedScript.forbiddenKeywordsEn,
            coverCatchphraseJp: sharedScript.coverCatchphraseJp,
            coverCatchphraseEn: sharedScript.coverCatchphraseEn,
            highlightWords: sharedScript.highlightWords || [],
            cuts: baseCutsData.map(c => {
              const cut = createDefaultCut(c.id, c.narration, c.plot, c.isSelected);
              cut.telop.highlights = c.highlights;
              if (c.comicPanel) cut.comicPanel = c.comicPanel;
              return cut;
            }),
            isGenerating: true,
            isGeneratingRemainingImages: false,
            isBatchGeneratingVideos: false,
            isPreviewDone: false,
            isDone: false,
            taste: tasteKey,
            era: existingEp?.era || settings.era,
            theme: existingEp?.theme || settings.theme
          };
        });
        setEpisodes(matrixEpisodes);

        // 各画風ごとにカットを描画
        for (let idx = 0; idx < targetTastes.length; idx++) {
          if (isAbortedRef.current) break;
          const epId = idx + 1;
          const tasteKey = targetTastes[idx];
          const shortTaste = tasteKey.split(' (')[0].trim();

          addLog(`🎨 [${idx + 1}/${targetTastes.length}] 画風「${shortTaste}」の描画タスクを開始...（先行${settings.previewCutCount}カット）`, 'process');
          const currentEp = matrixEpisodes[idx];
          const tasks: GenerationTask[] = currentEp.cuts.slice(0, settings.previewCutCount).map(c => ({
            epId,
            cutId: c.id,
            prompt: c.promptEn,
            styleKey: tasteKey,
            imageModel: settings.imageModel,
            storyContext: sharedScript.summary || '',
            eraAnalysis: sharedScript.eraAnalysisJp,
            forbiddenAnachronisms: sharedScript.forbiddenAnachronisms,
            authenticAttireEn: sharedScript.authenticAttireEn,
            forbiddenKeywordsEn: sharedScript.forbiddenKeywordsEn
          }));

          await runTasks(tasks);
          updateEpisode(epId, { isGenerating: false, isPreviewDone: true, isDone: true });
          addLog(`✅ 画風「${shortTaste}」の生成が完了しました！`, 'success');
        }

        addLog(`🎉 全 ${targetTastes.length} 種類の画風比較マトリクスの制作が完了しました！見比べて最適な画風をお選びください！`, 'success');
        return;
      }

      if (!seriesManifestRef.current) {
        addLog(`📜 全${settings.episodeCount}話の大河ドラマグランドデザインをAIに策定依頼中... [世界観・テーマ: ${settings.theme}]`, 'process');
        const designPrompt = buildGrandDesignPrompt(settings.episodeCount, settings.country, settings.theme, settings.era, settings.isMangaMode);
        const designRes = await callWithRetry(
          () => Flow.generate.text(designPrompt),
          (attempt, max, delay) => addLog(`Retrying Grand Design (attempt ${attempt}/${max}) after ${delay} ms...`, 'warning'),
          5
        );
        const design = safeJsonParse(designRes.text, { seriesTitle: 'Untitled Series', overallSynopsis: '', episodesPlan: [] });

        seriesManifestRef.current = {
          seriesTitle: design.seriesTitle,
          totalEpisodes: settings.episodeCount,
          currentEpisodeId: 1,
          completedEpisodeIds: [],
          overallSynopsis: design.overallSynopsis,
          episodesPlan: design.episodesPlan,
          referenceAsset: currentAssetRef.current ? {
            ...currentAssetRef.current,
            characterDna: activeReferenceRef.current?.characterDna,
            styleDna: activeReferenceRef.current?.styleDna,
            antiPoseNegative: activeReferenceRef.current?.antiPoseNegative,
            eraNegative: activeReferenceRef.current?.eraNegative
          } : undefined,
          settings: settings
        };

        const initialEpisodes: Episode[] = design.episodesPlan.map(p => ({
          id: p.epNumber,
          internalId: crypto.randomUUID(),
          titleJp: p.titleJp,
          titleEn: p.titleEn,
          summary: p.summary,
          cuts: Array.from({ length: CUTS_PER_EPISODE }, (_, j) => createDefaultCut(j + 1, '脚本策定待ち...', '', false)),
          isGenerating: false,
          isGeneratingRemainingImages: false,
          isBatchGeneratingVideos: false,
          isPreviewDone: false,
          isDone: false,
          taste: settings.taste,
          era: settings.era,
          theme: settings.theme
        }));
        setEpisodes(initialEpisodes);
        addLog(`🏛️ シリーズ設計図「${design.seriesTitle}」策定完了！（全${design.episodesPlan.length}話のプロット確定）`, 'success');
      }

      const manifest = seriesManifestRef.current!;

      for (let i = 0; i < (manifest.episodesPlan?.length || 0); i++) {
        const epId = i + 1;
        if (manifest.completedEpisodeIds.includes(epId)) continue;
        if (isAbortedRef.current) break;
        const currentPlan = manifest.episodesPlan[i];

        try {
          addLog(`📖 【第${epId}話】「${currentPlan.titleJp}」の脚本・時代考証をAIに執筆依頼中...`, 'process');
          updateEpisode(epId, { isGenerating: true });

          const scriptPrompt = buildScriptPrompt(epId, currentPlan, settings.country, settings.theme, settings.era, settings.isMangaMode);
          const scriptRes = await callWithRetry(
            () => Flow.generate.text(scriptPrompt),
            (attempt, max, delay) => addLog(`Retrying Script Plot (attempt ${attempt}/${max}) after ${delay} ms...`, 'warning'),
            5
          );

          const sharedScript = safeJsonParse(scriptRes.text, { titleJp: currentPlan.titleJp, titleEn: currentPlan.titleEn, cuts: [] });
          addLog(`✨ 【第${epId}話】脚本＆時代考証が完成！（考証: ${sharedScript.eraAnalysisJp?.slice(0, 24) || '完了'}...）`, 'success');

          const ratio = settings.videoRatio;
          const getIsSelected = (idx: number) => {
            if (ratio === 'none') return false;
            if (ratio === '30%') return [0, 4, 8, 11].includes(idx);
            if (ratio === '50%') return [0, 2, 4, 6, 8, 10].includes(idx);
            if (ratio === '100%') return true;
            return false;
          };

          const rawCuts = Array.isArray(sharedScript.cuts) ? sharedScript.cuts : (Array.isArray(sharedScript.scenes) ? sharedScript.scenes : (Array.isArray(sharedScript) ? sharedScript : []));

          const episodeCuts: Cut[] = Array.from({ length: CUTS_PER_EPISODE }, (_, j) => {
            const cutData = rawCuts[j] || {};
            const narration = cutData.narrationJp || cutData.narration || '';
            const plot = cutData.basicPlot || cutData.promptEn || cutData.prompt || '';
            const cut = createDefaultCut(j + 1, narration, plot, getIsSelected(j));
            
            // AI指定のハイライト、またはエピソード代表キーワード、または漢字熟語自動抽出を適用
            const cutHighlights = cutData.highlights || sharedScript.highlightWords || [];
            cut.telop.highlights = extractHighlights(narration, cutHighlights);

            const comicLayout = (cutData.comicPanelLayout || 'none') as ComicPanelLayout;
            const comicStep = Number(cutData.comicStep) || 1;
            const comicTotalSteps = Number(cutData.comicTotalSteps) || 1;
            const comicParentCutId = Number(cutData.comicParentCutId) || (j + 1);

            if (settings.isMangaMode && comicLayout !== 'none') {
              cut.comicPanel = {
                layout: comicLayout,
                step: comicStep,
                totalSteps: comicTotalSteps,
                parentCutId: comicParentCutId
              };
            }

            return cut;
          });

          updateEpisode(epId, {
            titleJp: sharedScript.titleJp,
            titleEn: sharedScript.titleEn,
            summary: sharedScript.summary,
            eraAnalysis: sharedScript.eraAnalysisJp,
            forbiddenAnachronisms: sharedScript.forbiddenAnachronisms,
            authenticAttireEn: sharedScript.authenticAttireEn,
            forbiddenKeywordsEn: sharedScript.forbiddenKeywordsEn,
            coverCatchphraseJp: sharedScript.coverCatchphraseJp,
            coverCatchphraseEn: sharedScript.coverCatchphraseEn,
            highlightWords: sharedScript.highlightWords || [],
            cuts: episodeCuts,
            taste: settings.taste,
            era: settings.era,
            theme: settings.theme
          });

          addLog(`🎨 【第${epId}話】先行プレビュー ${settings.previewCutCount} カットの描画タスクを開始...（並列度: ${settings.parallelCount}）`, 'process');
          const tasks: GenerationTask[] = episodeCuts.slice(0, settings.previewCutCount).map(c => ({
            epId, cutId: c.id, prompt: c.promptEn, styleKey: settings.taste, imageModel: settings.imageModel, storyContext: sharedScript.summary || '', eraAnalysis: sharedScript.eraAnalysisJp, forbiddenAnachronisms: sharedScript.forbiddenAnachronisms, authenticAttireEn: sharedScript.authenticAttireEn, forbiddenKeywordsEn: sharedScript.forbiddenKeywordsEn
          }));

          await runTasks(tasks);
          addLog(`🎉 【第${epId}話】「${currentPlan.titleJp}」の先行プレビュー制作が完了しました！`, 'success');

          const cutsToAnimate = episodeCuts.filter(c => c.isSelectedForVideo);
          if ((settings.autoVideo || settings.videoRatio !== 'none') && cutsToAnimate.length > 0 && !isAbortedRef.current) {
            updateEpisode(epId, { isBatchGeneratingVideos: true });
            for (const cutTask of cutsToAnimate) {
              if (isAbortedRef.current) break;
              const currentCut = episodesRef.current.find(e => e.id === epId)?.cuts.find(c => c.id === cutTask.id);
              if (currentCut?.imageMediaId) {
                await generateVideo(epId, cutTask.id, 'veo-lite');
              }
            }
            updateEpisode(epId, { isBatchGeneratingVideos: false });
          }

          updateEpisode(epId, { isGenerating: false, isPreviewDone: true, isDone: true });

          manifest.completedEpisodeIds = Array.from(new Set([...manifest.completedEpisodeIds, epId]));
          manifest.currentEpisodeId = epId + 1;

          const freshEp = episodesRef.current.find(e => e.id === epId)!;
          if (settings.autoDownload && !isAbortedRef.current) {
            await downloadZip(freshEp, addLog, manifest, logsRef.current);
          }
          await saveStory({ titleJp: freshEp.titleJp, titleEn: freshEp.titleEn, country: settings.country, era: settings.era, theme: settings.theme, protagonistSummary: freshEp.summary || '', createdAt: new Date().toISOString() });
        } catch (epErr: any) {
          addLog(`⚠️ 第 ${epId} 話の生成中にエラーが発生しました。スキップして次へ進みます: ${formatErrorMessage(epErr)}`, 'warning');
          updateEpisode(epId, { isGenerating: false, error: '生成中断' });
          continue;
        }
      }
    } catch (err: any) {
      console.error('Fatal Production Error:', err);
      const detail = err.stack ? err.stack.split('\n')[0] + ' (' + err.message + ')' : formatErrorMessage(err);
      addLog(`❌ 制作エラー: ${detail}`, 'error');
    } finally {
      setIsProducing(false);
      refreshStories();
    }
  };

  return { episodes, isProducing, startProduction, abortProduction, resumeSeries, activeSeriesManifest: seriesManifestRef.current, handleGenerateRemaining, handleBulkVideo, handleBulkBrowserVideo, handleExportFullMovie, generateImage, generateVideo, generateBrowserVideo, updateCut, clearEpisodes: () => setEpisodes([]) };
}