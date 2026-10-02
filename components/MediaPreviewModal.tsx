import React, { useState, useEffect, useRef } from 'react';
import { Cut, VideoModelType, KenBurnsPreset } from '../types';
import { 
  CAMERA_WORK_OPTIONS, 
  IMAGE_MODELS, 
  VIDEO_MODELS_REGISTRY,
  KEN_BURNS_PRESETS, 
  sanitizeFilename,
  resolveImageModel,
  resolveVideoModel
} from '../constants';
import { Flow } from 'flow-sdk';
import { callWithRetry } from '../services/utils';
import { extractHighlights } from '../services/directorService';
import { normalizeKenBurnsPreset } from '../services/browserVideoService';
import { TextInput, SectionLabel, PillButton, ToggleSwitch, FieldDropdown } from './Primitives';


interface MediaPreviewModalProps {
    isOpen: boolean;
    cut: Cut;
    episodeId: number;
    currentImageModel?: string;
    isMvMode?: boolean;
    onClose: () => void;
    onAnimate: (m: VideoModelType) => void;
    onBrowserAnimate: () => void;
    onUpdateCut: (updates: Partial<Cut>) => void;
    onRegenerateImage: (modelLabel: string, customPrompt?: string, customNeg?: string) => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
    isOpen, cut, episodeId, currentImageModel, isMvMode, onClose, onAnimate, onBrowserAnimate, onUpdateCut, onRegenerateImage
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [aiWish, setAiWish] = useState('');
    const [isRewriting, setIsRewriting] = useState(false);
    const [showTelop, setShowTelop] = useState(true);
    const [newKeyword, setNewKeyword] = useState('');
    const [downloadState, setDownloadState] = useState<'idle' | 'saving' | 'done'>('idle');

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    // モーダル表示時、もし登録されたハイライトが本文に1つも合致していなければ自動修復
    useEffect(() => {
        if (!isOpen) return;
        const text = cut.telop?.fullText || cut.narrationJp || '';
        const highlights = cut.telop?.highlights || [];
        if (text) {
            const hasAnyMatch = highlights.some(h => h.word && text.includes(h.word));
            if (!hasAnyMatch) {
                const auto = extractHighlights(text);
                if (auto.length > 0) {
                    onUpdateCut({ telop: { ...cut.telop!, fullText: text, highlights: auto } });
                }
            }
        }
    }, [isOpen, cut.id]);

    // Ken Burns アニメーションのCSS
    useEffect(() => {
        if (!isOpen) return;
        const id = 'ken-burns-styles';
        if (!document.getElementById(id)) {
            const style = document.createElement('style');
            style.id = id;
            style.textContent = `
                @keyframes kb-zoom-in { 0% { transform: scale(1); } 100% { transform: scale(1.15); } }
                @keyframes kb-zoom-out { 0% { transform: scale(1.15); } 100% { transform: scale(1); } }
                @keyframes kb-pan-left { 0% { transform: translateX(5%); } 100% { transform: translateX(-5%); } }
                @keyframes kb-pan-right { 0% { transform: translateX(-5%); } 100% { transform: translateX(5%); } }
                @keyframes kb-tilt-up { 0% { transform: translateY(5%); } 100% { transform: translateY(-5%); } }
                @keyframes kb-tilt-down { 0% { transform: translateY(-5%); } 100% { transform: translateY(5%); } }
                
                .animate-ken-burns-zoom-in { animation: kb-zoom-in 8s ease-in-out infinite alternate; }
                .animate-ken-burns-zoom-out { animation: kb-zoom-out 8s ease-in-out infinite alternate; }
                .animate-ken-burns-pan-left { animation: kb-pan-left 8s ease-in-out infinite alternate; scale: 1.1; }
                .animate-ken-burns-pan-right { animation: kb-pan-right 8s ease-in-out infinite alternate; scale: 1.1; }
                .animate-ken-burns-tilt-up { animation: kb-tilt-up 8s ease-in-out infinite alternate; scale: 1.1; }
                .animate-ken-burns-tilt-down { animation: kb-tilt-down 8s ease-in-out infinite alternate; scale: 1.1; }

                /* ド迫力テロップ用CSS（text-shadowによる疑似フチ取り） */
                .impact-telop {
                    text-shadow: 
                        3px 3px 0 #000, -3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000,
                        0px 3px 0 #000, 0px -3px 0 #000, 3px 0px 0 #000, -3px 0px 0 #000,
                        5px 5px 10px rgba(0,0,0,0.8);
                    line-height: 1.1;
                }
            `;
            document.head.appendChild(style);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleAiWishRequest = async () => {
        if (!aiWish.trim() || isRewriting || cut.isGeneratingImage) return;
        setIsRewriting(true);
        try {
            const rewritePrompt = `Rewrite the image generation prompt based on: "${aiWish}". Original: ${cut.promptEn}. Output ONLY English prompt.`;
            const { text } = await callWithRetry<any>(
                () => Flow.generate.text(rewritePrompt, { systemInstruction: "Expert cinematic prompt engineer." }),
                undefined, 4
            );
            const refinedPrompt = (text || '').trim();
            if (refinedPrompt) {
                onUpdateCut({ promptEn: refinedPrompt });
                setAiWish('');
                onRegenerateImage(resolveImageModel(currentImageModel).label, refinedPrompt, cut.negativePrompt);
            }
        } catch (err) { console.error(err); } finally { setIsRewriting(false); }
    };

    const handleAddKeyword = () => {
        const target = newKeyword.trim();
        if (!target) return;
        const currentHighlights = cut.telop?.highlights || [];
        if (!currentHighlights.some(h => h.word === target)) {
            const next = [...currentHighlights, { word: target, color: '#FFE600', sizeScale: 1.1 }];
            onUpdateCut({ telop: { ...cut.telop!, fullText: cut.telop?.fullText || '', highlights: next } });
        }
        setNewKeyword('');
    };

    const handleRemoveKeyword = (wordToRemove: string) => {
        const currentHighlights = cut.telop?.highlights || [];
        const next = currentHighlights.filter(h => h.word !== wordToRemove);
        onUpdateCut({ telop: { ...cut.telop!, fullText: cut.telop?.fullText || '', highlights: next } });
    };

    const handleAutoExtract = () => {
        const text = cut.telop?.fullText || cut.narrationJp || '';
        const auto = extractHighlights(text);
        onUpdateCut({ telop: { ...cut.telop!, fullText: text, highlights: auto } });
    };

    const handleDownloadVideo = async () => {
        if (!cut.videoBase64 || downloadState !== 'idle') return;
        setDownloadState('saving');
        try {
            const base64 = cut.videoBase64.includes('base64,') ? cut.videoBase64.split('base64,')[1] : cut.videoBase64;
            await Flow.download({ base64, mimeType: 'video/mp4', filename: `${sanitizeFilename(cut.narrationJp || 'cut')}_video.mp4` });
            setDownloadState('done');
            setTimeout(() => setDownloadState('idle'), 2000);
        } catch (err) { setDownloadState('idle'); }
    };

    const videoSrc = cut.videoBase64 ? (cut.videoBase64.startsWith('data:') ? cut.videoBase64 : `data:video/mp4;base64,${cut.videoBase64}`) : null;
    const imageSrc = cut.imageBase64 ? `data:image/png;base64,${cut.imageBase64}` : null;
    const isOmniRec = cut.targetVideoModel === 'omni-flash';
    const isVeoRec = cut.targetVideoModel === 'veo-lite';

    const getKenBurnsClass = () => {
        if (videoSrc || !imageSrc) return '';
        const preset = normalizeKenBurnsPreset(cut.kenBurnsPreset);
        if (preset === 'none') return '';
        return `animate-ken-burns-${preset}`;
    };

    const renderTelopContent = () => {
        if (!showTelop || !cut.telop?.fullText) return null;
        
        const text = cut.telop.fullText;
        const highlights = cut.telop.highlights || [];

        // 全一致箇所を正確にマッピング（同一単語が複数回登場しても確実にすべてハイライト）
        const highlightIndices = new Map<number, { color: string; sizeScale: number }>();
        highlights.forEach(h => {
            if (!h.word) return;
            let pos = 0;
            while ((pos = text.indexOf(h.word, pos)) !== -1) {
                for (let k = 0; k < h.word.length; k++) {
                    highlightIndices.set(pos + k, h);
                }
                pos += 1;
            }
        });

        if (isMvMode) {
            return (
                <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden flex items-center justify-center">
                    {text.split('').map((char, i) => {
                        const highlight = highlightIndices.get(i);
                        const color = highlight ? (highlight.color || '#FFE600') : '#FFFFFF';
                        const isKanji = /[\u4e00-\u9faf]/.test(char);
                        const baseScale = (highlight ? (highlight.sizeScale || 1.4) : 1.0) * (isKanji ? 1.1 : 1.0);
                        
                        const seed = i + 1;
                        const angles = [-45, -30, -15, 0, 15, 30, 45, 90];
                        const angle = angles[(seed * 7) % angles.length];
                        const posX = ((seed * 11) % 60) - 30; // -30% to +30% offset from center
                        const posY = ((seed * 17) % 60) - 30;
                        const delay = i * 0.08;

                        return (
                            <span
                                key={i}
                                className="absolute font-[900] select-none"
                                style={{
                                    transform: `translate(${posX}vw, ${posY}vh) rotate(${angle}deg)`,
                                }}
                            >
                                <span
                                    className="inline-block animate-kinetic-zoom-in opacity-0"
                                    style={{
                                        color: color,
                                        fontSize: `${baseScale * 3}rem`,
                                        WebkitTextStroke: '2px black',
                                        textShadow: '0 0 15px rgba(0,0,0,0.8)',
                                        animationDelay: `${delay}s`,
                                    }}
                                >
                                    {char}
                                </span>
                            </span>
                        );
                    })}
                </div>
            );
        }

        return (
            <div className="absolute bottom-[4%] left-0 w-full px-3 flex flex-col items-center pointer-events-none z-40 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* テロップ背景プレート（約20%〜35%背景が透けて見えるシネマ風グラスモーフィズム） */}
                <div className="bg-black/65 backdrop-blur-md rounded-2xl px-5 py-3 flex flex-wrap justify-center items-baseline max-w-[92%] shadow-xl shadow-black/40 border border-white/15 leading-snug">
                    {text.split('').map((char, i) => {
                        const isKanji = /[\u4e00-\u9faf]/.test(char);
                        const isPunctuation = /[。、！？…]/.test(char);
                        const highlight = highlightIndices.get(i);
                        
                        const color = highlight ? (highlight.color || '#FFE600') : '#FFFFFF';
                        const scale = (isKanji ? 1.06 : 1.0) * (highlight ? (highlight.sizeScale || 1.15) : 1.0);

                        return (
                            <span 
                                key={i}
                                className="font-[900] tracking-normal select-none"
                                style={{ 
                                    color: color, 
                                    fontSize: `${scale * 1.25}rem`, 
                                    display: isPunctuation ? 'inline' : 'inline-block',
                                    margin: isPunctuation ? '0 1px 0 -1px' : '0 0.5px',
                                    textShadow: highlight 
                                      ? '0 0 12px rgba(255, 230, 0, 0.85), 0 2px 5px rgba(0,0,0,0.95)' 
                                      : '0 2px 5px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.9)'
                                }}
                            >
                                {char}
                            </span>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4">
            <div className="absolute inset-0 bg-black/98 backdrop-blur-xl" onClick={onClose} />

            <div className="relative w-full max-w-[1200px] h-[95vh] lg:h-[85vh] bg-[#0c0c0c] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row animate-in fade-in zoom-in-95 duration-200">
                
                {/* Canvas Area */}
                <div className="flex-1 bg-black relative flex items-center justify-center p-4 lg:p-10 min-h-0 overflow-hidden">
                    <div className="relative h-full w-full flex items-center justify-center">
                        <div className="relative h-full max-h-full aspect-[9/16] shadow-2xl rounded-xl overflow-hidden border border-white/10 group bg-[#111] flex items-center justify-center">

                            {videoSrc ? (
                                <video ref={videoRef} src={videoSrc} className="w-full h-full object-contain block" autoPlay loop playsInline />
                            ) : imageSrc ? (
                                <div className="w-full h-full overflow-hidden">
                                    <img src={imageSrc} className={`w-full h-full object-contain block ${getKenBurnsClass()}`} alt="Preview" />
                                </div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-white/10 gap-3 uppercase tracking-widest text-[10px]">Rendering</div>
                            )}

                            {renderTelopContent()}

                            <div className="absolute top-4 right-4 z-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setShowTelop(!showTelop)} className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center transition-all ${showTelop ? 'bg-amber-500 border-amber-400 text-black' : 'bg-black/60 border-white/20 text-white/40'}`}>
                                    <span className="material-symbols-outlined text-[20px]">{showTelop ? 'subtitles' : 'subtitles_off'}</span>
                                </button>
                            </div>

                            {(isRewriting || cut.isGeneratingImage) && (
                                <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-30 animate-in fade-in duration-200">
                                    <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                                    <span className="text-xs font-black text-amber-400 tracking-widest uppercase animate-pulse">{isRewriting ? '✨ 指示を反映中...' : '🎨 描画中...'}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Editor Area */}
                <div className="w-full lg:w-[420px] h-[400px] lg:h-full bg-[#121212] border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col shadow-2xl shrink-0">
                    <div className="p-4 lg:p-6 border-b border-white/5 flex items-center justify-between bg-[#151515]">
                        <h3 className="text-lg lg:text-xl font-black italic tracking-tighter uppercase">Cut Editor Pro</h3>
                        <button onClick={onClose} className="text-white/20 hover:text-white transition-colors"><span className="material-symbols-outlined">close</span></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 lg:p-6 flex flex-col gap-6 dark-scrollbar min-h-0 pb-14">
                        <div className="flex flex-col gap-4">
                            <TextInput label="ナレーション (JP)" value={cut.narrationJp || ''} onChange={v => onUpdateCut({ narrationJp: v })} />
                            
                            <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                                <SectionLabel>✨ AIへのおねがい</SectionLabel>
                                <div className="flex gap-2">
                                    <input type="text" value={aiWish} onChange={e => setAiWish(e.target.value)} placeholder="例: 表情をもっと険しく..." className="flex-1 bg-black/60 border border-white/15 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-amber-500/80 text-white placeholder:text-white/30" onKeyDown={e => e.key === 'Enter' && handleAiWishRequest()} />
                                    <PillButton variant="filled" className="bg-amber-500 hover:bg-amber-400 text-black font-black h-8 px-4 text-xs" onClick={handleAiWishRequest} disabled={isRewriting || cut.isGeneratingImage || !aiWish.trim()}>反映</PillButton>
                                </div>
                            </div>

                            <SectionLabel>テロップ設定</SectionLabel>
                            <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 flex flex-col gap-3">
                                <ToggleSwitch label="字幕を表示する" checked={showTelop} onChange={setShowTelop} />
                                
                                <TextInput 
                                  label="字幕テキスト" 
                                  value={cut.telop?.fullText || ''} 
                                  onChange={v => {
                                    const currentHighlights = cut.telop?.highlights || [];
                                    const validExisting = currentHighlights.filter(h => h.word && v.includes(h.word));
                                    const nextHighlights = validExisting.length > 0 ? validExisting : extractHighlights(v);
                                    onUpdateCut({ telop: { ...cut.telop!, fullText: v, highlights: nextHighlights } });
                                  }} 
                                />

                                {/* キーワード管理エリア */}
                                <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-black text-amber-400 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">stars</span>
                                            金文字強調キーワード
                                        </span>
                                        <button 
                                          type="button"
                                          onClick={handleAutoExtract}
                                          className="text-[10px] text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-0.5 transition-colors"
                                          title="本文中の漢字熟語から自動抽出"
                                        >
                                            <span className="material-symbols-outlined text-[12px]">sync</span>
                                            本文から自動抽出
                                        </button>
                                    </div>

                                    {/* 現在登録されているキーワードの一覧（点灯/消灯ステータス付き） */}
                                    <div className="flex flex-wrap gap-1.5 min-h-[26px]">
                                        {cut.telop?.highlights && cut.telop.highlights.length > 0 ? (
                                            cut.telop.highlights.map((h, i) => {
                                                const currentFullText = cut.telop?.fullText || '';
                                                const isMatch = h.word && currentFullText.includes(h.word);
                                                return (
                                                    <span 
                                                      key={i} 
                                                      className={`px-2 py-0.5 rounded-md border text-[10px] font-bold flex items-center gap-1 transition-all ${
                                                          isMatch 
                                                            ? 'bg-amber-500/15 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(255,230,0,0.2)]' 
                                                            : 'bg-white/5 border-white/10 text-white/35'
                                                      }`}
                                                    >
                                                        <span>{isMatch ? '✨' : '⚠️'} {h.word}</span>
                                                        <span className={`text-[9px] ${isMatch ? 'text-amber-400/80 font-normal' : 'text-white/20'}`}>
                                                            {isMatch ? '(点灯中)' : '(未出現)'}
                                                        </span>
                                                        <button 
                                                          type="button"
                                                          onClick={() => handleRemoveKeyword(h.word)}
                                                          className="ml-0.5 hover:text-red-400 transition-colors flex items-center"
                                                          title="キーワードから削除"
                                                        >
                                                            <span className="material-symbols-outlined text-[11px]">close</span>
                                                        </button>
                                                    </span>
                                                );
                                            })
                                        ) : (
                                            <span className="text-[10px] text-white/30 italic">キーワードなし（すべて白色で表示中）</span>
                                        )}
                                    </div>

                                    {/* キーワード手動追加フォーム */}
                                    <div className="flex gap-1.5 mt-1">
                                        <input 
                                          type="text" 
                                          value={newKeyword} 
                                          onChange={e => setNewKeyword(e.target.value)} 
                                          onKeyDown={e => e.key === 'Enter' && handleAddKeyword()}
                                          placeholder="強調する単語を追加..." 
                                          className="flex-1 bg-black/50 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] outline-none focus:border-amber-400/70 text-white placeholder:text-white/25"
                                        />
                                        <button 
                                          type="button" 
                                          onClick={handleAddKeyword}
                                          disabled={!newKeyword.trim()}
                                          className="px-2.5 py-1 bg-white/10 hover:bg-amber-500 hover:text-black text-white text-[11px] font-bold rounded-lg border border-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                                        >
                                          ＋追加
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <FieldDropdown label="カメラワーク" value={CAMERA_WORK_OPTIONS.find(o => o.value === cut.cameraMotion)?.label || CAMERA_WORK_OPTIONS[0].label} options={CAMERA_WORK_OPTIONS.map(o => o.label)} onChange={l => onUpdateCut({ cameraMotion: CAMERA_WORK_OPTIONS.find(o => l === o.label)?.value })} />
                                <FieldDropdown label="ケンバーン演出" value={KEN_BURNS_PRESETS.find(p => p.value === normalizeKenBurnsPreset(cut.kenBurnsPreset))?.label || KEN_BURNS_PRESETS[0].label} options={KEN_BURNS_PRESETS.map(p => p.label)} onChange={l => onUpdateCut({ kenBurnsPreset: KEN_BURNS_PRESETS.find(p => p.label === l)?.value as KenBurnsPreset })} />
                            </div>

                            <TextInput label="画像プロンプト (EN)" value={cut.promptEn || ''} onChange={v => onUpdateCut({ promptEn: v })} />
                        </div>

                        <div className="pt-6 border-t border-white/5 flex flex-col gap-4">
                            <SectionLabel>動画生成</SectionLabel>
                            <PillButton variant="filled" className="bg-amber-600 hover:bg-amber-500 text-white font-black h-[42px]" onClick={onBrowserAnimate} disabled={cut.isGeneratingVideo || !cut.imageBase64}>⚡ ブラウザで即座に動画化 (0pt)</PillButton>
                            <div className="grid grid-cols-2 gap-2">
                                {VIDEO_MODELS_REGISTRY.slice(0, 2).map(m => {
                                    const isSelected = cut.targetVideoModel === m.id;
                                    const colorClass = m.id === 'omni-flash' ? 'bg-purple-600' : 'bg-blue-600';
                                    return (
                                        <PillButton 
                                            key={m.id}
                                            variant="filled" 
                                            className={`${colorClass} text-white font-black h-[40px] text-[10px] ${isSelected ? 'ring-2 ring-amber-400' : ''}`} 
                                            onClick={() => onAnimate(m.id)} 
                                            disabled={cut.isGeneratingVideo || !cut.imageMediaId}
                                        >
                                            🎬 {m.name} ({m.defaultDuration}s)
                                        </PillButton>
                                    );
                                })}
                            </div>
                            {videoSrc && (
                                <PillButton variant="outline" className="h-10 mt-2 border-amber-500/50 text-amber-500 font-black" onClick={handleDownloadVideo} disabled={downloadState !== 'idle'} icon={<span className="material-symbols-outlined text-[18px]">download</span>}>
                                    {downloadState === 'idle' ? '💾 保存 (MP4)' : '保存中...'}
                                </PillButton>
                            )}
                        </div>
                    </div>

                    <div className="p-4 lg:p-6 bg-[#161616] border-t border-white/10 shrink-0 z-10">
                        <PillButton 
                          variant="solid" 
                          className="w-full h-11 bg-white text-black font-black" 
                          disabled={cut.isGeneratingImage || isRewriting} 
                          onClick={() => onRegenerateImage(resolveImageModel(currentImageModel).label, cut.promptEn, cut.negativePrompt)} 
                          icon={<span className="material-symbols-outlined">image</span>}
                        >
                            {cut.isGeneratingImage ? '描画中...' : '画像を再描画'}
                        </PillButton>
                    </div>
                </div>
            </div>
        </div>
    );
};