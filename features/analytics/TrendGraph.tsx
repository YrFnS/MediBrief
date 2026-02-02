
import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceArea } from 'recharts';
import { FHIRObservation } from '../fhir/types';

interface TrendGraphProps {
    testName: string;
    observations: FHIRObservation[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900 text-white p-2 rounded-sm border border-slate-700 text-xs shadow-xl">
                <p className="font-mono mb-1 text-slate-400">{label}</p>
                <p className="font-bold text-sm">
                    {payload[0].value} {payload[0].unit}
                </p>
            </div>
        );
    }
    return null;
};

const TrendGraph: React.FC<TrendGraphProps> = ({ testName, observations }) => {
    // Filter and Sort Data
    const data = observations
        .filter(o => 
            o.code.text === testName && 
            o.valueQuantity && 
            o.valueQuantity.value !== undefined &&
            // EXCLUDE DATA QUALITY ISSUES (IMPLAUSIBLE VALUES)
            // If the note contains "DATA QUALITY", it was flagged by unitService as an OCR/Unit error.
            !o.note?.some(n => n.text.includes('DATA QUALITY'))
        )
        .map(o => ({
            date: o.effectiveDateTime ? new Date(o.effectiveDateTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Unknown',
            fullDate: o.effectiveDateTime ? new Date(o.effectiveDateTime).toLocaleString() : 'Unknown',
            value: o.valueQuantity!.value,
            unit: o.valueQuantity!.unit || '',
            low: o.referenceRange?.[0]?.low?.value,
            high: o.referenceRange?.[0]?.high?.value,
            timestamp: o.effectiveDateTime ? new Date(o.effectiveDateTime).getTime() : 0
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

    if (data.length < 2) return null;

    // Get range from the last observation (assuming consistency)
    const refLow = data[data.length - 1].low;
    const refHigh = data[data.length - 1].high;

    return (
        <div className="w-full h-[180px] bg-white dark:bg-slate-900/50 rounded-sm border border-slate-200 dark:border-slate-800 p-2 mt-4 relative">
             <div className="absolute top-2 left-3 z-10">
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
                    Trend Analysis: {testName}
                </h4>
            </div>
            
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                    
                    <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 9, fill: '#64748b' }} 
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis 
                        domain={['auto', 'auto']} 
                        tick={{ fontSize: 9, fill: '#64748b' }} 
                        axisLine={false}
                        tickLine={false}
                    />
                    
                    <Tooltip content={<CustomTooltip />} />

                    {/* Reference Range Shading */}
                    {refLow !== undefined && refHigh !== undefined && (
                         <ReferenceArea 
                            y1={refLow} 
                            y2={refHigh} 
                            fill="#22c55e" 
                            fillOpacity={0.05} 
                        />
                    )}

                    <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: '#60a5fa' }}
                        animationDuration={1000}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default TrendGraph;
