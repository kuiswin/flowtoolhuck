import React, { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpOverlay: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'basics' | 'shortcuts' | 'ai' | 'export'>('basics');

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center animate-fade-in px-4">
      <div className="absolute inset-0 bg-[#0e0e0e]/95 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-[#161616] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-blue-400 text-[28px]">help_center</span>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white">Screen Script Help</h2>
              <p className="text-[11px] text-white/40 uppercase tracking-widest font-medium">Interactive Guide & Shortcuts</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 bg-black/20 shrink-0">
          <TabButton active={activeTab === 'basics'} onClick={() => setActiveTab('basics')} icon="auto_stories" label="The Basics" />
          <TabButton active={activeTab === 'shortcuts'} onClick={() => setActiveTab('shortcuts')} icon="keyboard" label="Shortcuts" />
          <TabButton active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} icon="auto_awesome" label="AI Studio" />
          <TabButton active={activeTab === 'export'} onClick={() => setActiveTab('export')} icon="file_download" label="Exporting" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 dark-scrollbar">
          {activeTab === 'basics' && (
            <div className="space-y-8 animate-fade-in">
              <HelpSection title="Block-Based Writing">
                <p className="text-white/70 leading-relaxed">
                  Screen Script uses a unique block-based architecture. Every element of your script—Scene Headings, Dialogue, Actions—is a discrete block. This allows you to easily move, edit, and focus on specific parts of your story.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  <FeatureItem icon="edit" title="Edit Mode" desc="Standard writing mode. Click any block to type. Blocks auto-format based on their type." />
                  <FeatureItem icon="ads_click" title="Select Mode" desc="Allows you to select whole blocks to move them up/down or delete them quickly." />
                </div>
              </HelpSection>

              <HelpSection title="Workspace Themes">
                <p className="text-white/70 leading-relaxed mb-4">
                  Adjust the environment to suit your writing mood. You can toggle between Dark, Light, and Sepia modes in the Sidebar.
                </p>
                <div className="flex gap-4">
                  <div className="flex-1 p-4 rounded-xl border border-white/5 bg-black/20 flex items-center gap-3">
                    <span className="material-symbols-outlined text-blue-400">image</span>
                    <span className="text-sm text-white/80 font-medium">Custom Backgrounds with adjustable blur & opacity.</span>
                  </div>
                </div>
              </HelpSection>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                <Shortcut icon="keyboard_tab" keyName="Tab" desc="Cycle through block types (Scene → Action → Char...)" />
                <Shortcut icon="keyboard_return" keyName="Enter" desc="Create next logical block (Char → Dialogue → Char)" />
                <Shortcut icon="arrow_upward" keyName="Up / Down" desc="Navigate between script blocks" />
                <Shortcut icon="undo" keyName="Ctrl + Z" desc="Undo last action" />
                <Shortcut icon="redo" keyName="Ctrl + Y" desc="Redo last action" />
                <Shortcut icon="backspace" keyName="Backspace" desc="Merge or delete empty blocks" />
                <Shortcut icon="close" keyName="Escape" desc="Exit Select Mode or close modals" />
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-8 animate-fade-in">
              <HelpSection title="Creative Assistance">
                <p className="text-white/70 leading-relaxed mb-6">
                  The AI Studio (found by clicking the spark icon in the bottom bar) provides contextual tools to help you when you're stuck.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                    <h4 className="text-blue-400 font-bold text-sm mb-2 uppercase tracking-wide">Scene Intelligence</h4>
                    <p className="text-xs text-white/60 leading-relaxed">Generates professional loglines and summaries based on your current scene context.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                    <h4 className="text-purple-400 font-bold text-sm mb-2 uppercase tracking-wide">Dialogue Studio</h4>
                    <p className="text-xs text-white/60 leading-relaxed">Select a character name and request 3 distinct dialogue options to break through writer's block.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                    <h4 className="text-amber-400 font-bold text-sm mb-2 uppercase tracking-wide">Deep Analysis</h4>
                    <p className="text-xs text-white/60 leading-relaxed">Provides feedback on emotional beats, pacing, and subtextual transitions.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                    <h4 className="text-emerald-400 font-bold text-sm mb-2 uppercase tracking-wide">Haiku Inspiration</h4>
                    <p className="text-xs text-white/60 leading-relaxed">A quick creative meditation tool to set the mood for your next sequence.</p>
                  </div>
                </div>
              </HelpSection>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-8 animate-fade-in">
              <HelpSection title="Professional Delivery">
                <p className="text-white/70 leading-relaxed mb-6">
                  Ready to share? Screen Script supports industry-standard formatting for your exports. Choose your format in the Sidebar or bottom bar.
                </p>
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Format: RTF (Rich Text)</span>
                    <p className="text-sm text-white/80 mt-1">Preserves industry-standard indentation, margins, and the Courier Prime font. Perfect for printing or sharing with collaborators.</p>
                  </div>
                  <div className="p-4 rounded-xl border border-white/5 bg-white/5">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Format: TXT (Plain Text)</span>
                    <p className="text-sm text-white/80 mt-1">A lightweight text file that maintains capitalizations and block ordering. Ideal for backup or loading into other script software.</p>
                  </div>
                </div>
              </HelpSection>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-black/40 flex justify-center">
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Screen Script v1.0 • Built for Screenwriters</p>
        </div>
      </div>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: string; label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-all font-bold text-xs uppercase tracking-wider ${active ? 'border-blue-500 text-blue-400 bg-white/5' : 'border-transparent text-white/30 hover:text-white/60'}`}
  >
    <span className="material-symbols-outlined text-[18px]">{icon}</span>
    {label}
  </button>
);

const HelpSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="flex flex-col gap-3">
    <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
    {children}
  </div>
);

const FeatureItem: React.FC<{ icon: string; title: string; desc: string }> = ({ icon, title, desc }) => (
  <div className="p-4 rounded-xl border border-white/5 bg-white/5 flex gap-4">
    <div className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-blue-400/10 text-blue-400">
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
    </div>
    <div>
      <h4 className="text-sm font-bold text-white">{title}</h4>
      <p className="text-xs text-white/50 mt-1 leading-relaxed">{desc}</p>
    </div>
  </div>
);

const Shortcut: React.FC<{ icon: string; keyName: string; desc: string }> = ({ icon, keyName, desc }) => (
  <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 group">
    <div className="flex items-center gap-3">
      <span className="material-symbols-outlined text-white/20 group-hover:text-blue-400 transition-colors">{icon}</span>
      <span className="text-xs text-white/70 font-medium group-hover:text-white transition-colors">{desc}</span>
    </div>
    <div className="px-2 py-1 rounded bg-white/10 border border-white/10 min-w-[40px] text-center">
      <span className="text-[10px] font-bold text-white/60 uppercase">{keyName}</span>
    </div>
  </div>
);