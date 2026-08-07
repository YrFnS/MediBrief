import React, { useMemo, useState } from 'react';
import Header from '../../components/Header';
import {
    ActivityIcon,
    EyeIcon,
    ShieldCheckIcon,
    WifiOffIcon,
} from '../../components/icons';
import { useSecurityLock } from '../../hooks/useSecurityLock';
import CDSSContainer from '../cdss/CDSSContainer';
import ClinicalCandidateReview from '../clinical-record/components/ClinicalCandidateReview';
import ClinicalContextReview from '../clinical-record/components/ClinicalContextReview';
import { selectCandidateResources } from '../clinical-record/selectors';
import { useClinicalRecordStore } from '../clinical-record/useClinicalRecordStore';
import HeadsUpDisplay from '../hud/HeadsUpDisplay';
import { usePatientStore } from '../patient-management/usePatientStore';
import {
    AssistantAccessPrompt,
    PersonalHealthRecordShell,
    PersonalRecordNavigation,
} from '../personal-health-record';
import type { PersonalRecordView } from '../personal-health-record';
import SidebarRoster from '../patient-roster/SidebarRoster';
import SettingsModal from '../settings/SettingsModal';
import { AIProvider, useSettingsStore } from '../settings/useSettingsStore';
import { useUIStore } from '../ui/UIContext';
import BioMetricBackground from './BioMetricBackground';
import DisclaimerModal from '../../components/DisclaimerModal';
import MainLayout from './MainLayout';

const useOnlineStatus = (): boolean => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    React.useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
};

const LockedView: React.FC<{ onUnlock: () => void }> = ({ onUnlock }) => (
    <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 text-white">
        <div className="bg-grid-pattern absolute inset-0 opacity-10" />
        <div className="technical-border z-10 w-full max-w-sm rounded-md border border-slate-700 bg-slate-900 p-8 text-center shadow-2xl">
            <ShieldCheckIcon className="mx-auto mb-4 h-12 w-12 animate-pulse text-blue-500" />
            <h2 className="mb-2 text-xl font-display font-bold uppercase tracking-widest">
                Session locked
            </h2>
            <p className="mb-6 text-sm font-mono text-slate-400">
                Local privacy timeout
            </p>
            <button
                type="button"
                onClick={onUnlock}
                className="w-full rounded-sm bg-blue-600 py-3 font-bold uppercase tracking-widest text-white transition-colors hover:bg-blue-500"
            >
                Resume session
            </button>
        </div>
    </div>
);

const VIEW_TITLES: Record<PersonalRecordView, string> = {
    overview: 'Overview',
    'health-data': 'Health Data',
    timeline: 'Timeline',
    search: 'Search & Export',
    emergency: 'Emergency Summary',
    assistant: 'Assistant',
};

const Phase2Workspace: React.FC = () => {
    const [view, setView] = useState<PersonalRecordView>('overview');
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const activePatientId = usePatientStore(state => state.activePatientId);
    const activePatient = usePatientStore(
        state => state.patients[activePatientId],
    );
    const activeRecord = useClinicalRecordStore(
        state => state.records[activePatientId],
    );
    const { uiState, uiDispatch } = useUIStore();
    const { provider, openRouterApiKey } = useSettingsStore();
    const hasAnyApiKey = provider === AIProvider.Gemini || Boolean(openRouterApiKey);
    const { isLocked, isBlurred, unlock } = useSecurityLock();
    const isOnline = useOnlineStatus();

    React.useEffect(() => {
        const patientLabel = activePatient?.name
            ? ` — ${activePatient.name}`
            : '';
        document.title = `${VIEW_TITLES[view]}${patientLabel} | MediBrief`;
    }, [activePatient?.name, view]);

    React.useEffect(() => {
        const handleResize = () => {
            setIsSidebarOpen(window.innerWidth >= 768);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const pendingCandidates = useMemo(
        () => activeRecord
            ? selectCandidateResources(activeRecord).length
            : 0,
        [activeRecord],
    );

    if (isLocked) return <LockedView onUnlock={unlock} />;

    if (view === 'assistant' && hasAnyApiKey) {
        return (
            <div className="relative h-full w-full">
                <MainLayout />
                <button
                    type="button"
                    onClick={() => setView('overview')}
                    aria-label="Return from the assistant to the patient record overview"
                    className="fixed right-3 top-16 z-50 flex items-center gap-2 rounded-full border border-blue-200 bg-white/95 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-blue-700 shadow-lg backdrop-blur-md transition-colors hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-950/95 dark:text-blue-300"
                >
                    <ActivityIcon className="h-3.5 w-3.5" />
                    Back to record
                </button>
            </div>
        );
    }

    return (
        <div className="relative flex h-[100dvh] overflow-hidden bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <a
                href="#patient-record-content"
                className="sr-only fixed left-3 top-3 z-[100] rounded-lg bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-xl focus:not-sr-only"
            >
                Skip to patient record content
            </a>
            <BioMetricBackground />
            <DisclaimerModal />
            <SettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />

            <div className={`relative z-10 flex h-full w-full transition-all duration-500 ${isBlurred
                ? 'pointer-events-none scale-[0.99] opacity-60 blur-md grayscale'
                : ''
            }`}>
                <SidebarRoster
                    isOpen={isSidebarOpen}
                    toggle={() => setIsSidebarOpen(!isSidebarOpen)}
                />

                <div className="flex min-w-0 flex-1 flex-col">
                    <Header
                        currentMode={uiState.chatMode}
                        onModeChange={mode => uiDispatch({
                            type: 'SET_CHAT_MODE',
                            payload: mode,
                        })}
                        onClearChat={() => undefined}
                        onExportChat={() => undefined}
                        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                        onOpenSettings={() => setIsSettingsOpen(true)}
                        showAssistantControls={false}
                    />

                    {!isOnline && (
                        <div
                            role="status"
                            aria-live="polite"
                            className="z-40 flex items-center justify-center gap-2 bg-emerald-600 px-4 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-white shadow-sm"
                        >
                            <WifiOffIcon className="h-3.5 w-3.5" />
                            <span>Offline — local record remains available</span>
                        </div>
                    )}

                    {activePatient && (
                        <HeadsUpDisplay patient={activePatient} />
                    )}

                    <PersonalRecordNavigation
                        value={view}
                        onChange={setView}
                        pendingCandidates={pendingCandidates}
                    />

                    <main
                        id="patient-record-content"
                        role="tabpanel"
                        aria-labelledby={`patient-record-tab-${view}`}
                        tabIndex={-1}
                        className="flex min-h-0 min-w-0 flex-1 flex-col outline-none"
                    >
                        {activePatient && view === 'overview' && (
                            <>
                                <ClinicalContextReview patientId={activePatient.id} />
                                <ClinicalCandidateReview patientId={activePatient.id} />
                            </>
                        )}

                        <CDSSContainer />

                        {!activePatient ? (
                            <div className="flex flex-1 items-center justify-center p-6">
                                <div className="max-w-md rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-950/80">
                                    <ActivityIcon className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                                    <h1 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
                                        Select or create a patient
                                    </h1>
                                    <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                                        The personal health record is patient-scoped. Use the roster to choose the record you want to review.
                                    </p>
                                </div>
                            </div>
                        ) : view === 'assistant' ? (
                            <AssistantAccessPrompt
                                onOpenSettings={() => setIsSettingsOpen(true)}
                                record={activeRecord}
                            />
                        ) : (
                            <PersonalHealthRecordShell
                                patientId={activePatient.id}
                                view={view}
                                onNavigate={setView}
                            />
                        )}
                    </main>
                </div>
            </div>

            <div className={`pointer-events-none absolute inset-0 z-[60] flex items-center justify-center transition-opacity duration-500 ${isBlurred ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex items-center gap-3 rounded-full border border-white/10 bg-slate-900/90 px-8 py-4 text-sm font-mono uppercase tracking-widest text-white shadow-2xl">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    <EyeIcon className="h-4 w-4 text-emerald-500" />
                    <span>Privacy shield active</span>
                </div>
            </div>
        </div>
    );
};

export default Phase2Workspace;
