import React, { useState, useEffect, useRef } from 'react';
import { Flow } from 'flow-sdk';
import { DesignerCard } from './components/DesignerCard';
import { DiscussionLog } from './components/DiscussionLog';
import { ResultPanel } from './components/ResultPanel';
import { SectionLabel, PillButton, FieldDropdown, TextInput } from './components/Primitives';

type Phase = 'input' | 'discussing' | 'ready';

interface DesignerLine {
  designerId: number;
  text: string;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('input');
  const [userInput, setUserInput] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('16:9');
  const [model, setModel] = useState('🍌 Nano Banana Pro');
  const [discussionLines, setDiscussionLines] = useState<DesignerLine[]>([]);
  const [finalPrompt, setFinalPrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<{base64: string, mimeType: string} | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Global CSS Injection
  useEffect(() => {
    const id = 'flow-design-system-css';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      .dark-scrollbar { scrollbar-width: thin; scrollbar-color: #595959 transparent; }
      .dark-scrollbar::-webkit-scrollbar { width: 6px; }
      .dark-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .dark-scrollbar::-webkit-scrollbar-thumb { background: #595959; border-radius: 9999px; }
      @keyframes fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .animate-fade-in-up { animation: fade-in-up 0.4s ease-out forwards; }
      html, body, #root { margin: 0; padding: 0; width: 100%; height: 100%; background: #0e0e0e; color: white; font-family: 'Google Sans Text', sans-serif; }
    `;
    document.head.appendChild(style);
  }, []);

  const startRoundtable = async () => {
    if (!userInput.trim()) return;
    
    setPhase('discussing');
    setDiscussionLines([]);
    setError(null);

    try {
      const { text } = await Flow.generate.text(
        `User Idea: "${userInput}"
        
        Act as a panel of 5 elite graphic designers (100 years combined exp) discussing this idea. 
        1. THE VISIONARY: Mood and concept.
        2. THE COMPOSITOR: Layout and hierarchy.
        3. THE COLORIST: Palette and lighting.
        4. THE TECHNICAL LEAD: Texture and detail.
        5. THE CRITIC: Final polish.

        Output MUST follow this format exactly:
        [1] (text from Visionary)
        [2] (text from Compositor)
        [3] (text from Colorist)
        [4] (text from Technical Lead)
        [5] (text from Critic)
        ---FINAL PROMPT---
        (The ultimate, detailed, high-level AI prompt)
        `,
        { 
          systemInstruction: "You are the moderator of the Elite Designer Collective. Your goal is to produce the world's best graphic design prompts through rigorous simulated discussion.",
          thinkingLevel: 'high'
        }
      );

      // Parse the output
      const sections = text.split('---FINAL PROMPT---');
      const discussionPart = sections[0];
      const promptPart = sections[1]?.trim() || "Elite professional design, ultra high definition.";

      const lines = discussionPart.match(/\[(\d)\]\s*(.*?)(?=\s*\[|$)/gs);
      const parsedLines: DesignerLine[] = (lines || []).map(line => {
        const idMatch = line.match(/\[(\d)\]/);
        const textMatch = line.replace(/\[\d\]/, '').trim();
        return { designerId: parseInt(idMatch?.[1] || '1'), text: textMatch };
      });

      // Simulate typing/discussion flow
      for (let i = 0; i < parsedLines.length; i++) {
        await new Promise(r => setTimeout(r, 1200));
        setDiscussionLines(prev => [...prev, parsedLines[i]]);
      }

      await new Promise(r => setTimeout(r, 800));
      setFinalPrompt(promptPart);
      setPhase('ready');
    } catch (err) {
      setError('The collective is unavailable. Please try again.');
      setPhase('input');
    }
  };

  const handleGenerateImage = async () => {
    setIsGeneratingImage(true);
    setError(null);
    try {
      const result = await Flow.generate.image({
        prompt: finalPrompt,
        aspectRatio,
        modelDisplayName: model
      });
      setGeneratedImage(result);
    } catch (err) {
      setError('Image generation failed.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="flex h-full w-full bg-[#0e0e0e] overflow-hidden">
      {/* Left Settings Panel */}
      <div className="w-[300px] h-full border-r border-[rgba(218,220,224,0.15)] flex flex-col justify-between px-[10px] py-[12px] shrink-0">
        <div className="flex flex-col gap-[24px] w-full">
          <div className="flex flex-col gap-2">
            <SectionLabel>Core Concept</SectionLabel>
            <TextInput 
              value={userInput} 
              onChange={setUserInput} 
              placeholder="E.g., A minimalist poster for a jazz festival in Tokyo..." 
            />
          </div>

          <div className="flex flex-col gap-2">
            <SectionLabel>Configuration</SectionLabel>
            <div className="flex flex-col gap-1.5">
              <FieldDropdown 
                label="Aspect Ratio" 
                value={aspectRatio} 
                options={['1:1', '16:9', '9:16', '4:3', '3:4']} 
                onChange={(v) => setAspectRatio(v as any)} 
              />
              <FieldDropdown 
                label="Creative Model" 
                value={model} 
                options={['🍌 Nano Banana Pro', '🍌 Nano Banana 2', '🍌 Nano Banana 2 Lite']} 
                onChange={setModel} 
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 pt-4">
          <PillButton 
            variant="solid" 
            onClick={startRoundtable}
            icon={<span className="material-symbols-outlined text-[18px]">psychology</span>}
            disabled={phase === 'discussing'}
          >
            {phase === 'discussing' ? 'Refining...' : 'Start Collective Review'}
          </PillButton>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 h-full overflow-y-auto dark-scrollbar flex flex-col p-8 gap-8 items-center">
        {phase === 'input' && !generatedImage && (
          <div className="max-w-xl w-full text-center mt-20 animate-fade-in-up">
            <span className="material-symbols-outlined text-6xl text-white/20 mb-4">diamond</span>
            <h1 className="text-2xl font-medium mb-2 tracking-tight">The Elite Designer Collective</h1>
            <p className="text-white/40 text-sm leading-relaxed">
              Input your raw concept on the left. Five specialist designers with a century of combined expertise will critique, polish, and synthesize your idea into an elite AI generation prompt.
            </p>
          </div>
        )}

        {(phase === 'discussing' || phase === 'ready') && (
          <div className="w-full max-w-4xl flex flex-col gap-8">
            {/* Designer Row */}
            <div className="grid grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map(id => (
                <DesignerCard 
                  key={id} 
                  id={id} 
                  isActive={discussionLines.some(l => l.designerId === id)}
                  isSpeaking={discussionLines.length > 0 && discussionLines[discussionLines.length - 1].designerId === id && phase === 'discussing'}
                />
              ))}
            </div>

            {/* Discussion Log */}
            <DiscussionLog lines={discussionLines} isComplete={phase === 'ready'} />

            {/* Final Prompt & Preview */}
            {phase === 'ready' && (
              <div className="animate-fade-in-up">
                <ResultPanel 
                  prompt={finalPrompt} 
                  onGenerate={handleGenerateImage}
                  isGenerating={isGeneratingImage}
                  image={generatedImage}
                  error={error}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}