
import React, { useState } from 'react';
import { ParsedMedication } from '../../safety/types';
import { PillIcon, CheckIcon, XCircleIcon, BoltIcon } from '../../../components/icons';

interface MedicationReviewCardProps {
    medications: ParsedMedication[];
    onConfirm: (meds: ParsedMedication[]) => void;
    onDiscard: () => void;
}

const MedicationReviewCard: React.FC<MedicationReviewCardProps> = ({ medications, onConfirm, onDiscard }) => {
    const [editedMeds, setEditedMeds] = useState<ParsedMedication[]>(medications);

    const handleChange = (index: number, field: keyof ParsedMedication, value: string | number) => {
        const newMeds = [...editedMeds];
        newMeds[index] = { ...newMeds[index], [field]: value };
        setEditedMeds(newMeds);
    };

    const handleRemove = (index: number) => {
        const newMeds = editedMeds.filter((_, i) => i !== index);
        if (newMeds.length === 0) {
            onDiscard();
        } else {
            setEditedMeds(newMeds);
        }
    };

    return (
        <div className="mb-4 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/50 rounded-lg overflow-hidden shadow-sm animate-slide-up">
            <div className="bg-indigo-50 dark:bg-indigo-950/30 px-3 py-2 border-b border-indigo-100 dark:border-indigo-900/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <PillIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-800 dark:text-indigo-300">
                        Medication Entities Detected
                    </span>
                </div>
                <span className="text-[9px] text-indigo-400 dark:text-indigo-500 font-mono">
                    Verify before safety check
                </span>
            </div>

            <div className="p-3 space-y-2">
                {editedMeds.map((med, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                        <input
                            type="text"
                            value={med.drugName}
                            onChange={(e) => handleChange(index, 'drugName', e.target.value)}
                            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 font-medium text-slate-700 dark:text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors"
                            placeholder="Drug Name"
                        />
                        <div className="flex items-center gap-1 w-24 flex-shrink-0">
                            <input
                                type="number"
                                value={med.amount}
                                onChange={(e) => handleChange(index, 'amount', parseFloat(e.target.value) || 0)}
                                className="w-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-right font-mono text-slate-700 dark:text-slate-200 focus:border-indigo-500 focus:outline-none"
                            />
                            <input
                                type="text"
                                value={med.unit}
                                onChange={(e) => handleChange(index, 'unit', e.target.value)}
                                className="w-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 py-1.5 text-center text-[10px] text-slate-500 dark:text-slate-400 focus:border-indigo-500 focus:outline-none"
                            />
                        </div>
                        <button 
                            onClick={() => handleRemove(index)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Remove item"
                        >
                            <XCircleIcon className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>

            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                    onClick={onDiscard}
                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                >
                    Ignore
                </button>
                <button
                    onClick={() => onConfirm(editedMeds)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wide rounded shadow-sm flex items-center gap-1.5 transition-all active:translate-y-0.5"
                >
                    <BoltIcon className="w-3 h-3" />
                    Run Safety Check
                </button>
            </div>
        </div>
    );
};

export default MedicationReviewCard;
