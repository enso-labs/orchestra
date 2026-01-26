# PRD: Voice Mode User Experience (NVIDIA PersonaPlex Integration)

## Introduction

Implement a full-duplex voice mode user experience in Orchestra's chat interface, powered by NVIDIA PersonaPlex technology. This feature enables natural, real-time voice conversations with AI agents, supporting simultaneous listening and speaking, natural interruptions, and customizable voice personas. The implementation focuses on intuitive, no-code interaction patterns that allow business users (ICP 4) to converse with AI agents as naturally as speaking with a colleague.

Orchestra's mission is "helping people regain ownership of their time" - voice mode accelerates this by enabling hands-free AI interaction, allowing users to multitask while orchestrating complex automations through natural conversation.

## Goals

- Enable real-time, full-duplex voice conversations with AI agents in the chat interface
- Provide intuitive visual feedback for all voice interaction states (listening, speaking, processing, interruption)
- Allow users to select from 16 built-in voice personas or configure custom voices
- Support natural interruption patterns where users can interject mid-response
- Offer both "always listening" and "push-to-talk" modes for different user preferences and environments
- Ensure graceful fallback to text mode when voice is unavailable (permissions denied, no microphone, unsupported browser)
- Deliver responsive design that works seamlessly on both desktop and mobile devices
- Meet accessibility standards (WCAG 2.1 AA) for users with disabilities
- Achieve sub-200ms perceived latency to maintain conversational flow

## User Stories

### US-001: Voice Mode Toggle Activation
**Description:** As a business user, I want to easily toggle voice mode on/off from the chat interface so I can switch between typing and speaking based on my context.

**Acceptance Criteria:**
- [ ] Voice mode toggle button visible in ChatInput component toolbar (alongside existing tools)
- [ ] Toggle button shows clear on/off state with distinct icons (microphone for voice, keyboard for text)
- [ ] Single click/tap activates voice mode with smooth transition animation
- [ ] Voice mode state persists across page refreshes (localStorage)
- [ ] Keyboard shortcut available (Alt+V) for power users
- [ ] Toggle disabled with tooltip explanation when voice unavailable (e.g., "Microphone access required")
- [ ] Verify in browser using dev-browser skill: toggle transitions smoothly, state persists

### US-002: Microphone Permission Request Flow
**Description:** As a first-time user, I want a clear and non-intimidating permission request flow so I understand why microphone access is needed and feel comfortable granting it.

**Acceptance Criteria:**
- [ ] On first voice mode activation, display friendly modal explaining voice features
- [ ] Modal includes: brief description, privacy assurance, "Enable Microphone" and "Maybe Later" buttons
- [ ] Modal uses approachable language (no technical jargon)
- [ ] If permission denied, show helpful guidance to enable in browser settings
- [ ] Permission state cached to avoid repeated prompts
- [ ] "Learn more" link to documentation about voice data handling
- [ ] Verify in browser using dev-browser skill: permission flow is smooth and informative

### US-003: Real-Time Audio Visualization (Listening State)
**Description:** As a user speaking to the agent, I want clear visual feedback that the system is actively listening so I know my voice is being captured.

**Acceptance Criteria:**
- [ ] Animated waveform/pulse visualization when microphone is active and detecting audio
- [ ] Visualization responds to voice amplitude in real-time (louder = larger waves)
- [ ] Distinct "listening" indicator color (e.g., blue pulse) differentiates from "speaking" state
- [ ] Small avatar/icon shows "ear" or listening pose
- [ ] Silence detection: visualization shows lower activity when user pauses
- [ ] Visual positioned prominently in chat input area, replacing or augmenting existing VoiceVisualizer
- [ ] Verify in browser using dev-browser skill: visualization responds to actual voice input

### US-004: Real-Time Audio Visualization (Speaking State)
**Description:** As a user receiving a voice response, I want visual feedback showing the agent is speaking so I know a response is being delivered.

**Acceptance Criteria:**
- [ ] Animated waveform/avatar visualization synced to agent's speech output
- [ ] Distinct "speaking" indicator color (e.g., green pulse) differentiates from "listening" state
- [ ] Agent avatar/icon shows "speaking" pose or animation
- [ ] Audio playback progress indicator (subtle, non-intrusive)
- [ ] Visualization appears in message bubble area for the agent's response
- [ ] Smooth transition between listening -> processing -> speaking states
- [ ] Verify in browser using dev-browser skill: agent speaking state clearly distinguishable

### US-005: Processing State Indicator
**Description:** As a user waiting for a response, I want visual feedback that my message is being processed so I don't think the system is frozen.

**Acceptance Criteria:**
- [ ] Distinct "thinking" animation after user finishes speaking, before agent responds
- [ ] Processing indicator appears within 200ms of silence detection
- [ ] Subtle animation (e.g., pulsing dots, thinking emoji, brain icon)
- [ ] Processing state times out with friendly message if backend takes >30 seconds
- [ ] Processing indicator does not block ability to interrupt/cancel
- [ ] Verify in browser using dev-browser skill: processing state appears promptly after speaking

### US-006: Voice Persona Selection UI
**Description:** As a user, I want to select from different voice personas so I can customize my agent's voice to my preference.

**Acceptance Criteria:**
- [ ] Voice persona selector accessible from chat settings or voice mode panel
- [ ] Display all 16 NVIDIA PersonaPlex built-in voices with descriptive names
- [ ] Voice categories: "Natural Male", "Natural Female", "Variety Male", "Variety Female"
- [ ] Preview button plays short sample of each voice before selection
- [ ] Selected persona persists per-agent (different agents can have different voices)
- [ ] Default persona selection for new users (natural, professional voice)
- [ ] Persona selection available without entering voice mode (can set while in text mode)
- [ ] Verify in browser using dev-browser skill: persona selector displays all options with previews

### US-007: Custom Voice Persona Configuration
**Description:** As an advanced user, I want to configure custom voice personas using audio embeddings so I can create unique agent personalities.

**Acceptance Criteria:**
- [ ] "Custom Voice" option in persona selector
- [ ] File upload interface for audio embedding files (.wav, .mp3 format guidance)
- [ ] Text field for persona prompt (role, personality, speaking style)
- [ ] Validation: audio file format and size limits with clear error messages
- [ ] Preview custom voice before saving
- [ ] Save custom personas to user profile for reuse
- [ ] Clear documentation/help text explaining audio embedding requirements
- [ ] Verify in browser using dev-browser skill: custom voice upload and preview works

### US-008: Natural Interruption Handling
**Description:** As a user, I want to interrupt the agent mid-speech naturally so conversations feel human-like rather than turn-based.

**Acceptance Criteria:**
- [ ] Agent speech stops within 200ms when user starts speaking (full-duplex capability)
- [ ] Visual indicator shows interruption detected (brief flash or icon)
- [ ] Agent's partial response preserved in chat history (with "[interrupted]" marker if desired)
- [ ] Agent immediately begins processing user's interruption as new input
- [ ] No audio overlap/collision artifacts during interruption
- [ ] Backchannels ("uh-huh", "mmm") from agent while user speaks (optional, configurable)
- [ ] Verify in browser using dev-browser skill: interruption feels responsive and natural

### US-009: Push-to-Talk Mode
**Description:** As a user in a noisy environment, I want push-to-talk mode so I can control exactly when the agent listens to avoid false activations.

**Acceptance Criteria:**
- [ ] Toggle between "Always Listening" and "Push-to-Talk" modes in voice settings
- [ ] Push-to-talk: hold spacebar (desktop) or hold microphone button (mobile) to speak
- [ ] Clear visual indicator when PTT is active (button depressed, recording indicator)
- [ ] Audio only captured while PTT activated
- [ ] PTT preference persists in user settings
- [ ] Haptic feedback on mobile when PTT activated/deactivated
- [ ] Verify in browser using dev-browser skill: PTT activates only while held

### US-010: Always-Listening Mode
**Description:** As a user in a quiet environment, I want always-listening mode so I can have hands-free conversations.

**Acceptance Criteria:**
- [ ] In always-listening mode, agent continuously monitors for speech
- [ ] Voice Activity Detection (VAD) prevents processing background noise
- [ ] Configurable silence threshold before agent considers user "done speaking"
- [ ] Wake word optional: "Hey Orchestra" or agent name to initiate (stretch goal)
- [ ] Clear indicator showing always-listening is active
- [ ] Easy one-tap mute without leaving voice mode
- [ ] Verify in browser using dev-browser skill: VAD correctly detects speech vs silence

### US-011: Graceful Fallback to Text Mode
**Description:** As a user whose microphone is unavailable, I want the interface to gracefully fall back to text mode with clear explanation so I can still use the application.

**Acceptance Criteria:**
- [ ] Automatic detection of: no microphone, permission denied, unsupported browser
- [ ] Friendly error message explaining why voice mode is unavailable
- [ ] Suggested actions: "Check microphone connection", "Enable in browser settings", "Try Chrome/Edge"
- [ ] Text mode remains fully functional with no degradation
- [ ] Voice toggle shows disabled state with hover tooltip explanation
- [ ] Re-check microphone availability periodically (e.g., when user clicks disabled toggle)
- [ ] Verify in browser using dev-browser skill: fallback message displays correctly when mic blocked

### US-012: Mobile Responsive Voice Interface
**Description:** As a mobile user, I want voice mode to work seamlessly on my phone so I can interact while on the go.

**Acceptance Criteria:**
- [ ] Voice controls accessible via thumb-friendly tap targets (min 44x44px)
- [ ] Visualizations scale appropriately for smaller screens
- [ ] PTT button large and centered for easy one-hand operation
- [ ] Landscape and portrait orientations supported
- [ ] Voice mode works in mobile browsers (Chrome, Safari iOS)
- [ ] Audio output through device speakers or connected headphones
- [ ] No layout shift when transitioning between voice states
- [ ] Verify in browser using dev-browser skill: test at 375px and 768px widths

### US-013: Desktop Responsive Voice Interface
**Description:** As a desktop user, I want voice mode integrated cleanly into the existing chat layout so the experience feels cohesive.

**Acceptance Criteria:**
- [ ] Voice controls positioned consistently in ChatInput toolbar
- [ ] Visualizations fit within existing chat panel without overflow
- [ ] Keyboard shortcuts documented and accessible (Alt+V toggle, Spacebar PTT)
- [ ] Voice persona selector in settings popover or side panel
- [ ] Split view (editor + chat) maintains voice functionality
- [ ] Multi-monitor: voice indicator visible in system tray or persistent header
- [ ] Verify in browser using dev-browser skill: test at 1280px and 1920px widths

### US-014: Accessibility - Screen Reader Support
**Description:** As a user with visual impairment, I want voice mode to be fully accessible via screen reader so I can use all features.

**Acceptance Criteria:**
- [ ] All voice controls have proper ARIA labels and roles
- [ ] State changes announced: "Voice mode activated", "Agent speaking", "Listening"
- [ ] Visual-only indicators have text alternatives (aria-live regions)
- [ ] Focus management: focus moves logically when voice panel opens/closes
- [ ] Skip links to bypass voice visualizations if desired
- [ ] Voice persona names read correctly by screen readers
- [ ] Verify in browser using dev-browser skill with VoiceOver/NVDA simulation

### US-015: Accessibility - Keyboard Navigation
**Description:** As a user who cannot use a mouse, I want full keyboard access to voice mode so I can participate in voice conversations.

**Acceptance Criteria:**
- [ ] All voice controls reachable via Tab key navigation
- [ ] Visible focus indicators on all interactive elements
- [ ] Enter/Space activates buttons, Escape closes modals
- [ ] PTT mode: Spacebar activates without stealing focus from other elements
- [ ] Keyboard shortcut help dialog (? key or help menu)
- [ ] No keyboard traps in voice mode UI
- [ ] Verify in browser using dev-browser skill: navigate voice mode without mouse

### US-016: Voice Mode Transcript Display
**Description:** As a user, I want my spoken words to appear as text in the chat so I have a record of the conversation.

**Acceptance Criteria:**
- [ ] User's speech transcribed and displayed in chat as user message bubble
- [ ] Real-time transcription preview as user speaks (partial results)
- [ ] Final transcript appears when user finishes speaking
- [ ] Agent's spoken response also displayed as text in chat
- [ ] Transcript editable before sending (in PTT mode pause)
- [ ] Timestamps on all messages for reference
- [ ] Verify in browser using dev-browser skill: transcription appears in real-time

### US-017: Connection Status and Error Handling
**Description:** As a user, I want clear feedback when voice connection has issues so I understand what's happening and how to resolve it.

**Acceptance Criteria:**
- [ ] Connection status indicator: connected (green), connecting (yellow), disconnected (red)
- [ ] Auto-reconnect attempts with visual feedback ("Reconnecting...")
- [ ] Clear error messages for common issues: "Network connection lost", "Server unavailable"
- [ ] Retry button for manual reconnection attempts
- [ ] Graceful degradation: switch to text mode if voice backend down
- [ ] Toast notifications for transient errors (non-blocking)
- [ ] Verify in browser using dev-browser skill: simulate network interruption

### US-018: Voice Mode Settings Panel
**Description:** As a user, I want a dedicated settings panel for voice mode so I can configure all voice-related preferences in one place.

**Acceptance Criteria:**
- [ ] Voice settings accessible from SettingsPopover or dedicated modal
- [ ] Settings include: voice persona, input mode (PTT/always-listening), silence threshold, VAD sensitivity
- [ ] Microphone input level meter for testing
- [ ] Speaker output test button
- [ ] "Restore defaults" option
- [ ] Settings sync across devices via user profile
- [ ] Verify in browser using dev-browser skill: settings panel opens and saves correctly

## Functional Requirements

- **FR-1:** System must establish WebSocket connection to NVIDIA PersonaPlex endpoint for bidirectional audio streaming
- **FR-2:** Voice mode must support full-duplex audio: user audio sent while agent audio received simultaneously
- **FR-3:** System must maintain <200ms latency from end of user speech to start of agent response
- **FR-4:** Voice persona selection must support all 16 NVIDIA built-in voices plus custom audio embeddings
- **FR-5:** Interruption detection must trigger within 200ms of user voice onset during agent speech
- **FR-6:** Voice Activity Detection must distinguish speech from background noise with configurable sensitivity
- **FR-7:** Push-to-talk must capture audio only while activation control is held
- **FR-8:** Always-listening mode must respect configurable silence threshold (default 1.5 seconds)
- **FR-9:** Real-time transcription must display partial results within 300ms of speech
- **FR-10:** Voice mode must gracefully degrade to text mode when audio hardware unavailable
- **FR-11:** All voice UI elements must meet WCAG 2.1 AA accessibility standards
- **FR-12:** Voice mode state (enabled, persona, input mode) must persist in localStorage and user settings
- **FR-13:** Mobile interface must support touch targets minimum 44x44px per WCAG guidelines
- **FR-14:** Audio visualizations must render at 60fps without impacting main thread performance

## Non-Goals

- Backend API implementation for NVIDIA PersonaPlex integration (separate PRD)
- Voice authentication / speaker verification
- Multi-language voice support (English only for v1)
- Voice-to-voice translation
- Custom wake word training
- Voice recording/playback history beyond current session
- Voice mode in shared/public threads
- Integration with third-party voice assistants (Alexa, Google Assistant)
- Offline voice mode capability
- Voice cloning from user recordings

## Design Considerations

### Component Architecture
```
frontend/src/components/
├── voice/
│   ├── VoiceModeToggle.tsx        # Main toggle button in ChatInput toolbar
│   ├── VoiceModePanel.tsx         # Container for voice UI when active
│   ├── VoiceVisualizer.tsx        # Upgrade existing visualizer for bidirectional
│   ├── VoicePersonaSelector.tsx   # Persona picker dropdown/modal
│   ├── VoiceSettingsPanel.tsx     # Configuration panel
│   ├── VoiceConnectionStatus.tsx  # WebSocket connection indicator
│   ├── VoiceTranscript.tsx        # Real-time speech-to-text display
│   └── hooks/
│       ├── useVoiceMode.ts        # Voice mode state management
│       ├── useVoiceConnection.ts  # WebSocket connection handling
│       ├── useVoicePersona.ts     # Persona selection and storage
│       └── useVoiceVisualization.ts # Audio analysis for visualizations
```

### State Management
- Voice mode state managed via React Context (`VoiceModeContext`)
- Integrates with existing `ChatContext` for message handling
- Persona preferences stored in user settings (API) and localStorage (offline fallback)

### Audio Processing Pipeline
```
User Microphone → Web Audio API → VAD Filter → WebSocket → PersonaPlex
PersonaPlex → WebSocket → Audio Decoder → Web Audio API → Speakers
                       ↓
              Transcription → Chat Messages
```

### Visual Design Guidelines
- Visualizations use existing Tailwind color palette (`primary`, `secondary`, `muted`)
- Animations via CSS transitions/Framer Motion (already in stack)
- Icons from Lucide (already in use): `Mic`, `MicOff`, `Volume2`, `VolumeX`, `Settings`
- Voice panel styling consistent with existing `ChatInput` component

### Performance Considerations
- Audio visualization on separate thread (Web Worker) to avoid UI jank
- WebSocket message batching for efficiency
- Lazy load voice components when feature first activated
- Audio buffer management to prevent memory leaks

### Browser Compatibility
- Primary: Chrome 90+, Edge 90+, Firefox 88+, Safari 14+
- MediaDevices API required for microphone access
- WebSocket for real-time communication
- Web Audio API for visualization and processing

### Files to Create/Modify

| File | Action |
|------|--------|
| `frontend/src/components/voice/VoiceModeToggle.tsx` | CREATE |
| `frontend/src/components/voice/VoiceModePanel.tsx` | CREATE |
| `frontend/src/components/voice/VoicePersonaSelector.tsx` | CREATE |
| `frontend/src/components/voice/VoiceSettingsPanel.tsx` | CREATE |
| `frontend/src/components/voice/VoiceConnectionStatus.tsx` | CREATE |
| `frontend/src/components/voice/VoiceTranscript.tsx` | CREATE |
| `frontend/src/components/voice/hooks/useVoiceMode.ts` | CREATE |
| `frontend/src/components/voice/hooks/useVoiceConnection.ts` | CREATE |
| `frontend/src/context/VoiceModeContext.tsx` | CREATE |
| `frontend/src/components/inputs/ChatInput.tsx` | MODIFY (add voice toggle) |
| `frontend/src/components/inputs/AudioRecorder.tsx` | MODIFY (integrate with voice mode) |
| `frontend/src/lib/services/voiceService.ts` | CREATE |
| `frontend/src/lib/entities/voice.ts` | CREATE (TypeScript types) |
| `frontend/src/tests/voice/VoiceModeToggle.test.tsx` | CREATE |
| `frontend/src/tests/voice/VoicePersonaSelector.test.tsx` | CREATE |
| `frontend/src/tests/hooks/useVoiceMode.test.ts` | CREATE |

## Success Metrics

- **Adoption Rate:** 30% of active users try voice mode within first month
- **Retention:** 50% of users who try voice mode continue using it weekly
- **Task Completion:** Voice mode users complete tasks 25% faster than text-only
- **Error Rate:** <5% of voice sessions end due to technical errors
- **Latency:** 95th percentile response time <500ms (end-to-end)
- **Accessibility:** Zero critical accessibility issues in audit
- **NPS:** Voice mode users rate experience 4.0+ out of 5.0
- **ICP 4 Feedback:** Business process users report voice mode "easy to use" at 80%+ rate

## Open Questions

1. **Wake Word:** Should always-listening mode require a wake word ("Hey Orchestra") or rely purely on VAD? (Impacts privacy perception and false activation rate)

2. **Agent Voice Consistency:** Should different agents (if user has multiple) have different default voices, or one voice per user preference?

3. **Conversation History:** When voice mode is active, should the text transcript be hidden to focus on audio, or always visible for accessibility?

4. **Background Noise Handling:** What's the acceptable false-positive rate for VAD in noisy environments? Should we offer a "quiet environment" vs "noisy environment" preset?

5. **Mobile Browser Limitations:** Safari iOS has restrictions on background audio - how do we handle voice mode when app is backgrounded?

6. **Rate Limiting:** Should there be limits on voice mode usage (e.g., minutes per day) for cost management, or unlimited for all plans?

7. **Custom Voice Legal:** What disclaimers/agreements are needed when users upload custom voice embeddings? (IP/consent considerations)

8. **Interruption Sensitivity:** How aggressive should interruption detection be? Some users may want to think aloud without interrupting the agent.
