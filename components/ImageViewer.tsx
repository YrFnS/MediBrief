
import React, { useEffect } from 'react';
import { XCircleIcon, DownloadIcon } from './icons';

interface ImageViewerProps {
    src: string;
    alt: string;
    onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ src, alt, onClose }) => {
    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Toolbar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10">
                <div className="text-white/80 text-sm font-mono">
                    MEDICAL IMAGE VIEWER
                </div>
                <div className="flex items-center gap-4">
                     <a 
                        href={src} 
                        download={`medical-image-${Date.now()}`}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        title="Download Original"
                    >
                        <DownloadIcon className="w-6 h-6" />
                    </a>
                    <button 
                        onClick={onClose}
                        className="p-2 rounded-full bg-white/10 hover:bg-red-500/80 text-white transition-colors"
                    >
                        <XCircleIcon className="w-8 h-8" />
                    </button>
                </div>
            </div>

            {/* Image Container */}
            <div 
                className="w-full h-full p-4 md:p-12 flex items-center justify-center overflow-hidden" 
                onClick={onClose} // Click outside to close
            >
                <img 
                    src={src} 
                    alt={alt} 
                    className="max-w-full max-h-full object-contain shadow-2xl rounded-lg cursor-zoom-out"
                    onClick={(e) => e.stopPropagation()} // Prevent close when clicking image
                />
            </div>
            
            <div className="absolute bottom-6 left-0 right-0 text-center text-slate-400 text-xs uppercase tracking-widest pointer-events-none">
                {alt}
            </div>
        </div>
    );
};

export default ImageViewer;
