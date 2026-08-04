import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import Phase2Workspace from './features/layout/Phase2Workspace';
import SecurityGate from './features/security/SecurityGate';
import { UIProvider } from './features/ui/UIContext';

const App: React.FC = () => (
    <ErrorBoundary>
        <ToastProvider>
            <UIProvider>
                <SecurityGate>
                    <Phase2Workspace />
                </SecurityGate>
            </UIProvider>
        </ToastProvider>
    </ErrorBoundary>
);

export default App;
