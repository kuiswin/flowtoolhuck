import React, { useState } from 'react';
import { Flow } from 'flow-sdk';
import { SectionLabel, SegmentedToggle, PillButton, RangeSlider, TextInput, FieldDropdown } from './Primitives';
import { Theme, AppState, TitlePage } from '../types';

interface Props {
  state: AppState;
  setState: (val: AppState | ((prev: AppState) => AppState)) => void;
  pushState: (state: AppState) => void;
  characters: string[];
  setCharacters: (val: string[] | ((prev: string[]) => string[])) => void;
  environments: string[];
  setEnvironments: (val: string[] | ((prev: string[]) => string[])) => void;
  spellCheckEnabled: boolean;
  setSpellCheckEnabled: (val: boolean) => void;
  theme: Theme;
  onSetTheme: (theme: Theme) => void;
  onSetBackground: () => void;
  onClearBackground: () => void;
  onSelectCharacter: (name: string) => void;
  onSelectEnvironment: (name: string) => void;
  onImport: () => void;
  exportFormat: 'txt' | 'rtf';
  onSetExportFormat: (format: 'txt' | 'rtf') => void;
  onExport: () => void;
}

export const Sidebar: React.FC<Props> = ({ 
  state,
  setState,
  pushState,
  characters, 
  setCharacters, 
  environments,
  setEnvironments,
  spellCheckEnabled, 
  setSpellCheckEnabled, 
  theme,
  onSetTheme,
  onSetBackground,
  onClearBackground,
  onSelectCharacter,
  onSelectEnvironment,
  onImport,
  exportFormat,
  onSetExportFormat,
  onExport
}) => {
  const [newName, setNewName] = useState('');
  const [newEnv, setNewEnv] = useState('');
  const [envPrefix, setEnvPrefix] = useState<'INT.' | 'EXT.'>('INT.');
  const [isInterfaceOpen, setIsInterfaceOpen] = useState(false);
  const [isTitlePageOpen, setIsTitlePageOpen] = useState(true);

  const addChar = () => {
    if (!newName.trim()) return;
    setCharacters([...characters, newName.trim().toUpperCase()]);
    setNewName('');
  };

  const addEnv = () => {
    if (!newEnv.trim()) return;
    const fullEnv = `${envPrefix} ${newEnv.trim().toUpperCase()}`;
    if (!environments.includes(fullEnv)) {
      setEnvironments([...environments, fullEnv]);
    }
    setNewEnv('');
  };

  const updateBackgroundSetting = (key: 'backgroundOpacity' | 'backgroundBlur', value: number) => {
    const newState = { ...state, [key]: value };
    setState(newState);
    
    if ((window as any)._settingTimeout) clearTimeout((window as any)._settingTimeout);
    (window as any)._settingTimeout = setTimeout(() => {
      pushState(newState);
    }, 500);
  };

  const updateTitlePage = (updates: Partial<TitlePage>) => {
    const nextState = { ...state, titlePage: { ...state.titlePage, ...updates } };
    setState(nextState);
    
    if ((window as any)._titleTimeout) clearTimeout((window as any)._titleTimeout);
    (window as any)._titleTimeout = setTimeout(() => {
      pushState(nextState);
    }, 1000);
  };

  const setCoverImage = async () => {
    try {
      const media = await Flow.media.select({ filter: 'image' });
      updateTitlePage({ coverImage: `data:${media.mimeType};base64,${media.base64}` });
    } catch (err) {
      console.error("Failed to select cover image", err);
    }
  };

  return (
    <div className="relative border-r flex flex-col items-start px-[10px] py-[12px] w-[260px] h-full shrink-0 theme-transition bg-[var(--sidebar-bg)] z-20" style={{ borderColor: 'var(--border-color)' }}>
      <div className="flex flex-col gap-[24px] items-start w-full h-full overflow-y-auto dark-scrollbar pr-1.5">
        
        {/* Interface Settings */}
        <div className="flex flex-col gap-2 items-start w-full shrink-0">
          <button 
            onClick={() => setIsInterfaceOpen(!isInterfaceOpen)}
            className="flex items-center justify-between w-full hover:bg-white/5 p-1 rounded-lg transition-colors group"
          >
            <SectionLabel>Interface Settings</SectionLabel>
            <span className={`material-symbols-outlined text-[16px] text-[var(--text-muted)] transition-transform duration-300 ${isInterfaceOpen ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </button>
          
          {isInterfaceOpen && (
            <div className="flex flex-col gap-3 w-full animate-fade-in pl-1">
              <SegmentedToggle 
                value={theme} 
                onChange={(v) => onSetTheme(v as Theme)}
                items={[
                  { value: 'dark', label: 'Dark', icon: <span className="material-symbols-outlined text-[14px]">dark_mode</span> },
                  { value: 'light', label: 'Light', icon: <span className="material-symbols-outlined text-[14px]">light_mode</span> },
                  { value: 'sepia', label: 'Sepia', icon: <span className="material-symbols-outlined text-[14px]">history_edu</span> }
                ]}
              />

              <div className="flex flex-col gap-2 pt-1 border-t border-[var(--border-color)]">
                <div className="flex gap-1">
                  <PillButton 
                    variant="outline" 
                    onClick={onSetBackground}
                    className="flex-1 !h-[30px] !text-[9px] !border-[var(--border-color)] !text-[var(--text-secondary)]"
                    icon={<span className="material-symbols-outlined text-[14px]">image</span>}
                  >
                    {state.backgroundImage ? 'Change Image' : 'Set Background'}
                  </PillButton>
                  {state.backgroundImage && (
                    <button 
                      onClick={onClearBackground}
                      className="w-[30px] h-[30px] flex items-center justify-center rounded-xl border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                      title="Clear Background"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  )}
                </div>

                {state.backgroundImage && (
                  <div className="flex flex-col gap-2 px-1">
                    <RangeSlider 
                      label="Opacity" 
                      value={state.backgroundOpacity ?? 20} 
                      min={0} 
                      max={100} 
                      formatValue={(v) => `${v}%`}
                      onChange={(v) => updateBackgroundSetting('backgroundOpacity', v)} 
                    />
                    <RangeSlider 
                      label="Blur" 
                      value={state.backgroundBlur ?? 4} 
                      min={0} 
                      max={20} 
                      formatValue={(v) => `${v}px`}
                      onChange={(v) => updateBackgroundSetting('backgroundBlur', v)} 
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Title Page Management */}
        <div className="flex flex-col gap-2 items-start w-full shrink-0 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
          <button 
            onClick={() => setIsTitlePageOpen(!isTitlePageOpen)}
            className="flex items-center justify-between w-full hover:bg-white/5 p-1 rounded-lg transition-colors group"
          >
            <SectionLabel>Title Page</SectionLabel>
            <span className={`material-symbols-outlined text-[16px] text-[var(--text-muted)] transition-transform duration-300 ${isTitlePageOpen ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </button>
          
          {isTitlePageOpen && (
            <div className="flex flex-col gap-3 w-full animate-fade-in pl-1">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between px-1 mb-2">
                  <p className="text-[10px] text-[var(--text-muted)]">Show Title Page</p>
                  <button 
                    onClick={() => updateTitlePage({ show: !state.titlePage.show })}
                    className={`w-8 h-4 rounded-full relative transition-all ${state.titlePage.show ? 'bg-blue-500' : 'bg-[var(--border-color)]'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${state.titlePage.show ? 'left-4.5' : 'left-0.5'}`} />
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <p className="text-[9px] text-[var(--text-muted)] pl-1">Cover Artwork</p>
                    <div className="flex gap-1">
                      <PillButton 
                        variant="outline" 
                        onClick={setCoverImage}
                        className="flex-1 !h-[30px] !text-[9px] !border-[var(--border-color)] !text-[var(--text-secondary)]"
                        icon={<span className="material-symbols-outlined text-[14px]">{state.titlePage.coverImage ? 'edit' : 'add_photo_alternate'}</span>}
                      >
                        {state.titlePage.coverImage ? 'Change Art' : 'Add Cover'}
                      </PillButton>
                      {state.titlePage.coverImage && (
                        <button 
                          onClick={() => updateTitlePage({ coverImage: undefined })}
                          className="w-[30px] h-[30px] flex items-center justify-center rounded-xl border border-[var(--border-color)] text-[var(--text-muted)] hover:text-red-400 transition-all"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <p className="text-[9px] text-[var(--text-muted)] pl-1">Script Title</p>
                    <TextInput 
                      value={state.titlePage.title} 
                      onChange={(v) => updateTitlePage({ title: v })}
                      placeholder="SCRIPT TITLE"
                      className="!h-[34px] !py-2 !text-[var(--text-primary)] !bg-black/10"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-[9px] text-[var(--text-muted)] pl-1">Author</p>
                    <TextInput 
                      value={state.titlePage.author} 
                      onChange={(v) => updateTitlePage({ author: v })}
                      placeholder="Author Name"
                      className="!h-[34px] !py-2 !text-[var(--text-primary)] !bg-black/10"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="text-[9px] text-[var(--text-muted)] pl-1">Date / Version</p>
                    <TextInput 
                      value={state.titlePage.date} 
                      onChange={(v) => updateTitlePage({ date: v })}
                      placeholder="Date"
                      className="!h-[34px] !py-2 !text-[var(--text-primary)] !bg-black/10"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Environments List */}
        <div className="flex flex-col gap-2 items-start w-full shrink-0 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
          <SectionLabel>Scene Settings</SectionLabel>
          <div className="flex flex-col gap-1 w-full pr-1">
            {environments.map((env, i) => (
              <div key={env + i} className="group relative">
                <button 
                  onClick={() => onSelectEnvironment(env)}
                  className="w-full text-left px-3 py-2 rounded-xl border border-[var(--border-color)] bg-black/5 hover:bg-black/10 transition-all text-[10px] font-medium tracking-wider truncate text-[var(--text-secondary)]"
                >
                  {env}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setEnvironments(environments.filter((_, idx) => idx !== i)); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all text-[var(--text-muted)]"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            ))}
            <div className="pt-2 flex flex-col gap-1">
              <div className="flex gap-1">
                <button 
                  onClick={() => setEnvPrefix('INT.')}
                  className={`flex-1 text-[9px] py-1 rounded-md border transition-all ${envPrefix === 'INT.' ? 'bg-[var(--text-primary)] text-[var(--bg-color)] border-[var(--text-primary)]' : 'border-[var(--border-color)] text-[var(--text-muted)]'}`}
                >
                  INT.
                </button>
                <button 
                  onClick={() => setEnvPrefix('EXT.')}
                  className={`flex-1 text-[9px] py-1 rounded-md border transition-all ${envPrefix === 'EXT.' ? 'bg-[var(--text-primary)] text-[var(--bg-color)] border-[var(--text-primary)]' : 'border-[var(--border-color)] text-[var(--text-muted)]'}`}
                >
                  EXT.
                </button>
              </div>
              <div className="flex gap-1">
                <input 
                  value={newEnv} 
                  onChange={e => setNewEnv(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addEnv()}
                  placeholder="LOCATION"
                  className="flex-1 bg-transparent border border-[var(--border-color)] rounded-xl px-3 py-1.5 text-[10px] text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)] transition-colors"
                />
                <button 
                  onClick={addEnv}
                  className="w-[30px] h-[30px] shrink-0 flex items-center justify-center rounded-xl bg-[var(--text-muted)] text-[var(--bg-color)] hover:bg-[var(--text-secondary)] transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Character List */}
        <div className="flex flex-col gap-2 items-start w-full shrink-0 border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
          <SectionLabel>Character Cast</SectionLabel>
          <div className="flex flex-col gap-1 w-full pr-1">
            {characters.map((name, i) => (
              <div key={name + i} className="group relative">
                <button 
                  onClick={() => onSelectCharacter(name)}
                  className="w-full text-left px-3 py-2 rounded-xl border border-[var(--border-color)] bg-black/5 hover:bg-black/10 transition-all text-[10px] font-medium tracking-wider text-[var(--text-secondary)]"
                >
                  {name}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setCharacters(characters.filter((_, idx) => idx !== i)); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all text-[var(--text-muted)]"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            ))}
            <div className="pt-2 flex gap-1">
              <input 
                value={newName} 
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addChar()}
                placeholder="NAME"
                className="flex-1 bg-transparent border border-[var(--border-color)] rounded-xl px-3 py-1.5 text-[10px] text-[var(--text-primary)] outline-none focus:border-[var(--text-secondary)] transition-colors"
              />
              <button 
                onClick={addChar}
                className="w-[30px] h-[30px] shrink-0 flex items-center justify-center rounded-xl bg-[var(--text-muted)] text-[var(--bg-color)] hover:bg-[var(--text-secondary)] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Editor Settings */}
        <div className="flex flex-col gap-2 items-start w-full pt-4 border-t pb-10 shrink-0" style={{ borderColor: 'var(--border-color)' }}>
          <SectionLabel>Editor Options</SectionLabel>
          <div className="flex flex-col gap-2 w-full">
            <div className="flex flex-col gap-1 w-full">
               <p className="text-[10px] text-[var(--text-muted)] px-2 tracking-tight">Browser Spell Check</p>
               <SegmentedToggle 
                 value={spellCheckEnabled ? 'on' : 'off'} 
                 onChange={(v) => setSpellCheckEnabled(v === 'on')}
                 items={[
                   { value: 'on', label: 'On' },
                   { value: 'off', label: 'Off' }
                 ]}
               />
            </div>
            
            <div className="flex flex-col gap-1 pt-2">
              <PillButton 
                variant="outline" 
                onClick={onImport}
                className="!h-[32px] !text-[9px] !border-[var(--border-color)] !text-[var(--text-secondary)]"
                icon={<span className="material-symbols-outlined text-[14px]">upload_file</span>}
              >
                Import Script
              </PillButton>

              <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-white/5">
                <FieldDropdown 
                  label="Export Format"
                  value={exportFormat.toUpperCase()}
                  options={['TXT', 'RTF']}
                  onChange={(v) => onSetExportFormat(v.toLowerCase() as 'txt' | 'rtf')}
                  className="w-full !h-[42px]"
                />
                <PillButton 
                  variant="solid" 
                  onClick={onExport}
                  className="!h-[32px] !text-[9px] !bg-[var(--text-primary)] !text-[var(--bg-color)]"
                  icon={<span className="material-symbols-outlined text-[14px]">download</span>}
                >
                  Export Script
                </PillButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};