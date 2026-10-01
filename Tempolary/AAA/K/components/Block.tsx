import React, { useRef, useEffect } from 'react';
import { ScriptBlock, BlockType } from '../types';

interface BlockProps {
  block: ScriptBlock;
  isActive: boolean;
  isSelectionMode: boolean;
  spellCheckEnabled: boolean;
  onUpdate: (val: string) => void;
  onDelete: () => void;
  onMerge: (targetId: string) => void;
  onMergeNext: () => void;
  onFocus: () => void;
  onEnter: () => void;
  onMoveFocus: (dir: 'UP' | 'DOWN', pos: 'START' | 'END') => void;
  onTab: (shift: boolean) => void;
}

export const Block = React.forwardRef<HTMLTextAreaElement, BlockProps>(({ 
  block, isActive, isSelectionMode, spellCheckEnabled, 
  onUpdate, onDelete, onMerge, onMergeNext, 
  onFocus, onEnter, onMoveFocus, onTab 
}, ref) => {
  const innerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleSetCursor = (e: any) => {
      if (e.detail.id === block.id && innerRef.current) {
        innerRef.current.focus();
        const pos = e.detail.position;
        innerRef.current.setSelectionRange(pos, pos);
      }
    };
    window.addEventListener('set-cursor', handleSetCursor);
    return () => window.removeEventListener('set-cursor', handleSetCursor);
  }, [block.id]);

  useEffect(() => {
    if (typeof ref === 'function') ref(innerRef.current);
    else if (ref) (ref as any).current = innerRef.current;
  }, [ref]);

  const styles: Record<BlockType, string> = {
    SCENE_HEADING: 'font-bold uppercase mb-4 mt-8 text-[var(--editor-text)] text-[12pt]',
    ACTION: 'mb-4 text-[var(--editor-text)] text-[12pt] leading-[1.2]',
    CHARACTER: 'w-1/2 mx-auto text-center uppercase mt-6 mb-1 text-[var(--editor-text)] font-bold text-[12pt]',
    DIALOGUE: 'w-[70%] mx-auto text-left mb-4 px-0 text-[var(--editor-text)] text-[12pt] leading-[1.2]',
    PARENTHETICAL: 'w-[50%] mx-auto text-left italic text-[var(--editor-muted)] mb-0.5 text-[11pt]',
    TRANSITION: 'text-right uppercase mt-8 mb-8 text-[var(--editor-text)] font-bold text-[12pt]'
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSelectionMode) return;
    const { selectionStart, selectionEnd, value } = e.currentTarget;

    if (e.key === 'Tab') {
      e.preventDefault();
      onTab(e.shiftKey);
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onEnter();
    }
    if (e.key === 'Backspace') {
      if (selectionStart === 0 && selectionEnd === 0) {
        e.preventDefault();
        onDelete();
      }
    }
    if (e.key === 'Delete') {
      if (selectionStart === value.length && selectionEnd === value.length) {
        e.preventDefault();
        onMergeNext();
      }
    }
    if (e.key === 'ArrowUp' && selectionStart === 0) {
      e.preventDefault();
      onMoveFocus('UP', 'END');
    }
    if (e.key === 'ArrowDown' && selectionEnd === value.length) {
      e.preventDefault();
      onMoveFocus('DOWN', 'START');
    }
  };

  useEffect(() => {
    if (innerRef.current) {
      innerRef.current.style.height = '0px';
      innerRef.current.style.height = innerRef.current.scrollHeight + 'px';
    }
  }, [block.content, block.type]);

  return (
    <div 
      className={`relative group transition-all duration-200 cursor-default
        ${isSelectionMode && isActive ? 'ring-2 ring-blue-500/50 rounded-lg bg-blue-500/5' : ''}
        ${!isSelectionMode && isActive ? 'bg-black/[0.03]' : ''}
        ${isSelectionMode ? 'hover:bg-blue-500/5 cursor-pointer' : ''}
      `}
      onMouseDown={(e) => {
        if (isSelectionMode) e.preventDefault();
        onFocus();
      }}
      data-id={block.id}
    >
      <textarea
        ref={innerRef}
        autoFocus={isActive && !isSelectionMode}
        spellCheck={spellCheckEnabled}
        readOnly={isSelectionMode}
        value={block.content}
        onChange={e => onUpdate(block.type === 'SCENE_HEADING' || block.type === 'CHARACTER' ? e.target.value.toUpperCase() : e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={block.type.replace('_', ' ')}
        className={`w-full bg-transparent outline-none resize-none overflow-hidden py-1 px-2 script-font placeholder:text-[var(--editor-muted)] transition-all selection:bg-[var(--selection-bg)] 
          ${styles[block.type]} 
          ${isSelectionMode ? 'cursor-pointer select-none' : 'opacity-80'}
        `}
        rows={1}
      />
      {isSelectionMode && isActive && (
        <div className="absolute -left-8 top-1/2 -translate-y-1/2 text-blue-500">
           <span className="material-symbols-outlined text-[20px]">check_circle</span>
        </div>
      )}
    </div>
  );
});

Block.displayName = 'Block';