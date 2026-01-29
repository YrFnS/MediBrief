
import React from 'react';
import MainLayout from './features/layout/MainLayout';
import { UIProvider } from './features/ui/UIContext';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';

const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <ToastProvider>
                <UIProvider>
                    <MainLayout />
                </UIProvider>
            </ToastProvider>
        </ErrorBoundary>
    );
};

export default App;
