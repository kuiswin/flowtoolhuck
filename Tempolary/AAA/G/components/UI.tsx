import React, { useState, useRef, useEffect } from 'react';

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center px-2">
    <span className="text-[11px] font-medium text-[rgba(218,220,224,0.9)] tracking-[0.1px] normal-case">
      {children}
    </span>
  </div>
);

export const CheckboxRow: React.FC<{
  label: string;
  selected: boolean;
  onToggle: () => void;
}> = ({ label, selected, onToggle }) => (
  <div 
    onClick={onToggle}
    className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-white/5 cursor-pointer group transition-colors"
  >
    <span className={`material-symbols-outlined text-[18px] transition-colors ${selected ? 'text-white' : 'text-white/20'}`}>
      {selected ? 'check_box' : 'check_box_outline_blank'}
    </span>
    <span className={`text-[10px] font-medium leading-tight transition-colors ${selected ? 'text-white/80' : 'text-white/40'}`}>
      {label}
    </span>
  </div>
);

export const CheckboxChip: React.FC<{
  label: string;
  selected: boolean;
  onToggle: () => void;
}> = ({ label, selected, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className={`flex items-center gap-1.5 px-3 h-[34px] rounded-xl text-[11px] font-medium tracking-[0.1px] transition-all cursor-pointer select-none border border-[#595959] ${
      selected 
        ? 'bg-[#969696] text-black border-[#969696]' 
        : 'bg-transparent text-[rgba(218,220,224,0.75)] hover:border-[#7a7a7a] hover:text-white'
    }`}
  >
    <span className="material-symbols-outlined text-[16px]">
      {selected ? 'check' : 'add'}
    </span>
    <span>{label}</span>
  </button>
);

export const PillButton: React.FC<{
  icon?: React.ReactNode; 
  children: React.ReactNode;
  variant?: 'filled' | 'outline' | 'solid'; 
  onClick?: () => void;
  disabled?: boolean;
}> = ({ icon, children, variant = 'filled', onClick, disabled }) => {
  const base = 'flex items-center gap-[2px] justify-center w-full h-[34px] rounded-xl font-medium tracking-[0.1px] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
  const variants: Record<string, string> = {
    filled: 'bg-[#969696] hover:bg-[#a6a6a6] active:bg-[#868686] text-black text-[11px] pl-[8px] pr-[24px] py-1 select-none',
    outline: 'border border-[#595959] hover:bg-white/5 active:bg-white/10 backdrop-blur-[40px] text-[12px] pl-[8px] pr-[16px] py-2 text-white select-none',
    solid: 'bg-white hover:bg-gray-200 active:bg-gray-300 text-black text-[12px] pl-[8px] pr-[16px] py-2 select-none',
  };
  return (
    <button className={`${base} ${variants[variant]}`} onClick={onClick} disabled={disabled}>
      {icon && <span className="flex items-center justify-center w-6 h-6">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

export const TextInput: React.FC<{
  value: string; 
  onChange: (val: string) => void; 
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => (
  <textarea 
    value={value} 
    onChange={(e) => onChange(e.target.value)} 
    placeholder={placeholder}
    className="border border-[#595959] hover:border-[#7a7a7a] focus:border-[#969696] rounded-xl w-full h-[60px] px-3 py-2.5 resize-none bg-transparent text-[11px] font-medium text-white placeholder-[rgba(218,220,224,0.75)] tracking-[0.1px] focus:outline-none transition-colors" 
  />
);

export const FieldDisplay: React.FC<{ label: string; value: string; className?: string }> = ({ label, value, className = '' }) => (
  <div className={`border border-[#595959] rounded-xl flex flex-col gap-0.5 justify-center pb-2 pl-2.5 pr-1 pt-[5px] select-none w-full ${className}`}>
    <p className="text-[11px] font-medium text-[rgba(255,255,255,0.35)] tracking-[0.1px]">{label}</p>
    <div className="flex items-center">
      <span className="text-[11px] font-medium text-white tracking-[0.1px]">{value}</span>
    </div>
  </div>
);