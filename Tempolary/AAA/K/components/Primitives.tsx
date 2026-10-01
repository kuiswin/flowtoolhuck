import React, { useState, useRef, useEffect } from 'react';

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center px-2">
    <span className="text-[11px] font-medium text-[var(--text-secondary)] tracking-[0.1px] normal-case opacity-80">
      {children}
    </span>
  </div>
);

export const PillButton: React.FC<{
  icon?: React.ReactNode; children: React.ReactNode;
  variant?: 'filled' | 'outline' | 'solid'; onClick?: () => void;
  className?: string; disabled?: boolean;
}> = ({ icon, children, variant = 'filled', onClick, className = '', disabled }) => {
  const base = 'flex items-center gap-[2px] justify-center w-full h-[34px] rounded-xl font-medium tracking-[0.1px] transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed';
  const variants: Record<string, string> = {
    filled: 'bg-[var(--text-muted)] hover:bg-[var(--text-secondary)] active:bg-[var(--text-muted)] text-[var(--bg-color)] text-[11px] pl-[8px] pr-[24px] py-1 select-none',
    outline: 'border border-[var(--border-color)] hover:bg-white/5 active:bg-white/10 backdrop-blur-[40px] text-[11px] pl-[8px] pr-[16px] py-2 text-[var(--text-primary)] select-none',
    solid: 'bg-[var(--text-primary)] hover:opacity-90 active:opacity-100 text-[var(--bg-color)] text-[11px] pl-[8px] pr-[16px] py-2 select-none',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} onClick={onClick} disabled={disabled}>
      {icon && <span className="flex items-center justify-center w-6 h-6">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

export const SegmentedToggle: React.FC<{
  value: string; items: { value: string; label: string; icon?: React.ReactNode }[];
  onChange: (val: string) => void;
}> = ({ value, items, onChange }) => (
  <div className="flex w-full items-center border border-[var(--border-color)] rounded-xl overflow-hidden bg-transparent">
    {items.map((item) => (
      <button key={item.value} type="button" onClick={() => onChange(item.value)}
        className={`flex-1 flex items-center justify-center gap-1 h-[34px] px-3 py-2 rounded-xl text-[10px] font-medium tracking-[0.1px] transition-all cursor-pointer ${
          value === item.value ? 'bg-[var(--text-primary)] text-[var(--bg-color)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5'
        }`}>
        {item.icon}<span>{item.label}</span>
      </button>
    ))}
  </div>
);

export const RangeSlider: React.FC<{
  label: string; value: number; min: number; max: number;
  step?: number; formatValue?: (val: number) => string;
  onChange: (val: number) => void;
}> = ({ label, value, min, max, step = 1, formatValue = (v) => String(v), onChange }) => (
  <div className="flex flex-col gap-1.5 pt-1 pb-1 w-full">
    <div className="flex items-center justify-between px-1 select-none">
      <span className="text-[10px] font-medium text-[var(--text-secondary)] tracking-[0.1px]">{label}</span>
      <span className="text-[10px] font-medium text-[var(--text-muted)] tracking-[0.1px]">{formatValue(value)}</span>
    </div>
    <div className="px-1 w-full flex items-center h-2">
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step} 
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-[var(--text-primary)]"
      />
    </div>
  </div>
);

export const FieldDropdown: React.FC<{
  label: string; value: string; options: string[];
  onChange: (val: string) => void; className?: string;
}> = ({ label, value, options, onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left border border-[var(--border-color)] hover:border-[var(--text-muted)] transition-colors rounded-xl flex flex-col gap-0 justify-center pb-1.5 pl-2.5 pr-1 pt-[3px] select-none focus:outline-none">
        <p className="text-[10px] font-medium text-[var(--text-muted)] tracking-[0.1px]">{label}</p>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-[var(--text-primary)] tracking-[0.1px]">{value}</span>
          <span className={`material-symbols-outlined text-[16px] text-[var(--text-muted)] mr-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}>keyboard_arrow_down</span>
        </div>
      </button>
      {isOpen && (
        <div className="absolute z-50 top-[calc(100%+4px)] left-0 w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-xl backdrop-blur-md animate-dropdown origin-top">
          <div className="max-h-32 overflow-y-auto">
            {options.map((opt) => (
              <button key={opt} type="button"
                className={`w-full text-left px-2.5 py-2 text-[11px] font-medium tracking-[0.1px] hover:bg-[var(--border-color)] transition-colors ${value === opt ? 'bg-[var(--border-color)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}
                onClick={() => { onChange(opt); setIsOpen(false); }}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const TextInput: React.FC<{
  value: string; onChange: (val: string) => void; placeholder?: string; className?: string;
}> = ({ value, onChange, placeholder, className = '' }) => (
  <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    className={`border border-[var(--border-color)] hover:border-[var(--text-muted)] focus:border-[var(--text-secondary)] rounded-xl w-full h-[50px] px-3 py-2.5 resize-none bg-transparent text-[11px] font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)] tracking-[0.1px] focus:outline-none transition-colors ${className}`} />
);