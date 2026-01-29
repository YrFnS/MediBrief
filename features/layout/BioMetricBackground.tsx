
import React from 'react';

const BioMetricBackground: React.FC = () => {
    return (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none bg-slate-50">
            {/* 1. Organic Breath - Top Right */}
            <div className="absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] bg-blue-100/50 rounded-full blur-[120px] animate-breathe mix-blend-multiply opacity-60"></div>

            {/* 2. Stabilizing Presence - Bottom Left */}
            <div className="absolute -bottom-[20%] -left-[10%] w-[60vw] h-[60vw] bg-teal-100/50 rounded-full blur-[100px] animate-breathe mix-blend-multiply opacity-50" style={{ animationDelay: '2s' }}></div>

            {/* 3. Subtle Texture - Very faint noise for paper-like feel */}
            <div className="absolute inset-0 opacity-[0.015]" 
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}>
            </div>
        </div>
    );
};

export default BioMetricBackground;
