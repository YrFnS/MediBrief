import React, { useEffect, useMemo, useState } from 'react';
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
import { useSettingsStore } from '../settings/useSettingsStore';

const ATTEMPT_STATE_KEY = 'medibrief_vault_attempt_state_v1';
const MIN_PASSPHRASE_LENGTH = 12;
const LOCKOUT_THRESHOLD = 5;
const BASE_LOCKOUT_MS = 30_000;
const MAX_LOCKOUT_MS = 15 * 60_000;

interface AttemptState {
    failures: number;
    lockoutUntil: number;
}

const emptyAttemptState = (): AttemptState => ({
    failures: 0,
    lockoutUntil: 0,
});

const readAttemptState = (): AttemptState => {
    try {
        const parsed = JSON.parse(
            localStorage.getItem(ATTEMPT_STATE_KEY) || '{}',
        ) as Partial<AttemptState>;
        return {
            failures: Number.isFinite(parsed.failures)
                ? Math.max(0, Math.floor(parsed.failures!))
                : 0,
            lockoutUntil: Number.isFinite(parsed.lockoutUntil)
                ? Math.max(0, parsed.lockoutUntil!)
                : 0,
        };
    } catch {
        return emptyAttemptState();
    }
};

const writeAttemptState = (state: AttemptState): void => {
    localStorage.setItem(ATTEMPT_STATE_KEY, JSON.stringify(state));
};

const clearAttemptState = (): void => {
    localStorage.removeItem(ATTEMPT_STATE_KEY);
};

const recordFailedAttempt = (): AttemptState => {
    const previous = readAttemptState();
    const failures = previous.failures + 1;
    if (failures < LOCKOUT_THRESHOLD) {
        const next = { failures, lockoutUntil: 0 };
        writeAttemptState(next);
        return next;
    }

    const exponent = failures - LOCKOUT_THRESHOLD;
    const lockoutMs = Math.min(
        MAX_LOCKOUT_MS,
        BASE_LOCKOUT_MS * (2 ** exponent),
    );
    const next = {
        failures,
        lockoutUntil: Date.now() + lockoutMs,
    };
    writeAttemptState(next);
    return next;
};

const validateNewPassphrase = (value: string): string | null => {
    if (value.trim().length < MIN_PASSPHRASE_LENGTH) {
        return `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`;
    }
    if (/^\d+$/.test(value)) {
        return 'Passphrase cannot contain only numbers.';
    }
    return null;
};

const rehydrateEncryptedStores = async (): Promise<void> => {
    await Promise.all([
        usePatientStore.persist.rehydrate(),
        useChatStore.persist.rehydrate(),
        useClinicalStore.persist.rehydrate(),
        useClinicalRecordStore.persist.rehydrate(),
        useDocumentExtractionStore.persist.rehydrate(),
        useAuditStore.persist.rehydrate(),
        useSettingsStore.persist.rehydrate(),
    ]);
    migrateCurrentLegacyStores();
};

const SecurityGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isConfigured, setIsConfigured] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [credential, setCredential] = useState('');
    const [confirmCredential, setConfirmCredential] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [attemptState, setAttemptState] = useState<AttemptState>(
        emptyAttemptState,
    );
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        setIsConfigured(encryptionService.isConfigured());
        setAttemptState(readAttemptState());
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (attemptState.lockoutUntil <= Date.now()) return undefined;
        const timer = window.setInterval(() => setNow(Date.now()), 1_000);
        return () => window.clearInterval(timer);
    }, [attemptState.lockoutUntil]);

    const lockoutRemainingSeconds = Math.max(
        0,
        Math.ceil((attemptState.lockoutUntil - now) / 1_000),
    );
    const isRateLimited = lockoutRemainingSeconds > 0;
    const remainingAttempts = Math.max(
        0,
        LOCKOUT_THRESHOLD - attemptState.failures,
    );
    const legacyCredential = isConfigured
        && encryptionService.isLegacyCredentialPolicy();

    const passphraseHint = useMemo(() => (
        legacyCredential
            ? 'This existing vault accepts its original PIN or passphrase. New vaults require a long passphrase.'
            : 'Use a unique phrase of at least 12 characters. Spaces are allowed; do not reuse an account password.'
    ), [legacyCredential]);

    const handleUnlock = async (event: React.FormEvent) => {
        event.preventDefault();
        setNow(Date.now());
        if (isRateLimited) {
            setError(
                `Too many failed attempts. Try again in ${lockoutRemainingSeconds} seconds.`,
            );
            return;
        }

        setError(null);
        setIsLoading(true);
        window.setTimeout(async () => {
            try {
                const success = await encryptionService.unlock(credential);
                if (!success) {
                    const next = recordFailedAttempt();
                    setAttemptState(next);
                    setNow(Date.now());
                    setError(next.lockoutUntil > Date.now()
                        ? 'Invalid credential. Local retry delay is now active.'
                        : `Invalid credential. ${Math.max(
                            0,
                            LOCKOUT_THRESHOLD - next.failures,
                        )} attempts remain before a local retry delay.`);
                    setIsLoading(false);
                    return;
                }

                clearAttemptState();
                setAttemptState(emptyAttemptState());
                await rehydrateEncryptedStores();
                setIsUnlocked(true);
            } catch (unlockError) {
                console.error('Failed to hydrate encrypted stores:', unlockError);
                setError(
                    'The credential was accepted, but the local clinical vault could not be loaded or migrated. No legacy data was removed.',
                );
                setIsLoading(false);
            }
        }, 100);
    };

    const handleSetup = async (event: React.FormEvent) => {
        event.preventDefault();
        const validationError = validateNewPassphrase(credential);
        if (validationError) {
            setError(validationError);
            return;
        }
        if (credential !== confirmCredential) {
            setError('Passphrases do not match.');
            return;
        }

        setError(null);
        setIsLoading(true);
        window.setTimeout(async () => {
            try {
                await encryptionService.setup(credential);
                clearAttemptState();
                await rehydrateEncryptedStores();
                setIsUnlocked(true);
            } catch (setupError) {
                console.error('Failed to initialize encrypted stores:', setupError);
                setError(setupError instanceof Error
                    ? setupError.message
                    : 'The local clinical vault could not be initialized.');
                setIsLoading(false);
            }
        }, 100);
    };

    if (isUnlocked) return <>{children}</>;

    return (
        <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 p-4 text-slate-900">
            <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-40" />

            <div className="technical-border relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-7 shadow-float md:p-8">
                <div className="mb-7 flex flex-col items-center">
                    <div className="mb-4 rounded-full border border-blue-100 bg-blue-50 p-4 shadow-sm">
                        {isConfigured ? (
                            <LockIcon className="h-8 w-8 text-blue-600" />
                        ) : (
                            <ShieldCheckIcon className="h-8 w-8 text-blue-600" />
                        )}
                    </div>
                    <h1 className="text-center font-display text-2xl font-bold uppercase tracking-tight text-slate-900">
                        {isConfigured
                            ? 'Unlock local vault'
                            : 'Create local vault'}
                    </h1>
                    <p className="mt-2 text-center font-mono text-[10px] font-bold uppercase tracking-widest text-slate-500">
                        {isConfigured
                            ? 'Decrypt this device only'
                            : 'Strong passphrase required'}
                    </p>
                </div>

                {legacyCredential && (
                    <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                        <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <span>
                            Legacy vault credential detected. Access remains available to avoid destructive migration. After unlocking, create a validated backup before moving data into a new strong-passphrase vault.
                        </span>
                    </div>
                )}

                {isConfigured ? (
                    <form onSubmit={handleUnlock} className="space-y-5">
                        <label className="block">
                            <span className="mb-1.5 ml-1 block font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Vault passphrase or legacy PIN
                            </span>
                            <input
                                type="password"
                                value={credential}
                                onChange={event => setCredential(event.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 text-base text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                                placeholder="Enter vault credential"
                                autoFocus
                                autoComplete="current-password"
                                aria-describedby="vault-credential-hint"
                            />
                        </label>
                        <p
                            id="vault-credential-hint"
                            className="text-[11px] leading-relaxed text-slate-500"
                        >
                            {passphraseHint}
                        </p>

                        {isRateLimited && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-xs font-bold text-amber-800">
                                Local retry delay: {lockoutRemainingSeconds}s
                            </div>
                        )}
                        {!isRateLimited
                            && attemptState.failures > 0
                            && remainingAttempts > 0 && (
                                <p className="text-center text-[10px] font-mono uppercase tracking-wide text-amber-700">
                                    {remainingAttempts} attempt{remainingAttempts === 1 ? '' : 's'} before a local retry delay
                                </p>
                            )}

                        {error && (
                            <div className="flex items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 p-2.5 text-xs font-bold text-red-600">
                                <AlertTriangleIcon className="h-4 w-4" />
                                {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={!credential || isLoading || isRateLimited}
                            className="w-full rounded-lg bg-blue-600 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isLoading
                                ? 'Decrypting vault...'
                                : isRateLimited
                                    ? 'Retry temporarily delayed'
                                    : 'Unlock local record'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleSetup} className="space-y-5">
                        <div className="space-y-4">
                            <label className="block">
                                <span className="mb-1.5 ml-1 block font-mono text-[10px] font-bold uppercase text-slate-400">
                                    Create vault passphrase
                                </span>
                                <input
                                    type="password"
                                    value={credential}
                                    onChange={event => setCredential(event.target.value)}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                                    placeholder="At least 12 characters"
                                    autoFocus
                                    autoComplete="new-password"
                                />
                            </label>
                            <label className="block">
                                <span className="mb-1.5 ml-1 block font-mono text-[10px] font-bold uppercase text-slate-400">
                                    Confirm passphrase
                                </span>
                                <input
                                    type="password"
                                    value={confirmCredential}
                                    onChange={event => setConfirmCredential(event.target.value)}
                                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                                    placeholder="Repeat the passphrase"
                                    autoComplete="new-password"
                                />
                            </label>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-500">
                            {passphraseHint} MediBrief cannot recover a forgotten passphrase.
                        </p>
                        {error && (
                            <div className="flex items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 p-2.5 text-xs font-bold text-red-600">
                                <AlertTriangleIcon className="h-4 w-4" />
                                {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={!credential || !confirmCredential || isLoading}
                            className="w-full rounded-lg bg-blue-600 py-4 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-500 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isLoading
                                ? 'Creating encrypted vault...'
                                : 'Create local vault'}
                        </button>
                    </form>
                )}

                <div className="mt-7 border-t border-slate-100 pt-5 text-center">
                    <p className="font-mono text-[9px] uppercase leading-relaxed tracking-tight text-slate-400">
                        AES-GCM local encryption · PBKDF2 key derivation
                        <br />
                        Key remains in memory and is cleared when the app locks.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SecurityGate;
