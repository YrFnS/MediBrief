
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
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-900 p-4 relative overflow-hidden">
            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none"></div>
            
            <div className="max-w-md w-full bg-white border border-slate-200 p-8 rounded-xl shadow-float relative z-10 technical-border">
                <div className="flex flex-col items-center mb-8">
                    <div className="p-4 bg-blue-50 rounded-full mb-4 shadow-sm border border-blue-100">
                        {isConfigured ? (
                            <LockIcon className="w-8 h-8 text-blue-600" />
                        ) : (
                            <ShieldCheckIcon className="w-8 h-8 text-blue-600" />
                        )}
                    </div>
                    <h1 className="text-2xl font-display font-bold uppercase tracking-tight text-center text-slate-900">
                        {isConfigured ? "Identity Verification" : "Security Initialization"}
                    </h1>
                    <p className="text-slate-500 text-[10px] font-mono font-bold uppercase tracking-widest mt-2 text-center">
                        {isConfigured ? "Enter PIN to Decrypt Local Vault" : "Set a PIN to Encrypt Clinical Data"}
                    </p>
                </div>

                {isConfigured ? (
                    <form onSubmit={handleUnlock} className="space-y-6">
                        <input
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-4 text-center text-2xl tracking-[0.5em] font-mono focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all text-slate-900"
                            placeholder="••••"
                            autoFocus
                            inputMode="numeric"
                        />
                        {error && (
                            <div className="flex items-center gap-2 text-red-600 text-xs font-bold justify-center bg-red-50 p-2.5 rounded-lg border border-red-100">
                                <AlertTriangleIcon className="w-4 h-4" />
                                {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={!pin || isLoading}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold uppercase tracking-widest text-xs rounded-lg transition-all shadow-lg shadow-blue-500/20 active:translate-y-0.5"
                        >
                            {isLoading ? "Decrypting Vault..." : "Unlock Clinical System"}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleSetup} className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-mono font-bold uppercase text-slate-400 mb-1.5 ml-1">Create Access PIN</label>
                                <input
                                    type="password"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-center text-xl tracking-widest font-mono focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all text-slate-900"
                                    placeholder="••••"
                                    autoFocus
                                    inputMode="numeric"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-mono font-bold uppercase text-slate-400 mb-1.5 ml-1">Verify PIN</label>
                                <input
                                    type="password"
                                    value={confirmPin}
                                    onChange={(e) => setConfirmPin(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-center text-xl tracking-widest font-mono focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:outline-none transition-all text-slate-900"
                                    placeholder="••••"
                                    inputMode="numeric"
                                />
                            </div>
                        </div>
                        {error && (
                            <div className="flex items-center gap-2 text-red-600 text-xs font-bold justify-center bg-red-50 p-2.5 rounded-lg border border-red-100">
                                <AlertTriangleIcon className="w-4 h-4" />
                                {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={!pin || !confirmPin || isLoading}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold uppercase tracking-widest text-xs rounded-lg transition-all shadow-lg shadow-blue-500/20 active:translate-y-0.5"
                        >
                            {isLoading ? "Provisioning..." : "Initialize Security"}
                        </button>
                    </form>
                )}
                
                <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                    <p className="text-[9px] text-slate-400 font-mono uppercase tracking-tighter leading-relaxed">
                        Zero-Knowledge Architecture // Local AES-256 Encryption<br/>
                        Keys never leave memory.
                    </p>
                </div>
            </div>

            {/* Ambient Background Element */}
            <div className="absolute bottom-10 left-10 opacity-10">
                <div className="text-[120px] font-display font-bold text-blue-500 select-none">MB</div>
            </div>
        </div>
    );
};

export default SecurityGate;
