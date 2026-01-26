# PRD: Enterprise Voice Mode Deployment

## Introduction

Enable enterprise customers to deploy NVIDIA PersonaPlex voice mode within their own infrastructure, ensuring complete data sovereignty, compliance readiness, and security guarantees. PersonaPlex is a 7B parameter voice model that can be self-hosted, allowing all voice data processing to occur on-premises without external API calls. This feature directly addresses the needs of enterprise customers (ICP 3) who require "Your data, your control" - making Orchestra the premier choice for organizations with strict data governance requirements.

Voice mode transforms how enterprise users interact with AI agents, enabling hands-free workflows, accessibility improvements, and more natural human-AI collaboration. By offering self-hosted deployment options, enterprises can leverage these benefits while maintaining full compliance with data residency regulations, air-gapped network requirements, and internal security policies.

## Goals

- Enable complete on-premises voice processing with zero voice data leaving customer infrastructure
- Provide flexible deployment options supporting Docker, Kubernetes, and air-gapped environments
- Deliver enterprise-grade audit logging for all voice sessions and interactions
- Support GPU resource management with intelligent scaling and CPU offloading fallback
- Implement role-based access controls for voice features and model selection
- Provide clear hardware requirements and cost estimation guidance for deployment planning
- Maintain compatibility with NVIDIA Blackwell GPUs and CUDA 13.0
- Establish foundation for future custom voice training capabilities

## User Stories

### US-001: Docker-based PersonaPlex Deployment
**Description:** As a DevOps engineer, I want to deploy PersonaPlex as a Docker container so that I can quickly set up voice capabilities in our existing containerized infrastructure.

**Acceptance Criteria:**
- [ ] `docker-compose.voice.yml` file created with PersonaPlex service configuration
- [ ] Environment variables documented for GPU device selection (NVIDIA_VISIBLE_DEVICES)
- [ ] Health check endpoint configured for container orchestration
- [ ] Volume mounts configured for model weights persistence (avoid re-downloading)
- [ ] Container starts successfully with `docker compose -f docker-compose.voice.yml up`
- [ ] Voice service responds to health check within 60 seconds of startup
- [ ] Documentation includes minimum Docker version requirements (with GPU support)
- [ ] Typecheck/lint passes

### US-002: Kubernetes Helm Chart for PersonaPlex
**Description:** As a platform engineer, I want to deploy PersonaPlex via Helm chart so that I can manage voice services at scale with our existing Kubernetes infrastructure.

**Acceptance Criteria:**
- [ ] Helm chart created in `deployment/helm/personaplex/` directory
- [ ] Values file includes configurable GPU resource limits and requests
- [ ] Support for node selectors to target GPU-enabled nodes
- [ ] ConfigMap for PersonaPlex server configuration options
- [ ] Secret management for any required credentials
- [ ] Horizontal Pod Autoscaler (HPA) template based on GPU utilization metrics
- [ ] PersistentVolumeClaim for model weights storage
- [ ] Service and Ingress templates for internal access
- [ ] `helm install` successfully deploys PersonaPlex to a GPU-enabled cluster
- [ ] Typecheck/lint passes

### US-003: CPU Offloading Configuration
**Description:** As an infrastructure administrator, I want to configure CPU offloading for PersonaPlex so that I can run voice mode on machines with limited GPU memory.

**Acceptance Criteria:**
- [ ] Environment variable `PERSONAPLEX_CPU_OFFLOAD=true` enables CPU offloading
- [ ] Configuration option for specifying which model layers to offload
- [ ] Documentation of memory trade-offs (GPU VRAM vs system RAM requirements)
- [ ] Performance benchmarks documented for various offload configurations
- [ ] Graceful degradation when GPU memory is insufficient
- [ ] Warning logged when CPU offloading activates due to memory pressure
- [ ] Typecheck/lint passes

### US-004: Voice Session Audit Logging
**Description:** As a compliance officer, I want all voice sessions to be logged with metadata so that I can maintain audit trails for regulatory compliance.

**Acceptance Criteria:**
- [ ] New `voice_audit_logs` database table created with migration
- [ ] Each voice session logs: session_id, user_id, org_id, start_time, end_time, duration_seconds
- [ ] Logs include: agent_id, thread_id (for correlation with chat history)
- [ ] Logs capture: voice_model_version, deployment_node_id
- [ ] Configurable retention period via `VOICE_AUDIT_RETENTION_DAYS` environment variable
- [ ] Audit logs queryable via Admin API endpoint `GET /api/admin/voice/audit`
- [ ] Support for filtering by user, date range, organization
- [ ] Audit log entries are immutable (append-only, no updates or deletes)
- [ ] Typecheck/lint passes

### US-005: Voice Transcript Audit Logging (Optional)
**Description:** As a compliance officer, I want the option to log voice transcripts so that I can meet industry-specific regulatory requirements.

**Acceptance Criteria:**
- [ ] Feature flag `VOICE_TRANSCRIPT_LOGGING=false` (disabled by default for privacy)
- [ ] When enabled, transcripts stored in separate `voice_transcripts` table
- [ ] Transcripts linked to audit log entries via session_id
- [ ] Encryption at rest for transcript storage (using existing encryption service)
- [ ] Clear documentation warning about privacy implications
- [ ] Data subject access request (DSAR) export includes voice transcripts when enabled
- [ ] Typecheck/lint passes

### US-006: Voice Feature Access Controls
**Description:** As an organization admin, I want to control which users can access voice features so that I can manage costs and enforce security policies.

**Acceptance Criteria:**
- [ ] New permission: `voice:use` added to permission system
- [ ] New permission: `voice:admin` for managing voice settings
- [ ] Role assignment UI updated to include voice permissions
- [ ] API endpoint rejects voice requests for users without `voice:use` permission
- [ ] Organization-level toggle to enable/disable voice features entirely
- [ ] Rate limiting configurable per organization: `VOICE_RATE_LIMIT_PER_USER_HOUR`
- [ ] Admin dashboard shows voice usage statistics per user
- [ ] Typecheck/lint passes

### US-007: Voice Model Selection Controls
**Description:** As an organization admin, I want to restrict which voice models users can access so that I can control resource usage and ensure appropriate model selection.

**Acceptance Criteria:**
- [ ] Model allowlist configurable per organization in admin settings
- [ ] Default model configurable at organization level
- [ ] API validates model selection against organization allowlist
- [ ] Clear error message when user requests disallowed model
- [ ] Audit log includes which model was used for each session
- [ ] Typecheck/lint passes

### US-008: Air-gapped Deployment Support
**Description:** As a security engineer at an air-gapped facility, I want to deploy PersonaPlex without internet access so that voice features work in our isolated network.

**Acceptance Criteria:**
- [ ] Documentation for downloading model weights on internet-connected machine
- [ ] Portable archive creation script: `scripts/package-voice-airgap.sh`
- [ ] Archive includes: Docker images, model weights, configuration templates
- [ ] Verification checksums (SHA256) for all packaged components
- [ ] Step-by-step air-gapped installation guide in `wiki/docs/deployment/airgapped-voice.md`
- [ ] No external network calls required after initial deployment
- [ ] License compliance documentation (NVIDIA Open Model License)
- [ ] Typecheck/lint passes

### US-009: Hardware Requirements Documentation
**Description:** As an IT procurement specialist, I want clear hardware requirements so that I can budget and procure appropriate infrastructure.

**Acceptance Criteria:**
- [ ] Documentation page: `wiki/docs/deployment/voice-hardware-requirements.md`
- [ ] Minimum requirements specified: GPU model, VRAM, CPU, RAM, storage
- [ ] Recommended requirements for production workloads
- [ ] Requirements matrix for different concurrent user counts (10, 50, 100, 500)
- [ ] NVIDIA GPU compatibility list (including Blackwell with CUDA 13.0)
- [ ] Network bandwidth requirements for real-time voice streaming
- [ ] Latency requirements and expectations documented
- [ ] Typecheck/lint passes

### US-010: Cost Estimation Calculator
**Description:** As a finance stakeholder, I want to estimate deployment costs so that I can budget appropriately for voice feature rollout.

**Acceptance Criteria:**
- [ ] Documentation section: Cost estimation guidelines
- [ ] Reference pricing for cloud GPU instances (AWS, GCP, Azure)
- [ ] On-premises hardware cost estimates for different tiers
- [ ] TCO model including: hardware, power, cooling, maintenance
- [ ] Cost-per-voice-minute estimates for different deployment sizes
- [ ] Scaling cost projections for user growth scenarios
- [ ] Typecheck/lint passes

### US-011: GPU Resource Monitoring Dashboard
**Description:** As a platform operator, I want to monitor GPU utilization for voice workloads so that I can optimize resource allocation and plan capacity.

**Acceptance Criteria:**
- [ ] Prometheus metrics endpoint for PersonaPlex: `/metrics`
- [ ] Metrics include: GPU utilization %, VRAM usage, active sessions, queue depth
- [ ] Metrics include: average latency, p95 latency, p99 latency
- [ ] Grafana dashboard template: `deployment/grafana/voice-dashboard.json`
- [ ] Alerting rules for: high GPU utilization, memory pressure, latency spikes
- [ ] Documentation for integrating with existing monitoring stack
- [ ] Typecheck/lint passes

### US-012: Voice Service Health API
**Description:** As a DevOps engineer, I want health check endpoints for the voice service so that I can integrate with load balancers and orchestration systems.

**Acceptance Criteria:**
- [ ] `GET /api/voice/health` returns service status
- [ ] Response includes: status, gpu_available, model_loaded, version
- [ ] Response includes: current_sessions, max_sessions, queue_length
- [ ] Liveness probe endpoint: `/api/voice/health/live`
- [ ] Readiness probe endpoint: `/api/voice/health/ready` (only ready when model loaded)
- [ ] Configurable health check timeouts
- [ ] Typecheck/lint passes

### US-013: Auto-scaling Voice Workers
**Description:** As a platform engineer, I want voice workers to scale automatically based on demand so that we can handle usage spikes without over-provisioning.

**Acceptance Criteria:**
- [ ] Kubernetes HPA configured with custom GPU utilization metric
- [ ] Scale-up threshold configurable (default: 70% GPU utilization)
- [ ] Scale-down threshold configurable (default: 30% GPU utilization)
- [ ] Minimum replicas configurable (default: 1)
- [ ] Maximum replicas configurable (default: 10)
- [ ] Cool-down period configurable to prevent thrashing
- [ ] Documentation for KEDA integration as alternative scaler
- [ ] Typecheck/lint passes

### US-014: Voice Session Timeout and Cleanup
**Description:** As a system administrator, I want voice sessions to timeout automatically so that resources are released from abandoned sessions.

**Acceptance Criteria:**
- [ ] Configurable session timeout: `VOICE_SESSION_TIMEOUT_SECONDS` (default: 300)
- [ ] Idle detection after no audio input for configurable period
- [ ] Warning sent to client 30 seconds before timeout
- [ ] Graceful session termination with proper cleanup
- [ ] Resources immediately released on session end
- [ ] Zombie session cleanup job runs every 60 seconds
- [ ] Typecheck/lint passes

### US-015: Multi-tenant Voice Isolation
**Description:** As a security engineer, I want voice sessions to be isolated between organizations so that there is no data leakage between tenants.

**Acceptance Criteria:**
- [ ] Voice sessions tagged with organization ID
- [ ] No cross-organization audio data sharing
- [ ] Session IDs are organization-scoped (cannot guess other org's sessions)
- [ ] GPU memory cleared between sessions from different organizations
- [ ] Audit logs partitioned by organization
- [ ] Security documentation covers isolation guarantees
- [ ] Typecheck/lint passes

### US-016: Frontend Voice Mode Integration
**Description:** As a user, I want to enable voice mode in the chat interface so that I can interact with agents using my voice.

**Acceptance Criteria:**
- [ ] Microphone button added to chat input area
- [ ] Permission prompt for microphone access on first use
- [ ] Visual indicator when voice mode is active (recording)
- [ ] Real-time audio level visualization during recording
- [ ] Push-to-talk and voice-activity-detection modes supported
- [ ] Voice mode toggle persists in user preferences
- [ ] Graceful fallback message when voice service unavailable
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-017: Voice Response Playback
**Description:** As a user, I want to hear agent responses spoken aloud so that I can have a natural conversational experience.

**Acceptance Criteria:**
- [ ] Audio playback button on agent response messages
- [ ] Auto-play option configurable in user settings
- [ ] Playback controls: play/pause, volume, speed adjustment
- [ ] Audio caching for recently played responses
- [ ] Streaming audio playback (starts before full response generated)
- [ ] Visual indicator during audio playback
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-018: Voice Backend API Endpoints
**Description:** As a frontend developer, I want API endpoints for voice interactions so that the frontend can send audio and receive voice responses.

**Acceptance Criteria:**
- [ ] `POST /api/voice/session/start` - Initialize voice session
- [ ] `POST /api/voice/audio` - Send audio chunk for processing
- [ ] `GET /api/voice/session/{id}/stream` - SSE stream for voice responses
- [ ] `DELETE /api/voice/session/{id}` - End voice session
- [ ] WebSocket endpoint option for lower latency: `WS /api/voice/ws`
- [ ] All endpoints require authentication and `voice:use` permission
- [ ] Rate limiting applied per user
- [ ] OpenAPI documentation for all endpoints
- [ ] Typecheck/lint passes

### US-019: Voice Quality Settings
**Description:** As a user, I want to adjust voice quality settings so that I can balance audio quality with bandwidth usage.

**Acceptance Criteria:**
- [ ] Quality presets: low (8kbps), medium (16kbps), high (32kbps)
- [ ] User preference stored and persisted
- [ ] Adaptive quality option that adjusts based on network conditions
- [ ] Admin can set organization-wide quality limits
- [ ] Quality setting affects both input and output audio
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-020: Future - Custom Voice Training Preparation
**Description:** As a product manager, I want the architecture to support future custom voice training so that enterprises can create branded voice personas.

**Acceptance Criteria:**
- [ ] Database schema includes `custom_voices` table (organization_id, voice_name, model_path, status)
- [ ] API placeholder: `POST /api/voice/custom` returns 501 Not Implemented
- [ ] Documentation outlines future custom voice training workflow
- [ ] Storage architecture supports per-organization voice model files
- [ ] Access controls framework supports custom voice permissions
- [ ] Typecheck/lint passes

## Functional Requirements

- **FR-1:** The system MUST process all voice data locally without transmitting audio to external services
- **FR-2:** PersonaPlex server MUST be deployable via Docker with NVIDIA GPU passthrough
- **FR-3:** PersonaPlex server MUST be deployable via Kubernetes Helm chart with GPU scheduling
- **FR-4:** The system MUST support CPU offloading when GPU VRAM is insufficient (with performance trade-off)
- **FR-5:** All voice sessions MUST generate audit log entries including user, timestamp, duration, and model version
- **FR-6:** Voice transcript logging MUST be opt-in and disabled by default
- **FR-7:** Voice feature access MUST be controlled via role-based permissions (`voice:use`, `voice:admin`)
- **FR-8:** Organizations MUST be able to enable/disable voice features globally
- **FR-9:** Organization admins MUST be able to restrict available voice models via allowlist
- **FR-10:** Air-gapped deployment MUST be possible with pre-packaged model weights and Docker images
- **FR-11:** Voice service MUST expose health check endpoints for liveness and readiness probes
- **FR-12:** GPU utilization metrics MUST be exposed via Prometheus-compatible endpoint
- **FR-13:** Voice sessions MUST timeout after configurable idle period (default 5 minutes)
- **FR-14:** Voice sessions MUST be isolated between organizations with no data leakage
- **FR-15:** Frontend MUST provide microphone access UI with clear recording indicators
- **FR-16:** Voice responses MUST support streaming audio playback
- **FR-17:** All voice API endpoints MUST require authentication
- **FR-18:** The system MUST support NVIDIA Blackwell GPUs with CUDA 13.0
- **FR-19:** Hardware requirements documentation MUST cover deployments from 10 to 500 concurrent users

## Non-Goals

- **Real-time translation:** Voice mode will not include automatic language translation (future consideration)
- **Voice biometric authentication:** No user authentication via voice recognition in this release
- **Custom voice training UI:** Training interface is out of scope; only API preparation included
- **Mobile native apps:** Voice mode targets web interface only; mobile apps are future work
- **Third-party voice service integration:** No fallback to external voice APIs (contradicts data sovereignty goals)
- **Voice commands for system control:** Voice input is for agent conversation, not Orchestra UI control
- **Offline/edge deployment:** Assumes server deployment with network access to Orchestra backend
- **Multi-language support in single session:** Users select language; no automatic detection/switching
- **Voice emotion detection:** No sentiment analysis based on voice tone
- **Voice cloning from samples:** Custom voice training is future scope, not this release

## Technical Considerations

### PersonaPlex Integration

- PersonaPlex runs as a separate service (`python -m moshi.server`)
- Communication between Orchestra backend and PersonaPlex via gRPC or REST (TBD)
- Model weights are large (~14GB for 7B model); require persistent storage
- First startup requires model loading time (30-60 seconds typical)
- NVIDIA Open Model License permits commercial use but requires attribution

### GPU Requirements

| Deployment Size | Concurrent Users | GPU Recommendation | VRAM Required | CPU Fallback Option |
|-----------------|------------------|--------------------| --------------|---------------------|
| Development     | 1-5              | RTX 3060 or better | 12GB          | Yes (slow)          |
| Small           | 10-25            | RTX 4090 / A10     | 24GB          | Partial offload     |
| Medium          | 50-100           | A100 40GB          | 40GB          | Not recommended     |
| Large           | 100-500          | A100 80GB cluster  | 80GB+         | Not supported       |
| Enterprise      | 500+             | Multi-node H100    | Distributed   | Not supported       |

### CUDA and Driver Requirements

- Minimum CUDA version: 12.0
- Recommended CUDA version: 13.0 (for Blackwell support)
- NVIDIA Driver: 535.x or newer
- Docker: nvidia-docker2 or nvidia-container-toolkit

### Database Schema Additions

```sql
-- Voice audit logs
CREATE TABLE voice_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    org_id UUID NOT NULL REFERENCES organizations(id),
    agent_id UUID REFERENCES agents(id),
    thread_id UUID REFERENCES threads(id),
    voice_model_version VARCHAR(50) NOT NULL,
    deployment_node_id VARCHAR(100),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    INDEX idx_voice_audit_user (user_id),
    INDEX idx_voice_audit_org (org_id),
    INDEX idx_voice_audit_time (start_time)
);

-- Voice transcripts (optional, when enabled)
CREATE TABLE voice_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES voice_audit_logs(session_id),
    transcript_encrypted BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Custom voices (future preparation)
CREATE TABLE custom_voices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    voice_name VARCHAR(100) NOT NULL,
    model_path VARCHAR(500),
    status VARCHAR(20) DEFAULT 'pending',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(org_id, voice_name)
);
```

### Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `docker-compose.voice.yml` | CREATE | Docker Compose for PersonaPlex |
| `deployment/helm/personaplex/` | CREATE | Kubernetes Helm chart |
| `deployment/grafana/voice-dashboard.json` | CREATE | Grafana monitoring dashboard |
| `scripts/package-voice-airgap.sh` | CREATE | Air-gapped packaging script |
| `backend/migrations/xxx_voice_audit_logs.py` | CREATE | Database migration |
| `backend/src/schemas/entities/voice.py` | CREATE | Voice-related Pydantic schemas |
| `backend/src/routes/v0/voice.py` | CREATE | Voice API endpoints |
| `backend/src/services/voice.py` | CREATE | Voice service logic |
| `backend/src/services/voice_audit.py` | CREATE | Voice audit logging service |
| `backend/src/schemas/permissions.py` | MODIFY | Add voice permissions |
| `frontend/src/components/chat/VoiceButton.tsx` | CREATE | Voice toggle component |
| `frontend/src/components/chat/VoiceIndicator.tsx` | CREATE | Recording indicator |
| `frontend/src/components/chat/AudioPlayback.tsx` | CREATE | Audio response player |
| `frontend/src/hooks/useVoice.ts` | CREATE | Voice interaction hook |
| `frontend/src/services/voiceService.ts` | CREATE | Voice API client |
| `wiki/docs/deployment/voice-hardware-requirements.md` | CREATE | Hardware guide |
| `wiki/docs/deployment/airgapped-voice.md` | CREATE | Air-gapped deployment guide |

### Security Considerations

- Voice audio streams must use TLS encryption in transit
- Transcript storage (when enabled) must use encryption at rest
- Session tokens must be short-lived and non-guessable
- GPU memory should be cleared between sessions from different organizations
- No voice data should be cached beyond session lifetime
- Audit logs must be tamper-evident (append-only)

### Performance Targets

- Voice input latency: < 200ms from audio to text
- Voice response latency: < 500ms first audio byte
- Concurrent sessions per GPU: Varies by GPU (see requirements table)
- Session startup time: < 3 seconds
- Model cold start: < 60 seconds

## Success Metrics

- **Deployment Success:** 95% of enterprise customers can deploy voice within 2 hours using documentation
- **Data Sovereignty:** 100% of voice data remains on customer infrastructure (verified via network audit)
- **Audit Completeness:** 100% of voice sessions have corresponding audit log entries
- **Availability:** Voice service maintains 99.9% uptime during business hours
- **Latency:** P95 voice response latency under 500ms
- **Adoption:** 40% of enterprise users enable voice mode within 90 days of deployment
- **Resource Efficiency:** GPU utilization averages 60-80% during peak hours
- **Compliance:** Zero voice-related compliance findings in customer security audits

## Open Questions

1. **PersonaPlex Protocol:** Should communication between Orchestra backend and PersonaPlex use gRPC (lower latency) or REST (simpler integration)?

2. **Multi-GPU Scaling:** How should we handle session routing across multiple GPUs - round-robin, least-loaded, or sticky sessions?

3. **Audio Codec:** What audio codec should be used for streaming - Opus (better compression) or PCM (lower latency)?

4. **Voice Model Versioning:** How do we handle model version upgrades without disrupting active sessions?

5. **Transcript Redaction:** Should we offer automatic PII redaction for transcripts before storage?

6. **Voice Persona Default:** Should there be a default voice persona, or require explicit selection?

7. **Bandwidth Limits:** What bandwidth constraints should we document for poor network conditions?

8. **License Attribution:** How and where should NVIDIA Open Model License attribution be displayed?

9. **Telemetry:** Should we offer optional anonymized usage telemetry to help improve the service (opt-in only)?

10. **Custom Voice Timeline:** When should custom voice training (US-020) be prioritized for full implementation?
