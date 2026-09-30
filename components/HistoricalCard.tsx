import React from 'react';
import { Episode } from '../types';

interface HistoricalCardProps {
  ep: Episode;
}

export const HistoricalCard: React.FC<HistoricalCardProps> = ({ ep }) => (
  <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
    <div className="flex items-center justify-between border-b border-white/5 pb-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-amber-400 text-xl">history_edu</span>
        <h3 className="text-sm font-black tracking-widest uppercase text-white/90">Historical Intelligence Card</h3>
      </div>
      
      {/* 共通設定バッジ */}
      <div className="flex gap-2">
        {ep.taste && (
          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[9px] font-bold rounded-full border border-blue-500/30">
            画風: {ep.taste.split(' (')[0]}
          </span>
        )}
        {ep.era && (
          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-[9px] font-bold rounded-full border border-purple-500/30">
            年代: {ep.era.split('（')[0]}
          </span>
        )}
        {ep.theme && (
          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] font-bold rounded-full border border-amber-500/30">
            テーマ: {ep.theme.split(' ')[0]}
          </span>
        )}
      </div>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">作品世界観・時代分析</span>
        <p className="text-xs text-white/80 leading-relaxed italic">{ep.eraAnalysis || "分析データ収集中..."}</p>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">禁止要素 (Strictly Forbidden)</span>
        <div className="flex flex-wrap gap-1.5">
          {ep.forbiddenAnachronisms && ep.forbiddenAnachronisms.length > 0 ? (
            ep.forbiddenAnachronisms.map((item, i) => (
              <span key={i} className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] rounded-sm font-medium">
                {item}
              </span>
            ))
          ) : (
            <span className="text-[10px] text-white/20 italic">特になし</span>
          )}
        </div>
      </div>
    </div>
  </div>
);