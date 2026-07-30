import React, { useEffect, useRef, useState } from 'react';
import {
    AlertTriangleIcon,
    BoltIcon,
    CheckIcon,
    ClipboardIcon,
    DocumentTextIcon,
    ShieldCheckIcon,
} from '../../../components/icons';
import { blobStorage } from '../../../services/blobStorageService';
import type { ChatMessage } from '../../../types';
import { isHighCredibilitySource } from '../../../utils/sourceVerification';
import { useAuditStore } from '../../audit/useAuditStore';
import { usePatientStore } from '../../patient-management/usePatientStore';
import { reviewMedicationLabelsAsync } from '../../safety/dosageVerifier';
import { extractMedicationsFromText } from '../../safety/safetyExtractionService';
import type {
    MedicationLabelReviewResult,
    ParsedMedication,
} from '../../safety/types';
import MedicationReviewCard from './MedicationReviewCard';
import MessageContent from './MessageContent';

const MapPinIcon: React.FC<{ className?: string }> = props => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        {...props}
    >
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
);

const WifiOffIcon: React.FC<{ className?: string }> = props => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        {...props}
    >
        <path d="M23.64 7c-.45-.34-4.93-4-11.64-4-1.5 0-2.89.19-4.15.48L18.18 13.8 23.64 7zm-6.6 8.22L3.27 1.44 2 2.72l2.05 2.06C1.91 5.76.59 6.82.36 7l11.63 14.49.01.01.01-.01 3.9-4.86 3.32 3.32 1.27-1.27-3.46-3.46z" />
    </svg>
);

interface MessageProps {
    message: ChatMessage;
    isLoading?: boolean;
    isLast?: boolean;
    onImageLoad?: () => void;
    onViewImage?: (src: string, alt: string) => void;
}

const RECORD_UPDATE_MARKERS = [
    '**Clinical note saved**',
    '**Appointment request saved**',
    '**Follow-up task created**',
    '**Reviewed lab data saved**',
];

const Message: React.FC<MessageProps> = ({
    message,
    isLoading,
    isLast,
    onImageLoad,
    onViewImage,
}) => {
    const isModel = message.role === 'model';
    const [isCopied, setIsCopied] = useState(false);
    const [extractedMeds, setExtractedMeds] = useState<
        ParsedMedication[] | null
    >(null);
    const [labelReview, setLabelReview] = useState<
        MedicationLabelReviewResult | null
    >(null);
    const [isReviewingLabels, setIsReviewingLabels] = useState(false);
    const [isExtractionDone, setIsExtractionDone] = useState(false);

    const activePatientId = usePatientStore(state => state.activePatientId);
    const auditActions = useAuditStore(state => state.actions);

    const labelAbortControllerRef = useRef<AbortController | null>(null);
    const extractAbortControllerRef = useRef<AbortController | null>(null);
    const objectUrlRef = useRef<string | null>(null);
    const [fileUrl, setFileUrl] = useState<string | undefined>(
        message.filePreview?.url,
    );

    useEffect(() => () => {
        labelAbortControllerRef.current?.abort();
        extractAbortControllerRef.current?.abort();
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    }, []);

    useEffect(() => {
        let isMounted = true;

        const loadFile = async () => {
            if (message.filePreview?.storageId && !message.filePreview.url) {
                try {
                    const stored = await blobStorage.getFile(
                        message.filePreview.storageId,
                    );
                    if (!stored || !isMounted) return;

                    const byteCharacters = atob(stored.data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let index = 0; index < byteCharacters.length; index += 1) {
                        byteNumbers[index] = byteCharacters.charCodeAt(index);
                    }
                    const blob = new Blob(
                        [new Uint8Array(byteNumbers)],
                        { type: stored.mimeType },
                    );
                    if (objectUrlRef.current) {
                        URL.revokeObjectURL(objectUrlRef.current);
                    }
                    const url = URL.createObjectURL(blob);
                    objectUrlRef.current = url;
                    setFileUrl(url);
                } catch (error) {
                    console.error('Failed to load file from storage', error);
                }
            } else if (message.filePreview?.url) {
                setFileUrl(message.filePreview.url);
            }
        };

        loadFile();
        return () => {
            isMounted = false;
        };
    }, [message.filePreview]);

    useEffect(() => {
        if (isExtractionDone || !isModel || !message.content || isLoading) {
            return;
        }

        extractAbortControllerRef.current?.abort();
        const controller = new AbortController();
        extractAbortControllerRef.current = controller;

        const medicationKeywords = [
            'mg',
            'mcg',
            'tablet',
            'dose',
            'prescribe',
            'taking',
        ];
        const mightHaveMedications = medicationKeywords.some(keyword =>
            message.content.toLowerCase().includes(keyword),
        );

        if (!mightHaveMedications) {
            setIsExtractionDone(true);
            return;
        }

        const timer = window.setTimeout(async () => {
            try {
                const medications = await extractMedicationsFromText(
                    message.content,
                );
                if (medications.length > 0 && !controller.signal.aborted) {
                    setExtractedMeds(medications);
                }
            } catch (error) {
                console.warn('Medication extraction check failed', error);
            } finally {
                if (!controller.signal.aborted) setIsExtractionDone(true);
            }
        }, 800);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [isModel, message.content, isLoading, isExtractionDone]);

    const handleReviewLabels = async (medications: ParsedMedication[]) => {
        setExtractedMeds(null);
        setLabelReview(null);
        setIsReviewingLabels(true);
        labelAbortControllerRef.current?.abort();

        const controller = new AbortController();
        labelAbortControllerRef.current = controller;
        try {
            const result = await reviewMedicationLabelsAsync(
                medications,
                controller.signal,
            );
            if (controller.signal.aborted) return;

            setLabelReview(result);
            auditActions.logEvent(
                'MEDICATION_LABEL_REVIEW',
                activePatientId,
                `Looked up limited FDA label fields for ${medications.length} medication item(s).`,
                'USER',
                {
                    medications: medications.map(item => item.drugName),
                    boxedWarningCount: result.labelWarnings.length,
                    serviceError: !!result.serviceError,
                    limitationCount: result.limitations.length,
                },
            );
        } catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError')) {
                console.error('FDA label lookup failed', error);
            }
        } finally {
            if (!controller.signal.aborted) setIsReviewingLabels(false);
        }
    };

    const isAiSafetyWarning = isModel
        && message.content.includes('🛑 CRITICAL SAFETY WARNING');
    const isRecordUpdate = isModel && RECORD_UPDATE_MARKERS.some(marker =>
        message.content.includes(marker),
    );
    const isLabelServiceError = !!labelReview?.serviceError;
    const contentToRender = message.role === 'user' && message.displayContent
        ? message.displayContent
        : message.content;

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setIsCopied(true);
        window.setTimeout(() => setIsCopied(false), 2000);
    };

    return (
        <div className={`group flex flex-col gap-2 animate-slide-up ${isModel
            ? 'items-start'
            : 'items-end'
        }`}>
            <div className={`flex select-none items-center gap-2 px-1 transition-opacity duration-300 ${isModel
                ? 'opacity-100'
                : 'opacity-60'
            }`}>
                {isModel && (
                    <div className={`h-1.5 w-1.5 rounded-full ${isAiSafetyWarning
                        ? 'animate-pulse bg-red-500'
                        : isRecordUpdate
                            ? 'bg-emerald-500'
                            : isLoading && isLast
                                ? 'animate-pulse bg-blue-500'
                                : 'bg-blue-500'
                    }`} />
                )}
                <span className={`text-[10px] font-mono font-semibold uppercase tracking-widest ${isModel
                    ? isAiSafetyWarning
                        ? 'text-red-600'
                        : isRecordUpdate
                            ? 'text-emerald-600'
                            : 'text-slate-500'
                    : 'text-slate-400'
                }`}>
                    {isModel
                        ? isAiSafetyWarning
                            ? 'AI WARNING — REVIEW'
                            : isRecordUpdate
                                ? 'RECORD UPDATE'
                                : 'MEDIBRIEF AI'
                        : 'YOU'}
                </span>
            </div>

            <div className={`relative max-w-full overflow-hidden rounded-2xl p-5 transition-all duration-300 md:max-w-3xl md:p-7 ${isModel
                ? isAiSafetyWarning
                    ? 'border border-red-200 bg-red-50 shadow-soft'
                    : isRecordUpdate
                        ? 'border border-emerald-200 bg-emerald-50/50 shadow-sm'
                        : 'border border-slate-100 bg-white text-left shadow-float'
                : 'rounded-tr-sm border border-transparent bg-slate-100 text-slate-800'
            }`}>
                {isAiSafetyWarning && (
                    <div className="absolute right-0 top-0 z-10 flex items-center gap-2 rounded-bl-xl bg-red-600 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white shadow-sm">
                        <AlertTriangleIcon className="h-3 w-3" />
                        <span>AI-generated warning</span>
                    </div>
                )}

                {isRecordUpdate && (
                    <div className="absolute right-0 top-0 z-10 flex items-center gap-2 rounded-bl-xl bg-emerald-600 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white shadow-sm">
                        <CheckIcon className="h-3 w-3" />
                        <span>Saved locally</span>
                    </div>
                )}

                {isLabelServiceError && (
                    <div className="absolute right-0 top-0 z-10 flex items-center gap-2 rounded-bl-xl bg-amber-500 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white shadow-sm">
                        <WifiOffIcon className="h-3 w-3" />
                        <span>Label lookup unavailable</span>
                    </div>
                )}

                {extractedMeds && !isReviewingLabels && !labelReview && (
                    <MedicationReviewCard
                        medications={extractedMeds}
                        onConfirm={handleReviewLabels}
                        onDiscard={() => setExtractedMeds(null)}
                    />
                )}

                {isReviewingLabels && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 p-2 animate-pulse">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-mono font-bold tracking-wide text-blue-600">
                                LOOKING UP FDA LABEL FIELDS...
                            </span>
                            <span className="text-[9px] text-blue-400">
                                This does not validate the patient’s regimen
                            </span>
                        </div>
                    </div>
                )}

                {labelReview?.labelWarnings.length ? (
                    <div className="mb-4 rounded-lg border border-red-200 bg-white p-3 shadow-sm">
                        <div className="mb-2 flex items-center gap-2 border-b border-red-100 pb-1 text-red-600">
                            <BoltIcon className="h-4 w-4" />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest">
                                FDA boxed-warning text found
                            </span>
                        </div>
                        <ul className="space-y-1">
                            {labelReview.labelWarnings.map((warning, index) => (
                                <li
                                    key={index}
                                    className="text-xs font-medium text-red-700"
                                >
                                    {warning}
                                </li>
                            ))}
                        </ul>
                        <div className="mt-2 text-right text-[9px] text-slate-400">
                            Source: openFDA label API
                        </div>
                    </div>
                ) : null}

                {labelReview?.labelInformation.length ? (
                    <div className="mb-4 flex flex-col gap-1 rounded-lg border border-blue-100 bg-blue-50 p-3">
                        <div className="mb-1 flex items-center gap-2 text-blue-700">
                            <ShieldCheckIcon className="h-3 w-3" />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest">
                                FDA label information
                            </span>
                        </div>
                        {labelReview.labelInformation.map((item, index) => (
                            <p
                                key={index}
                                className="text-[10px] leading-relaxed text-blue-700"
                            >
                                {item}
                            </p>
                        ))}
                    </div>
                ) : null}

                {labelReview && (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <div className="mb-1 flex items-center gap-2 text-amber-700">
                            <AlertTriangleIcon className="h-3 w-3" />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest">
                                Important limitations
                            </span>
                        </div>
                        <ul className="space-y-1">
                            {labelReview.limitations.map((limitation, index) => (
                                <li
                                    key={index}
                                    className="text-[10px] leading-relaxed text-amber-700"
                                >
                                    • {limitation}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {isModel && !isLoading && (
                    <button
                        onClick={handleCopy}
                        className="absolute right-4 top-4 z-20 rounded-lg p-1.5 text-slate-300 transition-all hover:bg-slate-50 hover:text-blue-500"
                        title="Copy to Clipboard"
                    >
                        {isCopied
                            ? <CheckIcon className="h-4 w-4 text-emerald-500" />
                            : <ClipboardIcon className="h-4 w-4" />}
                    </button>
                )}

                {message.filePreview && (
                    <div className="mb-4 border-b border-slate-100 pb-4">
                        {message.filePreview.type.startsWith('image/') ? (
                            <div className="group/img relative inline-block">
                                <button
                                    onClick={() => fileUrl && onViewImage?.(
                                        fileUrl,
                                        message.filePreview!.name,
                                    )}
                                    className="block overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm"
                                    disabled={!fileUrl}
                                >
                                    {fileUrl ? (
                                        <img
                                            src={fileUrl}
                                            alt={message.filePreview.name}
                                            onLoad={onImageLoad}
                                            className="block max-h-[150px] max-w-[150px] object-contain transition-transform duration-500 group-hover/img:scale-105 md:max-h-[200px] md:max-w-[200px]"
                                        />
                                    ) : (
                                        <div className="flex h-[150px] w-[150px] animate-pulse items-center justify-center bg-slate-100 text-xs text-slate-400">
                                            Loading from Vault...
                                        </div>
                                    )}
                                </button>
                                <div className="mt-2 flex max-w-[200px] items-center justify-between text-[10px] font-mono text-slate-400">
                                    <span className="truncate">
                                        {message.filePreview.name}
                                    </span>
                                    <span className="cursor-pointer font-bold tracking-wider text-blue-600 opacity-0 transition-opacity group-hover/img:opacity-100">
                                        [EXPAND]
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex w-fit items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 pr-6 shadow-sm">
                                <div className="rounded-lg border border-slate-100 bg-white p-2 shadow-sm">
                                    <DocumentTextIcon className="h-5 w-5 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-slate-700">
                                        {message.filePreview.name}
                                    </p>
                                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                                        Ready for analysis
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <MessageContent
                    content={contentToRender}
                    role={message.role}
                    isLoading={!!isLoading}
                    isLast={!!isLast}
                />

                {message.sources && message.sources.length > 0 && (
                    <div className="mt-6 border-t border-slate-100 pt-4">
                        <div className="mb-3 flex items-center gap-2">
                            <ShieldCheckIcon className="h-3 w-3 text-slate-400" />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                                Web sources
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {message.sources.map((source, index) => {
                                if (source.web) {
                                    const isPreferredDomain =
                                        isHighCredibilitySource(source.web.uri)
                                        && !source.rejected;
                                    return (
                                        <div
                                            key={index}
                                            className={`flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-bold transition-all ${isPreferredDomain
                                                ? 'border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                                : 'border-amber-200 bg-amber-50 text-amber-700'
                                            }`}
                                            title={isPreferredDomain
                                                ? 'Preferred medical or institutional domain'
                                                : 'Source domain was not on the preferred list'}
                                        >
                                            {isPreferredDomain
                                                ? <ShieldCheckIcon className="h-3 w-3 text-emerald-500" />
                                                : <AlertTriangleIcon className="h-3 w-3 text-amber-500" />}
                                            <a
                                                href={source.web.uri}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="max-w-[200px] truncate hover:underline"
                                            >
                                                {source.web.title}
                                            </a>
                                        </div>
                                    );
                                }
                                if (source.maps) {
                                    return (
                                        <a
                                            key={index}
                                            href={source.maps.uri}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-600 transition-all hover:bg-blue-100"
                                        >
                                            <MapPinIcon className="h-3 w-3 text-blue-500" />
                                            <span className="max-w-[200px] truncate">
                                                {source.maps.title}
                                            </span>
                                        </a>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Message;
