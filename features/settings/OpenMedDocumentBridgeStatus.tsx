import React, { useState } from 'react';
import {
    AlertTriangleIcon,
    CheckIcon,
} from '../../components/icons';
import { checkOpenMedDocumentHealth } from '../openmed/openMedDocumentClient';
import type { OpenMedDocumentHealth } from '../openmed/documentTypes';

interface OpenMedDocumentBridgeStatusProps {
    baseUrl: string;
    timeoutMs: number;
}

const OpenMedDocumentBridgeStatus: React.FC<OpenMedDocumentBridgeStatusProps> = ({
    baseUrl,
    timeoutMs,
}) => {
    const [checking, setChecking] = useState(false);
    const [health, setHealth] = useState<OpenMedDocumentHealth | null>(null);

    const checkBridge = async () => {
        setChecking(true);
        setHealth(null);
        try {
            setHealth(await checkOpenMedDocumentHealth({
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
                    : 'OpenMed document bridge health check failed.',
                features: [],
                availableOcrEngines: [],
                ocrAvailable: false,
            });
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-900/60 dark:bg-violet-950/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-xs font-bold text-violet-900 dark:text-violet-100">
                        PDF text and OCR bridge
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-violet-700 dark:text-violet-300">
                        The extended bridge extracts embedded PDF text and can run local OCR on scanned PDF pages and images. The original upload remains authoritative.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={checkBridge}
                    disabled={checking}
                    className="flex-shrink-0 rounded-xl border border-violet-300 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-violet-800 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-800 dark:bg-slate-950 dark:text-violet-200"
                >
                    {checking ? 'Checking…' : 'Test document bridge'}
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
                            {health.bridgeVersion ? ` · bridge ${health.bridgeVersion}` : ''}
                        </p>
                        {health.availableOcrEngines.length > 0 && (
                            <p className="mt-1 text-[10px] opacity-80">
                                Detected OCR engines: {health.availableOcrEngines.join(', ')}.
                            </p>
                        )}
                        <p className="mt-1 text-[10px] opacity-80">
                            Reachability does not prove OCR quality, language accuracy, or clinical validity for a document.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OpenMedDocumentBridgeStatus;
