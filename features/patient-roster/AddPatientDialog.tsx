
import React, { useState, useEffect } from 'react';
import { XCircleIcon, PlusIcon, AlertTriangleIcon } from '../../components/icons';
import { PatientDemographics } from '../patient-management/types';

interface AddPatientDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (name: string, demographics: PatientDemographics) => void;
}

const AddPatientDialog: React.FC<AddPatientDialogProps> = ({ isOpen, onClose, onSubmit }) => {
    const [name, setName] = useState('');
    const [age, setAge] = useState('');
    const [weight, setWeight] = useState('');
    const [sex, setSex] = useState<'Male' | 'Female' | 'Other' | ''>('');

    // Reset form when opened
    useEffect(() => {
        if (isOpen) {
            setName('');
            setAge('');
            setWeight('');
            setSex('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            const demographics: PatientDemographics = {};
            if (age) demographics.age = parseInt(age);
            if (weight) demographics.weight = parseFloat(weight);
            if (sex) demographics.sex = sex;

            onSubmit(name.trim(), demographics);
            onClose();
        }
    };

    const isPediatric = (age && parseInt(age) < 18) || (weight && parseFloat(weight) < 40);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md border-2 border-slate-200 dark:border-slate-700 shadow-2xl rounded-sm technical-border animate-slide-up">
                
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                        Initialize New Context
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-red-500 transition-colors">
                        <XCircleIcon className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">
                            Patient Identifier / Location <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Bed 4 - John Doe"
                            autoFocus
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm px-3 py-2 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">
                                Age (Years)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="120"
                                value={age}
                                onChange={(e) => setAge(e.target.value)}
                                placeholder="--"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm px-3 py-2 text-sm focus:border-blue-500 focus:outline-none transition-colors tabular-nums"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">
                                Weight (kg)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={weight}
                                onChange={(e) => setWeight(e.target.value)}
                                placeholder="--"
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm px-3 py-2 text-sm focus:border-blue-500 focus:outline-none transition-colors tabular-nums"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-mono font-bold text-slate-500 uppercase mb-1">
                            Biological Sex
                        </label>
                        <div className="flex gap-2">
                            {['Male', 'Female', 'Other'].map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => setSex(option as any)}
                                    className={`flex-1 py-2 text-xs font-bold uppercase rounded-sm border transition-colors ${
                                        sex === option 
                                            ? 'bg-blue-600 text-white border-blue-600' 
                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>

                    {isPediatric && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-3 flex items-start gap-3">
                            <AlertTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                                    Pediatric / Low Weight Protocol
                                </p>
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight mt-1">
                                    Safety verification will enforce pediatric Black Box warnings and stricter dosage checks.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="pt-2 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-sm transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!name.trim()}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wide rounded-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <PlusIcon className="w-3.5 h-3.5" />
                            Create Context
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddPatientDialog;
