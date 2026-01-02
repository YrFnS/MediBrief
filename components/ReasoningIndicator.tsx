
import React, { useState, useEffect } from 'react';
import { ChatMode } from '../types';

interface ReasoningIndicatorProps {
    mode: ChatMode;
}

const STEPS = [
    "Scanning patient context...",
    "Checking known allergies...",
    "Verifying contraindications...",
    "Analyzing latest vitals...",
    "Synthesizing clinical data..."
];

const LIVE_STEPS = [
    "Listening...",
    "Transcribing audio...",
    "Analyzing safety constraints...",
    "Generating voice response..."
];

const ReasoningIndicator: React.FC<ReasoningIndicatorProps> = ({ mode }) => {
    const [stepIndex, setStepIndex] = useState(0);
    
    useEffect(() => {
        const interval = setInterval(() => {
            setStepIndex((prev) => (prev + 1) % STEPS.length);
        }, 1800);
        return () => clearInterval(interval);
    }, []);

    const currentSteps = mode === ChatMode.Live ? LIVE_STEPS : STEPS;
    const activeStep = currentSteps[stepIndex % currentSteps.length];

    return (
        <div className="flex flex-col gap-3 p-4 w-full max-w-md animate-in fade-in duration-500">
            <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-medical-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="absolute inset-0 bg-medical-500/20 blur-md rounded-full animate-pulse"></div>
                </div>
                <span className="font-mono text-xs font-bold text-medical-600 dark:text-medical-400 uppercase tracking-widest animate-pulse">
                    AI Reasoning
                </span>
            </div>
            
            <div className="space-y-2">
                <div className="h-1 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-medical-500 transition-all duration-500 ease-out"
                        style={{ width: `${((stepIndex + 1) / currentSteps.length) * 100}%` }}
                    ></div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-all duration-300">
                    {activeStep}
                </p>
            </div>

            {/* Simulated 'System Checks' for visual complexity */}
            <div className="flex gap-1 mt-1">
                {[...Array(5)].map((_, i) => (
                    <div 
                        key={i} 
                        className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                            i <= stepIndex ? 'bg-medical-200 dark:bg-medical-900' : 'bg-slate-100 dark:bg-slate-800'
                        }`} 
                    />
                ))}
            </div>
        </div>
    );
};

export default ReasoningIndicator;
