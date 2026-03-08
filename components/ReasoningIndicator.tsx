import React, { useState, useEffect } from 'react';
import { ChatMode } from '../types';

interface ReasoningIndicatorProps {
    mode: ChatMode;
}

const STEPS = [
    "INITIALIZING CONTEXT SCAN...",
    "CROSS-REFERENCING ALLERGIES...",
    "ANALYZING CONTRAINDICATIONS...",
    "SYNTHESIZING CLINICAL DATA..."
];

const LIVE_STEPS = [
    "AUDIO STREAM ACTIVE...",
    "TRANSCRIBING INPUT...",
    "SAFETY CONSTRAINTS CHECK...",
    "GENERATING RESPONSE..."
];

const ReasoningIndicator: React.FC<ReasoningIndicatorProps> = ({ mode }) => {
    const currentSteps = mode === ChatMode.Live ? LIVE_STEPS : STEPS;
    const [stepIndex, setStepIndex] = useState(0);
    
    useEffect(() => {
        const interval = setInterval(() => {
            setStepIndex((prev) => (prev + 1) % currentSteps.length);
        }, 1200);
        return () => clearInterval(interval);
    }, [currentSteps.length]);

    const activeStep = currentSteps[stepIndex];

    return (
        <div className="flex flex-col gap-2 p-1 w-full max-w-md animate-fade-in font-mono text-[10px]">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
                <span className="animate-pulse">●</span>
                <span className="font-bold tracking-widest uppercase">System Reasoning</span>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-900/50 text-blue-600 dark:text-blue-400 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner overflow-hidden relative technical-border">
                <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none"></div>
                
                <div className="flex flex-col gap-1.5 relative z-10">
                    {currentSteps.map((step, i) => {
                         const isActive = i === stepIndex;
                         const isPast = i < stepIndex;
                         return (
                            <div key={i} className={`flex items-center justify-between transition-all duration-500 ${isActive ? 'opacity-100 translate-x-1' : isPast ? 'opacity-40' : 'opacity-10'}`}>
                                <span className="flex items-center gap-2">
                                    <span className={isActive ? 'text-blue-500' : 'text-slate-400'}>{isActive ? '→' : ' '}</span>
                                    {step}
                                </span>
                                {isPast && <span className="text-[8px] font-bold text-emerald-500">[OK]</span>}
                                {isActive && <div className="flex gap-0.5">
                                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"></div>
                                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse [animation-delay:200ms]"></div>
                                </div>}
                            </div>
                         )
                    })}
                </div>
            </div>
        </div>
    );
};

export default ReasoningIndicator;