
import React from 'react';
import MainLayout from './features/layout/MainLayout';
import { PatientProvider } from './features/patient-management/usePatientStore';
import { UIProvider } from './features/ui/UIContext';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';

const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <ToastProvider>
                <UIProvider>
                    <PatientProvider>
                        <MainLayout />
                    </PatientProvider>
                </UIProvider>
            </ToastProvider>
        </ErrorBoundary>
    );
};

export default App;
