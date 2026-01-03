import React from 'react';
import { WELCOME_CONTENT } from '../constants';
import { LogoIcon, CheckIcon, SparklesIcon, DocumentTextIcon, UsersIcon, ShieldCheckIcon } from './icons';

// A technical "Module" component replacing the soft Card
const SystemModule: React.FC<{title: string; icon: React.ReactNode; children: React.ReactNode; delay: string}> = ({ title, icon, children, delay }) => (
    <div className={`group relative bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-5 shadow-sm hover:border-blue-500 dark:hover:border-blue-500 transition-colors duration-300 animate-slide-up ${delay}`}>
        {/* Decorative corner markers */}
        <div className="absolute top-0 left-0 w-1 h-1 bg-slate-400 group-hover:bg-blue-500 transition-colors"></div>
        <div className="absolute top-0 right-0 w-1 h-1 bg-slate-400 group-hover:bg-blue-500 transition-colors"></div>
        <div className="absolute bottom-0 left-0 w-1 h-1 bg-slate-400 group-hover:bg-blue-500 transition-colors"></div>
        <div className="absolute bottom-0 right-0 w-1 h-1 bg-slate-400 group-hover:bg-blue-500 transition-colors"></div>

        <div className="flex items-center gap-3 mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors">
                {icon}
            </div>
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">{title}</span>
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
            {children}
        </div>
    </div>
);

const WelcomeScreen: React.FC = () => {
    return (
        <main className="flex-1 flex flex-col items-center justify-center p-6 overflow-hidden relative">
            <div className="max-w-5xl w-full z-10">
                
                {/* Hero Section */}
                <div className="flex flex-col items-center text-center mb-16 animate-fade-in">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-blue-500 blur-[40px] opacity-20 rounded-full"></div>
                        <div className="relative p-4 bg-slate-900 dark:bg-slate-800 border border-slate-700 text-white shadow-2xl">
                            <LogoIcon className="w-10 h-10" />
                        </div>
                    </div>
                    
                    <h1 className="text-4xl md:text-6xl font-display font-bold text-slate-900 dark:text-white mb-4 tracking-tighter">
                        MEDIBRIEF<span className="text-blue-500">.CIL</span>
                    </h1>
                    <div className="flex items-center gap-3 text-xs font-mono text-slate-500 dark:text-slate-400 tracking-widest uppercase">
                        <span>v3.0.0 Stable</span>
                        <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                        <span>Clinical Intelligence Layer</span>
                    </div>
                </div>

                {/* Technical Grid Dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <SystemModule title="Safety Layer" icon={<ShieldCheckIcon className="w-5 h-5"/>} delay="animation-delay-100">
                        Protocol enforcement active. Checking allergies (MedDRA), medical history, and contraindications against all inputs.
                    </SystemModule>
                    <SystemModule title="Data Ingestion" icon={<DocumentTextIcon className="w-5 h-5"/>} delay="animation-delay-200">
                         Native multimodal analysis active. Synthesizing tokens from PDFs, X-Rays, and raw clinical text notes.
                    </SystemModule>
                    <SystemModule title="Shift Handover" icon={<UsersIcon className="w-5 h-5"/>} delay="animation-delay-300">
                        Structured briefing generation. Compiling priority cases and critical alerts into standardized JSON artifacts.
                    </SystemModule>
                </div>

                {/* Terminal-style Quick Start */}
                <div className="max-w-xl mx-auto border-l-2 border-blue-500 bg-slate-100 dark:bg-slate-900/80 p-5 animate-slide-up font-mono text-xs" style={{ animationDelay: '400ms' }}>
                    <div className="flex items-center gap-2 mb-3 text-blue-600 dark:text-blue-400">
                        <SparklesIcon className="w-4 h-4" />
                        <span className="font-bold uppercase tracking-wider">Operating_Procedures</span>
                    </div>
                    <ul className="space-y-2 text-slate-600 dark:text-slate-400">
                        {WELCOME_CONTENT.getStarted.steps.map((step, index) => (
                            <li key={index} className="flex items-start gap-3">
                                <span className="text-slate-400">[{index + 1}]</span>
                                <span>{step}</span>
                            </li>
                        ))}
                    </ul>
                </div>

            </div>
            
            {/* Background Decoration */}
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-slate-200/40 to-transparent dark:from-slate-800/20 dark:to-transparent opacity-50 blur-3xl"></div>
            </div>
        </main>
    );
};

export default WelcomeScreen;