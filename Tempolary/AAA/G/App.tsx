import React, { useState, useEffect } from 'react';
import { Flow } from 'flow-sdk';
import JSZip from 'jszip';
import { SectionLabel, PillButton, TextInput, FieldDisplay, CheckboxRow } from './components/UI';
import { ImageGrid } from './components/ImageGrid';
import { GenerationProgress } from './components/GenerationProgress';

// Categorized shot list for the UI
const SHOT_GROUPS = [
  {
    name: "Face Angles",
    shots: [
      "close-up portrait, front view, neutral expression, looking at camera",
      "close-up portrait, 3/4 view facing left, soft smile",
      "close-up portrait, 3/4 view facing right, soft smile",
      "close-up portrait, left side profile",
      "close-up portrait, right side profile",
      "close-up portrait, looking slightly up, curious expression",
      "close-up portrait, looking slightly down, gentle smile",
      "close-up portrait, head tilted, playful expression"
    ]
  },
  {
    name: "Expressions",
    shots: [
      "close-up, big open-mouth laugh, eyes squinted with joy",
      "close-up, surprised expression, wide eyes, mouth open in 'wow'",
      "close-up, singing expression, mouth open mid-song",
      "close-up, thinking expression, finger on chin",
      "close-up, excited grin, eyebrows raised",
      "close-up, sleepy expression, rubbing one eye"
    ]
  },
  {
    name: "Body Shots",
    shots: [
      "full body, standing front view, arms at sides, neutral pose",
      "full body, standing back view",
      "full body, waving hello with right hand, big smile",
      "full body, jumping mid-air, arms up, excited",
      "full body, sitting cross-legged, smiling at camera",
      "full body, walking pose, side view",
      "full body, pointing forward with excited expression",
      "full body, dancing pose, arms out, laughing"
    ]
  }
];

// Flat list for indexing
const ALL_SHOTS = SHOT_GROUPS.flatMap(g => g.shots);

export interface Portrait {
  mediaId: string;
  base64: string;
  mimeType: string;
  angle: string;
  feedback?: 'like' | 'dislike' | null;
  isRegenerating?: boolean;
}

export default function App() {
  const [referenceImage, setReferenceImage] = useState<{ mediaId: string; base64: string; mimeType: string } | null>(null);
  const [promptBase, setPromptBase] = useState('A single character portrait');
  const [selectedShots, setSelectedShots] = useState<Set<string>>(new Set(ALL_SHOTS));
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<Portrait[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState<'idle' | 'preparing' | 'done'>('idle');

  useEffect(() => {
    const id = 'flow-design-system-css';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      input[type=range] { -webkit-appearance: none; appearance: none; background: transparent; width: 100%; cursor: pointer; padding: 8px 0; }
      input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 3px; background: #595959; border-radius: 9999px; }
      input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: white; box-shadow: 0px 1px 3px rgba(0,0,0,0.5); margin-top: -5.5px; cursor: grab; }
      input[type=range]::-webkit-slider-thumb:active { cursor: grabbing; }
      .dark-scrollbar { scrollbar-width: thin; scrollbar-color: #595959 transparent; }
      .dark-scrollbar::-webkit-scrollbar { width: 4px; }
      .dark-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .dark-scrollbar::-webkit-scrollbar-thumb { background: #595959; border-radius: 9999px; }
      html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; background: #0e0e0e; color: white; font-family: 'Google Sans Text', sans-serif; overflow: hidden; }
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `;
    document.head.appendChild(style);
  }, []);

  const handleSelectReference = async () => {
    try {
      const media = await Flow.media.select({ filter: 'image' });
      setReferenceImage({
        mediaId: media.mediaId,
        base64: media.base64,
        mimeType: media.mimeType
      });
    } catch (err) {
      console.error("Selection cancelled", err);
    }
  };

  const getFullPrompt = (angle: string) => {
    const rules = "one character only, plain solid background, simple identical studio lighting, high quality face consistency";
    return `${angle}. ${promptBase}. ${rules}`;
  };

  const toggleShot = (shot: string) => {
    const next = new Set(selectedShots);
    if (next.has(shot)) next.delete(shot);
    else next.add(shot);
    setSelectedShots(next);
  };

  const toggleAll = () => {
    if (selectedShots.size === ALL_SHOTS.length) setSelectedShots(new Set());
    else setSelectedShots(new Set(ALL_SHOTS));
  };

  const handleGenerateBatch = async () => {
    if (!referenceImage || selectedShots.size === 0) return;
    setIsGenerating(true);
    setResults([]);
    setProgress(0);
    setError(null);

    const shotsToGenerate = ALL_SHOTS.filter(s => selectedShots.has(s));
    const batchResults: Portrait[] = [];
    
    try {
      for (let i = 0; i < shotsToGenerate.length; i++) {
        const angle = shotsToGenerate[i];
        const result = await Flow.generate.image({
          prompt: getFullPrompt(angle),
          referenceImageMediaIds: [referenceImage.mediaId],
          modelDisplayName: '🍌 Nano Banana Pro',
          aspectRatio: '1:1'
        });

        const newResult: Portrait = { ...result, angle, feedback: null };
        batchResults.push(newResult);
        setResults([...batchResults]);
        setProgress(Math.round(((i + 1) / shotsToGenerate.length) * 100));
      }
    } catch (err: any) {
      setError(err?.message || "Batch generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async (targetMediaId: string) => {
    if (!referenceImage) return;
    
    const target = results.find(img => img.mediaId === targetMediaId);
    if (!target) return;

    setResults(prev => prev.map(img => 
      img.mediaId === targetMediaId ? { ...img, isRegenerating: true } : img
    ));

    try {
      const result = await Flow.generate.image({
        prompt: getFullPrompt(target.angle),
        referenceImageMediaIds: [referenceImage.mediaId],
        modelDisplayName: '🍌 Nano Banana Pro',
        aspectRatio: '1:1'
      });

      setResults(prev => prev.map(img => 
        img.mediaId === targetMediaId ? { ...result, angle: target.angle, feedback: null, isRegenerating: false } : img
      ));
    } catch (err: any) {
      setError(`Failed to regenerate ${target.angle}.`);
      setResults(prev => prev.map(img => 
        img.mediaId === targetMediaId ? { ...img, isRegenerating: false } : img
      ));
    }
  };

  const handleToggleFeedback = (mediaId: string, type: 'like' | 'dislike') => {
    setResults(prev => prev.map(img => {
      if (img.mediaId === mediaId) {
        return { ...img, feedback: img.feedback === type ? null : type };
      }
      return img;
    }));
  };

  const handleDeleteImage = (mediaId: string) => {
    setResults(prev => prev.filter(img => img.mediaId !== mediaId));
  };

  const handleDownloadAll = async () => {
    if (results.length === 0) return;
    setDownloadState('preparing');
    try {
      const zip = new JSZip();
      results.forEach((res, i) => {
        const cleanAngle = res.angle.split(',')[0].replace(/\s+/g, '_').toLowerCase();
        const filename = `shot_${i + 1}_${cleanAngle}.jpg`;
        zip.file(filename, res.base64, { base64: true });
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        await Flow.download({
          base64,
          mimeType: 'application/zip',
          filename: 'persona_studio_batch.zip'
        });
        setDownloadState('done');
        setTimeout(() => setDownloadState('idle'), 2000);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      setDownloadState('idle');
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#0e0e0e]">
      <div className="relative border-r border-[rgba(218,220,224,0.15)] flex flex-col items-start justify-between px-[10px] py-[12px] w-[300px] h-full shrink-0">
        <div className="flex flex-col gap-[20px] items-start w-full overflow-y-auto dark-scrollbar pb-32 pr-1">
          <div className="flex flex-col gap-2 items-start w-full">
            <SectionLabel>Character Reference</SectionLabel>
            <div 
              className="w-full aspect-square rounded-xl border border-[#595959] bg-[#1a1a1a] overflow-hidden cursor-pointer group relative"
              onClick={handleSelectReference}
            >
              {referenceImage ? (
                <img src={`data:${referenceImage.mimeType};base64,${referenceImage.base64}`} className="w-full h-full object-cover" alt="Ref" />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-white/40">
                  <span className="material-symbols-outlined text-[32px]">add_a_photo</span>
                  <span className="text-[11px] mt-2 font-medium">Select Reference</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex flex-col gap-2 items-start w-full">
            <SectionLabel>Subject Base</SectionLabel>
            <TextInput value={promptBase} onChange={setPromptBase} placeholder="e.g. A young woman with blue hair..." />
          </div>

          <div className="flex flex-col gap-2 items-start w-full">
            <div className="flex items-center justify-between w-full pr-1">
              <SectionLabel>Shot Selection ({selectedShots.size})</SectionLabel>
              <button onClick={toggleAll} className="text-[9px] text-white/40 hover:text-white uppercase font-bold tracking-wider">
                {selectedShots.size === ALL_SHOTS.length ? 'None' : 'All'}
              </button>
            </div>
            
            <div className="flex flex-col gap-4 w-full">
              {SHOT_GROUPS.map((group, gIdx) => (
                <div key={gIdx} className="flex flex-col gap-1">
                  <div className="px-2 py-0.5 mb-1 bg-white/5 rounded-md self-start">
                    <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">{group.name}</span>
                  </div>
                  {group.shots.map((shot, sIdx) => (
                    <CheckboxRow 
                      key={sIdx}
                      label={shot.split(',').slice(0, 2).join(',')} // Shortened labels for clarity
                      selected={selectedShots.has(shot)}
                      onToggle={() => toggleShot(shot)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 items-start w-full">
            <SectionLabel>Model</SectionLabel>
            <FieldDisplay label="🍌 Nano Banana Pro" value="Pro Batcher" />
          </div>

          {error && <div className="p-3 rounded-xl bg-red-500/10 text-red-400 text-[11px]">{error}</div>}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-[10px] bg-[#0e0e0e] border-t border-[rgba(218,220,224,0.15)] flex flex-col gap-[8px] z-20">
          <PillButton 
            variant="solid" 
            onClick={handleGenerateBatch} 
            disabled={isGenerating || !referenceImage || selectedShots.size === 0}
            icon={<span className="material-symbols-outlined text-[18px]">{isGenerating ? 'hourglass_empty' : 'bolt'}</span>}
          >
            {isGenerating ? `Generating ${progress}%` : `Run Selected Set (${selectedShots.size})`}
          </PillButton>
          <PillButton 
            variant="outline" onClick={handleDownloadAll} disabled={results.length === 0 || downloadState !== 'idle'}
            icon={<span className="material-symbols-outlined text-[18px]">download</span>}
          >
            {downloadState === 'preparing' ? 'Zipping...' : downloadState === 'done' ? 'Downloaded ✓' : 'Download All (.zip)'}
          </PillButton>
        </div>
      </div>

      <div className="flex-1 h-full overflow-hidden relative flex flex-col">
        {isGenerating && <GenerationProgress progress={progress} currentAngle={results[results.length - 1]?.angle} />}
        <div className="flex-1 overflow-y-auto dark-scrollbar p-6">
          {results.length === 0 && !isGenerating ? (
            <div className="flex flex-col items-center justify-center h-full text-white/20">
              <span className="material-symbols-outlined text-[64px]">photo_library</span>
              <p className="mt-4 text-sm font-medium">Select shots & hit Run</p>
              <p className="text-[11px] opacity-60">Generate consistent assets for LoRA or Character training</p>
            </div>
          ) : (
            <ImageGrid 
              images={results} 
              onFeedback={handleToggleFeedback} 
              onDelete={handleDeleteImage} 
              onRegenerate={handleRegenerate}
            />
          )}
        </div>
      </div>
    </div>
  );
}