
import React, { useState } from 'react';
import { XCircleIcon } from './icons';

interface BodyMapProps {
    onClose: () => void;
    onSelect: (region: string, symptom: string) => void;
}

// Stylized "Cyberpunk" Paths for Body Regions
const PATHS = {
    head: "M100,50 L120,50 L125,80 L95,80 L100,50 Z", // Simple placeholder, real path below
    chest: "M85,85 L135,85 L140,140 L80,140 Z",
    abdomen: "M80,145 L140,145 L135,190 L85,190 Z",
    leftArm: "M145,90 L170,90 L180,180 L160,180 Z",
    rightArm: "M75,90 L50,90 L40,180 L60,180 Z",
    legs: "M85,195 L135,195 L130,300 L90,300 Z"
};

// Detailed SVG Paths (Approximated for visual impact)
const DETAILED_PATHS = {
    Head: "M110,20 C125,20 135,35 135,55 C135,75 125,85 110,85 C95,85 85,75 85,55 C85,35 95,20 110,20 Z",
    Chest: "M85,90 L135,90 L145,150 L75,150 Z",
    Abdomen: "M75,155 L145,155 L140,210 L80,210 Z",
    LeftArm: "M140,95 L170,105 L180,200 L160,205 L145,155 Z",
    RightArm: "M80,95 L50,105 L40,200 L60,205 L75,155 Z",
    Pelvis: "M80,215 L140,215 L145,245 L75,245 Z",
    LeftLeg: "M115,250 L145,250 L150,400 L120,400 L115,250 Z",
    RightLeg: "M105,250 L75,250 L70,400 L100,400 L105,250 Z"
};

const SYMPTOMS = [
    "Pain", "Swelling", "Laceration", "Rash", "Numbness", "Weakness", "Burn"
];

const BodyMap: React.FC<BodyMapProps> = ({ onClose, onSelect }) => {
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

    const handleRegionClick = (region: string) => {
        setSelectedRegion(region);
    };

    const handleSymptomClick = (symptom: string) => {
        if (selectedRegion) {
            onSelect(selectedRegion, symptom);
            setSelectedRegion(null); // Close menu
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md animate-fade-in">
            {/* Modal Container */}
            <div className="relative w-full max-w-lg bg-slate-950 border-2 border-slate-800 rounded-sm shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px] md:h-auto">
                
                {/* Background Grid */}
                <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>

                {/* Left: 3D Visualization Area */}
                <div className="flex-1 relative flex items-center justify-center p-8 bg-gradient-radial from-blue-900/10 to-slate-950">
                    <h3 className="absolute top-4 left-4 text-xs font-mono font-bold text-blue-500 uppercase tracking-widest">
                        Anatomical_Selector // v1.0
                    </h3>

                    {/* SVG Body */}
                    <svg viewBox="0 0 220 420" className="h-[400px] w-auto drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                        <defs>
                            <linearGradient id="hologram" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="rgba(59, 130, 246, 0.1)" />
                                <stop offset="100%" stopColor="rgba(59, 130, 246, 0.3)" />
                            </linearGradient>
                            <filter id="glow">
                                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                                <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                            </filter>
                        </defs>

                        {Object.entries(DETAILED_PATHS).map(([region, path]) => (
                            <path
                                key={region}
                                d={path}
                                fill={selectedRegion === region ? "rgba(59, 130, 246, 0.6)" : "url(#hologram)"}
                                stroke="cyan"
                                strokeWidth="1.5"
                                className={`transition-all duration-300 cursor-pointer hover:fill-blue-500/40 hover:filter-drop-shadow`}
                                onClick={() => handleRegionClick(region)}
                                filter="url(#glow)"
                            />
                        ))}
                    </svg>

                    {/* Close Button */}
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-500 hover:text-red-500"
                    >
                        <XCircleIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Right: Context Menu (If region selected) */}
                <div className={`
                    w-full md:w-64 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-6 flex flex-col transition-all duration-300
                    ${selectedRegion ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-50 md:hidden'}
                `}>
                    <div className="mb-6">
                        <h4 className="text-xs font-mono text-slate-400 uppercase">Selected Region</h4>
                        <h2 className="text-xl font-bold text-white uppercase tracking-tight">{selectedRegion || "Select Region"}</h2>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[10px] font-mono font-bold text-blue-500 uppercase tracking-widest mb-2">
                            Observed Symptom
                        </p>
                        {SYMPTOMS.map(symptom => (
                            <button
                                key={symptom}
                                onClick={() => handleSymptomClick(symptom)}
                                className="w-full text-left px-4 py-3 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded-sm text-sm font-bold uppercase transition-colors border border-slate-700 hover:border-blue-500"
                            >
                                {symptom}
                            </button>
                        ))}
                    </div>
                    
                    <button 
                        onClick={() => setSelectedRegion(null)}
                        className="mt-auto py-3 text-xs font-mono text-slate-500 hover:text-white uppercase tracking-widest text-center"
                    >
                        Cancel Selection
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BodyMap;
