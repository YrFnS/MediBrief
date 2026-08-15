import React, { useEffect, useRef } from 'react';
import type { PatientClinicalRecord } from '../../clinical-record/types';
import type {
    PersonalHealthDataArea,
    PersonalHealthDataNavigationTarget,
} from '../navigationTypes';
import type { PersonalHealthDataModule } from '../planningModuleTypes';
import HealthDataWorkspace from './HealthDataWorkspace';

interface NavigableHealthDataWorkspaceProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
    navigationTarget?: PersonalHealthDataNavigationTarget;
    onNavigationTargetConsumed?: (requestId: number) => void;
}

const MODULES_BY_AREA: Record<
    PersonalHealthDataArea,
    readonly PersonalHealthDataModule[]
> = {
    record: [
        'conditions',
        'allergies',
        'visits',
        'procedures',
        'immunizations',
        'notes',
    ],
    medications: ['medications', 'medication-reconciliation'],
    results: ['results', 'trend-reminders'],
    care: ['appointments', 'tasks', 'care-plans'],
    documents: ['documents'],
    manage: ['manage'],
};

export const isValidHealthDataNavigationTarget = (
    target: PersonalHealthDataNavigationTarget,
): boolean => MODULES_BY_AREA[target.area].includes(target.module);

const updateNativeSelect = (
    select: HTMLSelectElement,
    value: PersonalHealthDataModule,
): void => {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value',
    )?.set;
    setter?.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
};

/**
 * Compatibility bridge for the existing locally stateful HealthDataWorkspace.
 * It validates a typed in-memory destination, activates the existing area tab,
 * then uses the component's own native section control. No record, URL, or
 * persistent storage is changed.
 */
const NavigableHealthDataWorkspace: React.FC<
    NavigableHealthDataWorkspaceProps
> = ({
    record,
    onReviewCandidates,
    navigationTarget,
    onNavigationTargetConsumed,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const consumedRequestRef = useRef<number>();

    useEffect(() => {
        if (!navigationTarget) return;
        if (consumedRequestRef.current === navigationTarget.requestId) return;

        const consume = (): void => {
            consumedRequestRef.current = navigationTarget.requestId;
            onNavigationTargetConsumed?.(navigationTarget.requestId);
        };

        if (!isValidHealthDataNavigationTarget(navigationTarget)) {
            consume();
            return;
        }

        const areaTab = containerRef.current?.querySelector<HTMLButtonElement>(
            `#health-area-tab-${navigationTarget.area}`,
        );
        if (!areaTab) {
            consume();
            return;
        }

        areaTab.click();
        let secondFrame = 0;
        const firstFrame = window.requestAnimationFrame(() => {
            secondFrame = window.requestAnimationFrame(() => {
                const select = containerRef.current
                    ?.querySelector<HTMLSelectElement>(
                        '#health-data-module-select',
                    );
                const optionExists = select
                    ? Array.from(select.options).some(option =>
                        option.value === navigationTarget.module)
                    : false;
                if (select && optionExists) {
                    updateNativeSelect(select, navigationTarget.module);
                }
                consume();
            });
        });

        return () => {
            window.cancelAnimationFrame(firstFrame);
            if (secondFrame) window.cancelAnimationFrame(secondFrame);
        };
    }, [navigationTarget, onNavigationTargetConsumed]);

    return (
        <div ref={containerRef} className="contents">
            <HealthDataWorkspace
                record={record}
                onReviewCandidates={onReviewCandidates}
            />
        </div>
    );
};

export default NavigableHealthDataWorkspace;
