import React, { useState } from 'react';
import {
    AlertTriangleIcon,
    CheckIcon,
} from '../../components/icons';
import { checkOpenMedContextHealth } from '../openmed/openMedContextClient';
import type { OpenMedContextHealth } from '../openmed/contextTypes';

interface OpenMedContextBridgeStatusProps {
    baseUrl: string;
    timeoutMs: number;
}

const OpenMedContextBridgeStatus: React.FC<OpenMedContextBridgeStatusProps> = ({
    baseUrl,
    timeoutMs,
}) => {
    const [checking, setChecking] = useState(false);
    const [health, setHealth] = useState<OpenMedContextHealth | null>(null);

    const checkBridge = async () => {
        setChecking(true);
        setHealth(null);
        try {
            setHealth(await checkOpenMedContextHealth({
                config: {
                    baseUrl,
                    timeoutMs: Math.min(timeoutMs, 5_000),
                },
            }));
        } catch (error) {
            setHealth({
                available: false,
                endpoint: baseUrl,
                status: 'unavailable',
                message: error instanceof Error
                    ? error.message
                    : 'OpenMed context bridge health check failed.',
                features: [],
            });
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 dark:border-cyan-900/60 dark:bg-cyan-950/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-xs font-bold text-cyan-900 dark:text-cyan-100">
                        Assertion-context bridge
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-cyan-700 dark:text-cyan-300">
                        Slice 2 requires <code>uvicorn openmed_bridge.app:app</code>. The standard OpenMed app still provides NER, but it does not expose the Python context helpers through REST by itself.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={checkBridge}
                    disabled={checking}
                    className="flex-shrink-0 rounded-xl border border-cyan-300 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-cyan-800 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-cyan-800 dark:bg-slate-950 dark:text-cyan-200"
                >
                    {checking ? 'Checking…' : 'Test context bridge'}
                </button>
            </div>

            {health && (
                <div
                    role="status"
                    aria-live="polite"
                    className={`mt-3 flex items-start gap-2 rounded-xl border p-3 ${health.available
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
                        : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
                    }`}
                >
                    {health.available
                        ? <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        : <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />}
                    <div className="min-w-0">
                        <p className="text-xs font-bold">{health.message}</p>
                        <p className="mt-1 break-all text-[10px] opacity-80">
                            {health.endpoint}
                            {health.openMedVersion ? ` · OpenMed ${health.openMedVersion}` : ''}
                            {health.bridgeVersion ? ` · bridge ${health.bridgeVersion}` : ''}
                        </p>
                        {health.features.length > 0 && (
                            <p className="mt-1 text-[10px] opacity-80">
                                Reported features: {health.features.join(', ')}.
                            </p>
                        )}
                        <p className="mt-1 text-[10px] opacity-80">
                            Reachability confirms only that the advisory bridge is running. It does not establish clinical validity for a document or language.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OpenMedContextBridgeStatus;
