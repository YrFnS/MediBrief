
import React, { useState } from 'react';
import { LabReport, LabResultSchema } from '../../chat/schemas';
import { CheckIcon, XCircleIcon, AlertTriangleIcon, BeakerIcon } from '../../../components/icons';

interface LabVerificationModalProps {
    report: LabReport;
    onConfirm: (verifiedReport: LabReport) => void;
    onCancel: () => void;
}

const LabVerificationModal: React.FC<LabVerificationModalProps> = ({ report, onConfirm, onCancel }) => {
    const [editedLabs, setEditedLabs] = useState(report.labs);
    
    const handleUpdate = (index: number, field: keyof typeof report.labs[0], value: string) => {
        const updated = [...editedLabs];
        // Only update if value actually changed to prevent cursor jumping if we were stricter
        updated[index] = { ...updated[index], [field]: value };
        setEditedLabs(updated);
    };

    const handleRemove = (index: number) => {
        setEditedLabs(prev => prev.filter((_, i) => i !== index));
    };

    const handleConfirm = () => {
        // Return cleaned report
        onConfirm({
            ...report,
            labs: editedLabs
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-4xl border-2 border-blue-500 rounded-sm shadow-2xl flex flex-col max-h-[90vh] technical-border animate-slide-up">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400 animate-pulse">
                            <BeakerIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-display font-bold uppercase tracking-tight text-slate-900 dark:text-white">
                                Data Ingestion Verification
                            </h2>
                            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                Human-in-the-Loop Protocol Required
                            </p>
                        </div>
                    </div>
                    <button onClick={onCancel} className="text-slate-400 hover:text-red-500 transition-colors">
                        <XCircleIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Warning Banner */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-6 py-3 flex items-center gap-3">
                    <AlertTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wide">
                        Check values against original document. LLMs can misread decimal points and units.
                    </p>
                </div>

                {/* Table Editor */}
                <div className="flex-1 overflow-y-auto p-0">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-100 dark:bg-black/30 sticky top-0 z-10 text-[10px] uppercase font-mono font-bold text-slate-500 tracking-wider">
                            <tr>
                                <th className="px-6 py-3 border-b border-slate-200 dark:border-slate-800">Test Name</th>
                                <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 w-24">LOINC</th>
                                <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 w-32">Value</th>
                                <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 w-24">Unit</th>
                                <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 w-32">Ref Range</th>
                                <th className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 w-16 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {editedLabs.map((lab, i) => (
                                <tr key={i} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-2">
                                        <input 
                                            value={lab.testName} 
                                            onChange={(e) => handleUpdate(i, 'testName', e.target.value)}
                                            className="w-full bg-transparent border-none focus:ring-0 font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400"
                                            placeholder="Test Name"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input 
                                            value={lab.loinc || ''} 
                                            onChange={(e) => handleUpdate(i, 'loinc', e.target.value)}
                                            className="w-full bg-transparent border-none focus:ring-0 text-xs text-slate-500 dark:text-slate-400 font-mono"
                                            placeholder="LOINC"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input 
                                            value={lab.value} 
                                            onChange={(e) => handleUpdate(i, 'value', e.target.value)}
                                            className="w-full bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-blue-500 rounded-sm px-2 py-1 font-mono font-bold text-slate-900 dark:text-slate-100 text-right focus:outline-none"
                                            placeholder="0.0"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input 
                                            value={lab.units} 
                                            onChange={(e) => handleUpdate(i, 'units', e.target.value)}
                                            className="w-full bg-transparent border-none focus:ring-0 text-xs text-slate-500 dark:text-slate-400"
                                            placeholder="Unit"
                                        />
                                    </td>
                                    <td className="px-4 py-2">
                                        <input 
                                            value={lab.refRange} 
                                            onChange={(e) => handleUpdate(i, 'refRange', e.target.value)}
                                            className="w-full bg-transparent border-none focus:ring-0 text-xs text-slate-400 font-mono"
                                            placeholder="Range"
                                        />
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <button 
                                            onClick={() => handleRemove(i)}
                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete Row"
                                        >
                                            <XCircleIcon className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {editedLabs.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-slate-400 italic">
                                        No data rows. Import cancelled.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-sm transition-colors"
                    >
                        Discard Data
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={editedLabs.length === 0}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-widest rounded-sm shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <CheckIcon className="w-4 h-4" />
                        Verify & Ingest to Record
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LabVerificationModal;
