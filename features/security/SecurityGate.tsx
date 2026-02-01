
import React, { useState, useEffect } from 'react';
import { encryptionService } from '../../services/encryptionService';
import { usePatientStore } from '../patient-management/usePatientStore';
import { useChatStore } from '../chat/stores/useChatStore';
import { useClinicalStore } from '../clinical-analysis/stores/useClinicalStore';
import { useAuditStore } from '../audit/useAuditStore';
import { ShieldCheckIcon, LockIcon, AlertTriangleIcon } from '../../components/icons';

const SecurityGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isConfigured, setIsConfigured] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const configured = encryptionService.isConfigured();
        setIsConfigured(configured);
        setIsLoading(false);
    }, []);

    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        // Allow UI to paint loading state
        setTimeout(async () => {
            const success = await encryptionService.unlock(pin);
            if (success) {
                // Rehydrate all stores now that we have the key
                await Promise.all([
                    usePatientStore.persist.rehydrate(),
                    useChatStore.persist.rehydrate(),
                    useClinicalStore.persist.rehydrate(),
                    useAuditStore.persist.rehydrate()
                ]);
                setIsUnlocked(true);
            } else {
                setError("Invalid PIN. Access Denied.");
                setIsLoading(false);
            }
        }, 100);
    };

    const handleSetup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pin.length < 4) {
            setError("PIN must be at least 4 digits.");
            return;
        }
        if (pin !== confirmPin) {
            setError("PINs do not match.");
            return;
        }

        setIsLoading(true);
        setTimeout(async () => {
            await encryptionService.setup(pin);
            // Hydrate (likely empty, but good practice)
            await Promise.all([
                usePatientStore.persist.rehydrate(),
                useChatStore.persist.rehydrate(),
                useClinicalStore.persist.rehydrate(),
                useAuditStore.persist.rehydrate()
            ]);
            setIsUnlocked(true);
        }, 100);
    };

    if (isUnlocked) {
        return <>{children}</>;
    }

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
            
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-sm shadow-2xl relative z-10 technical-border">
                <div className="flex flex-col items-center mb-8">
                    <div className="p-4 bg-slate-800 rounded-full mb-4 shadow-inner border border-slate-700">
                        {isConfigured ? (
                            <LockIcon className="w-8 h-8 text-blue-500" />
                        ) : (
                            <ShieldCheckIcon className="w-8 h-8 text-emerald-500" />
                        )}
                    </div>
                    <h1 className="text-2xl font-display font-bold uppercase tracking-widest text-center">
                        {isConfigured ? "Identity Verification" : "Security Initialization"}
                    </h1>
                    <p className="text-slate-400 text-xs font-mono mt-2 text-center">
                        {isConfigured ? "Enter Session PIN to Decrypt Patient Data" : "Set a Session PIN to Encrypt Local Storage"}
                    </p>
                </div>

                {isConfigured ? (
                    <form onSubmit={handleUnlock} className="space-y-6">
                        <input
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-3 text-center text-xl tracking-[0.5em] font-mono focus:border-blue-500 focus:outline-none transition-colors text-white"
                            placeholder="••••"
                            autoFocus
                            inputMode="numeric"
                        />
                        {error && (
                            <div className="flex items-center gap-2 text-red-500 text-xs font-bold justify-center bg-red-950/30 p-2 rounded border border-red-900">
                                <AlertTriangleIcon className="w-4 h-4" />
                                {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={!pin || isLoading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold uppercase tracking-widest rounded-sm transition-all shadow-lg shadow-blue-900/20"
                        >
                            {isLoading ? "Decrypting..." : "Unlock System"}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleSetup} className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-mono font-bold uppercase text-slate-500 mb-1">Create PIN</label>
                                <input
                                    type="password"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-2 text-center text-lg tracking-widest font-mono focus:border-emerald-500 focus:outline-none transition-colors text-white"
                                    placeholder="••••"
                                    autoFocus
                                    inputMode="numeric"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-mono font-bold uppercase text-slate-500 mb-1">Confirm PIN</label>
                                <input
                                    type="password"
                                    value={confirmPin}
                                    onChange={(e) => setConfirmPin(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-sm px-4 py-2 text-center text-lg tracking-widest font-mono focus:border-emerald-500 focus:outline-none transition-colors text-white"
                                    placeholder="••••"
                                    inputMode="numeric"
                                />
                            </div>
                        </div>
                        {error && (
                            <div className="flex items-center gap-2 text-red-500 text-xs font-bold justify-center bg-red-950/30 p-2 rounded border border-red-900">
                                <AlertTriangleIcon className="w-4 h-4" />
                                {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={!pin || !confirmPin || isLoading}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold uppercase tracking-widest rounded-sm transition-all shadow-lg shadow-emerald-900/20"
                        >
                            {isLoading ? "Initializing..." : "Encrypt & Start"}
                        </button>
                    </form>
                )}
                
                <div className="mt-6 text-center">
                    <p className="text-[9px] text-slate-600 font-mono uppercase">
                        Zero-Knowledge Architecture // Key stays in memory
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SecurityGate;
