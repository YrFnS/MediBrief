
import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangleIcon } from './icons';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-red-500 font-mono p-4">
            <div className="border border-red-600 bg-red-900/10 p-8 max-w-lg w-full rounded-sm technical-border relative overflow-hidden">
                <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
                
                <div className="flex items-center gap-4 mb-6 relative z-10">
                    <AlertTriangleIcon className="w-12 h-12 animate-pulse" />
                    <div>
                        <h1 className="text-2xl font-bold uppercase tracking-widest">System Critical Failure</h1>
                        <p className="text-xs text-red-400">Runtime Exception Detected</p>
                    </div>
                </div>
                
                <div className="bg-black/50 p-4 rounded-sm border border-red-900/50 mb-6 overflow-auto max-h-40 relative z-10">
                    <code className="text-xs break-all text-red-300">
                        {this.state.error?.toString()}
                    </code>
                </div>

                <button 
                    onClick={() => window.location.reload()}
                    className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold uppercase tracking-widest rounded-sm transition-colors relative z-10 shadow-lg shadow-red-900/20"
                >
                    Reboot System
                </button>
            </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
