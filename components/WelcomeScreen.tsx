
import React, { useMemo } from 'react';
import { WELCOME_MESSAGE } from '../constants';
import { LogoIcon } from './icons';

const WelcomeScreen: React.FC = () => {
    
    const parsedWelcomeMessage = useMemo(() => {
        return WELCOME_MESSAGE
            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-800 dark:text-slate-100">$1</strong>')
            .replace(/-\s(.*?)(?=\n|$)/g, '<li class="flex items-start"><span class="mr-2 mt-1 text-blue-500">✓</span><span>$1</span></li>')
            .replace(/<li/g, '<ul><li')
            .replace(/li>\n/g, 'li></ul>')
            .replace(/<\/ul><ul>/g, ''); // Fix multiple lists
    }, []);

    return (
        <main className="flex-1 flex flex-col items-center justify-center p-4 text-center">
            <div className="max-w-2xl">
                 <div className="mx-auto mb-6 p-4 bg-blue-500 rounded-full w-20 h-20 flex items-center justify-center shadow-lg">
                    <LogoIcon className="w-12 h-12 text-white" />
                </div>
                <div 
                    className="text-left space-y-3 text-slate-600 dark:text-slate-300" 
                    dangerouslySetInnerHTML={{ __html: parsedWelcomeMessage }}
                />
            </div>
        </main>
    );
};

export default WelcomeScreen;