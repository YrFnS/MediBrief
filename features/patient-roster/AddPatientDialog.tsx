import React, { useEffect, useState } from 'react';
import {
    AlertTriangleIcon,
    PlusIcon,
    XCircleIcon,
} from '../../components/icons';
import type { PatientDemographics } from '../patient-management/types';

interface AddPatientDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (name: string, demographics: PatientDemographics) => void;
}

type PatientSex = 'Male' | 'Female' | 'Other' | '';

const AddPatientDialog: React.FC<AddPatientDialogProps> = ({
    isOpen,
    onClose,
    onSubmit,
}) => {
    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    const [weight, setWeight] = useState('');
    const [sex, setSex] = useState<PatientSex>('');

    useEffect(() => {
        if (isOpen) {
            setName('');
            setAge('');
            setWeight('');
            setSex('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (!name.trim()) return;

        const demographics: PatientDemographics = {};
        if (age) demographics.age = Number.parseInt(age, 10);
        if (weight) demographics.weight = Number.parseFloat(weight);
        if (sex) demographics.sex = sex;

        onSubmit(name.trim(), demographics);
        onClose();
    };

    const hasPediatricOrLowWeightContext =
        (age !== '' && Number.parseInt(age, 10) < 18)
        || (weight !== '' && Number.parseFloat(weight) < 40);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-fade-in">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-patient-dialog-title"
                aria-describedby="add-patient-dialog-description"
                className="technical-border w-full max-w-md rounded-sm border-2 border-slate-200 bg-white shadow-2xl animate-slide-up dark:border-slate-700 dark:bg-slate-900"
            >
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                    <div>
                        <h2
                            id="add-patient-dialog-title"
                            className="font-mono text-sm font-bold uppercase tracking-widest text-slate-700 dark:text-slate-200"
                        >
                            Add patient record
                        </h2>
                        <p
                            id="add-patient-dialog-description"
                            className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400"
                        >
                            Optional age and weight are stored as snapshots. They do not establish a date of birth or medication dose.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200 hover:text-red-500 dark:hover:bg-slate-700"
                        aria-label="Close add patient dialog"
                    >
                        <XCircleIcon className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 p-6">
                    <div>
                        <label
                            htmlFor="new-patient-name"
                            className="mb-1 block text-xs font-mono font-bold uppercase text-slate-500"
                        >
                            Patient name or local label{' '}
                            <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="new-patient-name"
                            type="text"
                            required
                            value={name}
                            onChange={event => setName(event.target.value)}
                            placeholder="e.g. Jane Doe or Record A"
                            autoFocus
                            className="min-h-11 w-full rounded-sm border border-slate-300 bg-slate-50 px-3 py-2 text-sm transition-colors focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label
                                htmlFor="new-patient-age"
                                className="mb-1 block text-xs font-mono font-bold uppercase text-slate-500"
                            >
                                Age snapshot (years)
                            </label>
                            <input
                                id="new-patient-age"
                                type="number"
                                min="0"
                                max="120"
                                value={age}
                                onChange={event => setAge(event.target.value)}
                                placeholder="--"
                                className="min-h-11 w-full rounded-sm border border-slate-300 bg-slate-50 px-3 py-2 text-sm tabular-nums transition-colors focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="new-patient-weight"
                                className="mb-1 block text-xs font-mono font-bold uppercase text-slate-500"
                            >
                                Weight snapshot (kg)
                            </label>
                            <input
                                id="new-patient-weight"
                                type="number"
                                min="0"
                                step="0.1"
                                value={weight}
                                onChange={event => setWeight(event.target.value)}
                                placeholder="--"
                                className="min-h-11 w-full rounded-sm border border-slate-300 bg-slate-50 px-3 py-2 text-sm tabular-nums transition-colors focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800"
                            />
                        </div>
                    </div>

                    <fieldset>
                        <legend className="mb-1 block text-xs font-mono font-bold uppercase text-slate-500">
                            Sex
                        </legend>
                        <div className="flex gap-2">
                            {(['Male', 'Female', 'Other'] as const).map(option => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setSex(option)}
                                    aria-pressed={sex === option}
                                    className={`min-h-11 flex-1 rounded-sm border py-2 text-xs font-bold uppercase transition-colors ${
                                        sex === option
                                            ? 'border-blue-600 bg-blue-600 text-white'
                                            : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </fieldset>

                    {hasPediatricOrLowWeightContext && (
                        <div className="flex items-start gap-3 border-l-4 border-amber-500 bg-amber-50 p-3 dark:bg-amber-900/20">
                            <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                                    Pediatric or low-weight context
                                </p>
                                <p className="mt-1 text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
                                    MediBrief records this information for review only. It does not calculate pediatric doses, enforce black-box warnings, or verify medication safety.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="min-h-11 rounded-sm px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim()}
                            className="flex min-h-11 items-center gap-2 rounded-sm bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <PlusIcon className="h-3.5 w-3.5" />
                            Add patient
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddPatientDialog;