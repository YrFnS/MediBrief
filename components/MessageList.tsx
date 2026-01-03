import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { ChatMessage, LiveTranscript } from '../types';
import Message from './Message';
import WelcomeScreen from './WelcomeScreen';
import { BotIcon, UserIcon, ShieldCheckIcon } from './icons';

interface LiveTranscriptDisplayProps {
    transcript: LiveTranscript;
}

const AudioWave: React.FC = () => (
    <div className="flex items-center gap-0.5 h-3">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div 
                key={i} 
                className="w-0.5 bg-green-500 animate-music" 
                style={{ 
                    height: '100%', 
                    animationDuration: `${0.3 + Math.random() * 0.4}s` 
                }}
            />
        ))}
    </div>
);

const LiveTranscriptDisplay: React.FC<LiveTranscriptDisplayProps> = ({ transcript }) => {
    return (
        <div className="max-w-3xl mx-auto mt-4 mb-8">
            {/* Telemetry Header */}
            <div className="flex items-center justify-between px-2 mb-1">
                <div className="flex items-center gap-2">
                     <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span className="text-[10px] font-mono font-bold text-red-500 uppercase tracking-widest">LIVE_FEED :: AUDIO_CHANNEL_01</span>
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                    16kHz PCM
                </div>
            </div>

            {/* Terminal Container */}
            <div className="bg-slate-50 dark:bg-slate-900 border border-red-500/30 technical-border relative overflow-hidden p-4">
                <div className="absolute top-0 right-0 p-2 opacity-20 pointer-events-none">
                    <div className="w-16 h-16 border border-red-500 rounded-full border-dashed animate-spin-slow"></div>
                </div>

                {/* User Channel */}
                <div className="mb-4 relative z-10">
                    <div className="flex items-center gap-2 mb-1 opacity-70">
                        <UserIcon className="w-3 h-3 text-slate-500" />
                        <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500">Input_Source (User)</span>
                    </div>
                    <div className="pl-2 border-l-2 border-slate-300 dark:border-slate-700 min-h-[1.5em]">
                         <p className="font-mono text-sm text-slate-700 dark:text-slate-300">
                            {transcript.userInput ? transcript.userInput : <span className="text-slate-400 animate-pulse">...listening...</span>}
                        </p>
                    </div>
                </div>

                {/* System Channel */}
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1 text-green-600 dark:text-green-500">
                        <BotIcon className="w-3 h-3" />
                        <span className="text-[9px] font-mono uppercase tracking-wider">System_Output (Gemini)</span>
                        {transcript.modelOutput && !transcript.userInput && <AudioWave />}
                    </div>
                    <div className="pl-2 border-l-2 border-green-500/50">
                        <p className="font-mono text-sm text-green-800 dark:text-green-400">
                             {transcript.modelOutput}
                        </p>
                    </div>
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

                {/* Safety Footer */}
                <div className="py-4 text-center opacity-60">
                     <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full">
                        <ShieldCheckIcon className="w-3 h-3 text-slate-500" />
                        <span className="text-[10px] text-slate-500 font-mono">
                            MediBrief can make mistakes. Verify important clinical information.
                        </span>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default MessageList;