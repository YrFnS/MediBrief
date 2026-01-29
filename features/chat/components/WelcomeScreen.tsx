
import React from 'react';
import { WELCOME_CONTENT } from '../../../constants';
import { LogoIcon, CheckIcon, SparklesIcon, DocumentTextIcon, UsersIcon, ShieldCheckIcon } from '../../../components/icons';

const SystemModule: React.FC<{title: string; icon: React.ReactNode; children: React.ReactNode; delay: string}> = ({ title, icon, children, delay }) => (
    <div className={`group relative bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-3 shadow-sm hover:border-blue-500 dark:hover:border-blue-500 transition-colors duration-300 animate-slide-up ${delay} rounded-lg`}>
        <div className="absolute top-0 left-0 w-1 h-1 bg-slate-400 group-hover:bg-blue-500 transition-colors rounded-tl-lg"></div>
        <div className="absolute top-0 right-0 w-1 h-1 bg-slate-400 group-hover:bg-blue-500 transition-colors rounded-tr-lg"></div>
        <div className="absolute bottom-0 left-0 w-1 h-1 bg-slate-400 group-hover:bg-blue-500 transition-colors rounded-bl-lg"></div>
        <div className="absolute bottom-0 right-0 w-1 h-1 bg-slate-400 group-hover:bg-blue-500 transition-colors rounded-br-lg"></div>

        <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b border-slate-100 dark:border-slate-800">
            <div className="text-slate-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors">
                {icon}
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-700 dark:text-slate-300">{title}</span>
        </div>
        <div className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400 leading-snug font-sans">
            {children}
        </div>
    </div>
);

const WelcomeScreen: React.FC = () => {
    return (
        <main className="flex-1 flex flex-col items-center justify-start md:justify-center p-4 overflow-y-auto relative no-scrollbar">
            <div className="max-w-4xl w-full z-10 py-8 md:py-0">
                
                {/* Hero Section */}
                <div className="flex flex-col items-center text-center mb-8 md:mb-12 animate-fade-in">
                    <div className="relative mb-4 scale-90 md:scale-100">
                        <div className="absolute inset-0 bg-blue-500 blur-[30px] opacity-20 rounded-full"></div>
                        <div className="relative p-3 bg-slate-900 dark:bg-slate-800 border border-slate-700 text-white shadow-xl rounded-xl">
                            <LogoIcon className="w-8 h-8" />
                        </div>
                    </div>
                    
                    <h1 className="text-3xl md:text-5xl font-display font-bold text-slate-900 dark:text-white mb-2 tracking-tighter">
                        MediBrief<span className="text-blue-500">.CIL</span>
                    </h1>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 dark:text-slate-400 tracking-widest uppercase bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                        <span>v4.2.0 Stable</span>
                        <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                        <span>Clinical Intelligence Layer</span>
                    </div>
                </div>

                {/* Modules Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-5 mb-8 md:mb-10">
                    <SystemModule title="Safety Layer" icon={<ShieldCheckIcon className="w-4 h-4"/>} delay="animation-delay-100">
                        Protocol enforcement active. Checking allergies (MedDRA) & contraindications.
                    </SystemModule>
                    <SystemModule title="Data Ingestion" icon={<DocumentTextIcon className="w-4 h-4"/>} delay="animation-delay-200">
                         Native multimodal analysis active. Synthesizing tokens from PDFs & X-Rays.
                    </SystemModule>
                    <SystemModule title="Shift Handover" icon={<UsersIcon className="w-4 h-4"/>} delay="animation-delay-300">
                        Structured briefing generation. Standardized JSON artifacts for clinical handoff.
                    </SystemModule>
                </div>

                {/* Operating Procedures */}
                <div className="max-w-lg mx-auto border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-slate-900/50 rounded-lg p-4 animate-slide-up font-mono text-[10px] md:text-xs" style={{ animationDelay: '400ms' }}>
                    <div className="flex items-center gap-2 mb-2 text-blue-600 dark:text-blue-400 border-b border-blue-200 dark:border-blue-800/50 pb-2">
                        <SparklesIcon className="w-3.5 h-3.5" />
                        <span className="font-bold uppercase tracking-wider">Standard Operating Procedures</span>
                    </div>
                    <ul className="space-y-2 text-slate-600 dark:text-slate-400">
                        {WELCOME_CONTENT.getStarted.steps.map((step, index) => (
                            <li key={index} className="flex items-start gap-2">
                                <span className="text-blue-400 font-bold">0{index + 1}</span>
                                <span>{step}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            
            {/* Background Ambient */}
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[800px] h-[300px] md:h-[800px] bg-gradient-radial from-slate-200/40 to-transparent dark:from-slate-800/20 dark:to-transparent opacity-50 blur-3xl"></div>
            </div>
        </main>
    );
};

export default WelcomeScreen;
