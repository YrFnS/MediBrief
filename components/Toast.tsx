
import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckIcon, AlertTriangleIcon, XCircleIcon } from './icons';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const contextValue = React.useMemo(() => ({ showToast }), [showToast]);

    return (
        <ToastContext.Provider value={contextValue}>
            {children}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`
                            animate-slide-up pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-sm shadow-2xl border-l-4 min-w-[320px] max-w-md backdrop-blur-md
                            ${toast.type === 'error' ? 'bg-slate-900/95 text-red-400 border-red-500 shadow-red-900/20' :
                                toast.type === 'success' ? 'bg-slate-900/95 text-emerald-400 border-emerald-500 shadow-emerald-900/20' :
                                    'bg-slate-900/95 text-blue-400 border-blue-500 shadow-blue-900/20'}
                        `}
                    >
                        {toast.type === 'error' && <XCircleIcon className="w-5 h-5 flex-shrink-0" />}
                        {toast.type === 'success' && <CheckIcon className="w-5 h-5 flex-shrink-0" />}
                        {toast.type === 'info' && <AlertTriangleIcon className="w-5 h-5 flex-shrink-0" />}
                        <span className="text-sm font-mono font-bold">{toast.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error("useToast must be used within ToastProvider");
    return context;
};
