
import React, { useEffect, useRef, useState } from 'react';
import type { ChatMessage, LiveTranscript } from '../types';
import Message from './Message';
import WelcomeScreen from './WelcomeScreen';
import { BotIcon, UserIcon } from './icons';

interface LiveTranscriptDisplayProps {
    transcript: LiveTranscript;
}

const LiveTranscriptDisplay: React.FC<LiveTranscriptDisplayProps> = ({ transcript }) => {
    return (
        <div className="max-w-3xl mx-auto space-y-4 p-4 rounded-lg bg-white dark:bg-slate-800 shadow-md border border-blue-500/50 animate-fade-in">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-slate-400">
                    <UserIcon className="w-5 h-5 text-white" />
                </div>
                <p className="pt-1.5 prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200">
                    {transcript.userInput || "Listening..."}
                </p>
            </div>
             <div className="flex items-start gap-3 min-h-[2.5rem]">
                 <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-blue-500">
                    <BotIcon className="w-5 h-5 text-white" />
                </div>
                <p className="pt-1.5 prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200">
                    {transcript.modelOutput}
                </p>
            </div>
        </div>
    );
};


interface MessageListProps {
    messages: ChatMessage[];
    isLoading: boolean;
    isLive?: boolean;
    liveTranscript?: LiveTranscript;
}

const MessageList: React.FC<MessageListProps> = ({ messages, isLoading, isLive, liveTranscript }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);

    const handleScroll = () => {
        if (!containerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        // Check if user is within 50px of the bottom
        const atBottom = scrollHeight - scrollTop - clientHeight < 50;
        setIsAtBottom(atBottom);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        // Smart Scroll: Only auto-scroll if the user was already at the bottom
        // or if a new message just started coming in (which forces attention)
        if (isAtBottom) {
            scrollToBottom();
        }
    }, [messages, isLoading, liveTranscript, isAtBottom]);

    if (messages.length === 0 && !isLive) {
        return <WelcomeScreen />;
    }

    return (
        <main 
            className="flex-1 overflow-y-auto p-4 md:p-6" 
            ref={containerRef}
            onScroll={handleScroll}
        >
            <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((msg, index) => (
                    <Message 
                        key={index} 
                        message={msg} 
                        isLoading={isLoading} 
                        isLast={index === messages.length - 1} 
                    />
                ))}
                
                {isLoading && messages.length > 0 && !isLive && (
                    <div className="flex items-start gap-4 animate-pulse">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-blue-500">
                            <BotIcon className="w-5 h-5 text-white" />
                        </div>
                        <div className="w-full max-w-full rounded-xl p-4 bg-white dark:bg-slate-800 shadow flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 bg-slate-400 dark:bg-slate-500 rounded-full animation-delay-0"></span>
                            <span className="w-2.5 h-2.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-pulse delay-200"></span>
                            <span className="w-2.5 h-2.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-pulse delay-400"></span>
                        </div>
                    </div>
                )}
                
                {isLive && liveTranscript && <LiveTranscriptDisplay transcript={liveTranscript} />}
                
                <div ref={messagesEndRef} />
            </div>
        </main>
    );
};

export default MessageList;
