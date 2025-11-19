
import React from 'react';
import { WELCOME_CONTENT } from '../constants';
import { LogoIcon, CheckIcon } from './icons';

const WelcomeScreen: React.FC = () => {
    return (
        <main className="flex-1 flex flex-col items-center justify-center p-2 md:p-4 overflow-hidden">
            <div className="max-w-lg w-full text-left">
                 <div className="flex justify-center mb-4 md:mb-6">
                    <div className="p-2 md:p-4 bg-blue-500 rounded-full w-12 h-12 md:w-20 md:h-20 flex items-center justify-center shadow-lg">
                        <LogoIcon className="w-6 h-6 md:w-12 md:h-12 text-white" />
                    </div>
                </div>
                
                <div className="space-y-3 md:space-y-4 text-slate-600 dark:text-slate-300">
                    <h1 className="text-lg md:text-xl font-semibold text-slate-800 dark:text-slate-100">
                        <span role="img" aria-label="waving hand" className="mr-2">👋</span>
                        {WELCOME_CONTENT.title}
                    </h1>
                    
                    <h2 className="flex items-center text-base md:text-lg">
                        <CheckIcon className="w-5 h-5 md:w-6 md:h-6 mr-2 text-blue-500" />
                        <strong className="font-semibold text-slate-800 dark:text-slate-100">{WELCOME_CONTENT.subtitle}</strong>
                    </h2>
                    
                    <p className="text-sm md:text-base">{WELCOME_CONTENT.introduction}</p>
                    
                    <ul className="space-y-1.5 md:space-y-2 pl-1 text-sm md:text-base">
                        {WELCOME_CONTENT.features.map((feature, index) => (
                            <li key={index} className="flex items-start">
                                <CheckIcon className="w-4 h-4 md:w-5 md:h-5 mr-3 mt-0.5 text-blue-500 flex-shrink-0" />
                                <span>
                                    <span role="img" aria-hidden="true" className="mr-2">{feature.icon}</span>
                                    {feature.text}
                                </span>
                            </li>
                        ))}
                    </ul>
                    
                    <div className="text-sm md:text-base">
                        <p><strong className="font-semibold text-slate-800 dark:text-slate-100">{WELCOME_CONTENT.getStarted.title}</strong></p>
                        <ol className="list-decimal list-inside mt-1 space-y-1">
                            {WELCOME_CONTENT.getStarted.steps.map((step, index) => (
                                <li key={index}>{step}</li>
                            ))}
                        </ol>
                    </div>

                    <p className="text-sm md:text-base">{WELCOME_CONTENT.closing}</p>
                </div>
            </div>
        </main>
    );
};

export default WelcomeScreen;
