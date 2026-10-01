import React, { useState, useEffect, useRef } from 'react';
import { Flow } from 'flow-sdk';
import JSZip from 'jszip';
import { Character, ArtStyle, Genre, PageLayoutStyle, ComicProject, GeneratedPage, ComicPageData, PageStatus, StyleReference } from './types';
import { ART_STYLES, GENRES, PAGE_LAYOUT_STYLES, DEFAULT_LAYOUT_MAPPING, MODELS } from './constants';
import { SectionLabel, PillButton, FieldDropdown, TextInput, Toggle } from './components/DesignSystem';
import { ComicEngine } from './services/engine';

export default function App() {
  // Project State
  const [project, setProject] = useState<ComicProject>({
    title: 'New Story',
    script: '',
    improveStory: true,
    style: 'High-Impact Colored Manga',
    genre: 'Follow Script / Auto',
    layoutStyle: 'Modern Cinematic Story Flow',
    fontStyle: 'Clean Manga Dialogue Font',
    model: '🍌 Nano Banana 2',
    characters: [],
    locationReferences: [],
    styleReferences: [],
    styleStrength: 'Medium'
  });

  // UI State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [progress, setProgress] = useState('');
  const [pagePlans, setPagePlans] = useState<ComicPageData[]>([]);
  const [pages, setPages] = useState<GeneratedPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  
  const [regenerationNotes, setRegenerationNotes] = useState<Record<string, string>>({});
  const [viewingPrevious, setViewingPrevious] = useState<Record<string, boolean>>({});
  const [editingPlanIndex, setEditingPlanIndex] = useState<number | null>(null);
  const [tempPlan, setTempPlan] = useState<ComicPageData | null>(null);

  const stopAutoRef = useRef(false);

  const validateProject = (targetPageIndex?: number) => {
    if (!project.title.trim()) return "Project title is missing.";
    if (!project.style) return "Art style is missing.";
    if (!project.genre) return "Genre mood is missing.";
    if (!project.layoutStyle) return "Page layout is missing.";
    if (!project.model) return "Image model is missing.";
    
    // Character references are now optional. 
    // Validation only blocks if a character is explicitly LOCKED but missing a reference.
    if (targetPageIndex !== undefined && pagePlans[targetPageIndex]) {
      const plan = pagePlans[targetPageIndex];
      for (const charName of plan.characters) {
        const found = project.characters.find(c => c.name.toLowerCase() === charName.toLowerCase());
        if (found && found.outfitLocked && !found.referenceMediaId) {
          return `The appearance for ${found.name} is locked, but the reference image is missing. Please upload a reference or unlock the character.`;
        }
      }
    }
    return null;
  };

  const addCharacter = () => {
    const newChar: Character = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      description: '',
      personality: '',
      outfit: '',
      outfitDescription: '',
      outfitLocked: false
    };
    setProject(p => ({ ...p, characters: [...p.characters, newChar] }));
  };

  const updateCharacter = (id: string, updates: Partial<Character>) => {
    setProject(p => ({
      ...p,
      characters: p.characters.map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  };

  const removeCharacter = (id: string) => {
    setProject(p => ({
      ...p,
      characters: p.characters.filter(c => c.id !== id)
    }));
  };

  const uploadCharacterRef = async (id: string) => {
    try {
      const media = await Flow.media.select({ filter: 'image' });
      updateCharacter(id, { 
        referenceMediaId: media.mediaId, 
        referenceBase64: media.base64 
      });
    } catch (err) {
      console.warn("Upload cancelled");
    }
  };

  const addStyleReference = async () => {
    if (project.styleReferences.length >= 3) return;
    try {
      const media = await Flow.media.select({ filter: 'image' });
      const newRef: StyleReference = {
        id: Math.random().toString(36).substr(2, 9),
        mediaId: media.mediaId,
        base64: media.base64
      };
      setProject(p => ({ ...p, styleReferences: [...p.styleReferences, newRef] }));
    } catch (err) {
      console.warn("Upload cancelled");
    }
  };

  const removeStyleReference = (id: string) => {
    setProject(p => ({
      ...p,
      styleReferences: p.styleReferences.filter(s => s.id !== id)
    }));
  };

  const handleAnalyze = async () => {
    if (!project.script.trim()) {
      setError("Please enter a story script first!");
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    setProgress('Planning your comic pages...');
    try {
      const { pages: plans, refinedCharacters: aiChars } = await ComicEngine.analyzeScript(project);
      
      setPagePlans(plans);
      setProject(p => {
        // MERGE: Keep all existing characters, update those mentioned by AI if not locked.
        const currentChars = [...p.characters];
        aiChars.forEach(aiC => {
          const idx = currentChars.findIndex(c => c.name.toLowerCase() === aiC.name?.toLowerCase());
          if (idx > -1) {
            if (!currentChars[idx].outfitLocked) {
              currentChars[idx] = { ...currentChars[idx], ...aiC };
            }
          } else {
            currentChars.push({
              id: Math.random().toString(36).substr(2, 9),
              name: aiC.name || 'Unnamed',
              description: aiC.description || '',
              personality: aiC.personality || '',
              outfit: aiC.outfit || '',
              outfitLocked: false
            });
          }
        });
        return { ...p, characters: currentChars };
      });
      
      setPages([]); 
      setShowPlan(true);
    } catch (err: any) {
      setError(err.message || "Analysis failed.");
    } finally {
      setIsAnalyzing(false);
      setProgress('');
    }
  };

  const updatePagePlanStatus = (index: number, status: PageStatus) => {
    setPagePlans(prev => prev.map((p, i) => i === index ? { ...p, status } : p));
  };

  const startEditPlan = (index: number) => {
    setEditingPlanIndex(index);
    setTempPlan({ ...pagePlans[index] });
  };

  const saveEditedPlan = () => {
    if (editingPlanIndex !== null && tempPlan) {
      setPagePlans(prev => prev.map((p, i) => i === editingPlanIndex ? tempPlan : p));
      setEditingPlanIndex(null);
      setTempPlan(null);
    }
  };

  const generatePageByIndex = async (index: number) => {
    if (index >= pagePlans.length) return;
    
    const validationError = validateProject(index);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(`Generating Page ${index + 1}...`);
    try {
      const prevPage = pages.find(p => p.pageNumber === pagePlans[index].pageNumber - 1 && !p.isRejected);
      const page = await ComicEngine.generatePage(pagePlans[index], project, project.characters, prevPage?.mediaId);
      
      setPages(prev => {
        const newPages = prev.filter(p => p.pageNumber !== page.pageNumber);
        newPages.push(page);
        return newPages.sort((a, b) => a.pageNumber - b.pageNumber);
      });
      updatePagePlanStatus(index, page.isRejected ? 'rejected' : 'generated');
    } catch (err: any) {
      setError(err.message || "Generation failed.");
    } finally {
      setIsGenerating(false);
      setProgress('');
    }
  };

  const handleRegenerate = async (pageId: string) => {
    const index = pages.findIndex(p => p.id === pageId);
    if (index === -1) return;
    const page = pages[index];
    const planIndex = pagePlans.findIndex(p => p.pageNumber === page.pageNumber);
    if (planIndex === -1) return;

    const validationError = validateProject(planIndex);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(`Regenerating Page ${page.pageNumber}...`);
    try {
      const prevPage = pages.find(p => p.pageNumber === page.pageNumber - 1 && !p.isRejected);
      const newVer = await ComicEngine.generatePage(pagePlans[planIndex], project, project.characters, prevPage?.mediaId, regenerationNotes[page.id]);
      
      if (newVer.isRejected) {
        setPages(prev => prev.map(p => p.id === pageId ? newVer : p));
        updatePagePlanStatus(planIndex, 'rejected');
      } else {
        setPages(prev => prev.map(p => p.id === pageId ? { ...p, pendingVersion: newVer, isRejected: false } : p));
        updatePagePlanStatus(planIndex, 'generated');
      }
      setRegenerationNotes(prev => ({ ...prev, [pageId]: '' }));
    } catch (err: any) {
      setError(err.message || "Regeneration failed.");
    } finally {
      setIsGenerating(false);
      setProgress('');
    }
  };

  const handleKeepVersion = (pageId: string) => {
    setPages(prev => prev.map(p => {
      if (p.id === pageId && p.pendingVersion) {
        const { pendingVersion, history = [], ...current } = p;
        return { ...pendingVersion, history: [...history, current] };
      }
      return p;
    }));
  };

  const handleRevertVersion = (pageId: string) => {
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, pendingVersion: undefined } : p));
  };

  const handleAutoGenerate = async () => {
    const globalValidation = validateProject();
    if (globalValidation) {
      setError(globalValidation);
      return;
    }

    setIsAutoGenerating(true);
    stopAutoRef.current = false;
    
    let currentPages = [...pages];
    let currentPlans = [...pagePlans];

    for (let i = 0; i < currentPlans.length; i++) {
      if (stopAutoRef.current) break;
      if (currentPlans[i].status !== 'not_generated') continue;
      
      const pageVal = validateProject(i);
      if (pageVal) {
        setError(pageVal);
        break;
      }

      setProgress(`Generating Page ${i + 1} of ${currentPlans.length}...`);
      try {
        const prevPage = currentPages.find(p => p.pageNumber === currentPlans[i].pageNumber - 1 && !p.isRejected);
        const page = await ComicEngine.generatePage(currentPlans[i], project, project.characters, prevPage?.mediaId);
        
        currentPages = [...currentPages.filter(p => p.pageNumber !== page.pageNumber), page];
        currentPlans[i].status = page.isRejected ? 'rejected' : 'generated';
        
        setPages([...currentPages].sort((a, b) => a.pageNumber - b.pageNumber));
        setPagePlans([...currentPlans]);
      } catch (err: any) {
        setError(`Process paused: ${err.message}`);
        break;
      }
    }
    setIsAutoGenerating(false);
    setProgress('');
    setShowSummary(true);
  };

  const handleGenreChange = (newGenre: Genre) => {
    const mapping = DEFAULT_LAYOUT_MAPPING[newGenre];
    setProject(p => ({
      ...p,
      genre: newGenre,
      layoutStyle: mapping?.layout || p.layoutStyle
    }));
  };

  const downloadAllAsZip = async () => {
    const zip = new JSZip();
    pages.filter(p => !p.isRejected).forEach(p => zip.file(`Page_${p.pageNumber}.png`, p.base64, { base64: true }));
    const blob = await zip.generateAsync({ type: 'blob' });
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = (reader.result as string).split(',')[1];
      await Flow.download({ base64: b64, mimeType: 'application/zip', filename: `${project.title.replace(/\s+/g, '_')}_Comic.zip` });
    };
    reader.readAsDataURL(blob);
  };

  const generatedCount = pagePlans.filter(p => p.status === 'generated').length;
  const remainingCount = pagePlans.filter(p => p.status === 'not_generated').length;

  return (
    <div className="flex h-screen w-screen bg-[#0e0e0e] text-white overflow-hidden font-sans">
      
      {/* Sidebar: Configuration */}
      <div className="w-[340px] h-full flex flex-col border-r border-white/10 bg-[#121212] overflow-y-auto custom-scrollbar shrink-0">
        <div className="p-6 flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h1 className="text-xl font-bold tracking-tight text-white">ComicGen Studio</h1>
            <TextInput label="Story Title" value={project.title} onChange={v => setProject(p => ({ ...p, title: v }))} placeholder="My Epic Manga..." />
          </div>

          <div className="flex flex-col gap-4">
            <SectionLabel icon="auto_awesome">Story Script</SectionLabel>
            <Toggle label="Improve Story Mode" enabled={project.improveStory} onChange={v => setProject(p => ({ ...p, improveStory: v }))} />
            <TextInput label="The Script" value={project.script} onChange={v => setProject(p => ({ ...p, script: v }))} placeholder="Enter your script here..." multiline rows={8} />
            <PillButton variant="filled" className="w-full" onClick={handleAnalyze} disabled={isAnalyzing || isGenerating || isAutoGenerating}>
              {isAnalyzing ? 'Analyzing...' : 'Plan Comic Pages'}
            </PillButton>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <SectionLabel icon="person">Characters</SectionLabel>
              <button onClick={addCharacter} className="text-[10px] uppercase font-bold text-white/40 hover:text-white transition-colors">+ Add</button>
            </div>
            <div className="flex flex-col gap-3">
              {project.characters.map(char => (
                <div key={char.id} className="p-3 rounded-xl border border-white/5 bg-white/[0.02] flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <input className="bg-transparent border-none text-[12px] font-bold text-white outline-none w-full" placeholder="Name" value={char.name} onChange={e => updateCharacter(char.id, { name: e.target.value })} />
                    <button onClick={() => removeCharacter(char.id)} className="text-white/20 hover:text-red-400"><span className="material-symbols-outlined text-[16px]">close</span></button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => uploadCharacterRef(char.id)} className="w-12 h-12 rounded-lg border border-white/10 flex flex-col items-center justify-center shrink-0 hover:border-white/30 bg-black/40 overflow-hidden">
                      {char.referenceBase64 ? <img src={`data:image/png;base64,${char.referenceBase64}`} className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-[18px] text-white/20">add_photo_alternate</span>}
                    </button>
                    <textarea className="bg-transparent border-none text-[10px] text-white/50 outline-none resize-none flex-1 custom-scrollbar" placeholder="Description & Outfit..." value={char.description} onChange={e => updateCharacter(char.id, { description: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-2 pt-1">
                    <Toggle label="Lock Outfit / Appearance" enabled={char.outfitLocked || false} onChange={v => updateCharacter(char.id, { outfitLocked: v })} />
                    <TextInput label="Outfit Description" value={char.outfitDescription || char.outfit || ''} onChange={v => updateCharacter(char.id, { outfitDescription: v })} placeholder="What are they wearing?" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <SectionLabel icon="palette">Visual Style</SectionLabel>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {project.styleReferences.map((ref) => (
                <div key={ref.id} className="relative aspect-square rounded-lg border border-white/10 overflow-hidden group">
                  <img src={`data:image/png;base64,${ref.base64}`} className="w-full h-full object-cover" />
                  <button onClick={() => removeStyleReference(ref.id)} className="absolute top-1 right-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100"><span className="material-symbols-outlined text-[14px]">close</span></button>
                </div>
              ))}
              {project.styleReferences.length < 3 && <button onClick={addStyleReference} className="aspect-square rounded-lg border border-dashed border-white/10 flex flex-col items-center justify-center hover:bg-white/5 text-white/20"><span className="material-symbols-outlined text-[18px]">add_photo_alternate</span></button>}
            </div>
            <FieldDropdown label="Image Model" value={project.model} options={MODELS} onChange={v => setProject(p => ({ ...p, model: v }))} />
            <FieldDropdown label="Art Style" value={project.style} options={ART_STYLES} onChange={v => setProject(p => ({ ...p, style: v as ArtStyle }))} />
            <FieldDropdown label="Genre Mood" value={project.genre} options={GENRES} onChange={v => handleGenreChange(v as Genre)} />
            <FieldDropdown label="Page Layout" value={project.layoutStyle} options={PAGE_LAYOUT_STYLES} onChange={v => setProject(p => ({ ...p, layoutStyle: v as PageLayoutStyle }))} />
          </div>
          <div className="pb-12" />
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 h-full bg-[#0a0a0a] flex flex-col relative overflow-hidden">
        
        {/* Progress Overlay */}
        {(isAnalyzing || isGenerating || isAutoGenerating) && (
          <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="flex flex-col items-center gap-6 p-10 rounded-3xl bg-white/[0.03] border border-white/10 shadow-2xl">
              <div className="w-12 h-12 border-4 border-white/10 border-t-white rounded-full animate-spin" />
              <div className="flex flex-col items-center gap-1">
                <p className="text-white text-lg font-bold">{progress || 'Working...'}</p>
                <p className="text-white/40 text-[11px] uppercase tracking-widest">Character references are optional</p>
              </div>
              {isAutoGenerating && <PillButton variant="outline" onClick={() => stopAutoRef.current = true}>Stop Generation</PillButton>}
            </div>
          </div>
        )}

        {/* Error Message Toast */}
        {error && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[110] animate-in slide-in-from-top duration-300">
            <div className="bg-red-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold border border-white/20">
              <span className="material-symbols-outlined">warning</span>
              {error}
              <button onClick={() => setError(null)} className="ml-2 opacity-50 hover:opacity-100 transition-opacity"><span className="material-symbols-outlined text-[18px]">close</span></button>
            </div>
          </div>
        )}

        {/* Toolbar */}
        {pagePlans.length > 0 && (
          <div className="h-20 border-b border-white/5 bg-[#121212] flex items-center justify-between px-8 shrink-0 z-40">
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-white">{generatedCount} <span className="text-white/30 font-medium">/ {pagePlans.length}</span></span>
              <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-white transition-all duration-700" style={{ width: `${(generatedCount / pagePlans.length) * 100}%` }} /></div>
            </div>
            <div className="flex items-center gap-4">
              <PillButton variant="outline" icon={<span className="material-symbols-outlined text-[18px]">{showPlan ? 'image' : 'list'}</span>} onClick={() => setShowPlan(!showPlan)}>{showPlan ? 'View Storyboard' : 'View Page Plan'}</PillButton>
              <PillButton variant="filled" disabled={remainingCount === 0 || isGenerating || isAutoGenerating} onClick={() => generatePageByIndex(pagePlans.findIndex(p => p.status === 'not_generated'))}>Generate Next</PillButton>
              <PillButton variant="solid" disabled={remainingCount === 0 || isGenerating || isAutoGenerating} onClick={handleAutoGenerate}>Generate All</PillButton>
              {pages.length > 0 && <PillButton variant="outline" icon={<span className="material-symbols-outlined text-[18px]">download</span>} onClick={downloadAllAsZip}>Download All</PillButton>}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden relative">
          {/* Plan View Panel */}
          <div className={`absolute inset-0 z-30 bg-[#0a0a0a] transition-transform duration-500 ease-in-out ${showPlan ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="h-full flex flex-col p-10 overflow-y-auto custom-scrollbar">
              <SectionLabel icon="assignment">Storyboard Plan</SectionLabel>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4 pb-20">
                {pagePlans.map((plan, idx) => (
                  <div key={idx} className={`p-5 rounded-2xl border transition-all ${plan.status === 'generated' ? 'bg-white/[0.05] border-white/20 shadow-lg' : plan.status === 'rejected' ? 'bg-red-500/10 border-red-500/30' : 'bg-black/40 border-white/5'} flex flex-col gap-4 relative group`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-white/30">Page {plan.pageNumber}</span>
                      <button onClick={() => startEditPlan(idx)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded"><span className="material-symbols-outlined text-[16px]">edit</span></button>
                    </div>
                    <p className="text-[11px] text-white/50 line-clamp-3">{plan.summary}</p>
                    {plan.status === 'not_generated' && <PillButton variant="outline" className="h-[32px] mt-2" onClick={() => generatePageByIndex(idx)}>Generate This</PillButton>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Storyboard Feed */}
          <div className="h-full overflow-y-auto p-12 custom-scrollbar flex flex-col items-center gap-16">
            {pages.length > 0 && (
              <div className="w-full flex flex-col gap-16 max-w-5xl">
                {[...pages].reverse().map(page => {
                  const isRev = !!page.pendingVersion;
                  const isViewingPrev = viewingPrevious[page.id] || false;
                  const displayPage = isRev && !isViewingPrev ? page.pendingVersion! : page;
                  const currentPlan = pagePlans.find(p => p.pageNumber === page.pageNumber);

                  if (page.isRejected) {
                    return (
                      <div key={page.id} className="w-full bg-red-500/5 border border-red-500/20 rounded-[2.5rem] p-10 flex flex-col gap-4">
                        <h3 className="text-2xl font-bold">Page {page.pageNumber} (Blocked)</h3>
                        <PillButton variant="filled" className="w-fit" icon={<span className="material-symbols-outlined">refresh</span>} onClick={() => handleRegenerate(page.id)}>Try Again</PillButton>
                      </div>
                    );
                  }

                  return (
                    <div key={page.id} className="flex flex-col lg:flex-row gap-8 w-full">
                      <div className="w-full lg:w-[280px] shrink-0 flex flex-col gap-6 lg:sticky lg:top-0 h-fit">
                        <div className="flex flex-col gap-4 p-5 rounded-2xl bg-white/[0.03] border border-white/10 shadow-xl backdrop-blur-md">
                          <SectionLabel icon="description">Page Script</SectionLabel>
                          <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                            <p className="text-[11px] text-white/60 leading-relaxed italic whitespace-pre-wrap">
                              {currentPlan?.textGuide || 'No text guide available.'}
                            </p>
                          </div>
                          <div className="pt-4 border-t border-white/5 flex flex-col gap-4">
                            <TextInput label="Revision Note" value={regenerationNotes[page.id] || ''} onChange={(v) => setRegenerationNotes(prev => ({ ...prev, [page.id]: v }))} placeholder="Changes for art/text..." />
                            <PillButton variant="outline" className="w-full" icon={<span className="material-symbols-outlined">refresh</span>} onClick={() => handleRegenerate(page.id)} disabled={isGenerating}>Regenerate Page</PillButton>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col items-center">
                        <div className="relative w-full max-w-3xl aspect-[3/4] bg-black/40 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10">
                          <img src={`data:${displayPage.mimeType};base64,${displayPage.base64}`} className="w-full h-full object-contain" alt={`Page ${page.pageNumber}`} />
                          <div className="absolute top-8 left-8 pointer-events-none">
                            <div className="px-5 py-2.5 bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10 text-[12px] font-black uppercase tracking-widest shadow-xl">Page {page.pageNumber}</div>
                          </div>
                        </div>
                        {isRev && (
                          <div className="flex gap-2 mt-4">
                            <PillButton variant="solid" onClick={() => handleKeepVersion(page.id)}>Keep New Version</PillButton>
                            <PillButton variant="outline" onClick={() => handleRevertVersion(page.id)}>Discard</PillButton>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="h-40 shrink-0" />
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 99px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
      `}</style>
    </div>
  );
}