import React, { useState } from 'react';
import {
    BoltIcon,
    PillIcon,
    XCircleIcon,
} from '../../../components/icons';
import type { ParsedMedication } from '../../safety/types';

interface MedicationReviewCardProps {
    medications: ParsedMedication[];
    onConfirm: (medications: ParsedMedication[]) => void;
    onDiscard: () => void;
}

const MedicationReviewCard: React.FC<MedicationReviewCardProps> = ({
    medications,
    onConfirm,
    onDiscard,
}) => {
    const [editedMeds, setEditedMeds] = useState<ParsedMedication[]>(
        medications,
    );

    const handleChange = (
        index: number,
        field: keyof ParsedMedication,
        value: string | number,
    ) => {
        const next = [...editedMeds];
        next[index] = { ...next[index], [field]: value };
        setEditedMeds(next);
    };

    const handleRemove = (index: number) => {
        const next = editedMeds.filter((_, itemIndex) => itemIndex !== index);
        if (next.length === 0) onDiscard();
        else setEditedMeds(next);
    };

    return (
        <div className="mb-4 overflow-hidden rounded-lg border border-indigo-200 bg-white shadow-sm animate-slide-up dark:border-indigo-900/50 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-indigo-100 bg-indigo-50 px-3 py-2 dark:border-indigo-900/50 dark:bg-indigo-950/30">
                <div className="flex items-center gap-2">
                    <PillIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-800 dark:text-indigo-300">
                        Medication names detected
                    </span>
                </div>
                <span className="text-[9px] font-mono text-indigo-400 dark:text-indigo-500">
                    Review names before label lookup
                </span>
            </div>

            <div className="space-y-2 p-3">
                {editedMeds.map((medication, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                        <input
                            type="text"
                            value={medication.drugName}
                            onChange={event => handleChange(
                                index,
                                'drugName',
                                event.target.value,
                            )}
                            className="flex-1 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 font-medium text-slate-700 transition-colors focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            placeholder="Medication name"
                        />
                        <div className="flex w-24 flex-shrink-0 items-center gap-1">
                            <input
                                type="number"
                                value={medication.amount}
                                onChange={event => handleChange(
                                    index,
                                    'amount',
                                    Number.parseFloat(event.target.value) || 0,
                                )}
                                className="w-12 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-right font-mono text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            />
                            <input
                                type="text"
                                value={medication.unit}
                                onChange={event => handleChange(
                                    index,
                                    'unit',
                                    event.target.value,
                                )}
                                className="w-10 rounded border border-slate-200 bg-slate-50 px-1 py-1.5 text-center text-[10px] text-slate-500 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                            />
                        </div>
                        <button
                            onClick={() => handleRemove(index)}
                            className="rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                            title="Remove item"
                        >
                            <XCircleIcon className="h-4 w-4" />
                        </button>
                    </div>
                ))}
                <p className="rounded-md bg-amber-50 p-2 text-[10px] leading-relaxed text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                    This retrieves limited FDA label fields only. It does not
                    validate the dose or determine whether a medication regimen
                    is safe for this patient.
                </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
                <button
                    onClick={onDiscard}
                    className="rounded px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800"
                >
                    Dismiss
                </button>
                <button
                    onClick={() => onConfirm(editedMeds)}
                    className="flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm transition-all hover:bg-indigo-500 active:translate-y-0.5"
                >
                    <BoltIcon className="h-3 w-3" />
                    Look up FDA labels
                </button>
            </div>
        </div>
    );
};

export default MedicationReviewCard;
