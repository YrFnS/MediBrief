import React, { useEffect, useState } from 'react';
import {
    AlertTriangleIcon,
    LockIcon,
    ShieldCheckIcon,
} from '../../components/icons';
import { encryptionService } from '../../services/encryptionService';
import { useAuditStore } from '../audit/useAuditStore';
import { useChatStore } from '../chat/stores/useChatStore';
import { useClinicalStore } from '../clinical-analysis/stores/useClinicalStore';
import { migrateCurrentLegacyStores } from '../clinical-record/backupService';
import { useClinicalRecordStore } from '../clinical-record/useClinicalRecordStore';
import { useDocumentExtractionStore } from '../openmed/useDocumentExtractionStore';
import { usePatientStore } from '../patient-management/usePatientStore';

const rehydrateEncryptedStores = async (): Promise<void> => {
    await Promise.all([
        usePatientStore.persist.rehydrate(),
        useChatStore.persist.rehydrate(),
        useClinicalStore.persist.rehydrate(),
        useClinicalRecordStore.persist.rehydrate(),
        useDocumentExtractionStore.persist.rehydrate(),
        useAuditStore.persist.rehydrate(),
    ]);

    // Build or complete the versioned clinical record only after every legacy
    // store has been decrypted. The migration is deterministic, additive, and
    // writes the complete validated record map in one store update.
    migrateCurrentLegacyStores();
};

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

    const handleUnlock = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        setIsLoading(true);

        // Allow the loading state to paint before key derivation begins.
        setTimeout(async () => {
            try {
                const success = await encryptionService.unlock(pin);
                if (!success) {
                    setError('Invalid PIN. Access Denied.');
                    setIsLoading(false);
                    return;
                }

                await rehydrateEncryptedStores();
                setIsUnlocked(true);
            } catch (unlockError) {
                console.error('Failed to hydrate encrypted stores:', unlockError);
                setError(
                    'The PIN was accepted, but the local clinical vault could not be loaded or migrated. No legacy data was removed.',
                );
                setIsLoading(false);
            }
        }, 100);
    };

    const handleSetup = async (event: React.FormEvent) => {
        event.preventDefault();
        if (pin.length < 4) {
            setError('PIN must be at least 4 digits.');
            return;
        }
        if (pin !== confirmPin) {
            setError('PINs do not match.');
            return;
        }

        setError(null);
        setIsLoading(true);
        setTimeout(async () => {
            try {
                await encryptionService.setup(pin);
                await rehydrateEncryptedStores();
                setIsUnlocked(true);
            } catch (setupError) {
                console.error('Failed to initialize encrypted stores:', setupError);
                setError(
                    'The local clinical vault could not be initialized. No legacy data was removed or partially imported.',
                );
                setIsLoading(false);
            }
        }, 100);
    };

    if (isUnlocked) {
        return <>{children}</>;
    }

    return (
        <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 p-4 text-slate-900">
            <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-40" />

            <div className="technical-border relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-float">
                <div className="mb-8 flex flex-col items-center">
                    <div className="mb-4 rounded-full border border-blue-100 bg-blue-50 p-4 shadow-sm">
                        {isConfigured ? (
                            <LockIcon className="h-8 w-8 text-blue-600" />
                        ) : (
                            <ShieldCheckIcon className="h-8 w-8 text-blue-600" />
                        )}
                    </div>
                    <h1 className="text-center text-2xl font-display font-bold uppercase tracking-tight text-slate-900">
                        {isConfigured
                            ? 'Identity Verification'
                            : 'Security Initialization'}
                    </h1>
                    <p className="mt-2 text-center text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
                        {isConfigured
                            ? 'Enter PIN to Decrypt Local Vault'
                            : 'Set a PIN to Encrypt Clinical Data'}
                    </p>
                </div>

                {isConfigured ? (
                    <form onSubmit={handleUnlock} className="space-y-6">
                        <input
                            type="password"
                            value={pin}
                            onChange={event => setPin(event.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                            placeholder="••••"
                            autoFocus
                            inputMode="numeric"
                            aria-label="Vault PIN"
                        />
                        {error && (
                            <div className="flex items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 p-2.5 text-xs font-bold text-red-600">
                                <AlertTriangleIcon className="h-4 w-4" />
                                {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={!pin || isLoading}
                            className="w-full rounded-lg bg-blue-600 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isLoading
                                ? 'Decrypting Vault...'
                                : 'Unlock Clinical System'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleSetup} className="space-y-6">
                        <div className="space-y-4">
                            <label className="block">
                                <span className="mb-1.5 ml-1 block text-[10px] font-mono font-bold uppercase text-slate-400">
                                    Create Access PIN
                                </span>
                                <input
                                    type="password"
                                    value={pin}
                                    onChange={event => setPin(event.target.value)}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xl font-mono tracking-widest text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                                    placeholder="••••"
                                    autoFocus
                                    inputMode="numeric"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 ml-1 block text-[10px] font-mono font-bold uppercase text-slate-400">
                                    Verify PIN
                                </span>
                                <input
                                    type="password"
                                    value={confirmPin}
                                    onChange={event => setConfirmPin(event.target.value)}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xl font-mono tracking-widest text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                                    placeholder="••••"
                                    inputMode="numeric"
                                />
                            </label>
                        </div>
                        {error && (
                            <div className="flex items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 p-2.5 text-xs font-bold text-red-600">
                                <AlertTriangleIcon className="h-4 w-4" />
                                {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={!pin || !confirmPin || isLoading}
                            className="w-full rounded-lg bg-blue-600 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isLoading
                                ? 'Provisioning...'
                                : 'Initialize Security'}
                        </button>
                    </form>
                )}

                <div className="mt-8 border-t border-slate-100 pt-6 text-center">
                    <p className="text-[9px] font-mono uppercase leading-relaxed tracking-tighter text-slate-400">
                        Zero-Knowledge Architecture // Local AES-256 Encryption
                        <br />
                        Keys never leave memory.
                    </p>
                </div>
            </div>

            <div className="absolute bottom-10 left-10 opacity-10">
                <div className="select-none text-[120px] font-display font-bold text-blue-500">
                    MB
                </div>
            </div>
        </div>
    );
};

export default SecurityGate;
