
import React, { useMemo } from 'react';
import { BeakerIcon, UserIcon, CalendarIcon, AlertTriangleIcon } from './icons';
import { parseJsonSafe } from '../utils';

interface LabResult {
    testName: string;
    value: string;
    units: string;
    refRange: string;
    flag: 'Normal' | 'High' | 'Low' | 'Critical' | 'Abnormal';
}

interface ParsedLabReport {
    reportType: string;
    patient?: string;
    date?: string;
    labs: LabResult[];
    interpretation?: string;
}

interface LabReportProps {
    content: string;
}

const getFlagColor = (flag: string) => {
    const f = flag.toLowerCase();
    if (f.includes('critical')) return 'bg-red-500 text-white animate-pulse';
    if (f.includes('high')) return 'bg-amber-100 text-amber-800 border border-amber-200';
    if (f.includes('low')) return 'bg-blue-100 text-blue-800 border border-blue-200';
    if (f.includes('abnormal')) return 'bg-amber-100 text-amber-800 border border-amber-200';
    return 'bg-slate-100 text-slate-600';
};

const LabReport: React.FC<LabReportProps> = ({ content }) => {
    const report = useMemo(() => parseJsonSafe<ParsedLabReport>(content), [content]);

    if (!report || !report.labs) {
        return <div className="text-red-500 text-sm">Error parsing lab data.</div>;
    }

    return (
        <div className="bg-white dark:bg-slate-900/50 -m-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-6 gap-3">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span className="p-1.5 bg-blue-500 rounded-lg"><BeakerIcon className="w-5 h-5 text-white" /></span>
                    <span>Lab Results Analysis</span>
                </h2>
                <div className="flex gap-4 text-sm text-slate-500 dark:text-slate-400">
                    {report.patient && report.patient !== 'Not Visible' && (
                        <div className="flex items-center gap-1.5">
                            <UserIcon className="w-4 h-4" />
                            <span>{report.patient}</span>
                        </div>
                    )}
                    {report.date && report.date !== 'Not Visible' && (
                        <div className="flex items-center gap-1.5">
                            <CalendarIcon className="w-4 h-4" />
                            <span>{report.date}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0 mb-4">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800 border-y border-slate-100 dark:border-slate-700">
                        <tr>
                            <th className="px-4 py-3 font-semibold">Test Name</th>
                            <th className="px-4 py-3 font-semibold">Value</th>
                            <th className="px-4 py-3 font-semibold">Ref Range</th>
                            <th className="px-4 py-3 font-semibold">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {report.labs.map((lab, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{lab.testName}</td>
                                <td className="px-4 py-3">
                                    <span className="font-bold text-slate-700 dark:text-slate-300">{lab.value}</span>
                                    <span className="ml-1 text-xs text-slate-400">{lab.units}</span>
                                </td>
                                <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{lab.refRange}</td>
                                <td className="px-4 py-3">
                                    {lab.flag && lab.flag.toLowerCase() !== 'normal' ? (
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${getFlagColor(lab.flag)}`}>
                                            {lab.flag}
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 text-xs">Normal</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {report.interpretation && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 border-l-4 border-blue-500">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Clinical Interpretation</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{report.interpretation}</p>
                </div>
            )}
        </div>
    );
};

export default LabReport;
