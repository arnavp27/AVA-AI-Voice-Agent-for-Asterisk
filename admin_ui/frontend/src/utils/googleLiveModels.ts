export const GOOGLE_LIVE_DEFAULT_MODEL = 'gemini-2.5-flash-native-audio-latest';

type GoogleLiveModelGroup = 'Gemini Developer API' | 'Vertex AI Live API' | 'Both Google APIs';

type GoogleLiveModelOption = {
    value: string;
    label: string;
};

type GoogleLiveModelSection = {
    label: GoogleLiveModelGroup;
    options: GoogleLiveModelOption[];
};

export const GOOGLE_LIVE_MODEL_GROUPS: GoogleLiveModelSection[] = [
    {
        label: 'Both Google APIs',
        options: [
            { value: 'gemini-3.8-live', label: 'Gemini 3.8 Live (GA)' },
        ],
    },
    {
        label: 'Gemini Developer API',
        options: [
            { value: 'gemini-2.5-flash-native-audio-latest', label: 'Gemini 2.5 Flash Native Audio (Latest)' },
            { value: 'gemini-2.5-flash-native-audio-preview-12-2025', label: 'Gemini 2.5 Flash Native Audio (Dec 2025)' },
            { value: 'gemini-2.5-flash-native-audio-preview-09-2025', label: 'Gemini 2.5 Flash Native Audio (Sep 2025)' },
            {
                value: 'gemini-3.1-flash-live-preview',
                label: 'Gemini 3.1 Flash Live Preview',
            },
        ],
    },
    {
        label: 'Vertex AI Live API',
        options: [
            { value: 'gemini-live-2.5-flash-native-audio', label: 'Gemini Live 2.5 Flash Native Audio (GA)' },
            { value: 'gemini-live-2.5-flash-preview-native-audio-09-2025', label: 'Gemini Live 2.5 Flash Native Audio (Preview 09-2025)' },
        ],
    },
];

export const GOOGLE_LIVE_MODEL_OPTIONS = GOOGLE_LIVE_MODEL_GROUPS.flatMap((group) => group.options);
export const GOOGLE_LIVE_SUPPORTED_MODELS = GOOGLE_LIVE_MODEL_OPTIONS.map((model) => model.value);

// https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-8-live
// Model availability is distinct from the generic Vertex endpoint region list.
export const GEMINI_3_8_LIVE_VERTEX_REGIONS = ['us-central1', 'us', 'eu'] as const;

export function getGemini38LiveVertexRegionSupport(
    model: unknown,
    useVertex: boolean,
    region: unknown,
): 'supported' | 'unsupported' | 'unsupported-endpoint' | null {
    if (!useVertex || normalizeGoogleLiveModelForUi(model) !== 'gemini-3.8-live') return null;
    const selectedRegion = typeof region === 'string' && region.trim() ? region.trim() : 'us-central1';
    if (selectedRegion === 'us-central1') return 'supported';
    // The app currently constructs a regional `${location}-aiplatform.googleapis.com`
    // WebSocket host. Google's us/eu multi-regions use different endpoint hosts.
    if (GEMINI_3_8_LIVE_VERTEX_REGIONS.some(supported => supported === selectedRegion)) {
        return 'unsupported-endpoint';
    }
    return 'unsupported';
}

export function isGoogleLiveModelCompatible(model: string, useVertex: boolean): boolean {
    const normalized = normalizeGoogleLiveModelForUi(model);
    const group = GOOGLE_LIVE_MODEL_GROUPS.find(section =>
        section.options.some(option => option.value === normalized)
    );
    if (group?.label === 'Both Google APIs') return true;
    if (group) return useVertex ? group.label === 'Vertex AI Live API' : group.label === 'Gemini Developer API';
    // Retain the prior behavior for custom model names.
    return useVertex ? normalized.startsWith('gemini-live-') : !normalized.startsWith('gemini-live-');
}

export const GOOGLE_LIVE_LEGACY_MODEL_MAP: Record<string, string> = {
    'gemini-live-2.5-flash-preview': GOOGLE_LIVE_DEFAULT_MODEL,
};

export function normalizeGoogleLiveModelForUi(model: unknown): string {
    let raw = typeof model === 'string' ? model.trim() : '';
    if (raw.startsWith('models/')) {
        raw = raw.slice(7);
    }

    if (!raw) {
        return GOOGLE_LIVE_DEFAULT_MODEL;
    }

    if (raw in GOOGLE_LIVE_LEGACY_MODEL_MAP) {
        return GOOGLE_LIVE_LEGACY_MODEL_MAP[raw];
    }

    // Always preserve the operator-configured model name.
    // Unknown models render in the "Custom" optgroup so the user
    // can see exactly what is configured and change it if needed.
    return raw;
}
