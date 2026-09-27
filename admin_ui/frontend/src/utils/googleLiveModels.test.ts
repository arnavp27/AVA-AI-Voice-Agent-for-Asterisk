import { describe, expect, it } from 'vitest';

import {
    GEMINI_3_8_LIVE_VERTEX_REGIONS,
    GOOGLE_LIVE_MODEL_GROUPS,
    getGemini38LiveVertexRegionSupport,
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

describe('Gemini 3.8 Live Vertex region guidance', () => {
    it('recognizes only the regions listed by the model reference', () => {
        expect(GEMINI_3_8_LIVE_VERTEX_REGIONS).toEqual(['us-central1', 'us', 'eu']);
        expect(getGemini38LiveVertexRegionSupport('models/gemini-3.8-live', true, 'us-central1')).toBe('supported');
        expect(getGemini38LiveVertexRegionSupport('gemini-3.8-live', true, 'us')).toBe('unsupported-endpoint');
        expect(getGemini38LiveVertexRegionSupport('gemini-3.8-live', true, 'eu')).toBe('unsupported-endpoint');
        expect(getGemini38LiveVertexRegionSupport('gemini-3.8-live', true, 'us-east1')).toBe('unsupported');
        expect(getGemini38LiveVertexRegionSupport('gemini-3.8-live', true, 'us-west1')).toBe('unsupported');
        expect(getGemini38LiveVertexRegionSupport('gemini-3.8-live', true, '')).toBe('supported');
    });

    it('does not infer regional availability for the Developer API or other Live models', () => {
        expect(getGemini38LiveVertexRegionSupport('gemini-3.8-live', false, 'us-east1')).toBeNull();
        expect(getGemini38LiveVertexRegionSupport('gemini-live-2.5-flash-native-audio', true, 'us-east1')).toBeNull();
    });
});
