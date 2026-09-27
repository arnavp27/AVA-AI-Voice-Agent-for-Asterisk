"""Model-specific Gemini 3.8 Live protocol and lifecycle regressions."""

import asyncio

import pytest

from src.config import GoogleProviderConfig
from src.providers.google_live import GoogleLiveProvider
from src.tools.context import ToolExecutionContext


@pytest.mark.asyncio
@pytest.mark.parametrize("use_vertex", [False, True])
async def test_3_8_setup_is_audio_only_and_tools_are_blocking(monkeypatch, use_vertex):
    config = GoogleProviderConfig(
        llm_model="gemini-3.8-live", use_vertex_ai=use_vertex,
        vertex_project="test-project", response_modalities="audio_text",
    )
    provider = GoogleLiveProvider(config=config, on_event=lambda event: None)
    provider._call_id = "call-1"
    sent = []

    async def capture(payload):
        sent.append(payload)
        return True

    monkeypatch.setattr(provider, "_send_message", capture)
    monkeypatch.setattr(provider._tool_adapter, "format_tools", lambda names: [
        {"functionDeclarations": [{"name": "hangup_call"}, {"name": "check_extension_status"}]}
    ])
    await provider._send_setup({"tools": ["hangup_call", "check_extension_status"]})

    setup = sent[0]["setup"]
    prefix = "projects/test-project/locations/us-central1/publishers/google/models/" if use_vertex else "models/"
    assert setup["model"] == prefix + "gemini-3.8-live"
    assert setup["generationConfig"]["responseModalities"] == ["AUDIO"]
    assert setup["tools"][0]["functionDeclarations"][0]["behavior"] == "BLOCKING"
    assert setup["tools"][0]["functionDeclarations"][1]["behavior"] == "NON_BLOCKING"


@pytest.mark.asyncio
@pytest.mark.parametrize("model,use_vertex,expects_id", [
    ("gemini-3.8-live", False, True),
    ("gemini-3.8-live", True, True),
    ("gemini-live-2.5-flash-native-audio", True, False),
])
async def test_tool_response_id_matches_model_protocol(monkeypatch, model, use_vertex, expects_id):
    provider = GoogleLiveProvider(
        config=GoogleProviderConfig(llm_model=model, use_vertex_ai=use_vertex),
        on_event=lambda event: None,
    )
    provider._call_id = "call-1"
    sent = []

    async def capture(payload):
        sent.append(payload)
        return True

    async def blocked(self, tool_name):
        return {"status": "error", "message": "Not allowed in this test"}

    monkeypatch.setattr(provider, "_send_message", capture)
    monkeypatch.setattr(ToolExecutionContext, "get_tool_block_response", blocked)
    await provider._handle_tool_call({"toolCall": {"functionCalls": [
        {"id": "fc-1", "name": "check_extension_status", "args": {"extension": "100"}}
    ]}})

    response = sent[0]["toolResponse"]["functionResponses"][0]
    assert response.get("id") == ("fc-1" if expects_id else None)
    assert response["name"] == "check_extension_status"
    if model == "gemini-3.8-live":
        assert response["response"]["scheduling"] == "WHEN_IDLE"
        assert response["response"]["retryable"] is False
    else:
        assert "scheduling" not in response["response"]


@pytest.mark.asyncio
async def test_3_8_cancellation_reaches_in_flight_tool_without_blocking_receive(monkeypatch):
    provider = GoogleLiveProvider(
        config=GoogleProviderConfig(llm_model="gemini-3.8-live"),
        on_event=lambda event: None,
    )
    provider._call_id = "call-1"
    started = asyncio.Event()
    cancelled = asyncio.Event()

    async def running_tool(data):
        started.set()
        try:
            await asyncio.Future()
        except asyncio.CancelledError:
            cancelled.set()
            raise

    monkeypatch.setattr(provider, "_handle_tool_call", running_tool)
    await provider._handle_server_message({"toolCall": {"functionCalls": [
        {"id": "fc-1", "name": "check_extension_status", "args": {}}
    ]}})
    await asyncio.wait_for(started.wait(), 1)
    await provider._handle_server_message({"toolCallCancellation": {"ids": ["fc-1"]}})
    await asyncio.wait_for(cancelled.wait(), 1)
    await asyncio.sleep(0)
    assert provider._tool_call_tasks == {}


@pytest.mark.asyncio
async def test_3_8_does_not_cancel_active_call_state_tool_mid_action(monkeypatch):
    provider = GoogleLiveProvider(
        config=GoogleProviderConfig(llm_model="gemini-3.8-live"),
        on_event=lambda event: None,
    )
    provider._call_id = "call-1"
    started = asyncio.Event()
    release = asyncio.Event()
    completed = asyncio.Event()

    async def running_tool(data):
        started.set()
        await release.wait()
        completed.set()

    monkeypatch.setattr(provider, "_handle_tool_call", running_tool)
    await provider._handle_server_message({"toolCall": {"functionCalls": [
        {"id": "fc-1", "name": "attended_transfer", "args": {}}
    ]}})
    await asyncio.wait_for(started.wait(), 1)
    await provider._handle_server_message({"toolCallCancellation": {"ids": ["fc-1"]}})
    assert not completed.is_set()
    assert not provider._tool_call_tasks["fc-1"].cancelled()
    release.set()
    await asyncio.wait_for(completed.wait(), 1)
    await asyncio.sleep(0)
    assert provider._tool_call_tasks == {}
