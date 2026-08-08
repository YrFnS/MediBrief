
import React, { useState, useEffect } from 'react';
import { AlertTriangleIcon, ShieldCheckIcon } from './icons';

const DisclaimerModal: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const hasAccepted = localStorage.getItem('medibrief_disclaimer_accepted_v1');
        if (!hasAccepted) {
            setIsOpen(true);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem('medibrief_disclaimer_accepted_v1', 'true');
        setIsOpen(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
            <div className="w-full max-w-lg bg-slate-900 border-2 border-amber-500 rounded-sm shadow-2xl relative overflow-hidden technical-border animate-slide-up">
                
                {/* Hazard Stripe */}
                <div className="h-2 w-full bg-[repeating-linear-gradient(45deg,#f59e0b,#f59e0b_10px,#b45309_10px,#b45309_20px)]"></div>
                
                <div className="p-8">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-amber-500/20 rounded-full border border-amber-500/50">
                            <AlertTriangleIcon className="w-8 h-8 text-amber-500" />
                        </div>
                        <div>
                            <h1 className="text-xl font-display font-bold text-white uppercase tracking-widest">
                                Investigational Software
                            </h1>
                            <p className="text-xs text-amber-500 font-mono font-bold uppercase tracking-wide">
                                Not a Medical Device
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4 text-sm text-slate-300 leading-relaxed border-t border-slate-800 pt-4">
                        <p>
                            <strong className="text-white">1. NON-CLINICAL USE ONLY:</strong> MediBrief is a prototype Clinical Intelligence Layer designed for demonstration and research purposes only. It has <strong className="text-red-400">NOT</strong> been cleared by the FDA or any regulatory body.
                        </p>
                        <p>
                            <strong className="text-white">2. HUMAN VERIFICATION REQUIRED:</strong> AI-generated summaries, safety checks, and clinical decision support outputs are probabilistic and may be incorrect. <strong className="text-white">You must independently verify all outputs.</strong>
                        </p>
                        <p>
                            <strong className="text-white">3. DATA TRANSMISSION:</strong> OpenRouter-powered chat and cloud extraction send the submitted content directly from this browser to OpenRouter using your key. Live audio is disabled. Follow applicable privacy, consent, institutional, HIPAA/GDPR, and provider-account requirements; do not submit real patient data without an appropriate approved arrangement.
                        </p>
                    </div>

                    <button
                        onClick={handleAccept}
                        className="w-full mt-8 py-4 bg-amber-600 hover:bg-amber-500 text-white font-bold uppercase tracking-widest rounded-sm transition-all shadow-lg hover:shadow-amber-500/20 flex items-center justify-center gap-2 group"
                    >
                        <ShieldCheckIcon className="w-5 h-5 group-hover:text-slate-900 transition-colors" />
                        <span>I Acknowledge & Accept Risks</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DisclaimerModal;
