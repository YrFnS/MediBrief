import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installClinicalCloudPolicyGuard } from './features/governance';
import IconAuditPage from './features/testing/IconAuditPage';
import './styles.css';

installClinicalCloudPolicyGuard();

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('Could not find root element to mount to');
}

const isIconAudit = new URLSearchParams(window.location.search)
    .get('__medibriefIconAudit') === '1';

if (isIconAudit) {
    document.title = 'MediBrief icon audit';
}

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        {isIconAudit ? <IconAuditPage /> : <App />}
    </React.StrictMode>,
);

if (!isIconAudit && 'serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        void navigator.serviceWorker.register('/sw.js').catch(error => {
            console.warn('MediBrief offline shell registration failed:', error);
        });
    });
}
