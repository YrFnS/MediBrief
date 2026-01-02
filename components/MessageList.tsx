
import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { ChatMessage, LiveTranscript } from '../types';
import Message from './Message';
import WelcomeScreen from './WelcomeScreen';
import { BotIcon, UserIcon } from './icons';

interface LiveTranscriptDisplayProps {
    transcript: LiveTranscript;
}

const AudioWave: React.FC = () => (
    <div className="flex items-center gap-1 h-4">
        {[1, 2, 3, 4, 5].map(i => (
            <div 
                key={i} 
                className="w-1 bg-medical-500 rounded-full animate-music" 
                style={{ 
                    height: '100%', 
                    animationDuration: `${0.4 + Math.random() * 0.5}s` 
                }}
            />
        ))}
    </div>
);

const LiveTranscriptDisplay: React.FC<LiveTranscriptDisplayProps> = ({ transcript }) => {
    return (
        <div className="max-w-3xl mx-auto space-y-4 p-4 rounded-lg bg-white dark:bg-slate-800 shadow-md border border-medical-500/30 animate-fade-in relative overflow-hidden">
            {/* Active Status Indicator */}
            <div className="absolute top-0 right-0 p-2 flex items-center gap-2">
                 <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">LIVE SESSION</span>
            </div>

            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-slate-200 dark:bg-slate-700">
                    <UserIcon className="w-5 h-5 text-slate-500 dark:text-slate-300" />
                </div>
                <div className="flex-1">
                    <p className="text-xs font-bold text-slate-400 mb-1 uppercase">User</p>
                    <p className="prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 min-h-[1.5em]">
                        {transcript.userInput ? transcript.userInput : <span className="text-slate-400 italic">Listening...</span>}
                    </p>
                </div>
            </div>
             
             <div className="h-px bg-slate-100 dark:bg-slate-700 w-full" />

             <div className="flex items-start gap-3">
                 <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-medical-500 to-medical-600 shadow-sm">
                    <BotIcon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-bold text-slate-400 uppercase">Assistant</p>
                        {transcript.modelOutput && !transcript.userInput && <AudioWave />}
                    </div>
                    <p className="prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200">
                        {transcript.modelOutput}
                    </p>
                </div>
            </div>
        </div>
    );
};


interface MessageListProps {
    messages: ChatMessage[];
    isLoading: boolean;
    isLive?: boolean;
    liveTranscript?: LiveTranscript;
    onViewImage?: (src: string, alt: string) => void;
}

const MessageList: React.FC<MessageListProps> = ({ messages, isLoading, isLive, liveTranscript, onViewImage }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);

    const handleScroll = () => {
        if (!containerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const atBottom = scrollHeight - scrollTop - clientHeight < 50;
        setIsAtBottom(atBottom);
    };

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    }, []);

    useEffect(() => {
        if (isAtBottom) {
            scrollToBottom(isLoading ? 'auto' : 'smooth');
        }
    }, [messages, isLoading, liveTranscript, isAtBottom, scrollToBottom]);

    const handleImageLoad = useCallback(() => {
        if (isAtBottom) {
            scrollToBottom('auto');
        }
    }, [isAtBottom, scrollToBottom]);

    if (messages.length === 0 && !isLive) {
        return <WelcomeScreen />;
    }

    return (
        <main 
            className="flex-1 overflow-y-auto p-2 md:p-6" 
            ref={containerRef}
            onScroll={handleScroll}
        >
            <div className="max-w-3xl mx-auto space-y-4 md:space-y-6 pb-4">
                {messages.map((msg, index) => (
                    <Message 
                        key={index} 
                        message={msg} 
                        isLoading={isLoading} 
                        isLast={index === messages.length - 1}
                        onImageLoad={handleImageLoad}
                        onViewImage={onViewImage}
                    />
                ))}
                
                {isLive && liveTranscript && <LiveTranscriptDisplay transcript={liveTranscript} />}
                
                <div ref={messagesEndRef} />
            </div>
        </main>
    );
};

export default MessageList;
