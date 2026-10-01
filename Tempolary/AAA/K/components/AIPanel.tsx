import React, { useState } from 'react';
import { Flow } from 'flow-sdk';
import { SectionLabel, PillButton, TextInput } from './Primitives';
import { ScriptBlock } from '../types';

interface Props {
  sceneContext: string;
  activeBlock?: ScriptBlock;
  onApplyDialogue: (content: string) => void;
  onClose?: () => void;
}

const RANDOM_THEMES = [
  "Neon Rain", "Lost Love", "Cyberpunk Alley", "Morning Fog", 
  "First Espresso", "Silent Subway", "Empty Theatre", "Withered Rose",
  "Midnight Call", "Broken Watch", "Cold Concrete", "Ancient Oak"
];

export const AIPanel: React.FC<Props> = ({ sceneContext, activeBlock, onApplyDialogue, onClose }) => {
  const [summary, setSummary] = useState('');
  const [dialogueSuggestion, setDialogueSuggestion] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [haikuTheme, setHaikuTheme] = useState('');
  const [haikuResult, setHaikuResult] = useState('');
  const [loading, setLoading] = useState<'summary' | 'dialogue' | 'analysis' | 'haiku' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = async () => {
    if (!sceneContext) return;
    setLoading('summary');
    setError(null);
    try {
      const { text } = await Flow.generate.text(
        `Summarize the following screenplay scene into a concise 1-2 sentence logline. Format it as professional coverage.\n\n${sceneContext}`,
        { systemInstruction: 'You are a professional Hollywood script doctor and story analyst.' }
      );
      setSummary(text);
    } catch (err) {
      setError('Failed to generate summary.');
    } finally {
      setLoading(null);
    }
  };

  const suggestDialogue = async () => {
    if (!activeBlock || (activeBlock.type !== 'CHARACTER' && activeBlock.type !== 'DIALOGUE')) {
      setError('Select a character or dialogue block first.');
      return;
    }
    
    setLoading('dialogue');
    setError(null);
    try {
      const charName = activeBlock.type === 'CHARACTER' ? activeBlock.content : 'the speaker';
      const { text } = await Flow.generate.text(
        `Based on the following scene context, suggest 3 different short options for the next line of dialogue for ${charName}. Provide only the options, separated by newlines.\n\nCONTEXT:\n${sceneContext}`,
        { systemInstruction: 'You are a master screenwriter. Write punchy, subtext-heavy dialogue.' }
      );
      setDialogueSuggestion(text);
    } catch (err) {
      setError('Failed to suggest dialogue.');
    } finally {
      setLoading(null);
    }
  };

  const runAnalysis = async () => {
    if (!sceneContext) return;
    setLoading('analysis');
    setError(null);
    try {
      const { text } = await Flow.generate.text(
        `Perform a deep structural analysis of this screenplay scene. 
        Focus on:
        1. Emotional Tone: Primary emotional beat.
        2. Pacing: Action vs Dialogue balance.
        3. Subtext: What is being unsaid?
        4. "The Turn": Where does the power shift?
        
        FORMAT: Extremely concise bullet points. No intro or outro.
        
        SCENE:\n${sceneContext}`,
        { systemInstruction: 'You are an elite Hollywood script consultant. You give brutal but brilliant feedback.' }
      );
      setAnalysis(text);
    } catch (err) {
      setError('Failed to run analysis.');
    } finally {
      setLoading(null);
    }
  };

  const generateHaiku = async () => {
    setLoading('haiku');
    setError(null);
    try {
      const theme = haikuTheme || RANDOM_THEMES[Math.floor(Math.random() * RANDOM_THEMES.length)];
      const { text } = await Flow.generate.text(
        `Write a beautiful, professional 5-7-5 haiku about the following theme. 
        THEME: ${theme}
        
        FORMAT: Only the three lines of the haiku, separated by newlines. No titles or quotes.`,
        { systemInstruction: 'You are a sensitive Japanese poet and master of imagery.' }
      );
      setHaikuResult(text);
    } catch (err) {
      setError('Failed to generate haiku.');
    } finally {
      setLoading(null);
    }
  };

  const pickRandomTheme = () => {
    const random = RANDOM_THEMES[Math.floor(Math.random() * RANDOM_THEMES.length)];
    setHaikuTheme(random);
  };

  return (
    <div className="relative border-l flex flex-col items-start px-[10px] py-[12px] w-[300px] h-full shrink-0 animate-slide-in-right theme-transition bg-[var(--sidebar-bg)] z-20" style={{ borderColor: 'var(--border-color)' }}>
      <div className="flex flex-col gap-[24px] items-start w-full h-full overflow-y-auto dark-scrollbar pr-1">
        
        {/* Header with Close Button */}
        <div className="flex items-center justify-between w-full shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-blue-400">auto_awesome</span>
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-primary)]">AI Studio</h2>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* Haiku Inspiration Tool */}
        <div className="flex flex-col gap-3 items-start w-full shrink-0">
          <SectionLabel>Haiku Inspiration</SectionLabel>
          <div className="flex flex-col gap-2 w-full p-3 rounded-xl border border-[var(--border-color)] bg-black/5">
            {haikuResult ? (
              <div className="flex flex-col items-center justify-center py-4 text-center border-b border-[var(--border-color)] mb-2 animate-fade-in">
                {haikuResult.split('\n').map((line, i) => (
                  <p key={i} className="text-[12px] font-medium text-[var(--text-primary)] italic leading-relaxed tracking-wide">
                    {line}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed italic mb-2">
                Need a spark? Generate a haiku to set the mood for your scene.
              </p>
            )}
            
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1">
                <TextInput 
                  value={haikuTheme} 
                  onChange={setHaikuTheme} 
                  placeholder="Enter theme..." 
                  className="!h-[34px] !py-1.5 !text-[var(--text-primary)] !border-[var(--border-color)]"
                />
                <button 
                  onClick={pickRandomTheme}
                  className="w-[34px] h-[34px] shrink-0 flex items-center justify-center rounded-xl border border-[var(--border-color)] hover:bg-black/5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                  title="Random theme"
                >
                  <span className="material-symbols-outlined text-[18px]">shuffle</span>
                </button>
              </div>
              
              <PillButton 
                variant="outline" 
                onClick={generateHaiku}
                disabled={!!loading}
                className="!text-[var(--text-primary)] !border-[var(--border-color)]"
                icon={<span className={`material-symbols-outlined text-[18px] ${loading === 'haiku' ? 'animate-spin' : ''}`}>
                  {loading === 'haiku' ? 'refresh' : 'ink_pen'}
                </span>}
              >
                {loading === 'haiku' ? 'Meditating...' : 'Generate Haiku'}
              </PillButton>
            </div>
          </div>
        </div>

        {/* Scene Summary Tool */}
        <div className="flex flex-col gap-3 items-start w-full shrink-0">
          <SectionLabel>Scene Intelligence</SectionLabel>
          <div className="flex flex-col gap-2 w-full p-3 rounded-xl border border-[var(--border-color)] bg-black/5">
            <p className="text-[10px] text-[var(--text-muted)] leading-relaxed italic">
              {summary || "Generate a professional logline for your current scene."}
            </p>
            <PillButton 
              variant="outline" 
              onClick={generateSummary}
              disabled={!!loading || !sceneContext}
              className="!text-[var(--text-primary)] !border-[var(--border-color)]"
              icon={<span className={`material-symbols-outlined text-[18px] ${loading === 'summary' ? 'animate-spin' : ''}`}>
                {loading === 'summary' ? 'refresh' : 'summarize'}
              </span>}
            >
              {loading === 'summary' ? 'Analyzing...' : 'Summarize Scene'}
            </PillButton>
          </div>
        </div>

        {/* Script Analysis Tool */}
        <div className="flex flex-col gap-3 items-start w-full shrink-0">
          <SectionLabel>Deep Analysis</SectionLabel>
          <div className="flex flex-col gap-2 w-full p-3 rounded-xl border border-[var(--border-color)] bg-black/5">
            {analysis ? (
              <div className="flex flex-col gap-2 mb-2">
                {analysis.split('\n').filter(l => l.trim()).map((line, i) => (
                  <p key={i} className="text-[10px] text-[var(--text-secondary)] leading-normal flex gap-2">
                    <span className="text-[var(--text-muted)] opacity-50">•</span>
                    {line.replace(/^[•\-\d\.]+\s*/, '')}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-[var(--text-muted)] leading-relaxed italic mb-2">
                Review the emotional beats, pacing, and subtext of your current scene.
              </p>
            )}
            <PillButton 
              variant="outline" 
              onClick={runAnalysis}
              disabled={!!loading || !sceneContext}
              className="!text-[var(--text-primary)] !border-[var(--border-color)]"
              icon={<span className={`material-symbols-outlined text-[18px] ${loading === 'analysis' ? 'animate-spin' : ''}`}>
                {loading === 'analysis' ? 'refresh' : 'insights'}
              </span>}
            >
              {loading === 'analysis' ? 'Thinking...' : 'Run Analysis'}
            </PillButton>
          </div>
        </div>

        {/* Dialogue Assistant */}
        <div className="flex flex-col gap-3 items-start w-full shrink-0">
          <SectionLabel>Dialogue Studio</SectionLabel>
          <div className="flex flex-col gap-2 w-full">
            <div className="flex flex-col gap-2 w-full p-3 rounded-xl border border-[var(--border-color)] bg-black/5 max-h-[300px] overflow-y-auto dark-scrollbar">
              {dialogueSuggestion ? (
                <div className="flex flex-col gap-3">
                  {dialogueSuggestion.split('\n').filter(line => line.trim()).map((opt, i) => (
                    <button 
                      key={i}
                      onClick={() => onApplyDialogue(opt.replace(/^\d+\.\s*/, '').trim())}
                      className="text-left text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 p-2 rounded-lg transition-all border border-transparent hover:border-[var(--border-color)]"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <span className="material-symbols-outlined text-[var(--text-muted)] opacity-30 text-[32px] mb-2">chat_bubble</span>
                  <p className="text-[10px] text-[var(--text-muted)] opacity-50">
                    Select a Character block in the editor to get dialogue suggestions based on context.
                  </p>
                </div>
              )}
            </div>
            
            <PillButton 
              variant="solid" 
              onClick={suggestDialogue}
              disabled={!!loading || (!activeBlock || (activeBlock.type !== 'CHARACTER' && activeBlock.type !== 'DIALOGUE'))}
              className="!bg-[var(--text-primary)] !text-[var(--bg-color)]"
              icon={<span className={`material-symbols-outlined text-[18px] ${loading === 'dialogue' ? 'animate-spin' : ''}`}>
                {loading === 'dialogue' ? 'refresh' : 'auto_awesome'}
              </span>}
            >
              {loading === 'dialogue' ? 'Writing...' : 'Suggest Lines'}
            </PillButton>
          </div>
        </div>

        {error && (
          <div className="w-full p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] shrink-0">
            {error}
          </div>
        )}

        {/* Info */}
        <div className="mt-auto pt-4 border-t w-full shrink-0 pb-4" style={{ borderColor: 'var(--border-color)' }}>
           <div className="flex items-center gap-2 px-2 py-1 bg-blue-500/5 rounded-lg border border-blue-500/10">
             <span className="material-symbols-outlined text-blue-500 text-[16px]">info</span>
             <p className="text-[9px] text-blue-500 opacity-80 leading-tight">
               AI tools analyze the entire current scene for better creative consistency.
             </p>
           </div>
        </div>
      </div>
    </div>
  );
};