import { describe, expect, it } from 'vitest';
import {
    getResourceDateBounds,
    matchesClinicalResourceQuery,
} from '../features/clinical-record';
import {
    makeObservation,
    unknownClinicalDate,
} from './fixtures';

describe('partial and unknown clinical dates', () => {
    it('treats a month-precision date as the complete calendar interval', () => {
        const observation = makeObservation({
            id: 'month-observation',
            effective: {
                value: '2026-07',
                precision: 'month',
            },
        });
        const bounds = getResourceDateBounds(observation);

        expect(new Date(bounds.start || 0).toISOString())
            .toBe('2026-07-01T00:00:00.000Z');
        expect(new Date(bounds.end || 0).toISOString())
            .toBe('2026-07-31T23:59:59.999Z');
        expect(matchesClinicalResourceQuery(observation, {
            date: { from: '2026-07-15', to: '2026-07-15' },
        })).toBe(true);
        expect(matchesClinicalResourceQuery(observation, {
            date: { from: '2026-08-01' },
        })).toBe(false);
    });

    it('treats a year-precision date as the complete year interval', () => {
        const observation = makeObservation({
            id: 'year-observation',
            effective: {
                value: '2026',
                precision: 'year',
            },
        });
        const bounds = getResourceDateBounds(observation);

        expect(new Date(bounds.start || 0).toISOString())
            .toBe('2026-01-01T00:00:00.000Z');
        expect(new Date(bounds.end || 0).toISOString())
            .toBe('2026-12-31T23:59:59.999Z');
    });

    it('never places an unknown clinical date into a range via recordedAt', () => {
        const observation = makeObservation({
            id: 'unknown-observation',
            effective: unknownClinicalDate('No date shown'),
        });
        const bounds = getResourceDateBounds(observation);

        expect(bounds.usesRecordedAtFallback).toBe(true);
        expect(matchesClinicalResourceQuery(observation, {
            date: {
                from: '2026-07-01',
                to: '2026-07-31',
            },
        })).toBe(false);
        expect(matchesClinicalResourceQuery(observation, {
            date: {
                from: '2026-07-01',
                to: '2026-07-31',
                includeUnknown: true,
            },
        })).toBe(true);
    });
});
