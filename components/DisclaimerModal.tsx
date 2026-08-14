import React, { useEffect, useState } from 'react';
import { AlertTriangleIcon, ShieldCheckIcon } from './icons';

const DISCLAIMER_KEY = 'medibrief_disclaimer_accepted_v2';

const DisclaimerModal: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!localStorage.getItem(DISCLAIMER_KEY)) setIsOpen(true);
    }, []);

    const handleAccept = () => {
        localStorage.setItem(DISCLAIMER_KEY, 'true');
        setIsOpen(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
            <div className="technical-border relative w-full max-w-xl overflow-hidden rounded-xl border-2 border-amber-500 bg-slate-900 shadow-2xl animate-slide-up">
                <div className="h-2 w-full bg-[repeating-linear-gradient(45deg,#f59e0b,#f59e0b_10px,#b45309_10px,#b45309_20px)]" />

                <div className="p-7 md:p-8">
                    <div className="mb-6 flex items-center gap-4">
                        <div className="rounded-full border border-amber-500/50 bg-amber-500/20 p-3">
                            <AlertTriangleIcon className="h-8 w-8 text-amber-500" />
                        </div>
                        <div>
                            <h1 className="font-display text-xl font-bold uppercase tracking-widest text-white">
                                Local record prototype
                            </h1>
                            <p className="font-mono text-xs font-bold uppercase tracking-wide text-amber-500">
                                Not a certified medical device
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4 border-t border-slate-800 pt-4 text-sm leading-relaxed text-slate-300">
                        <p>
                            <strong className="text-white">1. RECORD SUPPORT, NOT CARE:</strong>{' '}
                            MediBrief organizes a local personal health record, preserves source evidence, and supports human review. It does not diagnose, prescribe, perform emergency triage, place orders, or verify that the record is complete.
                        </p>
                        <p>
                            <strong className="text-white">2. VERIFY EVERY OUTPUT:</strong>{' '}
                            Extracted candidates and AI-generated text can be incomplete or wrong. Confirm important information against the original document and an appropriate healthcare professional before relying on it.
                        </p>
                        <p>
                            <strong className="text-white">3. CLOUD IS SEPARATE AND OFF BY DEFAULT:</strong>{' '}
                            Accepting this notice does not enable cloud processing. OpenRouter requests require a separate per-tab acknowledgement in Safety & capabilities. Patient-specific and medical document/image cloud requests remain blocked until an exact model/provider review profile is registered.
                        </p>
                        <p>
                            <strong className="text-white">4. URGENT CARE:</strong>{' '}
                            Do not use MediBrief to decide whether an emergency exists. Contact local emergency services or a qualified healthcare professional when urgent help may be needed.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleAccept}
                        className="group mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 py-4 font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:bg-amber-500 hover:shadow-amber-500/20"
                    >
                        <ShieldCheckIcon className="h-5 w-5 transition-colors group-hover:text-slate-900" />
                        <span>I understand these boundaries</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DisclaimerModal;
