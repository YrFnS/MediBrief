import React, { useEffect, useRef, useState } from 'react';
import { DownloadIcon, XCircleIcon } from './icons';

interface ImageViewerProps {
    src: string;
    alt: string;
    onClose: () => void;
}

const ZoomInIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        <path d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z" />
    </svg>
);

const ZoomOutIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        <path d="M7 9h5v1H7z" />
    </svg>
);

const ContrastIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
        <path d="M12 20c4.41 0 8-3.59 8-8s-3.59-8-8-8v16z" />
    </svg>
);

const InvertIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M6.34 7.93c-3.12 3.12-3.12 8.19 0 11.31C7.9 20.8 9.95 21.58 12 21.58s4.1-.78 5.66-2.34c3.12-3.12 3.12-8.19 0-11.31l-11.32 0zM12 19.59c-1.6 0-3.11-.62-4.24-1.76C6.62 16.69 6 15.19 6 13.59s.62-3.11 1.76-4.24L12 13.59v6z" />
    </svg>
);

const ResetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
    </svg>
);

const ImageViewer: React.FC<ImageViewerProps> = ({ src, alt, onClose }) => {
    const [scale, setScale] = useState(1);
    const [contrast, setContrast] = useState(1);
    const [invert, setInvert] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const handleMouseDown = (event: React.MouseEvent) => {
        setIsDragging(true);
        dragStart.current = {
            x: event.clientX - position.x,
            y: event.clientY - position.y,
        };
    };

    const handleMouseMove = (event: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: event.clientX - dragStart.current.x,
            y: event.clientY - dragStart.current.y,
        });
    };

    const resetView = () => {
        setScale(1);
        setContrast(1);
        setInvert(false);
        setPosition({ x: 0, y: 0 });
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950/98 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-grid-pattern pointer-events-none absolute inset-0 opacity-5" />

            <div className="z-20 flex flex-shrink-0 items-center justify-between border-b border-white/10 bg-slate-900/80 p-4">
                <div className="flex items-center gap-3">
                    <div className="h-2 w-2 bg-blue-500" />
                    <div>
                        <div className="text-xs font-mono font-bold uppercase tracking-widest text-white">
                            Medical Image Viewer
                        </div>
                        <div className="text-[10px] font-mono text-white/50">
                            {alt.substring(0, 40)}
                        </div>
                        <div className="text-[9px] text-amber-300/80">
                            Basic image controls — not a DICOM/PACS workstation
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 rounded-sm border border-slate-700 bg-slate-800 p-1">
                    <button
                        onClick={() => setScale(value => Math.max(0.5, value - 0.25))}
                        className="rounded-sm p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
                        title="Zoom out"
                    >
                        <ZoomOutIcon />
                    </button>
                    <button
                        onClick={() => setScale(value => Math.min(3, value + 0.25))}
                        className="rounded-sm p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
                        title="Zoom in"
                    >
                        <ZoomInIcon />
                    </button>
                    <div className="mx-1 h-4 w-px bg-slate-700" />
                    <button
                        onClick={() => setContrast(value => value === 1 ? 1.5 : 1)}
                        className={`rounded-sm p-2 ${contrast > 1
                            ? 'bg-slate-700 text-blue-400'
                            : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                        title="Toggle display contrast"
                    >
                        <ContrastIcon />
                    </button>
                    <button
                        onClick={() => setInvert(value => !value)}
                        className={`rounded-sm p-2 ${invert
                            ? 'bg-slate-700 text-blue-400'
                            : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                        }`}
                        title="Invert display colors"
                    >
                        <InvertIcon />
                    </button>
                    <div className="mx-1 h-4 w-px bg-slate-700" />
                    <button
                        onClick={resetView}
                        className="rounded-sm p-2 text-slate-400 hover:bg-slate-700 hover:text-white"
                        title="Reset view"
                    >
                        <ResetIcon />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <a
                        href={src}
                        download={`medical-image-${Date.now()}`}
                        className="rounded-sm border border-white/20 p-2 text-white transition-colors hover:bg-white/10"
                        title="Download original"
                    >
                        <DownloadIcon className="h-5 w-5" />
                    </a>
                    <button
                        onClick={onClose}
                        className="rounded-sm border border-white/20 p-2 text-white transition-colors hover:border-red-500 hover:bg-red-500/20 hover:text-red-500"
                        aria-label="Close image viewer"
                    >
                        <XCircleIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>

            <div
                className="relative flex h-full w-full flex-1 cursor-move items-center justify-center overflow-hidden bg-black"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
            >
                <div
                    className="relative transition-transform duration-100 ease-out"
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    }}
                >
                    <img
                        src={src}
                        alt={alt}
                        className="max-h-[80vh] max-w-[85vw] border border-slate-800 object-contain shadow-2xl"
                        style={{
                            filter: `contrast(${contrast}) invert(${invert ? 1 : 0})`,
                        }}
                        draggable={false}
                    />
                    <div className="pointer-events-none absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-blue-500/50" />
                    <div className="pointer-events-none absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-blue-500/50" />
                    <div className="pointer-events-none absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-blue-500/50" />
                    <div className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-blue-500/50" />
                </div>

                <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-4">
                    <div className="rounded-sm border border-white/10 bg-black/70 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-slate-400">
                        Zoom: {Math.round(scale * 100)}%
                    </div>
                    {contrast > 1 && (
                        <div className="rounded-sm border border-blue-500/30 bg-blue-900/50 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-blue-300">
                            Display contrast enhanced
                        </div>
                    )}
                    {invert && (
                        <div className="rounded-sm border border-blue-500/30 bg-blue-900/50 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-blue-300">
                            Colors inverted
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImageViewer;
