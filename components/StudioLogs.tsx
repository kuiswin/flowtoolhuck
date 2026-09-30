import React, { useState, useRef, useEffect } from 'react';

export type LogEntry = { id: string; message: string; type: 'info' | 'success' | 'warning' | 'error' | 'process' };

interface StudioLogsProps {
  logs: LogEntry[];
  onAddLog: (msg: string, type?: LogEntry['type']) => void;
}

export const StudioLogs: React.FC<StudioLogsProps> = ({ logs, onAddLog }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isCollapsed]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = logs.map(l => l.message).join('\n');
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      onAddLog('📋 ログをクリップボードにコピーしました', 'info');
    } catch (err) {
      onAddLog('❌ コピーに失敗しました', 'error');
    }
    document.body.removeChild(textArea);
  };

  const toggleCollapsed = () => {
    if (isMaximized) setIsMaximized(false);
    setIsCollapsed(!isCollapsed);
  };

  const toggleMaximized = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCollapsed(false);
    setIsMaximized(!isMaximized);
  };

  // 1行(35px)に収まる折りたたみスタイル
  const panelHeight = isCollapsed ? 'h-[35px]' : isMaximized ? 'h-[600px]' : 'h-[240px]';

  return (
    <div 
      className={`
        ${panelHeight} border-t border-white/10 flex flex-col bg-[#0a0a0a]/95 backdrop-blur-md -mx-2.5 px-3 transition-all duration-300 relative
        ${isMaximized ? 'fixed bottom-0 left-[380px] right-0 z-[100] border-l border-white/10 -mx-0' : ''}
      `}
    >
      <div 
        onClick={toggleCollapsed}
        className="flex items-center justify-between h-[35px] cursor-pointer hover:bg-white/5 transition-colors shrink-0"
      >
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-[16px] text-white/30 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>
            keyboard_arrow_up
          </span>
          <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Studio Logs</span>
          {!isCollapsed && logs.length > 0 && (
            <span className="text-[9px] bg-amber-500/20 text-amber-500 px-1.5 rounded-full font-bold">
              {logs.length}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="text-[9px] text-white/40 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
          >
            📋 COPY
          </button>
          <button
            onClick={toggleMaximized}
            className={`w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors ${isMaximized ? 'text-amber-400' : 'text-white/20'}`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isMaximized ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div 
          ref={scrollRef} 
          className="flex-1 overflow-y-auto dark-scrollbar font-mono text-[10px] flex flex-col gap-1.5 text-white/60 pb-3 mt-1"
        >
          {logs.map(log => (
            <div key={log.id} className={`
              ${log.type === 'error' ? 'text-red-400 bg-red-400/5' : 
                log.type === 'success' ? 'text-green-400' : 
                log.type === 'process' ? 'text-amber-400' : 
                log.type === 'warning' ? 'text-orange-400 italic' : ''}
              px-1 rounded
            `}>
              {log.message}
            </div>
          ))}
          {logs.length === 0 && <div className="italic text-white/20 px-1">ログ待機中...</div>}
        </div>
      )}
    </div>
  );
};