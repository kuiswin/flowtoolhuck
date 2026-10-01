import React, { useState, useRef, useEffect } from 'react';

// Section Label
export const SectionLabel: React.FC<{ children: React.ReactNode; icon?: string }> = ({ children, icon }) => (
  <div className="flex items-center gap-2 px-1 mb-2">
    {icon && <span className="material-symbols-outlined text-[16px] text-white/50">{icon}</span>}
    <span className="text-[11px] font-medium text-[rgba(218,220,224,0.9)] tracking-[0.1px] uppercase">
      {children}
    </span>
  </div>
);

// Pill Button
export const PillButton: React.FC<{
  icon?: React.ReactNode; 
  children: React.ReactNode;
  variant?: 'filled' | 'outline' | 'solid' | 'danger'; 
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}> = ({ icon, children, variant = 'filled', onClick, disabled, className = '' }) => {
  const base = 'flex items-center gap-[6px] justify-center h-[38px] rounded-xl font-medium tracking-[0.1px] transition-all cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed px-4';
  const variants: Record<string, string> = {
    filled: 'bg-[#333] hover:bg-[#444] active:bg-[#222] text-white text-[12px]',
    outline: 'border border-[#595959] hover:bg-white/5 active:bg-white/10 text-[12px] text-white',
    solid: 'bg-white hover:bg-gray-200 active:bg-gray-300 text-black text-[12px]',
    danger: 'bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 text-red-400 text-[12px]',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} onClick={onClick} disabled={disabled}>
      {icon && <span className="flex items-center justify-center">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

// Custom Dropdown
export const FieldDropdown: React.FC<{
  label: string; 
  value: string; 
  options: string[];
  onChange: (val: string) => void; 
  className?: string;
}> = ({ label, value, options, onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button 
        type="button" 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left border border-[#595959] hover:border-[#7a7a7a] transition-colors rounded-xl flex flex-col gap-0.5 justify-center pb-2 pl-3 pr-2 pt-2 select-none focus:outline-none bg-black/20"
      >
        <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider">{label}</p>
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-white">{value}</span>
          <span className={`material-symbols-outlined text-[18px] text-white/30 transition-transform ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
        </div>
      </button>
      {isOpen && (
        <div className="absolute z-[100] top-[calc(100%+6px)] left-0 w-full bg-[#1a1a1a] border border-[#595959] rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {options.map((opt) => (
              <button 
                key={opt} 
                type="button"
                className={`w-full text-left px-4 py-2.5 text-[12px] font-medium hover:bg-white/10 transition-colors ${value === opt ? 'bg-white/5 text-white' : 'text-white/70'}`}
                onClick={() => { onChange(opt); setIsOpen(false); }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Text Input / Textarea
export const TextInput: React.FC<{
  label: string;
  value: string; 
  onChange: (val: string) => void; 
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}> = ({ label, value, onChange, placeholder, multiline, rows = 3 }) => (
  <div className="flex flex-col gap-1.5 w-full">
    <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider px-1">{label}</p>
    {multiline ? (
      <textarea 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        placeholder={placeholder}
        rows={rows}
        className="border border-[#595959] hover:border-[#7a7a7a] focus:border-white/40 rounded-xl w-full px-3 py-3 bg-black/20 text-[13px] text-white placeholder-white/20 focus:outline-none transition-all resize-none custom-scrollbar" 
      />
    ) : (
      <input 
        type="text"
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        placeholder={placeholder}
        className="border border-[#595959] hover:border-[#7a7a7a] focus:border-white/40 rounded-xl h-[44px] w-full px-3 bg-black/20 text-[13px] text-white placeholder-white/20 focus:outline-none transition-all" 
      />
    )}
  </div>
);

// Toggle Switch
export const Toggle: React.FC<{
  label: string;
  enabled: boolean;
  onChange: (val: boolean) => void;
}> = ({ label, enabled, onChange }) => (
  <button 
    onClick={() => onChange(!enabled)}
    className="flex items-center justify-between w-full p-3 rounded-xl border border-[#595959] hover:bg-white/5 transition-all group"
  >
    <span className="text-[12px] font-medium text-white/80">{label}</span>
    <div className={`w-10 h-5 rounded-full p-1 transition-colors ${enabled ? 'bg-white' : 'bg-[#333]'}`}>
      <div className={`w-3 h-3 rounded-full transition-transform ${enabled ? 'translate-x-5 bg-black' : 'translate-x-0 bg-white/50'}`} />
    </div>
  </button>
);