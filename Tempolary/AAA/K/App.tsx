import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { Flow } from 'flow-sdk';
import { PillButton, FieldDropdown } from './components/Primitives';
import { ScriptBlock, BlockType, Theme, AppState, TitlePage } from './types';
import { Block } from './components/Block';
import { Sidebar } from './components/Sidebar';
import { AIPanel } from './components/AIPanel';
import { ConfirmationModal } from './components/ConfirmationModal';
import { HelpOverlay } from './components/HelpOverlay';
import { useHistory } from './hooks/useHistory';

export default function App() {
  const { 
    state, 
    setState,
    pushState, 
    undo, 
    redo, 
    canUndo, 
    canRedo 
  } = useHistory({
    blocks: [
      { 
        id: '1', 
        type: 'ACTION', 
        content: 'Remember to export your script to save your work. Click New Script to get started. Enjoy Screen Script.' 
      },
    ],
    characters: ['ARTHUR', 'CLAIRE'],
    environments: ['INT. COFFEE SHOP - DAY', 'EXT. CITY STREET - NIGHT'],
    theme: 'dark',
    backgroundImage: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=2000&auto=format&fit=crop',
    backgroundOpacity: 25,
    backgroundBlur: 6,
    titlePage: {
      show: true,
      title: 'Welcome to Screen Script.',
      author: 'Scroll down to read more',
      date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      coverImage: undefined
    }
  });

  const { blocks, characters, environments, theme, backgroundImage, backgroundOpacity = 25, backgroundBlur = 6, titlePage } = state;
  const [activeBlockId, setActiveBlockId] = useState<string | null>('1');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [spellCheckEnabled, setSpellCheckEnabled] = useState(true);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'txt' | 'rtf'>('txt');
  const [zoom, setZoom] = useState(100);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isNewScriptConfirmOpen, setIsNewScriptConfirmOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  
  // Suppression logic
  const [warningSuppressedUntil, setWarningSuppressedUntil] = useState<number | null>(null);
  const [suppressUntilNewScript, setSuppressUntilNewScript] = useState(false);

  const [pages, setPages] = useState<ScriptBlock[][]>([blocks]);
  const blockRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const contentTimeoutRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check suppression expiry
  useEffect(() => {
    if (!warningSuppressedUntil) return;
    const interval = setInterval(() => {
      if (Date.now() > warningSuppressedUntil) {
        setWarningSuppressedUntil(null);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [warningSuppressedUntil]);

  // Prevention of accidental closure
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && blocks.length > 0) {
        e.preventDefault();
        e.returnValue = 'You have unexported changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, blocks]);

  useEffect(() => {
    const fontId = 'courier-prime-font';
    if (!document.getElementById(fontId)) {
      const link = document.createElement('link');
      link.id = fontId;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&swap';
      document.head.appendChild(link);
    }

    const themeId = 'script-studio-theme-vars';
    if (!document.getElementById(themeId)) {
      const style = document.createElement('style');
      style.id = themeId;
      style.textContent = `
        :root {
          --bg-color: #0e0e0e;
          --sidebar-bg: #161616;
          --editor-bg: #ffffff;
          --editor-text: #000000;
          --editor-muted: #555555;
          --text-primary: #ffffff;
          --text-secondary: rgba(255,255,255,0.7);
          --text-muted: rgba(255,255,255,0.4);
          --border-color: rgba(255,255,255,0.1);
          --selection-bg: rgba(66, 133, 244, 0.3);
          --warning-bg: #2d1a1a;
          --warning-text: #fca5a5;
          --warning-border: rgba(239, 68, 68, 0.2);
        }
        [data-theme='light'] {
          --bg-color: #f5f5f5;
          --sidebar-bg: #ffffff;
          --editor-bg: #ffffff;
          --editor-text: #000000;
          --editor-muted: #555555;
          --text-primary: #1a1a1a;
          --text-secondary: #444444;
          --text-muted: #888888;
          --border-color: rgba(0,0,0,0.1);
          --selection-bg: rgba(66, 133, 244, 0.2);
          --warning-bg: #fef3c7;
          --warning-text: #92400e;
          --warning-border: #fde68a;
        }
        [data-theme='sepia'] {
          --bg-color: #2b2621;
          --sidebar-bg: #36302a;
          --editor-bg: #f4ecd8;
          --editor-text: #433422;
          --editor-muted: #705e4c;
          --text-primary: #f4ecd8;
          --text-secondary: rgba(244, 236, 216, 0.7);
          --text-muted: rgba(244, 236, 216, 0.4);
          --border-color: rgba(244, 236, 216, 0.1);
          --selection-bg: rgba(139, 69, 19, 0.3);
          --warning-bg: #433422;
          --warning-text: #f4ecd8;
          --warning-border: rgba(244, 236, 216, 0.2);
        }
        .script-font { font-family: 'Courier Prime', 'Courier New', Courier, monospace; }
        .page-shadow { box-shadow: 0 10px 40px rgba(0,0,0,0.3); }
        .theme-transition { transition: all 0.3s ease; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
        .dark-scrollbar::-webkit-scrollbar { width: 6px; }
        .dark-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .dark-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
        .dark-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        .zoom-transition { transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
        @keyframes dropdown-enter { from { opacity: 0; transform: scale(0.95) translateY(-5px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-dropdown { animation: dropdown-enter 0.15s ease-out forwards; }
        @keyframes slide-down { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-down { animation: slide-down 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  useLayoutEffect(() => {
    const PAGE_HEIGHT = 1056; 
    const TOP_MARGIN = 96;   
    const BOTTOM_MARGIN = 96;
    const PAGE_CONTENT_LIMIT = PAGE_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN;
    
    const newPages: ScriptBlock[][] = [[]];
    let currentPageIndex = 0;
    let currentHeight = 0;

    const getEstimatedLines = (block: ScriptBlock) => {
      let charsPerLine = 60;
      if (block.type === 'CHARACTER') charsPerLine = 30;
      if (block.type === 'DIALOGUE') charsPerLine = 42;
      if (block.type === 'PARENTHETICAL') charsPerLine = 32;
      
      const text = block.content || '';
      const explicitLines = text.split('\n').length;
      const wrappedLines = text.split('\n').reduce((acc, line) => acc + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
      return Math.max(explicitLines, wrappedLines);
    };

    blocks.forEach((block) => {
      const lines = getEstimatedLines(block);
      let blockHeight = lines * 22; 

      if (block.type === 'SCENE_HEADING') blockHeight += 48;
      else if (block.type === 'CHARACTER') blockHeight += 28;
      else if (block.type === 'TRANSITION') blockHeight += 64;
      else blockHeight += 16;

      const isCharacterNameAtBottom = block.type === 'CHARACTER' && (currentHeight + blockHeight + 40 > PAGE_CONTENT_LIMIT);
      
      if ((currentHeight + blockHeight > PAGE_CONTENT_LIMIT || isCharacterNameAtBottom) && newPages[currentPageIndex].length > 0) {
        currentPageIndex++;
        newPages[currentPageIndex] = [block];
        currentHeight = blockHeight;
      } else {
        newPages[currentPageIndex].push(block);
        currentHeight += blockHeight;
      }
    });

    setPages(newPages);
  }, [blocks]);

  const handleZoom = useCallback((direction: 'IN' | 'OUT') => {
    setZoom(prev => {
      if (direction === 'IN') return Math.min(prev + 10, 200);
      return Math.max(prev - 10, 50);
    });
  }, []);

  const handleNewScript = useCallback(() => {
    const blankState: AppState = {
      blocks: [],
      characters: [],
      environments: [],
      theme: state.theme,
      backgroundImage: state.backgroundImage,
      backgroundOpacity: state.backgroundOpacity,
      backgroundBlur: state.backgroundBlur,
      titlePage: {
        show: true,
        title: 'UNTITLED SCRIPT',
        author: 'A SCREENWRITER',
        date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        coverImage: undefined
      }
    };
    pushState(blankState);
    setActiveBlockId(null);
    setIsNewScriptConfirmOpen(false);
    setIsSelectionMode(false);
    setIsDirty(false); 
    setSuppressUntilNewScript(false); // Reset suppression on new script
  }, [state, pushState]);

  const handleMoveFocus = useCallback((id: string, direction: 'UP' | 'DOWN', position: 'START' | 'END') => {
    const index = blocks.findIndex(b => b.id === id);
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < blocks.length) {
      const targetId = blocks[targetIndex].id;
      setActiveBlockId(targetId);
      
      setTimeout(() => {
        const el = blockRefs.current[targetId];
        if (el) {
          el.focus();
          const pos = position === 'START' ? 0 : el.value.length;
          el.setSelectionRange(pos, pos);
        }
      }, 0);
    }
  }, [blocks]);

  const addBlock = useCallback((type: BlockType, index?: number, initialContent?: string) => {
    const newBlock: ScriptBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      content: initialContent ?? '',
    };
    
    const insertionPoint = index !== undefined ? index + 1 : blocks.length;
    const newBlocks = [...blocks];
    newBlocks.splice(insertionPoint, 0, newBlock);
    
    pushState({ ...state, blocks: newBlocks });
    setActiveBlockId(newBlock.id);
    setIsDirty(true);
  }, [blocks, state, pushState]);

  const updateBlock = useCallback((id: string, content: string) => {
    const newBlocks = blocks.map(b => b.id === id ? { ...b, content } : b);
    setState(prev => ({ ...prev, blocks: newBlocks }));
    setIsDirty(true);
    
    if (contentTimeoutRef.current) clearTimeout(contentTimeoutRef.current);
    contentTimeoutRef.current = window.setTimeout(() => {
      pushState({ ...state, blocks: newBlocks });
    }, 1000);
  }, [blocks, state, pushState, setState]);

  const handleMergeBlocks = useCallback((sourceId: string, targetId: string) => {
    const sourceBlock = blocks.find(b => b.id === sourceId);
    const targetBlock = blocks.find(b => b.id === targetId);
    if (!sourceBlock || !targetBlock) return;

    const combinedContent = targetBlock.content + sourceBlock.content;
    const newBlocks = blocks.filter(b => b.id !== sourceId)
      .map(b => b.id === targetId ? { ...b, content: combinedContent } : b);
    
    pushState({ ...state, blocks: newBlocks });
    setActiveBlockId(targetId);
    setIsDirty(true);
    window.dispatchEvent(new CustomEvent('set-cursor', { 
      detail: { id: targetId, position: targetBlock.content.length } 
    }));
  }, [blocks, state, pushState]);

  const handleTypeChange = useCallback((id: string, newType: BlockType) => {
    const newBlocks = blocks.map(b => b.id === id ? { ...b, type: newType } : b);
    pushState({ ...state, blocks: newBlocks });
    setIsDirty(true);
  }, [blocks, state, pushState]);

  const deleteBlock = useCallback((id: string) => {
    const newBlocks = blocks.filter(b => id !== b.id);
    pushState({ ...state, blocks: newBlocks });
    setIsDirty(true);
    setIsDeleteConfirmOpen(false);
  }, [blocks, state, pushState]);

  const moveBlock = useCallback((id: string, direction: 'UP' | 'DOWN') => {
    const index = blocks.findIndex(b => b.id === id);
    if (index === -1) return;
    if (direction === 'UP' && index === 0) return;
    if (direction === 'DOWN' && index === blocks.length - 1) return;

    const newBlocks = [...blocks];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    
    pushState({ ...state, blocks: newBlocks });
    setActiveBlockId(id);
    setIsDirty(true);
  }, [blocks, state, pushState]);

  const clearBlock = useCallback((id: string) => {
    const newBlocks = blocks.map(b => b.id === id ? { ...b, content: '' } : b);
    pushState({ ...state, blocks: newBlocks });
    setIsDirty(true);
  }, [blocks, state, pushState]);

  const handleEditAction = async (action: string) => {
    if (!activeBlockId) return;
    const block = blocks.find(b => b.id === activeBlockId);
    if (!block) return;

    try {
      switch (action) {
        case 'Cut':
          await navigator.clipboard.writeText(block.content);
          clearBlock(activeBlockId);
          break;
        case 'Copy':
          await navigator.clipboard.writeText(block.content);
          break;
        case 'Paste':
          const text = await navigator.clipboard.readText();
          updateBlock(activeBlockId, block.content + text);
          break;
        case 'Clear':
          clearBlock(activeBlockId);
          break;
      }
    } catch (err) {
      console.error("Clipboard action failed", err);
    }
  };

  const handleExport = async () => {
    let content = '';
    let mimeType = '';
    let ext = exportFormat;

    if (exportFormat === 'txt') {
      content = [
        titlePage.show ? `${titlePage.title.toUpperCase()}\n\nby\n\n${titlePage.author}\n\n${titlePage.date}\n\n\n` : '',
        ...blocks.map(b => {
          switch(b.type) {
            case 'SCENE_HEADING': return `\n${b.content.toUpperCase()}\n`;
            case 'CHARACTER': return `\n          ${b.content.toUpperCase()}`;
            case 'PARENTHETICAL': return `          (${b.content})`;
            case 'DIALOGUE': return `     ${b.content}`;
            case 'TRANSITION': return `\n                                ${b.content.toUpperCase()}\n`;
            default: return `\n${b.content}\n`;
          }
        })
      ].join('\n');
      mimeType = 'text/plain';
    } else {
      content = generateRTF(pages, titlePage);
      mimeType = 'application/rtf';
    }

    const filename = `${titlePage.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'script'}.${ext}`;
    const base64 = btoa(unescape(encodeURIComponent(content)));

    await Flow.download({ base64, mimeType, filename });
    setIsDirty(false); 
  };

  const generateRTF = (pages: ScriptBlock[][], titlePage: TitlePage) => {
    const escapeRTF = (text: string) => text.replace(/\\/g, String.fromCharCode(92, 92)).replace(/{/g, '\\{').replace(/}/g, '\\}').replace(/\n/g, '\\par ');
    // Twips for 8.5x11: 12240 x 15840. Standard left margin 1.5" (2160 twips).
    const header = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Courier Prime;}{\\f1 Courier;}}\\viewkind4\\uc1\\f0\\fs24\\paperw12240\\paperh15840\\margl2160\\margr1440\\margt1440\\margb1440 `;
    let body = '';

    if (titlePage.show) {
      body += `\\qc \\par \\par \\par \\par \\par \\par \\par \\par \\par \\par \\par \\par \\par \\par \\par \\par `;
      body += `\\b \\fs32 ${escapeRTF(titlePage.title.toUpperCase())} \\b0 \\par \\par `;
      body += `\\fs24 by \\par \\par `;
      body += `\\b ${escapeRTF(titlePage.author.toUpperCase())} \\b0 \\par \\par \\par \\par \\par \\par \\par \\par \\par \\par `;
      body += `\\fs20 ${escapeRTF(titlePage.date)} \\par `;
      body += `\\page `; 
    }

    body += `\\ql `;
    pages.forEach((pageBlocks, pageIndex) => {
      // Start each page with a clean layout
      body += `\\pard\\ql\\f0\\fs24 `;
      pageBlocks.forEach(block => {
        const text = escapeRTF(block.content);
        switch (block.type) {
          // indents are relative to the 1.5" (2160 twip) margin
          case 'SCENE_HEADING': body += `\\li0 \\b ${text.toUpperCase()} \\b0 \\par \\par `; break;
          case 'ACTION': body += `\\li0 ${text} \\par \\par `; break;
          case 'CHARACTER': body += `\\li3168 \\b ${text.toUpperCase()} \\b0 \\par `; break; // ~3.7" from edge
          case 'PARENTHETICAL': body += `\\li2304 \\i (${text}) \\i0 \\par `; break; // ~3.1" from edge
          case 'DIALOGUE': body += `\\li1440 \\ri2880 ${text} \\par \\par `; break; // ~2.5" from edge
          case 'TRANSITION': body += `\\qr \\li0 \\b ${text.toUpperCase()} \\b0 \\par \\par `; break;
          default: body += `\\li0 ${text} \\par \\par `;
        }
      });
      // Append explicit page break to mirror visual separation on screen
      if (pageIndex < pages.length - 1) {
        body += `\\page `;
      }
    });
    return `${header}${body}}`;
  };

  const currentSceneContext = useMemo(() => {
    if (!activeBlockId) return "";
    const activeIndex = blocks.findIndex(b => b.id === activeBlockId);
    let start = activeIndex;
    while (start > 0 && blocks[start].type !== 'SCENE_HEADING') start--;
    let end = activeIndex;
    while (end < blocks.length - 1 && blocks[end + 1].type !== 'SCENE_HEADING') end++;
    return blocks.slice(start, end + 1).map(b => `${b.type}: ${b.content}`).join('\n');
  }, [blocks, activeBlockId]);

  const handleSnooze = (option: string) => {
    if (option === 'Until New Script') {
      setSuppressUntilNewScript(true);
    } else {
      const minutes = parseInt(option.split(' ')[0]);
      setWarningSuppressedUntil(Date.now() + minutes * 60000);
    }
  };

  const isWarningVisible = isDirty && blocks.length > 0 && !suppressUntilNewScript && (!warningSuppressedUntil || Date.now() > warningSuppressedUntil);

  return (
    <div className="flex h-screen w-screen overflow-hidden theme-transition" data-theme={theme} style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".txt,.rtf" 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (event) => {
            let text = event.target?.result as string;
            const lines = text.split('\n');
            const newBlocks = lines.map(line => ({ id: Math.random().toString(36).substr(2, 9), type: 'ACTION' as BlockType, content: line.trim() })).filter(b => b.content);
            pushState({ ...state, blocks: newBlocks });
            setIsDirty(true);
          };
          reader.readAsText(file);
          e.target.value = '';
        }}
      />

      {backgroundImage && (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none transition-opacity duration-1000">
          <img src={backgroundImage} className="w-full h-full object-cover scale-105" style={{ opacity: backgroundOpacity / 100, filter: `blur(${backgroundBlur}px)` }} alt="" />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      <Sidebar 
        state={state} setState={setState} pushState={pushState}
        characters={characters} setCharacters={(v) => { pushState({ ...state, characters: typeof v === 'function' ? v(characters) : v }); setIsDirty(true); }}
        environments={environments} setEnvironments={(v) => { pushState({ ...state, environments: typeof v === 'function' ? v(environments) : v }); setIsDirty(true); }}
        spellCheckEnabled={spellCheckEnabled} setSpellCheckEnabled={setSpellCheckEnabled}
        theme={theme} onSetTheme={(t) => pushState({ ...state, theme: t })}
        onSetBackground={async () => {
          const media = await Flow.media.select({ filter: 'image' });
          pushState({ ...state, backgroundImage: `data:${media.mimeType};base64,${media.base64}` });
        }}
        onClearBackground={() => pushState({ ...state, backgroundImage: undefined })}
        onSelectCharacter={(name) => addBlock('CHARACTER', undefined, name)}
        onSelectEnvironment={(env) => addBlock('SCENE_HEADING', undefined, env)}
        onImport={() => fileInputRef.current?.click()}
        exportFormat={exportFormat}
        onSetExportFormat={setExportFormat}
        onExport={handleExport}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-transparent z-10 relative">
        <div className="h-14 border-b bg-[var(--sidebar-bg)] flex items-center justify-between px-6 shrink-0 z-20 theme-transition" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsNewScriptConfirmOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-white/5 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">note_add</span>
              New Script
            </button>
            <button 
              onClick={() => setIsHelpOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold border border-[var(--border-color)] text-blue-400 hover:bg-blue-400/5 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">help</span>
              Help
            </button>
            <div className="w-px h-6 bg-[var(--border-color)]" />
            <div className="flex items-center bg-[var(--border-color)] rounded-xl p-0.5">
              <button 
                onClick={() => setIsSelectionMode(false)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all ${!isSelectionMode ? 'bg-[var(--text-primary)] text-[var(--bg-color)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                Edit
              </button>
              <button 
                onClick={() => setIsSelectionMode(true)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all ${isSelectionMode ? 'bg-[var(--text-primary)] text-[var(--bg-color)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              >
                <span className="material-symbols-outlined text-[16px]">ads_click</span>
                Select
              </button>
            </div>

            {isSelectionMode && activeBlockId && (
              <div className="flex items-center gap-1 border-l pl-4 animate-fade-in" style={{ borderColor: 'var(--border-color)' }}>
                <button onClick={() => moveBlock(activeBlockId, 'UP')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-[var(--text-primary)]" title="Move Up"><span className="material-symbols-outlined text-[20px]">arrow_upward</span></button>
                <button onClick={() => moveBlock(activeBlockId, 'DOWN')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-[var(--text-primary)]" title="Move Down"><span className="material-symbols-outlined text-[20px]">arrow_downward</span></button>
                <button onClick={() => clearBlock(activeBlockId)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-[var(--text-primary)]" title="Clear Block"><span className="material-symbols-outlined text-[20px]">backspace</span></button>
                <button onClick={() => setIsDeleteConfirmOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-red-400" title="Delete Block"><span className="material-symbols-outlined text-[20px]">delete</span></button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
             <FieldDropdown 
               label="Text" 
               value="Tools" 
               options={['Cut', 'Copy', 'Paste', 'Clear']} 
               onChange={handleEditAction}
               className="min-w-[90px] !h-[38px] !rounded-xl"
             />
             <div className="w-px h-8 bg-[var(--border-color)]" />
             <div className="flex items-center gap-1">
                <button onClick={() => handleZoom('OUT')} className="w-8 h-8 text-[var(--text-primary)] hover:bg-white/5 rounded-lg flex items-center justify-center transition-all"><span className="material-symbols-outlined text-[18px]">remove</span></button>
                <span className="text-[10px] font-bold w-10 text-center text-[var(--text-primary)]">{zoom}%</span>
                <button onClick={() => handleZoom('IN')} className="w-8 h-8 text-[var(--text-primary)] hover:bg-white/5 rounded-lg flex items-center justify-center transition-all"><span className="material-symbols-outlined text-[18px]">add</span></button>
             </div>
          </div>
        </div>

        {/* Unexported Changes Warning Banner */}
        {isWarningVisible && (
          <div className="bg-[var(--warning-bg)] text-[var(--warning-text)] border-b px-6 py-2 flex items-center justify-between z-20 animate-slide-down shrink-0 shadow-md transition-colors duration-300" style={{ borderColor: 'var(--warning-border)' }}>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px]">warning</span>
              <p className="text-[11px] font-bold uppercase tracking-wider">
                Unexported Changes: Export your work to avoid data loss.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <FieldDropdown 
                label="Snooze"
                value="Options"
                options={['5 Minutes', '10 Minutes', '15 Minutes', 'Until New Script']}
                onChange={handleSnooze}
                className="!min-w-[130px] !h-[32px] !rounded-lg border-none !bg-black/5"
              />
              <button 
                onClick={handleExport}
                className="bg-[var(--warning-text)] text-[var(--warning-bg)] px-3 py-1 rounded-lg text-[10px] font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Export Now
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto dark-scrollbar py-12 px-8 lg:px-12 bg-black/10">
          <div className="flex flex-col items-center gap-12 max-w-4xl mx-auto pb-48 zoom-transition origin-top" style={{ transform: `scale(${zoom / 100})` }}>
            {titlePage.show && (
              <div className="w-[816px] h-[1056px] bg-[var(--editor-bg)] border border-[var(--border-color)] page-shadow script-font relative theme-transition animate-fade-in flex flex-col items-center justify-center p-[1.5in] overflow-hidden shrink-0">
                {titlePage.coverImage && <img src={titlePage.coverImage} className="mb-12 max-h-[300px] w-auto object-contain border border-[var(--border-color)] shadow-sm" alt="" />}
                <div className="flex flex-col items-center text-center w-full max-w-lg mb-[200px]">
                  <h1 className="text-[18pt] font-bold uppercase mb-8 text-[var(--editor-text)] tracking-widest leading-normal">{titlePage.title || "UNTITLED SCRIPT"}</h1>
                  <p className="text-[12pt] text-[var(--editor-text)] mb-4">by</p>
                  <p className="text-[14pt] text-[var(--editor-text)] uppercase font-medium">{titlePage.author || "A SCREENWRITER"}</p>
                </div>
                <div className="absolute bottom-[1.5in] right-[1.5in] text-[12pt] text-[var(--editor-text)] opacity-80">{titlePage.date}</div>
              </div>
            )}

            {pages.map((pageBlocks, pageIndex) => (
              <div 
                key={pageIndex} 
                className="w-[816px] h-[1056px] p-[1in] bg-[var(--editor-bg)] border border-[var(--border-color)] page-shadow script-font relative theme-transition animate-fade-in overflow-hidden shrink-0"
                onClick={() => {
                  if (blocks.length === 0) addBlock('ACTION');
                }}
              >
                <div className="absolute top-[0.5in] right-[1in] text-[12pt] font-medium opacity-50 select-none z-30" style={{ color: 'var(--editor-text)' }}>{pageIndex + 1}.</div>
                <div className="flex flex-col relative z-20">
                  {pageBlocks.map((block) => {
                    const globalIndex = blocks.findIndex(b => b.id === block.id);
                    return (
                      <Block 
                        key={block.id}
                        ref={el => blockRefs.current[block.id] = el}
                        block={block}
                        isActive={activeBlockId === block.id}
                        isSelectionMode={isSelectionMode}
                        spellCheckEnabled={spellCheckEnabled}
                        onUpdate={content => updateBlock(block.id, content)}
                        onDelete={() => {
                          if (globalIndex > 0) handleMoveFocus(block.id, 'UP', 'END');
                          deleteBlock(block.id);
                        }}
                        onMerge={(targetId) => handleMergeBlocks(block.id, targetId)}
                        onFocus={() => setActiveBlockId(block.id)}
                        onFocusOut={() => setActiveBlockId(null)}
                        onFocusMove={(dir, pos) => handleMoveFocus(block.id, dir, pos)}
                        onTab={(shift) => {
                          const types: BlockType[] = ['SCENE_HEADING', 'ACTION', 'CHARACTER', 'DIALOGUE', 'PARENTHETICAL', 'TRANSITION'];
                          const idx = types.indexOf(block.type);
                          const nextIdx = shift ? (idx === 0 ? types.length - 1 : idx - 1) : (idx === types.length - 1 ? 0 : idx + 1);
                          handleTypeChange(block.id, types[nextIdx]);
                        }}
                        onEnter={() => {
                          let nextType: BlockType = 'ACTION';
                          if (block.type === 'SCENE_HEADING') nextType = 'ACTION';
                          if (block.type === 'CHARACTER') nextType = 'DIALOGUE';
                          if (block.type === 'DIALOGUE') nextType = 'CHARACTER';
                          if (block.type === 'PARENTHETICAL') nextType = 'DIALOGUE';
                          addBlock(nextType, globalIndex);
                        }}
                        onMergeNext={() => {
                          if (globalIndex < blocks.length - 1) handleMergeBlocks(blocks[globalIndex + 1].id, block.id);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-16 border-t bg-[var(--sidebar-bg)] flex items-center justify-between gap-2 px-6 shrink-0 z-10 theme-transition" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-1">
            <FormatButton icon="grid_view" label="Scene" onClick={() => addBlock('SCENE_HEADING')} />
            <FormatButton icon="notes" label="Action" onClick={() => addBlock('ACTION')} />
            <FormatButton icon="person" label="Char" onClick={() => addBlock('CHARACTER')} />
            <FormatButton icon="chat" label="Dialog" onClick={() => addBlock('DIALOGUE')} />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex gap-1 items-center bg-[var(--border-color)] rounded-xl p-1">
              <button onClick={undo} disabled={!canUndo} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-20 text-[var(--text-primary)]"><span className="material-symbols-outlined text-[20px]">undo</span></button>
              <button onClick={redo} disabled={!canRedo} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-20 text-[var(--text-primary)]"><span className="material-symbols-outlined text-[20px]">redo</span></button>
            </div>
            <button onClick={() => setIsAIPanelOpen(!isAIPanelOpen)} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all border border-[var(--border-color)] ${isAIPanelOpen ? 'bg-[var(--text-primary)] text-[var(--bg-color)]' : 'text-[var(--text-primary)] hover:bg-white/10'}`}><span className="material-symbols-outlined text-[20px]">auto_awesome</span></button>
            <div className="relative group">
               <PillButton variant="solid" onClick={handleExport} icon={<span className="material-symbols-outlined text-[18px]">download</span>} className="!w-auto px-4 !bg-[var(--text-primary)] !text-[var(--bg-color)]">Export .{exportFormat}</PillButton>
               {isDirty && blocks.length > 0 && (
                 <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-[var(--sidebar-bg)] shadow-sm animate-pulse" title="Unexported changes" />
               )}
            </div>
          </div>
        </div>
      </div>

      {isAIPanelOpen && (
        <AIPanel sceneContext={currentSceneContext} activeBlock={blocks.find(b => b.id === activeBlockId)} onClose={() => setIsAIPanelOpen(false)} onApplyDialogue={(content) => {
          const active = blocks.find(b => b.id === activeBlockId);
          if (active?.type === 'CHARACTER') addBlock('DIALOGUE', blocks.findIndex(b => b.id === activeBlockId), content);
          else if (active?.type === 'DIALOGUE') updateBlock(active.id, content);
        }} />
      )}

      <ConfirmationModal 
        isOpen={isDeleteConfirmOpen} 
        title="Delete Block?" 
        message="This action cannot be undone. All text in this script block will be permanently removed."
        onConfirm={() => activeBlockId && deleteBlock(activeBlockId)}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />

      <ConfirmationModal 
        isOpen={isNewScriptConfirmOpen} 
        title="Create New Script?" 
        message={isDirty && blocks.length > 0 
          ? "You have unexported changes! Creating a new script will permanently clear your current work. We recommend exporting first." 
          : "This will permanently clear your current script and all assets. Ensure you have exported your work if you wish to keep it."}
        confirmLabel="New Script"
        onConfirm={handleNewScript}
        onCancel={() => setIsNewScriptConfirmOpen(false)}
      />

      <HelpOverlay isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}

const FormatButton: React.FC<{ icon: string; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button onClick={onClick} className="flex flex-col items-center justify-center min-w-[56px] h-full hover:bg-[var(--border-color)] transition-colors group">
    <span className="material-symbols-outlined text-[18px] text-[var(--text-muted)] group-hover:text-[var(--text-primary)]">{icon}</span>
    <span className="text-[9px] font-medium text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]">{label}</span>
  </button>
);