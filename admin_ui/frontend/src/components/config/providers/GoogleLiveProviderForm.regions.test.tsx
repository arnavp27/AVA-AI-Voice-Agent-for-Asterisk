// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GoogleLiveProviderForm from './GoogleLiveProviderForm';

vi.mock('axios');
vi.mock('../../../hooks/useConfirmDialog', () => ({
    useConfirmDialog: () => ({ confirm: vi.fn().mockResolvedValue(false) }),
}));

describe('GoogleLiveProviderForm Gemini 3.8 Live region guidance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(axios.get).mockImplementation(async url => {
            if (url === '/api/config/vertex-ai/regions') {
                return {
                    data: {
                        regions: [
                            { value: 'us-central1', label: 'US Central (Iowa)' },
                            { value: 'us-east1', label: 'US East (South Carolina)' },
                        ],
                    },
                };
            }
            return { data: { credentials: { 'vertex-json': { uploaded: false } } } };
        });
    });

    it('flags an unsupported selected Vertex region and updates after model change', async () => {
        const { rerender } = render(
            <GoogleLiveProviderForm
                providerKey="google_live"
                config={{ use_vertex_ai: true, llm_model: 'gemini-3.8-live', vertex_location: 'us-east1' }}
                onChange={vi.fn()}
            />
        );

        expect(screen.getByRole('alert')).toHaveTextContent('Google does not list Gemini 3.8 Live in this region');
        expect(screen.getByRole('alert')).toHaveTextContent('Choose US Central (Iowa)');
        expect(screen.getByRole('alert').querySelector('a')).toHaveAttribute(
            'href',
            'https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-8-live',
        );
        await waitFor(() => {
            expect(screen.getByRole('option', { name: /US East.*unavailable for Gemini 3.8 Live/ })).toBeInTheDocument();
        });

        rerender(
            <GoogleLiveProviderForm
                providerKey="google_live"
                config={{ use_vertex_ai: true, llm_model: 'gemini-3.8-live', vertex_location: 'us-central1' }}
                onChange={vi.fn()}
            />
        );
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Gemini 3.8 Live is listed in this region');
    });

    it('leaves existing Google Live models without a 3.8-specific region claim', async () => {
        render(
            <GoogleLiveProviderForm
                providerKey="google_live"
                config={{ use_vertex_ai: true, llm_model: 'gemini-live-2.5-flash-native-audio', vertex_location: 'us-east1' }}
                onChange={vi.fn()}
            />
        );
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        expect(screen.getByText('Region for Vertex AI endpoint')).toBeInTheDocument();
        await screen.findByRole('option', { name: 'US East (South Carolina)' });
    });

    it('does not claim the app supports Google multi-region endpoints', () => {
        render(
            <GoogleLiveProviderForm
                providerKey="google_live"
                config={{ use_vertex_ai: true, llm_model: 'gemini-3.8-live', vertex_location: 'us' }}
                onChange={vi.fn()}
            />
        );
        expect(screen.getByRole('alert')).toHaveTextContent('does not yet use its required multi-region WebSocket endpoint');
    });
});
