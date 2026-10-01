import React from 'react';
import { Portrait } from '../App';

interface ImageGridProps {
  images: Portrait[];
  onFeedback: (mediaId: string, type: 'like' | 'dislike') => void;
  onDelete: (mediaId: string) => void;
  onRegenerate: (mediaId: string) => void;
}

export const ImageGrid: React.FC<ImageGridProps> = ({ images, onFeedback, onDelete, onRegenerate }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {images.map((img) => (
        <div key={img.mediaId} className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="relative aspect-square rounded-2xl overflow-hidden border border-white/5 bg-white/5 shadow-2xl group">
            <img 
              src={`data:${img.mimeType};base64,${img.base64}`} 
              className={`w-full h-full object-cover transition-all duration-700 ${img.isRegenerating ? 'blur-md opacity-40' : 'group-hover:scale-105'}`} 
              alt={img.angle}
            />

            {/* Loading Spinner for Regeneration */}
            {img.isRegenerating && (
              <div className="absolute inset-0 flex items-center justify-center z-20">
                <span className="material-symbols-outlined text-white text-[32px] animate-spin">refresh</span>
              </div>
            )}
            
            {/* Top Right: Delete Button */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex flex-col gap-2">
              <button 
                onClick={() => onDelete(img.mediaId)}
                className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/80 hover:bg-red-500/80 hover:text-white transition-all cursor-pointer"
                title="Delete"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
              <button 
                onClick={() => onRegenerate(img.mediaId)}
                disabled={img.isRegenerating}
                className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/80 hover:bg-white/20 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                title="Regenerate this angle"
              >
                <span className={`material-symbols-outlined text-[18px] ${img.isRegenerating ? 'animate-spin' : ''}`}>refresh</span>
              </button>
            </div>

            {/* Bottom: Overlay with Feedback */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col p-3 gap-2">
              <span className="text-[10px] text-white font-medium truncate">{img.angle}</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => onFeedback(img.mediaId, 'like')}
                  className={`flex-1 h-7 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                    img.feedback === 'like' ? 'bg-green-500/40 text-green-300' : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{img.feedback === 'like' ? 'thumb_up' : 'thumb_up'}</span>
                  <span className="text-[10px] font-bold">Good</span>
                </button>
                <button 
                  onClick={() => onFeedback(img.mediaId, 'dislike')}
                  className={`flex-1 h-7 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                    img.feedback === 'dislike' ? 'bg-red-500/40 text-red-300' : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{img.feedback === 'dislike' ? 'thumb_down' : 'thumb_down'}</span>
                  <span className="text-[10px] font-bold">Bad</span>
                </button>
              </div>
            </div>
            
            {/* Persistent Indicator for Liked/Disliked */}
            {img.feedback && (
              <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg ${
                img.feedback === 'like' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
              }`}>
                <span className="material-symbols-outlined text-[14px]">
                  {img.feedback === 'like' ? 'check' : 'close'}
                </span>
              </div>
            )}
          </div>
          <span className="text-[10px] text-white/40 font-medium px-1 text-center uppercase tracking-tighter truncate">{img.angle}</span>
        </div>
      ))}
    </div>
  );
};