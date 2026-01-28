
import React from 'react';
import MainLayout from './features/layout/MainLayout';
import { PatientProvider } from './features/patient-management/usePatientStore';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';

const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <ToastProvider>
                <PatientProvider>
                    <MainLayout />
                </PatientProvider>
            </ToastProvider>
        </ErrorBoundary>
    );
};

export default App;
