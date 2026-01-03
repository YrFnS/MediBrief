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
    const [stepIndex, setStepIndex] = useState(0);
    
    useEffect(() => {
        const interval = setInterval(() => {
            setStepIndex((prev) => (prev + 1) % STEPS.length);
        }, 1200);
        return () => clearInterval(interval);
    }, []);

    const currentSteps = mode === ChatMode.Live ? LIVE_STEPS : STEPS;
    const activeStep = currentSteps[stepIndex];

    return (
        <div className="flex flex-col gap-2 p-3 w-full max-w-md animate-fade-in font-mono text-xs">
            <div className="flex items-center gap-2 text-blue-500 mb-1">
                <span className="animate-pulse">●</span>
                <span className="font-bold tracking-widest uppercase">System Reasoning</span>
            </div>
            
            <div className="bg-slate-900 text-green-500 p-3 rounded-md border border-slate-800 shadow-inner overflow-hidden relative">
                <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
                
                <div className="flex flex-col gap-1 relative z-10">
                    {currentSteps.map((step, i) => {
                         const isActive = i === stepIndex;
                         const isPast = i < stepIndex;
                         return (
                            <div key={i} className={`flex items-center justify-between ${isActive ? 'opacity-100' : isPast ? 'opacity-50' : 'opacity-20'}`}>
                                <span>{`> ${step}`}</span>
                                {isPast && <span>[OK]</span>}
                                {isActive && <span className="animate-pulse">...</span>}
                            </div>
                         )
                    })}
                </div>
            </div>
        </div>
    );
};

export default ReasoningIndicator;