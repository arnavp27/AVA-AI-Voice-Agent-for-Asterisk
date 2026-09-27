import { describe, expect, it } from 'vitest';

import {
    GOOGLE_LIVE_MODEL_GROUPS,
    isGoogleLiveModelCompatible,
} from './googleLiveModels';

describe('Google Live model API compatibility', () => {
    it('offers Gemini 3.8 Live on both Developer API and Vertex AI', () => {
        expect(GOOGLE_LIVE_MODEL_GROUPS.find(group => group.label === 'Both Google APIs')?.options)
            .toContainEqual({ value: 'gemini-3.8-live', label: 'Gemini 3.8 Live (GA)' });
        expect(isGoogleLiveModelCompatible('gemini-3.8-live', false)).toBe(true);
        expect(isGoogleLiveModelCompatible('models/gemini-3.8-live', true)).toBe(true);
    });

    it('keeps existing surface-specific models restricted', () => {
        expect(isGoogleLiveModelCompatible('gemini-live-2.5-flash-native-audio', true)).toBe(true);
        expect(isGoogleLiveModelCompatible('gemini-live-2.5-flash-native-audio', false)).toBe(false);
        expect(isGoogleLiveModelCompatible('gemini-3.1-flash-live-preview', false)).toBe(true);
        expect(isGoogleLiveModelCompatible('gemini-3.1-flash-live-preview', true)).toBe(false);
    });
});
