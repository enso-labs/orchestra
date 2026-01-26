# Voice Mode Implementation: Final Consolidated Plan

## AI Council Review Summary

This plan synthesizes reviews from three specialist perspectives:
- **Technical Architect**: System integration, API design, scalability
- **Product/UX Strategist**: ICP alignment, MVP scope, user adoption
- **DevOps/Security Lead**: Infrastructure, compliance, operational readiness

---

## Critical Conflicts Resolved

### 1. Communication Protocol (RESOLVED)
| PRD | Original | Resolution |
|-----|----------|------------|
| API | WebSocket only | **WebSocket for all real-time audio** |
| Enterprise | "gRPC or REST (TBD)" + SSE | SSE removed; gRPC for internal PersonaPlex communication |

**Decision**: WebSocket for browser-to-server; gRPC for FastAPI-to-PersonaPlex (better latency, built-in streaming, easier mTLS).

### 2. Session Timeout (RESOLVED)
| PRD | Original | Resolution |
|-----|----------|------------|
| API | 30 minutes | **5 minutes default** |
| Enterprise | 5 minutes | Configurable up to 30 minutes for enterprise |

**Decision**: 5 minutes default (resource efficiency), configurable per-organization up to 30 minutes.

### 3. File/Component Naming (RESOLVED)
| Conflict | Resolution |
|----------|------------|
| Duplicate `voice.py` schemas | API PRD is canonical; Enterprise adds `voice_enterprise.py` for audit schemas |
| Duplicate routes | API PRD owns `/api/voice/*`; Enterprise adds `/api/admin/voice/*` for admin endpoints |
| Frontend components | UX PRD owns `components/voice/`; Enterprise references, does not duplicate |

### 4. Latency Targets (RESOLVED)
| Metric | Target | Context |
|--------|--------|---------|
| Interruption detection | <200ms | Audio processing only |
| Transcription feedback | <300ms | Speech-to-text display |
| Agent response (simple) | <500ms | Non-LLM tool calls |
| Agent response (LLM) | <2000ms | Full LLM reasoning |

---

## MVP Scope (Phase 1)

### Guiding Principle
**Validate user demand before enterprise infrastructure**

Per Product/UX review: "Current 51 user stories is too ambitious. Focus on 12-15 core stories to prove value proposition."

### MVP User Stories (14 total)

| Priority | PRD | Story ID | Description | ICP Target |
|----------|-----|----------|-------------|------------|
| 1 | API | US-002 | Pydantic schemas (VoiceSession, VoiceConfig) | Foundation |
| 2 | API | US-003 | Voice session service (lifecycle management) | Foundation |
| 3 | API | US-004 | PersonaPlex client service | Foundation |
| 4 | API | US-005 | WebSocket voice gateway | ICP 1, 2 |
| 5 | API | US-006 | REST endpoints (create, end session only) | ICP 1, 2 |
| 6 | API | US-007 | Agent workflow integration (VoiceAgentBridge) | **All ICPs** |
| 7 | UX | US-001 | Voice mode toggle (Alt+V) | All ICPs |
| 8 | UX | US-002 | Microphone permission flow | All ICPs |
| 9 | UX | US-003 | Listening visualization | ICP 4 |
| 10 | UX | US-004 | Speaking visualization | ICP 4 |
| 11 | UX | US-011 | Graceful fallback to text | All ICPs |
| 12 | UX | US-016 | Real-time transcript display | ICP 4 |
| 13 | UX | US-017 | Connection status indicator | All ICPs |
| 14 | UX | **NEW** | Voice discovery onboarding | All ICPs |

### MVP Explicitly Defers
- All Enterprise PRD user stories (US-001 through US-020)
- Custom voice personas (UX US-006, US-007)
- Interruption handling (UX US-008) - iterate post-launch
- Push-to-talk (UX US-009) - add in Phase 1.1
- Accessibility (UX US-014, US-015) - Phase 1.1 priority
- Voice preferences storage (API US-009)

### MVP Infrastructure
- **Cloud-hosted PersonaPlex only** (managed by Ruska)
- No self-hosting in MVP - GPU problem is adoption blocker for ICP 4
- CPU fallback not in MVP (latency unproven)

---

## New User Stories Required

### NEW-001: Voice Discovery Onboarding
**Description**: As a new user, I want to discover voice mode exists and understand why I should try it.

**Acceptance Criteria**:
- [ ] In-app announcement banner for existing users on first visit after launch
- [ ] Tooltip on chat input: "Try voice mode (Alt+V)"
- [ ] 30-second "How it works" modal available from settings
- [ ] First voice session shows "What can I say?" suggestions
- [ ] Typecheck passes

### NEW-002: Mid-Conversation Fallback
**Description**: As a user, I want my conversation to continue in text if voice connection drops.

**Acceptance Criteria**:
- [ ] Connection drop detected within 2 seconds
- [ ] User notified: "Voice disconnected. Continuing in text."
- [ ] Conversation context preserved
- [ ] One-click "Reconnect voice" button appears
- [ ] Typecheck passes

### NEW-003: Service-to-Service Authentication
**Description**: As a platform operator, I need secure communication between FastAPI and PersonaPlex.

**Acceptance Criteria**:
- [ ] mTLS or shared secret authentication between services
- [ ] No plaintext credentials in environment variables
- [ ] Certificate rotation procedure documented
- [ ] Health check validates auth is working
- [ ] Security scan passes

### NEW-004: WebSocket Message Versioning
**Description**: As a developer, I need WebSocket protocol versioning to enable future evolution.

**Acceptance Criteria**:
- [ ] All WebSocket messages include `"version": 1` field
- [ ] Server rejects messages with unsupported versions gracefully
- [ ] Client receives clear error on version mismatch
- [ ] Protocol version documented in API docs

---

## Security Requirements (P0 Blockers)

Per DevOps/Security review, these must be addressed before launch:

| Issue | Resolution | Owner |
|-------|------------|-------|
| No service-to-service auth | Add mTLS between FastAPI and PersonaPlex (NEW-003) | Backend |
| WebSocket token in query params | Move to upgrade headers only; remove query param option | Backend |
| No payload size limits | Add `VOICE_MAX_PAYLOAD_BYTES=65536` (64KB per frame) | Backend |
| GPU memory clearing | Document that only user context is cleared, not model weights | Docs |
| Missing DPIA template | Create GDPR DPIA template for voice processing | Compliance |

---

## Phase Plan

### Phase 1: MVP (6-8 weeks)
**Theme**: "Talk to your AI agent"
**ICP Focus**: ICP 4 (Business Automation) with ICP 1/2 power users

**Deliverables**:
- Cloud-hosted voice mode
- Core conversation flow
- Basic visualizations
- Discovery onboarding

**Success Metrics**:
| Metric | Target |
|--------|--------|
| Users who try voice (week 1-2) | 20% of active users |
| Voice user retention (week 4) | 40% |
| Tasks completed via voice | Track baseline |
| Qualitative feedback | "This saved me time" |

### Phase 1.1: Polish (2-3 weeks)
**Theme**: "Voice that feels natural"

**Deliverables**:
- Push-to-talk mode (default for enterprise)
- Interruption handling
- Full voice persona library
- Mobile responsive
- Accessibility (screen reader, keyboard nav)

**Success Metrics**:
| Metric | Target |
|--------|--------|
| Error rate | <5% |
| Session duration | 2x baseline |
| Voice NPS | 4.0+ |

### Phase 2: Self-Hosted (4-6 weeks)
**Theme**: "Voice on your terms"
**ICP Focus**: ICP 1 (Developers)

**Deliverables**:
- Docker deployment (Enterprise US-001)
- CPU offloading option (Enterprise US-003)
- Basic audit logging (Enterprise US-004)
- Hardware requirements docs (Enterprise US-009)
- Cost estimation guide (Enterprise US-010)

**Success Metrics**:
| Metric | Target |
|--------|--------|
| Successful self-hosted deployments | 10+ |
| Deployment time with docs | <2 hours |

### Phase 3: Enterprise (6-8 weeks)
**Theme**: "Voice for the enterprise"
**ICP Focus**: ICP 3 (Enterprise)

**Deliverables**:
- Kubernetes Helm chart (Enterprise US-002)
- Full audit logging with transcripts (Enterprise US-004, US-005)
- RBAC for voice (Enterprise US-006, US-007)
- Air-gapped deployment (Enterprise US-008)
- GPU monitoring dashboard (Enterprise US-011)
- Auto-scaling (Enterprise US-013)
- Multi-tenant isolation (Enterprise US-015)

**Success Metrics**:
| Metric | Target |
|--------|--------|
| Enterprise pilots | 3+ |
| Compliance audit findings | 0 |
| Deployment success rate | 95% |

### Phase 4: Advanced (Future)
**Theme**: "Your voice, your AI"

**Deliverables**:
- Custom voice training (Enterprise US-020)
- Wake word detection
- Multi-language support
- Voice analytics dashboard

---

## Technical Architecture Decisions

### 1. Communication Stack
```
Browser <--WSS--> FastAPI <--gRPC--> PersonaPlex
                     |
                     v
              LangChain Agents
```

### 2. State Management
```python
class VoiceSessionState(str, Enum):
    IDLE = "idle"
    CONNECTING = "connecting"
    ACTIVE = "active"
    PAUSED = "paused"
    ENDED = "ended"
    ERROR = "error"
```

Separate WebSocket connection state machine:
```
DISCONNECTED → CONNECTING → CONNECTED → RECONNECTING → DISCONNECTED
                                ↓
                         AUTH_FAILED
```

### 3. Buffer Management
- Maximum buffer: 30 seconds rolling
- Overflow behavior: Drop oldest chunks
- Client-side buffering for jitter compensation
- Server-side: Stream through, no storage (ephemeral)

### 4. Circuit Breaker
```python
VOICE_CIRCUIT_BREAKER_THRESHOLD = 5  # failures before open
VOICE_CIRCUIT_BREAKER_TIMEOUT = 30   # seconds before half-open
```

### 5. Rate Limiting
```python
VOICE_RATE_LIMIT_SESSIONS_PER_MINUTE = 5  # per user
VOICE_RATE_LIMIT_AUDIO_KBPS = 128         # per session
```

---

## Infrastructure Requirements

### MVP (Cloud-Hosted)
- Ruska manages GPU infrastructure
- Users connect to managed voice endpoint
- No customer GPU requirements

### Self-Hosted Minimum
| Component | Requirement |
|-----------|-------------|
| GPU | 16GB VRAM (RTX 4090, A10, or equivalent) |
| CPU | 8 cores (for CPU offload option) |
| RAM | 32GB |
| Disk | 50GB SSD (model weights + logs) |
| Network | 100Mbps symmetric |

### Enterprise Scale
| Tier | Concurrent Users | GPU | Monthly Cloud Cost |
|------|------------------|-----|-------------------|
| Small | 10-25 | 1x A10 | $2,500-4,000 |
| Medium | 50-100 | 1x A100 40GB | $8,000-15,000 |
| Large | 100-500 | 2-4x A100 80GB | $25,000-50,000 |

---

## Compliance Checklist

### Before MVP Launch
- [ ] DPIA template created
- [ ] Privacy policy updated for voice data
- [ ] "No audio storage" architecture verified
- [ ] mTLS between services implemented
- [ ] WebSocket authentication hardened

### Before Enterprise Launch
- [ ] SOC 2 Type II evidence collected
- [ ] GDPR Article 17 deletion API implemented
- [ ] Audit log tamper-evidence verified
- [ ] BAA template available (for HIPAA customers)
- [ ] Air-gapped deployment tested

---

## Open Questions Resolved

| Question | Decision |
|----------|----------|
| GPU sharing with Ollama? | **Dedicated GPU** for PersonaPlex (memory contention risk) |
| Transcript storage? | **Disabled by default**; opt-in per-org with separate encryption keys |
| gRPC vs REST internally? | **gRPC** for lower latency and built-in streaming |
| Audio codec? | **Opus** (32kbps) for all deployments |
| PII redaction? | **Configurable per-organization**; required for HIPAA customers |
| Default interaction mode? | **Push-to-talk** for enterprise; always-listening for consumers |

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| GPU availability | Medium | High | Cloud-first MVP; defer self-hosting |
| User adoption | Medium | High | Strong onboarding; clear "aha moment" |
| Latency complaints | Medium | Medium | Set expectations; "thinking" indicators |
| Enterprise compliance gaps | Low | High | DPIA + SOC 2 evidence before enterprise |
| WebSocket scaling | Low | Medium | Separate gateway if >100 concurrent |

---

## Success Criteria

### MVP Success (Go/No-Go for Phase 1.1)
- [ ] 20% of active users try voice within 2 weeks
- [ ] 40% retention of voice users at week 4
- [ ] Positive qualitative feedback: "saved time"
- [ ] <5% error rate in voice sessions
- [ ] P95 latency <2000ms for LLM responses

### Full Success (6 months)
- [ ] Voice mode used by 30% of active users weekly
- [ ] 3+ enterprise pilots in progress
- [ ] 10+ successful self-hosted deployments
- [ ] Feature mentioned in user acquisition conversations

---

## Next Steps

1. **Immediate**: Resolve P0 security blockers (NEW-003, WebSocket auth)
2. **Week 1**: Set up cloud GPU infrastructure for MVP
3. **Week 2**: Implement core schemas and session service (API US-002, US-003)
4. **Week 3-4**: WebSocket gateway and PersonaPlex integration
5. **Week 5-6**: Frontend components and visualizations
6. **Week 7**: Voice discovery onboarding
7. **Week 8**: Testing, polish, launch

---

## Appendix: User Story Prioritization Matrix

| Story | Business Value | Technical Risk | Dependencies | Phase |
|-------|----------------|----------------|--------------|-------|
| API US-007 (Agent Bridge) | Critical | Medium | US-002,003,004 | MVP |
| UX US-001 (Toggle) | High | Low | None | MVP |
| UX US-016 (Transcript) | High | Low | API US-005 | MVP |
| UX US-008 (Interruption) | Medium | High | API US-005 | 1.1 |
| ENT US-015 (Multi-tenant) | Medium | High | Many | 3 |
| ENT US-020 (Custom Voice) | Low | Very High | All | 4 |

---

*This plan was generated by AI Council review of three PRDs:*
- `tasks/prd-voice-api-integration.md`
- `tasks/prd-voice-mode-ux.md`
- `tasks/prd-enterprise-voice-deployment.md`

*Council members: Technical Architect, Product/UX Strategist, DevOps/Security Lead*
