import React, { useEffect, useState, useRef } from 'react';
import { XCircleIcon, DownloadIcon } from './icons';

interface ImageViewerProps {
    src: string;
    alt: string;
    onClose: () => void;
}

// Icons for the toolbar
const ZoomInIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/><path d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z"/></svg>;
const ZoomOutIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/><path d="M7 9h5v1H7z"/></svg>;
const ContrastIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><path d="M12 20c4.41 0 8-3.59 8-8s-3.59-8-8-8v16z"/></svg>;
const InvertIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M6.34 7.93c-3.12 3.12-3.12 8.19 0 11.31C7.9 20.8 9.95 21.58 12 21.58s4.1-.78 5.66-2.34c3.12-3.12 3.12-8.19 0-11.31l-11.32 0zM12 19.59c-1.6 0-3.11-.62-4.24-1.76C6.62 16.69 6 15.19 6 13.59s.62-3.11 1.76-4.24L12 13.59v6z"/></svg>;
const ResetIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>;

const ImageViewer: React.FC<ImageViewerProps> = ({ src, alt, onClose }) => {
    const [scale, setScale] = useState(1);
    const [contrast, setContrast] = useState(1);
    const [invert, setInvert] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.current.x,
            y: e.clientY - dragStart.current.y
        });
    };

    const handleMouseUp = () => setIsDragging(false);

    const resetView = () => {
        setScale(1);
        setContrast(1);
        setInvert(false);
        setPosition({ x: 0, y: 0 });
    };

    return (
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950/98 backdrop-blur-md animate-in fade-in duration-200">
            {/* Grid Background */}
            <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none"></div>

            {/* Header / Top Toolbar */}
            <div className="flex-shrink-0 p-4 flex justify-between items-center z-20 border-b border-white/10 bg-slate-900/80">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-500 animate-pulse"></div>
                    <div>
                        <div className="text-white text-xs font-mono font-bold uppercase tracking-widest">
                            PACS_VIEWER
                        </div>
                        <div className="text-white/50 text-[10px] font-mono">
                            {alt.substring(0, 40)}
                        </div>
                    </div>
                </div>
                
                {/* PACS Controls */}
                <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-sm border border-slate-700">
                     <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-sm" title="Zoom Out">
                        <ZoomOutIcon />
                    </button>
                    <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-sm" title="Zoom In">
                        <ZoomInIcon />
                    </button>
                    <div className="w-px h-4 bg-slate-700 mx-1"></div>
                    <button onClick={() => setContrast(c => c === 1 ? 1.5 : 1)} className={`p-2 rounded-sm ${contrast > 1 ? 'text-blue-400 bg-slate-700' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} title="Toggle High Contrast">
                        <ContrastIcon />
                    </button>
                    <button onClick={() => setInvert(i => !i)} className={`p-2 rounded-sm ${invert ? 'text-blue-400 bg-slate-700' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} title="Invert Colors (Bone Window)">
                        <InvertIcon />
                    </button>
                    <div className="w-px h-4 bg-slate-700 mx-1"></div>
                    <button onClick={resetView} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-sm" title="Reset View">
                        <ResetIcon />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                     <a 
                        href={src} 
                        download={`medical-image-${Date.now()}`}
                        className="p-2 border border-white/20 hover:bg-white/10 text-white transition-colors rounded-sm"
                        title="Download Original"
                    >
                        <DownloadIcon className="w-5 h-5" />
                    </a>
                    <button 
                        onClick={onClose}
                        className="p-2 border border-white/20 hover:bg-red-500/20 hover:border-red-500 hover:text-red-500 text-white transition-colors rounded-sm"
                    >
                        <XCircleIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Image Canvas */}
            <div 
                className="flex-1 w-full h-full flex items-center justify-center overflow-hidden relative bg-black cursor-move" 
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div 
                    className="relative transition-transform duration-100 ease-out"
                    style={{ 
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`
                    }}
                >
                    <img 
                        src={src} 
                        alt={alt} 
                        className="max-w-[85vw] max-h-[80vh] object-contain shadow-2xl border border-slate-800"
                        style={{
                            filter: `contrast(${contrast}) invert(${invert ? 1 : 0})`
                        }}
                        draggable={false}
                    />
                    
                    {/* Technical Reticle Overlay (Does not scale/move) */}
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-500/50 pointer-events-none"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-500/50 pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-500/50 pointer-events-none"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-500/50 pointer-events-none"></div>
                </div>

                {/* Status Overlay */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none flex gap-4">
                     <div className="bg-black/70 px-3 py-1 text-slate-400 text-[10px] font-mono uppercase tracking-widest border border-white/10 rounded-sm">
                        Zoom: {Math.round(scale * 100)}%
                    </div>
                    {contrast > 1 && (
                        <div className="bg-blue-900/50 px-3 py-1 text-blue-300 text-[10px] font-mono uppercase tracking-widest border border-blue-500/30 rounded-sm">
                            High Contrast
                        </div>
                    )}
                    {invert && (
                         <div className="bg-blue-900/50 px-3 py-1 text-blue-300 text-[10px] font-mono uppercase tracking-widest border border-blue-500/30 rounded-sm">
                            Inverted
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImageViewer;