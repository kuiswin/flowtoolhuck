import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Cut, VideoModelType, KenBurnsPreset } from '../types';
import { 
  CAMERA_WORK_OPTIONS, 
  CAMERA_WORK_REGISTRY,
  IMAGE_MODELS, 
  VIDEO_MODELS_REGISTRY,
  KEN_BURNS_PRESETS, 
  TELOP_STYLE_REGISTRY,
  TELOP_TRANSITION_REGISTRY,
  TELOP_POSITION_REGISTRY,
  STUDIO_NEON_PALETTE,
  resolveNeonTheme,
  sanitizeFilename,
  resolveImageModel,
  resolveVideoModel,
  resolveTelopStyle,
  resolveTelopTransition,
  resolveTelopPosition,
  resolveRecommendedTelopStaging
} from '../constants';
import { Flow } from 'flow-sdk';
import { callWithRetry } from '../services/utils';
import { extractHighlights, buildLyricLines } from '../services/directorService';
import { normalizeKenBurnsPreset } from '../services/browserVideoService';
import { TextInput, SectionLabel, PillButton, ToggleSwitch, FieldDropdown } from './Primitives';

interface MediaPreviewModalProps {
    isOpen: boolean;
    cut: Cut;
    episodeId: number;
    currentImageModel?: string;
    isMvMode?: boolean;
    hasPrev?: boolean;
    hasNext?: boolean;
    onPrev?: () => void;
    onNext?: () => void;
    currentIndex?: number;
    totalCuts?: number;
    onClose: () => void;
    onAnimate: (m: VideoModelType) => void;
    onBrowserAnimate: () => void;
    onUpdateCut: (updates: Partial<Cut>) => void;
    onBulkRerollTelop?: (epId: number) => void;
    onRegenerateImage: (modelLabel: string, customPrompt?: string, customNeg?: string) => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
    isOpen, cut, episodeId, currentImageModel, isMvMode,
    hasPrev, hasNext, onPrev, onNext, currentIndex, totalCuts,
    onClose, onAnimate, onBrowserAnimate, onUpdateCut, onBulkRerollTelop, onRegenerateImage
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [aiWish, setAiWish] = useState('');
    const [isRewriting, setIsRewriting] = useState(false);
    const [showTelop, setShowTelop] = useState(true);
    const [newKeyword, setNewKeyword] = useState('');
    const [downloadState, setDownloadState] = useState<'idle' | 'saving' | 'done'>('idle');

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => { 
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowLeft' && onPrev) {
                onPrev();
            } else if (e.key === 'ArrowRight' && onNext) {
                onNext();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose, onPrev, onNext]);

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
                    const staging = resolveRecommendedTelopStaging(cut.id, isMvMode, false);
                    onUpdateCut({ 
                        telop: { 
                            fullText: text, 
                            highlights: auto,
                            style: cut.telop?.style || staging.style,
                            transition: cut.telop?.transition || staging.transition,
                            position: cut.telop?.position || staging.position,
                            directorNote: cut.telop?.directorNote || staging.directorNote
                        } 
                    });
                }
            }
        }
    }, [isOpen, cut.id]);

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

    const getKenBurnsClass = () => {
        if (videoSrc || !imageSrc) return '';
        const preset = normalizeKenBurnsPreset(cut.kenBurnsPreset);
        if (preset === 'none') return '';
        return `studio-kb-${preset}`;
    };

    // 複数行（2枠以上）の時に、行ごとに入り・出のベクトルをダイナミックに対向・ランダム化
    const getLineMotion = (lineIdx: number, totalLines: number, baseMotion: string, cutId: number) => {
        if (totalLines <= 1) return baseMotion;
        
        const motionPairs = [
            ['vook-motion-in-left-out-right', 'vook-motion-in-right-out-left'], // 1: 左右すれ違い突き抜けスルー
            ['vook-motion-in-top-out-down', 'vook-motion-in-bottom-out-up'],    // 2: 上下垂直クロス
            ['vook-motion-in-top-out-down', 'vook-motion-in-right-out-left'],   // 3: 上から落下 ＆ 右から突き抜け
            ['vook-motion-in-zoom-out-up', 'vook-motion-in-bottom-out-up'],     // 4: ズームイン昇天 ＆ 下からリフト
            ['vook-motion-in-left-out-left', 'vook-motion-in-right-out-right'], // 5: 各自リバース戻り
            ['vook-motion-in-zoom-out-down', 'vook-motion-in-left-out-right']   // 6: ズーム沈降 ＆ 左から右スルー
        ];
        const pairIdx = (cutId + lineIdx) % motionPairs.length;
        const pair = motionPairs[pairIdx];
        return pair[lineIdx % pair.length];
    };

    const telopContent = useMemo(() => {
        const rawText = (cut.telop?.fullText || cut.narrationJp || '').trim();
        if (!showTelop || !rawText) return null;
        
        const text = rawText;
        const highlights = (cut.telop?.highlights && cut.telop.highlights.length > 0)
            ? cut.telop.highlights 
            : extractHighlights(text);

        const transKey = cut.telop?.transition || 'blur-slide-left';
        const defaultMotionClass = 
          transKey === 'animista-slide-bck' ? 'vook-motion-animista-slide-bck' :
          transKey === 'aos-fade-soft' ? 'vook-motion-aos-fade-soft' :
          transKey === 'gsap-kinetic-stagger' ? 'vook-motion-gsap-kinetic-stagger' :
          transKey === 'blur-slide-up' ? 'vook-motion-blur-slide-up' :
          transKey === 'blur-slide-right' ? 'vook-motion-blur-slide-right' :
          transKey === 'zoom-in-bounce' ? 'vook-motion-zoom-bounce' :
          transKey === 'glow-fade' ? 'vook-motion-glow-fade' :
          transKey === 'glitch-pop' ? 'vook-motion-glitch-pop' :
          'vook-motion-blur-slide-left';

        const posKey = cut.telop?.position || 'bottom-center';
        const isPlateStyle = cut.telop?.style === 'cinema-subtle' || cut.telop?.style === 'traditional-sumi';

        if (!isPlateStyle) {
            const lyricLines = buildLyricLines(text, highlights);

            const isVertical = posKey === 'vertical-right' || posKey === 'vertical-left';
            const isRightSide = posKey === 'vertical-right';
            const isTop = posKey === 'top-cinema';
            const isCenter = posKey === 'center-climax' || posKey === 'center-stagger';
            const isLeft = posKey === 'bottom-left';
            const isRight = posKey === 'bottom-right';

            // 縦書きレイアウト（和モダン・エモMV風）
            if (isVertical) {
                return (
                    <div 
                        key={`${transKey}-${cut.telop?.style}-${posKey}-${text}`}
                        className={`absolute top-[8%] ${isRightSide ? 'right-[5%]' : 'left-[5%]'} h-[80%] max-h-[82%] flex ${isRightSide ? 'flex-row-reverse' : 'flex-row'} items-start gap-2.5 pointer-events-none z-40 select-none`}
                    >
                        {lyricLines.map((line, wIdx) => {
                            const delay = wIdx * 0.12;
                            const motionClass = getLineMotion(wIdx, lyricLines.length, defaultMotionClass, cut.id || 1);
                            
                            // 該当行のネオンテーマ（最初のハイライトから取得）
                            const firstHighlight = line.segments.find(s => s.isHighlight);
                            const neonTheme = firstHighlight 
                                ? resolveNeonTheme(firstHighlight.text, wIdx, cut.id || 1, firstHighlight.color)
                                : STUDIO_NEON_PALETTE[0];

                            return (
                                <div
                                    key={wIdx}
                                    className={`${motionClass} vertical-text-flow`}
                                    style={{
                                        animationDelay: `${delay}s`,
                                        animationFillMode: 'both'
                                    }}
                                >
                                    <div className={`inline-block whitespace-nowrap backdrop-blur-md rounded-2xl transition-all shadow-2xl px-2 py-4 ${
                                        line.hasHighlight 
                                          ? `bg-black/80 border ${neonTheme.border} ${neonTheme.shadow}` 
                                          : 'bg-black/55 border border-white/10'
                                    }`}>
                                        {line.segments.map((seg, sIdx) => {
                                            const segNeon = seg.isHighlight 
                                                ? resolveNeonTheme(seg.text, sIdx, cut.id || 1, seg.color)
                                                : null;

                                            return (
                                                <span
                                                    key={sIdx}
                                                    className="font-[900] select-none inline"
                                                    style={{
                                                        color: seg.isHighlight ? (segNeon?.color || '#FFE600') : '#FFFFFF',
                                                        fontSize: seg.isHighlight ? '1.45rem' : '1.2rem',
                                                        textShadow: seg.isHighlight ? segNeon?.glow : '0 2px 5px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.85)',
                                                        fontFamily: '"Zen Kaku Gothic New", "Montserrat", "Outfit", "Noto Sans JP", sans-serif',
                                                        letterSpacing: '0.14em',
                                                        lineHeight: 1.2
                                                    }}
                                                >
                                                    {seg.text}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            }

            // 横書きレイアウト
            const isClimax = posKey === 'center-climax';
            const xOffsets = isLeft 
                ? ['0%', '3%', '6%', '9%']
                : isRight
                ? ['0%', '-3%', '-6%', '-9%']
                : lyricLines.length === 1 ? ['0%'] :
                  lyricLines.length === 2 ? ['-4%', '4%'] :
                  ['-5%', '0%', '5%'];

            const angles = isLeft ? [-1.0, 0.8, -0.6, 0.8] : 
                           isRight ? [1.0, -0.8, 0.6, -0.8] : 
                           isClimax ? [-0.8, 0.8, -0.5] :
                           [-1.2, 0.8, -1.0, 1.2];

            const containerPositionClass = 
                isTop ? 'top-[7%] left-0 right-0 px-4 items-center justify-start' :
                isCenter ? 'top-1/2 left-0 right-0 -translate-y-1/2 px-4 items-center justify-center' :
                isLeft ? 'bottom-[6%] left-0 right-0 px-5 items-start justify-end' :
                isRight ? 'bottom-[6%] left-0 right-0 px-5 items-end justify-end' :
                'bottom-[8%] left-0 right-0 px-4 items-center justify-end';

            const alignmentClass = isLeft ? 'items-start text-left' : isRight ? 'items-end text-right' : 'items-center text-center';

            return (
                <div 
                    key={`${transKey}-${cut.telop?.style}-${posKey}-${text}`}
                    className={`absolute ${containerPositionClass} w-full flex flex-col pointer-events-none z-40 select-none`}
                >
                    <div className={`flex flex-col ${alignmentClass} gap-2 w-full max-w-[96%]`}>
                        {lyricLines.map((line, wIdx) => {
                            const angle = angles[wIdx % angles.length];
                            const xOff = xOffsets[wIdx] || '0%';
                            const delay = wIdx * 0.12;

                            // 1シーン内の各枠ごとに異なる入出方向を割り当て！
                            const motionClass = getLineMotion(wIdx, lyricLines.length, defaultMotionClass, cut.id || 1);

                            // 行ごとのメインネオンテーマ
                            const firstHighlight = line.segments.find(s => s.isHighlight);
                            const neonTheme = firstHighlight 
                                ? resolveNeonTheme(firstHighlight.text, wIdx, cut.id || 1, firstHighlight.color)
                                : STUDIO_NEON_PALETTE[0];

                            return (
                                <div
                                    key={wIdx}
                                    className={`${motionClass} ${isRight ? 'self-end' : isLeft ? 'self-start' : 'self-center'}`}
                                    style={{
                                        transform: `translateX(${xOff}) rotate(${angle}deg)`,
                                        animationDelay: `${delay}s`,
                                        animationFillMode: 'both'
                                    }}
                                >
                                    <div className={`inline-flex items-baseline whitespace-nowrap backdrop-blur-md rounded-xl transition-all shadow-2xl px-3.5 py-1 ${
                                        line.hasHighlight 
                                          ? `bg-black/75 border ${neonTheme.border} ${neonTheme.shadow}` 
                                          : 'bg-black/50 border border-white/10'
                                    }`}>
                                        {line.segments.map((seg, sIdx) => {
                                            const segNeon = seg.isHighlight 
                                                ? resolveNeonTheme(seg.text, sIdx, cut.id || 1, seg.color)
                                                : null;

                                            return (
                                                <span
                                                    key={sIdx}
                                                    className="font-[900] select-none inline-block align-baseline whitespace-nowrap"
                                                    style={{
                                                        color: seg.isHighlight ? (segNeon?.color || '#FFE600') : '#FFFFFF',
                                                        fontSize: isClimax 
                                                          ? (seg.isHighlight ? '1.85rem' : '1.4rem')
                                                          : (seg.isHighlight ? '1.55rem' : '1.25rem'),
                                                        textShadow: seg.isHighlight ? segNeon?.glow : '0 2px 5px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.85)',
                                                        fontFamily: '"Zen Kaku Gothic New", "Montserrat", "Outfit", "Noto Sans JP", sans-serif',
                                                        letterSpacing: seg.isHighlight ? '0.03em' : '0.01em',
                                                        lineHeight: 1.15
                                                    }}
                                                >
                                                    {seg.text}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        // プレートスタイル（cinema-subtle / traditional-sumi）
        // 各ハイライト単語に対して単語単位で一意のテーマを確定（単語内の全文字で色が完全に一致することを保証）
        const wordThemeMap = new Map<string, { color: string; glow: string; border: string; shadow: string }>();
        highlights.forEach((h, hIdx) => {
            if (!h.word) return;
            const theme = resolveNeonTheme(h.word, hIdx, cut.id || 1, h.color);
            wordThemeMap.set(h.word, theme);
        });

        const highlightIndices = new Map<number, { color: string; sizeScale: number; word: string; glow: string }>();
        highlights.forEach((h, hIdx) => {
            if (!h.word) return;
            const theme = wordThemeMap.get(h.word) || STUDIO_NEON_PALETTE[0];
            let pos = 0;
            while ((pos = text.indexOf(h.word, pos)) !== -1) {
                for (let k = 0; k < h.word.length; k++) {
                    highlightIndices.set(pos + k, {
                        word: h.word,
                        color: theme.color,
                        glow: theme.glow,
                        sizeScale: h.sizeScale || 1.15
                    });
                }
                pos += 1;
            }
        });

        const platePosClass = 
            posKey === 'top-cinema' ? 'top-[6%] items-center' :
            (posKey === 'center-climax' || posKey === 'center-stagger') ? 'top-1/2 -translate-y-1/2 items-center' :
            posKey === 'bottom-left' ? 'bottom-[5%] items-start pl-6' :
            posKey === 'bottom-right' ? 'bottom-[5%] items-end pr-6' :
            'bottom-[5%] items-center';

        return (
            <div 
                key={`${transKey}-${cut.telop?.style}-${posKey}-${text}`}
                className={`absolute ${platePosClass} left-0 w-full px-4 flex flex-col pointer-events-none z-40 ${defaultMotionClass}`}
                style={{ animationFillMode: 'both' }}
            >
                {/* テロップ背景プレート（シネマ風グラスモーフィズム） */}
                <div className="bg-black/70 backdrop-blur-md rounded-2xl px-5 py-2.5 flex flex-wrap justify-center items-baseline max-w-[92%] shadow-xl shadow-black/40 border border-white/15 leading-snug">
                    {text.split('').map((char, i) => {
                        const isKanji = /[\u4e00-\u9faf]/.test(char);
                        const isPunctuation = /[。、！？…]/.test(char);
                        const highlight = highlightIndices.get(i);
                        
                        const color = highlight ? highlight.color : '#FFFFFF';
                        const glow = highlight ? highlight.glow : '0 2px 5px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.9)';
                        const scale = (isKanji ? 1.05 : 1.0) * (highlight ? highlight.sizeScale : 1.0);

                        return (
                            <span 
                                key={i}
                                className="font-[900] tracking-normal select-none"
                                style={{ 
                                    color: color, 
                                    fontSize: `${scale * 1.15}rem`, 
                                    display: isPunctuation ? 'inline' : 'inline-block',
                                    margin: isPunctuation ? '0 1px 0 -1px' : '0 0.5px',
                                    textShadow: glow,
                                    fontFamily: '"Zen Kaku Gothic New", "Montserrat", "Noto Sans JP", sans-serif'
                                }}
                            >
                                {char}
                            </span>
                        );
                    })}
                </div>
            </div>
        );
    }, [showTelop, cut.telop, cut.narrationJp, cut.id]);

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 select-none">
            <div className="absolute inset-0 bg-black/98 backdrop-blur-xl" onClick={onClose} />

            <div className="relative w-full max-w-[1200px] h-[95vh] lg:h-[85vh] bg-[#0c0c0c] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row animate-in fade-in zoom-in-95 duration-200">
                
                {/* Canvas Area */}
                <div className="flex-1 bg-black relative flex items-center justify-center p-3 sm:p-6 lg:p-10 min-h-0 overflow-hidden">
                    <div className="relative h-full w-full flex items-center justify-center">

                        {/* ── 👈 前のカットへ移動する矢印ボタン ── */}
                        {hasPrev && onPrev && (
                            <button
                                type="button"
                                onClick={e => { e.stopPropagation(); onPrev(); }}
                                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-50 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/75 hover:bg-amber-500 hover:text-black border border-white/20 hover:border-amber-400 text-white backdrop-blur-md flex items-center justify-center transition-all shadow-2xl cursor-pointer hover:scale-110 active:scale-95 group"
                                title="前のカットへ移動 (キーボード ←)"
                            >
                                <span className="material-symbols-outlined text-[26px] sm:text-[30px] group-hover:-translate-x-0.5 transition-transform">chevron_left</span>
                            </button>
                        )}

                        {/* ── 👉 次のカットへ移動する矢印ボタン ── */}
                        {hasNext && onNext && (
                            <button
                                type="button"
                                onClick={e => { e.stopPropagation(); onNext(); }}
                                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-50 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/75 hover:bg-amber-500 hover:text-black border border-white/20 hover:border-amber-400 text-white backdrop-blur-md flex items-center justify-center transition-all shadow-2xl cursor-pointer hover:scale-110 active:scale-95 group"
                                title="次のカットへ移動 (キーボード →)"
                            >
                                <span className="material-symbols-outlined text-[26px] sm:text-[30px] group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                            </button>
                        )}

                        {/* ── カット番号インジケーター ── */}
                        {currentIndex !== undefined && totalCuts !== undefined && (
                            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-50 px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-white/90 text-[11px] font-bold flex items-center gap-1.5 shadow-xl select-none">
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                <span>Cut {currentIndex} / {totalCuts}</span>
                            </div>
                        )}

                        <div className="relative h-full max-h-full aspect-[9/16] shadow-2xl rounded-xl overflow-hidden border border-white/10 group bg-[#111] flex items-center justify-center">

                            {videoSrc ? (
                                <video ref={videoRef} src={videoSrc} className="w-full h-full object-contain block" autoPlay loop playsInline />
                            ) : imageSrc ? (
                                <div className="w-full h-full overflow-hidden flex items-center justify-center">
                                    <img src={imageSrc} className={`w-full h-full object-contain block ${getKenBurnsClass()}`} alt="Preview" />
                                </div>
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-white/10 gap-3 uppercase tracking-widest text-[10px]">Rendering</div>
                            )}

                            {telopContent}

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

                            <div className="flex items-center justify-between">
                                <SectionLabel>テロップ設定</SectionLabel>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const rawText = cut.telop?.fullText || cut.narrationJp || '';
                                        const highlights = (cut.telop?.highlights && cut.telop.highlights.length > 0)
                                            ? cut.telop.highlights 
                                            : extractHighlights(rawText);
                                        const staging = resolveRecommendedTelopStaging(cut.id, isMvMode, false, {
                                            transition: cut.telop?.transition,
                                            position: cut.telop?.position,
                                            style: cut.telop?.style
                                        });
                                        onUpdateCut({
                                            telop: {
                                                fullText: rawText,
                                                highlights,
                                                style: staging.style,
                                                transition: staging.transition,
                                                position: staging.position,
                                                directorNote: staging.directorNote
                                            }
                                        });
                                    }}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-500/20 hover:bg-purple-500/35 text-purple-300 border border-purple-500/40 flex items-center gap-1 transition-all"
                                    title="画像は変更せず、このカットのテロップ演出（動き・配置・スタイル）だけを再抽選します"
                                >
                                    <span className="material-symbols-outlined text-[13px]">casino</span>
                                    演出リロール
                                </button>
                            </div>
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

                                {/* ── 🎬 Vook風テロップ演出セレクター ── */}
                                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                                    <FieldDropdown 
                                        label="演出スタイル" 
                                        value={TELOP_STYLE_REGISTRY.find(s => s.id === cut.telop?.style)?.name || TELOP_STYLE_REGISTRY[0].name} 
                                        options={TELOP_STYLE_REGISTRY.map(s => s.name)} 
                                        onChange={name => {
                                            const found = TELOP_STYLE_REGISTRY.find(s => s.name === name);
                                            if (found) {
                                                onUpdateCut({ 
                                                    telop: { 
                                                        ...cut.telop!, 
                                                        style: found.id,
                                                        transition: cut.telop?.transition || found.defaultTransition,
                                                        position: cut.telop?.position || found.defaultPosition
                                                    } 
                                                });
                                            }
                                        }} 
                                    />
                                    <FieldDropdown 
                                        label="トランジション" 
                                        value={TELOP_TRANSITION_REGISTRY.find(t => t.id === cut.telop?.transition)?.name || TELOP_TRANSITION_REGISTRY[0].name} 
                                        options={TELOP_TRANSITION_REGISTRY.map(t => t.name)} 
                                        onChange={name => {
                                            const found = TELOP_TRANSITION_REGISTRY.find(t => t.name === name);
                                            if (found) {
                                                onUpdateCut({ 
                                                    telop: { 
                                                        ...cut.telop!, 
                                                        transition: found.id 
                                                    } 
                                                });
                                            }
                                        }} 
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    <FieldDropdown 
                                        label="テロップ配置構図" 
                                        value={TELOP_POSITION_REGISTRY.find(p => p.id === cut.telop?.position)?.name || TELOP_POSITION_REGISTRY[0].name} 
                                        options={TELOP_POSITION_REGISTRY.map(p => p.name)} 
                                        onChange={name => {
                                            const found = TELOP_POSITION_REGISTRY.find(p => p.name === name);
                                            if (found) {
                                                onUpdateCut({ 
                                                    telop: { 
                                                        ...cut.telop!, 
                                                        position: found.id 
                                                    } 
                                                });
                                            }
                                        }} 
                                    />
                                </div>

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

                            {(() => {
                                const currentCw = CAMERA_WORK_REGISTRY.find(c => c.id === cut.cameraWork || c.motionPrompt === cut.cameraMotion || (cut.kenBurnsPreset && cut.kenBurnsPreset !== 'none' && c.recommendedKenBurns === cut.kenBurnsPreset)) || CAMERA_WORK_REGISTRY[0];
                                const currentKb = KEN_BURNS_PRESETS.find(p => p.value === normalizeKenBurnsPreset(cut.kenBurnsPreset)) || KEN_BURNS_PRESETS[0];
                                return (
                                    <div className="grid grid-cols-2 gap-2">
                                        <FieldDropdown label="カメラワーク" value={currentCw.label} options={CAMERA_WORK_REGISTRY.map(c => c.label)} onChange={l => {
                                            const cw = CAMERA_WORK_REGISTRY.find(c => c.label === l);
                                            if (cw) onUpdateCut({ cameraWork: cw.id, cameraMotion: cw.motionPrompt, kenBurnsPreset: cw.recommendedKenBurns });
                                        }} />
                                        <FieldDropdown label="ケンバーン演出" value={currentKb.label} options={KEN_BURNS_PRESETS.map(p => p.label)} onChange={l => {
                                            const kb = KEN_BURNS_PRESETS.find(p => p.label === l);
                                            if (kb) {
                                                const cw = CAMERA_WORK_REGISTRY.find(c => c.recommendedKenBurns === kb.value);
                                                onUpdateCut({ kenBurnsPreset: kb.value as KenBurnsPreset, ...(cw ? { cameraWork: cw.id, cameraMotion: cw.motionPrompt } : {}) });
                                            }
                                        }} />
                                    </div>
                                );
                            })()}

                            <TextInput label="画像プロンプト (EN)" value={cut.promptEn || ''} onChange={v => onUpdateCut({ promptEn: v })} />

                            {/* ── 🎨 画像生成インプット解析インスペクター ── */}
                            <div className="flex flex-col gap-2 p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 mt-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black text-purple-300 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[15px] text-purple-400">tune</span>
                                        画像生成インプット解析 (Prompt Inspector)
                                    </span>
                                    <span className="text-[9px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                                        {cut.styleKeyUsed ? `画風: ${cut.styleKeyUsed.split(' (')[0].split('（')[0]}` : '画風情報'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                    <div className="bg-black/50 p-2 rounded-lg border border-white/5 flex flex-col">
                                        <span className="text-white/40 font-bold text-[9px]">適用画風 (Style)</span>
                                        <span className="text-white/90 font-medium truncate" title={cut.styleKeyUsed || '未記録'}>
                                            {cut.styleKeyUsed || '未記録'}
                                        </span>
                                    </div>
                                    <div className="bg-black/50 p-2 rounded-lg border border-white/5 flex flex-col">
                                        <span className="text-white/40 font-bold text-[9px]">使用モデル (Model)</span>
                                        <span className="text-white/90 font-medium truncate" title={cut.imageModelUsed || currentImageModel || '未記録'}>
                                            {cut.imageModelUsed || currentImageModel || '未記録'}
                                        </span>
                                    </div>
                                </div>

                                {/* 実際にAPIへ送られた完全合成プロンプト */}
                                <div className="flex flex-col gap-1 bg-black/60 p-2.5 rounded-lg border border-white/5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                                            <span>⚡ 送信された完全プロンプト (Master Prompt)</span>
                                        </span>
                                        {cut.finalPromptUsed && (
                                            <button 
                                                type="button" 
                                                onClick={() => navigator.clipboard.writeText(cut.finalPromptUsed || '')}
                                                className="text-[9px] text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/40 px-1.5 py-0.5 rounded border border-amber-500/30 transition-colors cursor-pointer"
                                            >
                                                コピー
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-white/70 font-mono leading-relaxed max-h-24 overflow-y-auto dark-scrollbar select-text break-words">
                                        {cut.finalPromptUsed || (cut.promptEn ? `(推定) Masterpiece, authentic ${cut.styleKeyUsed || ''}... ${cut.promptEn}` : '生成ログがありません')}
                                    </p>
                                </div>

                                {/* 送信されたネガティブプロンプト */}
                                <div className="flex flex-col gap-1 bg-black/60 p-2.5 rounded-lg border border-white/5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-red-400 flex items-center gap-1">
                                            <span>🚫 送信されたネガティブプロンプト</span>
                                        </span>
                                        {cut.finalNegativeUsed && (
                                            <button 
                                                type="button" 
                                                onClick={() => navigator.clipboard.writeText(cut.finalNegativeUsed || '')}
                                                className="text-[9px] text-red-300 hover:text-white bg-red-500/20 hover:bg-red-500/40 px-1.5 py-0.5 rounded border border-red-500/30 transition-colors cursor-pointer"
                                            >
                                                コピー
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-white/70 font-mono leading-relaxed max-h-20 overflow-y-auto dark-scrollbar select-text break-words">
                                        {cut.finalNegativeUsed || cut.negativePrompt || '（指定なし）'}
                                    </p>
                                </div>
                            </div>

                            {/* ── 🎬 ディレクター演出・テロップ解析インスペクター ── */}
                            {(() => {
                                const staging = resolveRecommendedTelopStaging(cut.id, isMvMode, false);
                                const currentStyle = resolveTelopStyle(cut.telop?.style || staging.style);
                                const currentTrans = resolveTelopTransition(cut.telop?.transition || staging.transition);
                                const currentPos = cut.telop?.position || staging.position;
                                const posLabel = resolveTelopPosition(currentPos).name;
                                const directorNote = cut.telop?.directorNote || staging.directorNote;

                                return (
                                    <div className="flex flex-col gap-2 p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 mt-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-black text-amber-300 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-[15px] text-amber-400">movie_edit</span>
                                                ディレクター演出解析 (Director Staging & Telop)
                                            </span>
                                            <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[11px]">auto_awesome</span>
                                                AI Director 指示
                                            </span>
                                        </div>

                                        {/* ディレクターの演出意図 (Director's Intent) */}
                                        <div className="flex flex-col gap-1 bg-black/60 p-2.5 rounded-lg border border-amber-500/20">
                                            <span className="text-[9.5px] font-bold text-amber-400/90 flex items-center gap-1">
                                                <span>💡 カット演出意図 (Director's Intent)</span>
                                            </span>
                                            <p className="text-[10.5px] text-white/90 font-medium leading-relaxed select-text">
                                                {directorNote}
                                            </p>
                                        </div>

                                        {/* スタイル & モーショントランジション */}
                                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                                            <div className="bg-black/50 p-2 rounded-lg border border-white/5 flex flex-col gap-0.5">
                                                <span className="text-white/40 font-bold text-[9px]">演出スタイル (Style)</span>
                                                <span className="text-amber-300 font-bold truncate flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: currentStyle.badgeColor || '#FFE600' }} />
                                                    {currentStyle.name.split(' (')[0]}
                                                </span>
                                                <span className="text-white/40 text-[8.5px] truncate" title={currentStyle.description}>
                                                    {currentStyle.description}
                                                </span>
                                            </div>
                                            <div className="bg-black/50 p-2 rounded-lg border border-white/5 flex flex-col gap-0.5">
                                                <span className="text-white/40 font-bold text-[9px]">トランジション (Motion)</span>
                                                <span className="text-cyan-300 font-bold truncate flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[12px]">{currentTrans.icon}</span>
                                                    {currentTrans.name}
                                                </span>
                                                <span className="text-white/40 text-[8.5px] truncate" title={currentTrans.description}>
                                                    {currentTrans.description}
                                                </span>
                                            </div>
                                        </div>

                                        {/* テロップ配置 ＆ タイポグラフィ特効 */}
                                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                                            <div className="bg-black/50 p-2 rounded-lg border border-white/5 flex flex-col">
                                                <span className="text-white/40 font-bold text-[9px]">配置構図 (Placement)</span>
                                                <span className="text-white/90 font-bold truncate" title={posLabel}>
                                                    {posLabel.split(' (')[0]}
                                                </span>
                                            </div>
                                            <div className="bg-black/50 p-2 rounded-lg border border-white/5 flex flex-col">
                                                <span className="text-white/40 font-bold text-[9px]">タイポグラフィ特効</span>
                                                <span className="text-white/90 font-bold truncate" title="Zen Kaku Gothic New (900) + Vook Directional Blur Ease-Out">
                                                    Zen Kaku Gothic (900)
                                                </span>
                                            </div>
                                        </div>

                                        {/* 強調キーワード点灯状況 */}
                                        <div className="flex flex-col gap-1 bg-black/40 p-2 rounded-lg border border-white/5">
                                            <span className="text-[9px] font-bold text-white/50">✨ 強調キーワード点灯状況:</span>
                                            <div className="flex flex-wrap gap-1">
                                                {cut.telop?.highlights && cut.telop.highlights.length > 0 ? (
                                                    cut.telop.highlights.map((h, i) => {
                                                        const isLit = cut.telop?.fullText?.includes(h.word);
                                                        return (
                                                            <span key={i} className={`px-1.5 py-0.5 rounded text-[9px] font-bold border flex items-center gap-1 ${isLit ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 shadow-[0_0_8px_rgba(255,230,0,0.15)]' : 'bg-white/5 border-white/10 text-white/30'}`}>
                                                                <span>{isLit ? '✨' : '⚪'}</span>
                                                                <span>{h.word}</span>
                                                                <span className="text-[8px] opacity-75">{isLit ? '(特大・ゴールド)' : '(未検出)'}</span>
                                                            </span>
                                                        );
                                                    })
                                                ) : (
                                                    <span className="text-[9px] text-white/30 italic">なし（全体均一表示）</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* 🎲 テロップ演出リロール（画像そのまま） */}
                                        <div className="flex gap-2 pt-1 border-t border-white/5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const rawText = cut.telop?.fullText || cut.narrationJp || '';
                                                    const highlights = (cut.telop?.highlights && cut.telop.highlights.length > 0)
                                                        ? cut.telop.highlights 
                                                        : extractHighlights(rawText);
                                                    const staging = resolveRecommendedTelopStaging(cut.id, isMvMode, false, {
                                                        transition: cut.telop?.transition,
                                                        position: cut.telop?.position,
                                                        style: cut.telop?.style
                                                    });
                                                    onUpdateCut({
                                                        telop: {
                                                            fullText: rawText,
                                                            highlights,
                                                            style: staging.style,
                                                            transition: staging.transition,
                                                            position: staging.position,
                                                            directorNote: staging.directorNote
                                                        }
                                                    });
                                                }}
                                                className="flex-1 py-1.5 px-2.5 rounded-lg text-[10px] font-black bg-purple-500/25 hover:bg-purple-500/40 text-purple-200 border border-purple-500/50 flex items-center justify-center gap-1 transition-all shadow-md shadow-purple-950/20"
                                                title="画像は変更せず、このカットのテロップ演出（動き・配置・スタイル）だけを再抽選します"
                                            >
                                                <span className="material-symbols-outlined text-[13px]">casino</span>
                                                このカットの演出を再抽選
                                            </button>
                                            {onBulkRerollTelop && (
                                                <button
                                                    type="button"
                                                    onClick={() => onBulkRerollTelop(episodeId)}
                                                    className="py-1.5 px-3 rounded-lg text-[10px] font-black bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/40 flex items-center justify-center gap-1 transition-all"
                                                    title="全12カットのテロップ演出を一気に再抽選（画像は保持）"
                                                >
                                                    <span className="material-symbols-outlined text-[13px]">auto_mode</span>
                                                    全カット一括リロール
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
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