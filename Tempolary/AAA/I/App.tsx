import React, { useState, useEffect, useRef } from 'react';
import { Flow } from 'flow-sdk';
import { 
  SectionLabel, 
  PillButton, 
  FieldDropdown, 
  DragNumberField, 
  TextInput,
  RangeSlider,
  SegmentedToggle
} from './components/Controls';
import { PreviewArea } from './components/PreviewArea';
import { LoadingOverlay } from './components/LoadingOverlay';

const EMOTIONS = [
  'Happy', 'Sad', 'Angry', 'Surprised', 'Fearful', 
  'Disgusted', 'Neutral', 'Winking', 'Laughing', 'Crying',
  'Thinking', 'Screaming', 'Smiling', 'Smirking'
];

const MODELS = [
  '🍌 Nano Banana Pro',
  '🍌 Nano Banana 2',
  'Imagen 4 (Leaving 6/16)'
];

export default function App() {
  const [sourceImage, setSourceImage] = useState<any>(null);
  const [resultImage, setResultImage] = useState<any>(null);
  const [emotion, setEmotion] = useState('Happy');
  const [intensity, setIntensity] = useState(80);
  const [customPrompt, setCustomPrompt] = useState('');
  const [useEpicPrompt, setUseEpicPrompt] = useState('Off');
  const [model, setModel] = useState('🍌 Nano Banana Pro');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Inject global styles including slider track/thumb
  useEffect(() => {
    const id = 'flow-face-morph-css';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; background: #0e0e0e; color: white; overflow: hidden; }
      .dark-scrollbar::-webkit-scrollbar { width: 4px; }
      .dark-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .dark-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      
      input[type=range] { -webkit-appearance: none; appearance: none; background: transparent; width: 100%; cursor: pointer; padding: 8px 0; }
      input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 3px; background: #595959; border-radius: 9999px; }
      input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: white; box-shadow: 0px 1px 3px rgba(0,0,0,0.5); margin-top: -5.5px; cursor: grab; }
      input[type=range]::-webkit-slider-thumb:active { cursor: grabbing; }
      input[type=range]::-moz-range-track { width: 100%; height: 3px; background: #595959; border-radius: 9999px; }
      input[type=range]::-moz-range-thumb { width: 14px; height: 14px; border: none; border-radius: 50%; background: white; box-shadow: 0px 1px 3px rgba(0,0,0,0.5); cursor: grab; }
    `;
    document.head.appendChild(style);
  }, []);

  const handleSelectImage = async () => {
    try {
      const media = await Flow.media.select({ filter: 'image' });
      if (media) {
        setSourceImage(media);
        setResultImage(null);
        setError(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerate = async () => {
    if (!sourceImage) {
      setError('Please select a source image first.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const intensityScale = intensity / 100;
      let prompt = "";

      if (useEpicPrompt === 'On' && customPrompt.trim()) {
        // Epic Combination Mode
        prompt = `Highly detailed portrait. The person has a ${emotion.toLowerCase()} facial expression modified by: ${customPrompt.trim()}. Intensity of emotion: ${intensity}%. Maintain exact person identity, clothing, lighting, and cinematic background. Ultra-realistic, 8k.`;
      } else {
        // Standard Mode
        const intensityText = intensity > 85 ? 'extremely ' : intensity < 35 ? 'slightly ' : '';
        prompt = `A detailed realistic portrait showing a ${intensityText}${emotion.toLowerCase()} facial expression. High fidelity, maintaining the exact identity and background of the reference image. Perfect facial anatomy.`;
      }

      const result = await Flow.generate.image({
        prompt,
        modelDisplayName: model,
        referenceImageMediaIds: [sourceImage.mediaId],
        aspectRatio: '1:1', 
      });

      setResultImage(result);
    } catch (err: any) {
      setError(err.message || 'Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!resultImage) return;
    setSaveState('saving');
    try {
      await Flow.save({
        base64: resultImage.base64,
        mimeType: resultImage.mimeType as any,
        name: `Face Morph - ${emotion}`
      });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (err) {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  const handleDownload = async () => {
    if (!resultImage) return;
    try {
      await Flow.download({
        base64: resultImage.base64,
        mimeType: resultImage.mimeType,
        filename: `face_morph_${emotion.toLowerCase()}.png`
      });
    } catch (err) {
      console.error(err);
    }
  };

  const saveLabel = {
    idle: 'Save to Gallery',
    saving: 'Saving...',
    saved: 'Saved ✓',
    error: 'Save Failed',
  }[saveState];

  return (
    <div className="flex h-screen w-screen bg-[#0e0e0e]">
      {/* Left Panel */}
      <div className="relative border-r border-[rgba(218,220,224,0.15)] flex flex-col items-start justify-between overflow-clip px-[10px] py-[12px] w-[300px] h-full min-h-0 bg-[#0e0e0e] z-10">
        <div className="flex flex-col gap-[24px] items-start w-full overflow-y-auto dark-scrollbar pr-1">
          
          {/* Input Section */}
          <div className="flex flex-col gap-2 items-start w-full">
            <SectionLabel>Source Image</SectionLabel>
            {sourceImage ? (
              <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-[#595959] group">
                <img 
                  src={`data:${sourceImage.mimeType};base64,${sourceImage.base64}`} 
                  className="w-full h-full object-cover" 
                  alt="Source"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <PillButton 
                    variant="outline" 
                    onClick={handleSelectImage}
                    icon={<span className="material-symbols-outlined text-[18px]">cached</span>}
                  >
                    Change
                  </PillButton>
                </div>
              </div>
            ) : (
              <PillButton 
                variant="filled" 
                onClick={handleSelectImage}
                icon={<span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>}
              >
                Select Image
              </PillButton>
            )}
          </div>

          {/* Expression Controls */}
          <div className="flex flex-col gap-2 items-start w-full">
            <SectionLabel>Expression</SectionLabel>
            <div className="flex flex-col gap-1.5 items-start w-full">
              <FieldDropdown 
                label="Emotion" 
                value={emotion} 
                options={EMOTIONS} 
                onChange={setEmotion} 
                className="w-full"
              />
              <div className="flex gap-1 w-full items-end">
                <div className="flex-1">
                  <RangeSlider 
                    label="Intensity" 
                    value={intensity} 
                    min={0} 
                    max={100} 
                    formatValue={(v) => `${v}%`} 
                    onChange={setIntensity} 
                  />
                </div>
                <DragNumberField 
                  label="Value" 
                  value={intensity} 
                  min={0} 
                  max={100} 
                  suffix="%" 
                  onChange={setIntensity} 
                  className="w-[70px]"
                />
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="flex flex-col gap-2 items-start w-full">
            <SectionLabel>Customization</SectionLabel>
            <div className="flex flex-col gap-1.5 items-start w-full">
              <div className="flex items-center justify-between w-full px-2 mb-1">
                <span className="text-[11px] font-medium text-white/40">Combine Custom Prompt</span>
                <div className="w-[80px]">
                  <SegmentedToggle 
                    value={useEpicPrompt} 
                    onChange={setUseEpicPrompt}
                    items={[{ value: 'Off', label: 'Off' }, { value: 'On', label: 'On' }]}
                  />
                </div>
              </div>
              <TextInput 
                value={customPrompt} 
                onChange={setCustomPrompt} 
                placeholder="e.g. adding a mischievous glint in the eyes..."
              />
              <p className="px-2 text-[10px] text-white/30 italic">
                {useEpicPrompt === 'On' 
                  ? "Combine mode: Custom details will be mixed with your emotion & intensity." 
                  : "Standard mode: Prompt replaces default emotion logic."}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 items-start w-full">
            <SectionLabel>Model</SectionLabel>
            <FieldDropdown 
              label="AI Model" 
              value={model} 
              options={MODELS} 
              onChange={setModel} 
              className="w-full"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium w-full animate-fade-in">
              {error}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-[5px] items-start w-full pt-4 border-t border-[rgba(218,220,224,0.1)] mt-4">
          <PillButton 
            variant="solid" 
            onClick={handleGenerate}
            disabled={isGenerating || !sourceImage}
            icon={isGenerating ? <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[18px]">auto_fix_high</span>}
          >
            {isGenerating ? 'Morphing...' : 'Generate Expression'}
          </PillButton>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex items-center justify-center p-8 bg-[#0e0e0e]">
        <PreviewArea 
          source={sourceImage} 
          result={resultImage} 
          isGenerating={isGenerating}
        />
        
        {resultImage && !isGenerating && (
          <div className="absolute bottom-8 right-8 flex gap-2 animate-fade-in">
             <PillButton 
              variant="outline" 
              onClick={handleDownload}
              icon={<span className="material-symbols-outlined text-[18px]">download</span>}
            >
              Download
            </PillButton>
            <PillButton 
              variant="solid" 
              onClick={handleSave}
              disabled={saveState !== 'idle'}
              icon={<span className="material-symbols-outlined text-[18px]">{saveState === 'saved' ? 'check' : 'save'}</span>}
            >
              {saveLabel}
            </PillButton>
          </div>
        )}
      </div>

      {isGenerating && <LoadingOverlay emotion={emotion} />}
    </div>
  );
}