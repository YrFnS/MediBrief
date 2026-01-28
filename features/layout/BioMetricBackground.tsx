
import React, { useMemo } from 'react';
import { usePatientStore } from '../patient-management/usePatientStore';

const EKG_PATH = "M0,50 L50,50 L60,45 L70,55 L80,50 L90,50 L95,20 L100,80 L105,50 L115,50 L125,40 L135,60 L145,50 L200,50 M200,50 L250,50 L260,45 L270,55 L280,50 L290,50 L295,20 L300,80 L305,50 L315,50 L325,40 L335,60 L345,50 L400,50";

const BioMetricBackground: React.FC = () => {
    const { activePatient } = usePatientStore();
    
    // Determine system state based on patient status
    const systemState = useMemo(() => {
        const status = activePatient?.status || 'Stable';
        switch (status) {
            case 'Critical':
                return {
                    pulseColor: 'bg-red-500',
                    pulseAnimation: 'animate-cardiac-fast',
                    strokeColor: 'stroke-red-500/30',
                    glowColor: 'shadow-red-500/20',
                    ambientGradient: 'from-slate-900 via-red-950/20 to-slate-900',
                };
            case 'New Admission':
                return {
                    pulseColor: 'bg-indigo-500',
                    pulseAnimation: 'animate-cardiac-slow',
                    strokeColor: 'stroke-indigo-500/20',
                    glowColor: 'shadow-indigo-500/20',
                    ambientGradient: 'from-slate-900 via-indigo-950/10 to-slate-900',
                };
            default: // Stable / Discharge Ready
                return {
                    pulseColor: 'bg-cyan-500',
                    pulseAnimation: 'animate-cardiac-slow',
                    strokeColor: 'stroke-cyan-500/20',
                    glowColor: 'shadow-cyan-500/20',
                    ambientGradient: 'from-slate-900 via-slate-800/40 to-slate-900',
                };
        }
    }, [activePatient?.status]);

    return (
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
            
            {/* 1. Deep Ambient Vignette */}
            <div className={`absolute inset-0 bg-gradient-radial ${systemState.ambientGradient} opacity-60 z-0 transition-colors duration-1000`}></div>

            {/* 2. Technical Grid with Fade-Out Edges */}
            <div className="absolute inset-0 bg-medical-cross dark:bg-medical-cross-dark opacity-[0.07] mask-radial-center z-0"></div>

            {/* 3. The Living Pulse (Heartbeat) */}
            {/* This is the subtle "breath" of the UI */}
            <div className={`
                absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 
                w-[50vw] h-[50vw] max-w-[800px] max-h-[800px] rounded-full 
                blur-[100px] mix-blend-screen opacity-15 
                transition-all duration-1000
                ${systemState.pulseColor} ${systemState.pulseAnimation}
            `}></div>

            {/* 4. EKG Monitoring Strip (Bottom) */}
            {/* Simulates a continuous monitor feed with "phosphor persistence" fade */}
            <div className="absolute inset-x-0 bottom-0 h-32 opacity-40 overflow-hidden mask-linear-fade">
                <div className="absolute inset-y-0 left-0 w-[200%] flex items-center animate-ekg-flow">
                    <svg viewBox="0 0 1200 100" className={`w-1/2 h-full fill-none stroke-2 ${systemState.strokeColor}`} preserveAspectRatio="none">
                         <path d={`${EKG_PATH} M400,50 L450,50 L460,45 L470,55 L480,50 L490,50 L495,20 L500,80 L505,50 L515,50 L525,40 L535,60 L545,50 L600,50 M600,50 L650,50 L660,45 L670,55 L680,50 L690,50 L695,20 L700,80 L705,50 L715,50 L725,40 L735,60 L745,50 L800,50 M800,50 L850,50 L860,45 L870,55 L880,50 L890,50 L895,20 L900,80 L905,50 L915,50 L925,40 L935,60 L945,50 L1000,50 M1000,50 L1050,50 L1060,45 L1070,55 L1080,50 L1090,50 L1095,20 L1100,80 L1105,50 L1115,50 L1125,40 L1135,60 L1145,50 L1200,50`} />
                    </svg>
                    <svg viewBox="0 0 1200 100" className={`w-1/2 h-full fill-none stroke-2 ${systemState.strokeColor}`} preserveAspectRatio="none">
                         <path d={`${EKG_PATH} M400,50 L450,50 L460,45 L470,55 L480,50 L490,50 L495,20 L500,80 L505,50 L515,50 L525,40 L535,60 L545,50 L600,50 M600,50 L650,50 L660,45 L670,55 L680,50 L690,50 L695,20 L700,80 L705,50 L715,50 L725,40 L735,60 L745,50 L800,50 M800,50 L850,50 L860,45 L870,55 L880,50 L890,50 L895,20 L900,80 L905,50 L915,50 L925,40 L935,60 L945,50 L1000,50 M1000,50 L1050,50 L1060,45 L1070,55 L1080,50 L1090,50 L1095,20 L1100,80 L1105,50 L1115,50 L1125,40 L1135,60 L1145,50 L1200,50`} />
                    </svg>
                </div>
            </div>

            {/* 5. Noise Grain (Film Effect) */}
            <div className="absolute inset-0 bg-transparent opacity-[0.02]" 
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}>
            </div>
        </div>
    );
};

export default BioMetricBackground;
