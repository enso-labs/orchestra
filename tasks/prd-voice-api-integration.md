# PRD: Core Voice API Integration (NVIDIA PersonaPlex)

## Introduction

Integrate NVIDIA PersonaPlex (7B parameter full-duplex speech-to-speech model) as a voice interaction layer for Orchestra. This PRD focuses on the **backend implementation** that enables real-time voice conversations with AI agents. PersonaPlex provides simultaneous bidirectional conversation (listens AND speaks at the same time), 170ms latency, and voice conditioning via audio prompts.

The voice system will run as a separate microservice alongside the FastAPI backend, with WebSocket connections bridging the browser to PersonaPlex, and a coordination layer routing voice interactions to existing LangChain agent workflows.

**Mission Alignment**: Voice mode helps users "regain ownership of their time" by enabling hands-free, natural language interaction with AI agents while multitasking.

## Goals

- Deploy PersonaPlex as a containerized microservice alongside the Orchestra backend
- Establish WebSocket streaming architecture for real-time bidirectional audio
- Create voice session management with state persistence
- Bridge voice transcriptions to existing LangChain/deepagent workflows
- Enable voice selection (16 built-in voices) and persona configuration
- Provide API endpoints for voice mode initiation, configuration, and control
- Support both cloud deployment and self-hosted/on-premise installations
- Maintain compatibility with existing thread and checkpoint systems

## User Stories

### US-001: Create Voice Service Microservice Configuration
**Description:** As a DevOps engineer, I need PersonaPlex to run as a containerized microservice so that it can be deployed alongside the main Orchestra backend with proper isolation and scaling.

**Acceptance Criteria:**
- [ ] Docker Compose service definition for PersonaPlex server
- [ ] Environment variables for GPU configuration, model path, SSL certificates
- [ ] Health check endpoint for PersonaPlex service (`/health`)
- [ ] Network configuration allowing communication between FastAPI and PersonaPlex
- [ ] CPU offloading configuration option for limited GPU memory environments
- [ ] Service starts with `python -m moshi.server --ssl "$SSL_DIR"` command
- [ ] Dependencies: PyTorch, Opus codec (libopus-dev), GPU runtime
- [ ] Documentation for required NVIDIA driver and CUDA versions

### US-002: Implement Voice Session Pydantic Schemas
**Description:** As a developer, I need well-defined schemas for voice session data structures so the API has type-safe request/response handling.

**Acceptance Criteria:**
- [ ] `VoiceSessionState` enum: IDLE, CONNECTING, ACTIVE, PAUSED, ENDED, ERROR
- [ ] `VoiceConfig` model with fields: voice_id, persona_prompt, language, sample_rate
- [ ] `VoiceSession` model with fields: session_id, thread_id, user_id, state, voice_config, created_at, updated_at
- [ ] `VoiceSessionCreateRequest` model: thread_id (optional), assistant_id (optional), voice_config
- [ ] `VoiceSessionResponse` model: session_id, websocket_url, state, voice_config
- [ ] `VoiceMessage` model: session_id, content, role (user/assistant), timestamp, confidence
- [ ] `AvailableVoice` model: voice_id, name, gender, description, sample_url
- [ ] All schemas exported from `backend/src/schemas/entities/voice.py`
- [ ] Schemas exported in `backend/src/schemas/entities/__init__.py`
- [ ] Typecheck passes

### US-003: Implement Voice Session Service
**Description:** As a developer, I need a service layer that manages voice session lifecycle, state transitions, and persistence.

**Acceptance Criteria:**
- [ ] `VoiceSessionService` class in `backend/src/services/voice_session.py`
- [ ] `create_session(user_id, voice_config, thread_id?, assistant_id?)` method
- [ ] `get_session(session_id)` method returns session or None
- [ ] `update_session_state(session_id, new_state)` method with state transition validation
- [ ] `end_session(session_id)` method gracefully terminates session
- [ ] `list_user_sessions(user_id, active_only=True)` method
- [ ] Session storage using existing LangGraph store patterns (user namespace)
- [ ] Session timeout handling (configurable, default 30 minutes of inactivity)
- [ ] Concurrent session limit per user (configurable, default 1)
- [ ] Typecheck passes

### US-004: Implement PersonaPlex Client Service
**Description:** As a developer, I need a client service that communicates with the PersonaPlex microservice for voice processing.

**Acceptance Criteria:**
- [ ] `PersonaPlexClient` class in `backend/src/services/personaplex.py`
- [ ] Configuration via environment variables: `PERSONAPLEX_URL`, `PERSONAPLEX_SSL_VERIFY`
- [ ] `get_available_voices()` method returns list of 16 built-in voices (NATF0-3, NATM0-3, VARF0-4, VARM0-4)
- [ ] `create_stream(session_id, voice_config)` method establishes WebSocket to PersonaPlex
- [ ] `send_audio(stream, audio_chunk)` method for streaming audio input
- [ ] `set_persona(stream, persona_prompt)` method for text-based persona control
- [ ] `set_voice(stream, voice_id)` method for voice conditioning
- [ ] Connection pooling and reconnection logic
- [ ] Error handling for PersonaPlex service unavailability
- [ ] Health check method `is_healthy()` for service status
- [ ] Typecheck passes

### US-005: Create WebSocket Voice Gateway Route
**Description:** As a frontend developer, I need a WebSocket endpoint that handles bidirectional audio streaming between the browser and the voice system.

**Acceptance Criteria:**
- [ ] `WebSocket /api/voice/stream/{session_id}` endpoint in `backend/src/routes/v0/voice.py`
- [ ] Authentication via token query parameter or upgrade headers
- [ ] Validates session_id belongs to authenticated user
- [ ] Bidirectional audio streaming (Opus codec format)
- [ ] Forwards audio from client to PersonaPlex
- [ ] Forwards PersonaPlex responses to client
- [ ] Handles connection lifecycle (open, message, close, error)
- [ ] Implements heartbeat/ping-pong for connection health
- [ ] Sends structured events: `transcript`, `response`, `state_change`, `error`
- [ ] Graceful handling of PersonaPlex disconnection
- [ ] Tagged with "Voice" in OpenAPI docs
- [ ] Typecheck passes

### US-006: Create REST API Voice Endpoints
**Description:** As an API consumer, I need REST endpoints to manage voice sessions and configuration.

**Acceptance Criteria:**
- [ ] `POST /api/voice/sessions` - Create new voice session, returns session_id and websocket_url
- [ ] `GET /api/voice/sessions/{session_id}` - Get session details and state
- [ ] `PATCH /api/voice/sessions/{session_id}` - Update voice config (voice_id, persona)
- [ ] `DELETE /api/voice/sessions/{session_id}` - End voice session
- [ ] `GET /api/voice/voices` - List available voices with metadata
- [ ] `POST /api/voice/sessions/{session_id}/pause` - Pause active session
- [ ] `POST /api/voice/sessions/{session_id}/resume` - Resume paused session
- [ ] All endpoints require authentication via `verify_credentials`
- [ ] All endpoints tagged with "Voice" in OpenAPI docs
- [ ] Rate limiting applied to session creation
- [ ] Typecheck passes

### US-007: Integrate Voice with Agent Workflow
**Description:** As a developer, I need voice transcriptions to route through the existing LangChain agent pipeline so that voice users get the same AI capabilities as text users.

**Acceptance Criteria:**
- [ ] `VoiceAgentBridge` class in `backend/src/services/voice_agent_bridge.py`
- [ ] Receives transcriptions from PersonaPlex with confidence scores
- [ ] Creates `HumanMessage` from transcription and routes to agent graph
- [ ] Streams agent `AIMessage` responses back for text-to-speech
- [ ] Maintains conversation context within the thread (uses existing checkpoint system)
- [ ] Handles tool calls and responses (audio notification for tool execution)
- [ ] Supports interrupt handling for HITL workflows (pause voice, await decision)
- [ ] Configurable transcription confidence threshold (reject low-confidence input)
- [ ] Typecheck passes

### US-008: Implement Voice Thread Association
**Description:** As a developer, I need voice sessions to associate with threads so conversation history persists across voice and text interactions.

**Acceptance Criteria:**
- [ ] Voice session can be created with existing `thread_id` (continue conversation)
- [ ] Voice session can create new thread if `thread_id` not provided
- [ ] Thread metadata includes `voice_session_id` when active
- [ ] Thread history shows voice messages with `channel: "voice"` metadata
- [ ] Seamless switching between voice and text within same thread
- [ ] Voice session shares assistant configuration from associated thread
- [ ] Typecheck passes

### US-009: Implement Voice Configuration Storage
**Description:** As a developer, I need voice preferences to persist at the user and assistant level so users don't have to reconfigure each session.

**Acceptance Criteria:**
- [ ] `VoicePreferences` model: default_voice_id, default_persona, auto_detect_language
- [ ] User-level voice preferences stored in user namespace
- [ ] Assistant-level voice configuration in assistant schema (optional `voice_config` field)
- [ ] Priority: Session config > Assistant config > User preferences > System defaults
- [ ] API endpoint to update user voice preferences: `PATCH /api/voice/preferences`
- [ ] API endpoint to get user voice preferences: `GET /api/voice/preferences`
- [ ] Typecheck passes

### US-010: Unit Tests for Voice Schemas
**Description:** As a developer, I need comprehensive schema tests to ensure validation logic works correctly.

**Acceptance Criteria:**
- [ ] Test file: `backend/tests/unit/schemas/test_voice_schemas.py`
- [ ] Tests all VoiceSessionState enum values and transitions
- [ ] Tests VoiceConfig validation (valid voice_ids, sample rates)
- [ ] Tests VoiceSession serialization and deserialization
- [ ] Tests VoiceMessage with different roles and confidence values
- [ ] All tests pass with `make test`

### US-011: Unit Tests for Voice Session Service
**Description:** As a developer, I need service tests to verify session lifecycle management.

**Acceptance Criteria:**
- [ ] Test file: `backend/tests/unit/services/test_voice_session.py`
- [ ] Test create_session with valid and invalid inputs
- [ ] Test state transitions (IDLE -> CONNECTING -> ACTIVE -> ENDED)
- [ ] Test invalid state transitions are rejected
- [ ] Test concurrent session limit enforcement
- [ ] Test session timeout behavior
- [ ] Mock store interactions
- [ ] All tests pass with `make test`

### US-012: Unit Tests for Voice Route Endpoints
**Description:** As a developer, I need route tests to verify HTTP status codes and response formats.

**Acceptance Criteria:**
- [ ] Test file: `backend/tests/unit/routes/test_voice.py`
- [ ] Test POST /sessions returns 201 with session details
- [ ] Test GET /sessions/{id} returns 200 or 404
- [ ] Test DELETE /sessions/{id} returns 204
- [ ] Test all endpoints return 401 without auth
- [ ] Test rate limiting on session creation
- [ ] Test WebSocket upgrade and authentication
- [ ] All tests pass with `make test`

### US-013: Integration Tests for Voice Pipeline
**Description:** As a QA engineer, I need integration tests to verify the full voice-to-agent pipeline works end-to-end.

**Acceptance Criteria:**
- [ ] Test file: `backend/tests/integration/test_voice_pipeline.py`
- [ ] Test voice session creation and WebSocket connection
- [ ] Test audio streaming through PersonaPlex (mocked)
- [ ] Test transcription routing to agent graph
- [ ] Test agent response streaming back through voice
- [ ] Test thread history includes voice messages
- [ ] All tests pass with `make test`

## Functional Requirements

- **FR-1:** System must deploy PersonaPlex as a separate Docker service with GPU support
- **FR-2:** Voice sessions must be uniquely identified and associated with a user
- **FR-3:** WebSocket endpoint must authenticate users before establishing audio stream
- **FR-4:** Audio format must use Opus codec for bandwidth efficiency
- **FR-5:** Voice transcriptions must route through existing agent pipeline with full tool access
- **FR-6:** Voice responses must maintain conversation context via thread checkpoints
- **FR-7:** Users must be able to select from 16 built-in PersonaPlex voices
- **FR-8:** Persona prompts must be configurable per session for role/background control
- **FR-9:** Voice sessions must support pause/resume without losing context
- **FR-10:** System must gracefully handle PersonaPlex service unavailability
- **FR-11:** Voice messages must be persisted in thread history with voice metadata
- **FR-12:** Concurrent voice session limit must be enforced per user
- **FR-13:** Session timeout must automatically end inactive sessions
- **FR-14:** System must support CPU offloading for environments with limited GPU memory

## Non-Goals

- Frontend UI implementation (separate PRD)
- Mobile app voice integration
- Voice wake word detection ("Hey Orchestra")
- Multi-language real-time translation
- Voice biometric authentication
- Custom voice training/cloning (uses only built-in voices)
- Offline/edge deployment (requires server with GPU)
- Voice recording/playback storage (ephemeral streaming only)
- PSTN/phone call integration
- Voice analytics or quality metrics dashboards

## Technical Considerations

### Architecture Overview

```
[Browser] <--WebSocket/Opus--> [FastAPI Voice Gateway] <--WebSocket--> [PersonaPlex Server]
                                        |
                                        v
                              [VoiceAgentBridge]
                                        |
                                        v
                              [LangGraph Agent Pipeline]
                                        |
                                        v
                              [Checkpoint/Thread Store]
```

### PersonaPlex Deployment

- Docker image with NVIDIA runtime
- GPU requirements: NVIDIA GPU with sufficient VRAM (16GB+ recommended)
- CPU offloading available for memory-constrained environments
- SSL required for secure WebSocket connections
- Model weights loaded at container startup (several GB)
- License: MIT (code), NVIDIA Open Model License (weights) - commercial use OK

### WebSocket Protocol

```json
// Client -> Server (audio chunk)
{
  "type": "audio",
  "data": "<base64 encoded Opus audio>",
  "sequence": 123
}

// Server -> Client (transcription)
{
  "type": "transcript",
  "content": "Hello, can you help me with...",
  "confidence": 0.95,
  "is_final": true
}

// Server -> Client (voice response)
{
  "type": "audio_response",
  "data": "<base64 encoded Opus audio>",
  "text": "Of course! I'd be happy to help...",
  "sequence": 456
}

// Server -> Client (state change)
{
  "type": "state",
  "state": "ACTIVE",
  "reason": "voice_detected"
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PERSONAPLEX_URL` | `wss://localhost:8998` | PersonaPlex server WebSocket URL |
| `PERSONAPLEX_SSL_VERIFY` | `true` | Verify SSL certificates |
| `VOICE_SESSION_TIMEOUT_MINUTES` | `30` | Inactivity timeout |
| `VOICE_MAX_CONCURRENT_SESSIONS` | `1` | Max sessions per user |
| `VOICE_DEFAULT_VOICE_ID` | `NATF0` | Default voice selection |
| `VOICE_TRANSCRIPTION_CONFIDENCE_THRESHOLD` | `0.7` | Minimum confidence |

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `backend/src/schemas/entities/voice.py` | CREATE | Voice Pydantic schemas |
| `backend/src/schemas/entities/__init__.py` | MODIFY | Export voice schemas |
| `backend/src/services/voice_session.py` | CREATE | Voice session management |
| `backend/src/services/personaplex.py` | CREATE | PersonaPlex client |
| `backend/src/services/voice_agent_bridge.py` | CREATE | Agent integration |
| `backend/src/routes/v0/voice.py` | CREATE | Voice REST and WebSocket routes |
| `backend/src/routes/v0/__init__.py` | MODIFY | Register voice router |
| `docker/docker-compose.voice.yml` | CREATE | PersonaPlex service definition |
| `backend/tests/unit/schemas/test_voice_schemas.py` | CREATE | Schema tests |
| `backend/tests/unit/services/test_voice_session.py` | CREATE | Service tests |
| `backend/tests/unit/routes/test_voice.py` | CREATE | Route tests |
| `backend/tests/integration/test_voice_pipeline.py` | CREATE | Integration tests |
| `.example.env` | MODIFY | Add voice environment variables |

### ICP Value Alignment

| ICP | Value Delivered |
|-----|-----------------|
| **Developers & Individual Engineers** | Full control via self-hosting, MIT license, WebSocket API for custom integrations |
| **Development Teams** | Scalable microservice architecture, easy horizontal scaling of voice workers |
| **Enterprises** | On-premise deployment option, no data leaving infrastructure, configurable security |
| **Business Process Automation Teams** | Hands-free agent interaction, voice-driven workflows without coding |

### Performance Considerations

- PersonaPlex: 170ms latency for voice-to-voice
- WebSocket overhead: ~5-10ms additional latency
- Audio buffering: Configurable buffer size (default 100ms chunks)
- Agent response: Variable depending on LLM and tool calls
- Target end-to-end latency: <500ms for simple responses

### Security Considerations

- WebSocket authentication required (JWT token validation)
- Audio data encrypted in transit (WSS)
- Session tokens scoped to user
- Rate limiting on session creation
- No audio storage (ephemeral streaming)
- PersonaPlex runs in isolated container

## Success Metrics

- All 13 user stories completed with passing acceptance criteria
- `make test` passes with all new unit and integration tests
- `make format` shows no style violations
- Voice endpoints visible in OpenAPI docs at `/api` under Voice tag
- PersonaPlex microservice starts successfully and passes health checks
- WebSocket connections establish and maintain stable audio streaming
- Voice transcriptions successfully route through agent pipeline
- Thread history correctly shows voice message interleaving with text

## Open Questions

1. **GPU Sharing**: Should PersonaPlex share GPU with other services or have dedicated GPU allocation?
2. **Session Recovery**: How should the system handle voice sessions when PersonaPlex restarts?
3. **Transcript Storage**: Should raw transcripts be stored separately for analytics/debugging?
4. **Rate Limiting**: What are appropriate rate limits for voice API (sessions/minute, audio data/second)?
5. **Voice Feedback**: Should there be audio confirmation when agent starts/stops tool execution?
6. **Latency SLA**: What is the acceptable maximum latency for voice responses?
7. **Fallback Mode**: Should the system fall back to text-to-speech when PersonaPlex is unavailable?
8. **Multi-turn Interruption**: How should the system handle user interrupting the agent mid-response (full-duplex)?
