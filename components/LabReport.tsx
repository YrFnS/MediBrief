
import React, { useMemo } from 'react';
import { BeakerIcon } from './icons';
import { parseAndValidate } from '../utils';
import { usePatientStore } from '../features/patient-management/usePatientStore';
import { useClinicalStore } from '../features/clinical-analysis/stores/useClinicalStore';
import TrendGraph from '../features/analytics/TrendGraph';
import { LabReportSchema, LabReport as LabReportType } from '../features/chat/schemas';

interface LabReportProps {
    content: string;
}

const getFlagColor = (flag: string) => {
    const f = flag.toLowerCase();
    if (f.includes('critical')) return 'text-red-600 dark:text-red-400 font-bold';
    if (f.includes('high')) return 'text-amber-600 dark:text-amber-400 font-semibold';
    if (f.includes('low')) return 'text-blue-600 dark:text-blue-400 font-semibold';
    if (f.includes('abnormal')) return 'text-amber-600 dark:text-amber-400 font-semibold';
    return 'text-slate-500 dark:text-slate-400';
};

// Heuristic to visually plot a value against a range
const RangeVisualizer: React.FC<{ value: string; range: string }> = ({ value, range }) => {
    try {
        const val = parseFloat(value.replace(/[^0-9.-]/g, ''));
        const rangeMatch = range.match(/([\d.]+)\s*-\s*([\d.]+)/);
        
        if (isNaN(val) || !rangeMatch) return null;

        const min = parseFloat(rangeMatch[1]);
        const max = parseFloat(rangeMatch[2]);
        const spread = max - min;
        const totalMin = min - (spread * 0.5); // Extend bar 50% below min
        const totalMax = max + (spread * 0.5); // Extend bar 50% above max
        const totalSpread = totalMax - totalMin;

        // Calculate percentages
        const leftPct = ((val - totalMin) / totalSpread) * 100;
        const startRangePct = ((min - totalMin) / totalSpread) * 100;
        const rangeWidthPct = (spread / totalSpread) * 100;
        
        const clampedPos = Math.max(0, Math.min(100, leftPct));

        return (
            <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-700 relative mt-1.5 overflow-hidden rounded-sm">
                {/* Reference Range Zone */}
                <div 
                    className="absolute top-0 bottom-0 bg-slate-300 dark:bg-slate-500 opacity-50" 
                    style={{ left: `${startRangePct}%`, width: `${rangeWidthPct}%` }}
                />
                
                {/* Value Marker */}
                <div 
                    className={`absolute top-0 bottom-0 w-1 h-2 -mt-0.5 z-10 ${
                        val < min ? 'bg-blue-500' : val > max ? 'bg-amber-500' : 'bg-green-500'
                    }`}
                    style={{ left: `${clampedPos}%` }}
                />
            </div>
        );
    } catch(e) {
        return null;
    }
};

const LabReport: React.FC<LabReportProps> = ({ content }) => {
    const report = useMemo(() => parseAndValidate<LabReportType>(content, LabReportSchema), [content]);
    
    // Zustand Selector: Specific to Clinical Data
    const activePatientId = usePatientStore(state => state.activePatientId);
    const clinicalStore = useClinicalStore(state => state.data[activePatientId]);
    const observations = clinicalStore?.observations || [];

    if (!report || !report.labs) {
        return <div className="text-red-500 text-sm p-4">Error: Malformed Lab Report Data</div>;
    }

    // Find a test that has at least 2 data points in history to graph
    const trendCandidate = report.labs.find(lab => {
        const historyCount = observations.filter(o => o.code.text === lab.testName).length;
        return historyCount >= 2;
    });

    return (
        <div className="bg-white dark:bg-slate-900/40 -m-5 p-5 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-6 gap-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                <h2 className="text-sm font-mono font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="text-lg">🧪</span>
                    <span>LABORATORY_RESULTS</span>
                </h2>
                <div className="flex gap-4 text-xs font-mono text-slate-500 dark:text-slate-400">
                    {report.patient && report.patient !== 'Not Visible' && (
                        <span>PT: {report.patient}</span>
                    )}
                    {report.date && report.date !== 'Not Visible' && (
                        <span>DT: {report.date}</span>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto -mx-5 sm:mx-0 mb-4">
                <table className="w-full text-sm text-left">
                    <thead className="text-[10px] text-slate-400 uppercase font-mono tracking-wider border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className="px-4 py-2 font-medium">Test</th>
                            <th className="px-4 py-2 font-medium">Result</th>
                            <th className="px-4 py-2 font-medium w-32">Range</th>
                            <th className="px-4 py-2 font-medium text-right">Flag</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {report.labs.map((lab, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-200">{lab.testName}</td>
                                <td className="px-4 py-2">
                                    <div className="flex flex-col">
                                        <div>
                                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{lab.value}</span>
                                            <span className="ml-1 text-[10px] text-slate-400">{lab.units}</span>
                                        </div>
                                        <RangeVisualizer value={lab.value} range={lab.refRange} />
                                    </div>
                                </td>
                                <td className="px-4 py-2 text-slate-500 dark:text-slate-400 font-mono text-xs">{lab.refRange}</td>
                                <td className="px-4 py-2 text-right">
                                    <span className={`text-xs font-mono uppercase ${getFlagColor(lab.flag)}`}>
                                        {lab.flag}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* AUTOMATED TREND ANALYSIS */}
            {trendCandidate && (
                <div className="mb-4 animate-fade-in">
                    <TrendGraph testName={trendCandidate.testName} observations={observations} />
                </div>
            )}

            {report.interpretation && (
                <div className="bg-slate-50 dark:bg-slate-800/30 p-3 border border-slate-200 dark:border-slate-700 rounded-sm">
                    <h4 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-1">Interpretation</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans">{report.interpretation}</p>
                </div>
            )}
        </div>
    );
};

export default LabReport;
