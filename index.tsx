import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installClinicalCloudPolicyGuard } from './features/governance';
import './styles.css';

installClinicalCloudPolicyGuard();

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        void navigator.serviceWorker.register('/sw.js').catch(error => {
            console.warn('MediBrief offline shell registration failed:', error);
        });
    });
}
