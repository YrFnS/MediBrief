
import React, { useState } from 'react';
import { XCircleIcon, PlusIcon } from '../../components/icons';
import { PatientStatus } from '../patient-management/types';

interface AddPatientDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (name: string) => void;
}

const AddPatientDialog: React.FC<AddPatientDialogProps> = ({ isOpen, onClose, onSubmit }) => {
    const [name, setName] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onSubmit(name.trim());
            setName('');
            onClose();
        }
    };

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
                            Patient Identifier / Location
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Bed 4 - John Doe"
                            autoFocus
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm px-3 py-2 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                        />
                         <p className="text-[10px] text-slate-400 mt-1">
                            This creates a secure, isolated context for this patient's data.
                        </p>
                    </div>

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
