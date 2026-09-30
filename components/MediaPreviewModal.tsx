import React, { useState, useEffect, useRef } from 'react';
import { Cut, VideoModelType, KenBurnsPreset } from '../types';
import { PillButton, SectionLabel, TextInput, FieldDropdown, ToggleSwitch } from './Primitives';
import { VOICE_CHARACTERS, CAMERA_WORK_OPTIONS, IMAGE_MODELS, KEN_BURNS_PRESETS, sanitizeFilename } from '../constants';
import { Flow } from 'flow-sdk';
import { callWithRetry } from '../lib/utils';

interface MediaPreviewModalProps {
    isOpen: boolean;
    cut: Cut;
    episodeId: number;
    onClose: () => void;
    onAnimate: (m: VideoModelType) => void;
    onBrowserAnimate: () => void;
    onUpdateCut: (updates: Partial<Cut>) => void;
    onRegenerateImage: (modelLabel: string, customPrompt?: string, customNeg?: string) => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
    isOpen, cut, episodeId, onClose, onAnimate, onBrowserAnimate, onUpdateCut, onRegenerateImage
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [aiWish, setAiWish] = useState('');
    const [isRewriting, setIsRewriting] = useState(false);
    const [showTelop, setShowTelop] = useState(true);
    const [downloadState, setDownloadState] = useState<'idle' | 'saving' | 'done'>('idle');

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

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
            const { text } = await callWithRetry(
                () => Flow.generate.text(rewritePrompt, { systemInstruction: "Expert cinematic prompt engineer." }),
                undefined, 4
            );
            const refinedPrompt = text.trim();
            if (refinedPrompt) {
                onUpdateCut({ promptEn: refinedPrompt });
                setAiWish('');
                onRegenerateImage(IMAGE_MODELS[1].label, refinedPrompt, cut.negativePrompt);
            }
        } catch (err) { console.error(err); } finally { setIsRewriting(false); }
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
        if (videoSrc || !imageSrc || !cut.kenBurnsPreset || cut.kenBurnsPreset === 'none') return '';
        return `animate-ken-burns-${cut.kenBurnsPreset}`;
    };

    const renderTelopContent = () => {
        if (!showTelop || !cut.telop?.fullText) return null;
        
        const text = cut.telop.fullText;
        const highlights = cut.telop.highlights || [];

        return (
            <div className="absolute bottom-[10%] left-0 w-full px-8 flex flex-col items-center pointer-events-none z-40 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* テロップ背景プレート（黒座布団） */}
                <div className="bg-black/65 backdrop-blur-sm rounded-[24px] px-8 py-5 flex flex-wrap justify-center items-baseline gap-y-3 max-w-[620px] shadow-2xl border border-white/5">
                    {text.split('').map((char, i) => {
                        const isKanji = /[\u4e00-\u9faf]/.test(char);
                        const highlight = highlights.find(h => {
                           const startIdx = text.indexOf(h.word);
                           return startIdx !== -1 && i >= startIdx && i < startIdx + h.word.length;
                        });
                        
                        const color = highlight ? (highlight.color || '#FFE600') : 'white';
                        const scale = (isKanji ? 1.2 : 1.0) * (highlight ? highlight.sizeScale : 1.0);

                        return (
                            <span 
                                key={i}
                                className="impact-telop font-[900] tracking-tighter"
                                style={{ 
                                    color: color, 
                                    fontSize: `${scale * 3.2}rem`, 
                                    display: 'inline-block',
                                    margin: '0 4px' // 文字間マージン確保
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
                            <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex flex-col gap-3">
                                <ToggleSwitch label="字幕を表示する" checked={showTelop} onChange={setShowTelop} />
                                <TextInput label="字幕テキスト" value={cut.telop?.fullText || ''} onChange={v => onUpdateCut({ telop: { ...cut.telop!, fullText: v } })} />
                                {cut.telop?.highlights && cut.telop.highlights.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {cut.telop.highlights.map((h, i) => (
                                          <span key={i} style={{ color: h.color || '#FFE600', borderColor: (h.color || '#FFE600') + '40' }} className="px-2 py-0.5 rounded border bg-black/20 text-[10px] font-bold">● {h.word}</span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <FieldDropdown label="カメラワーク" value={CAMERA_WORK_OPTIONS.find(o => o.value === cut.cameraMotion)?.label || CAMERA_WORK_OPTIONS[0].label} options={CAMERA_WORK_OPTIONS.map(o => o.label)} onChange={l => onUpdateCut({ cameraMotion: CAMERA_WORK_OPTIONS.find(o => l === o.label)?.value })} />
                                <FieldDropdown label="ケンバーン演出" value={KEN_BURNS_PRESETS.find(p => p.value === cut.kenBurnsPreset)?.label || KEN_BURNS_PRESETS[0].label} options={KEN_BURNS_PRESETS.map(p => p.label)} onChange={l => onUpdateCut({ kenBurnsPreset: KEN_BURNS_PRESETS.find(p => p.label === l)?.value as KenBurnsPreset })} />
                            </div>

                            <TextInput label="画像プロンプト (EN)" value={cut.promptEn || ''} onChange={v => onUpdateCut({ promptEn: v })} />
                        </div>

                        <div className="pt-6 border-t border-white/5 flex flex-col gap-4">
                            <SectionLabel>動画生成</SectionLabel>
                            <PillButton variant="filled" className="bg-amber-600 hover:bg-amber-500 text-white font-black h-[42px]" onClick={onBrowserAnimate} disabled={cut.isGeneratingVideo || !cut.imageBase64}>⚡ ブラウザで即座に動画化 (0pt)</PillButton>
                            <div className="grid grid-cols-2 gap-2">
                                <PillButton variant="filled" className={`bg-purple-600 text-white font-black h-[40px] text-[10px] ${isOmniRec ? 'ring-2 ring-amber-400' : ''}`} onClick={() => onAnimate('omni-flash')} disabled={cut.isGeneratingVideo || !cut.imageMediaId}>🎬 Omni (4s)</PillButton>
                                <PillButton variant="filled" className={`bg-blue-600 text-white font-black h-[40px] text-[10px] ${isVeoRec ? 'ring-2 ring-amber-400' : ''}`} onClick={() => onAnimate('veo-lite')} disabled={cut.isGeneratingVideo || !cut.imageMediaId}>🎬 Veo (8s)</PillButton>
                            </div>
                            {videoSrc && (
                                <PillButton variant="outline" className="h-10 mt-2 border-amber-500/50 text-amber-500 font-black" onClick={handleDownloadVideo} disabled={downloadState !== 'idle'} icon={<span className="material-symbols-outlined text-[18px]">download</span>}>
                                    {downloadState === 'idle' ? '💾 保存 (MP4)' : '保存中...'}
                                </PillButton>
                            )}
                        </div>
                    </div>

                    <div className="p-4 lg:p-6 bg-[#161616] border-t border-white/10 shrink-0 z-10">
                        <PillButton variant="solid" className="w-full h-11 bg-white text-black font-black" disabled={cut.isGeneratingImage || isRewriting} onClick={() => onRegenerateImage(IMAGE_MODELS[1].label, cut.promptEn, cut.negativePrompt)} icon={<span className="material-symbols-outlined">image</span>}>
                            {cut.isGeneratingImage ? '描画中...' : '画像を再描画'}
                        </PillButton>
                    </div>
                </div>
            </div>
        </div>
    );
};