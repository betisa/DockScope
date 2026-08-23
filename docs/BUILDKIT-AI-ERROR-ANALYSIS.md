# BuildKit AI Error Analysis

> **Shared provider note:** Settings → AI Provider is now shared by BuildKit AI Error Analysis and Container AI Failure Analysis. No duplicate API key/provider configuration is required.

## Objective
Add optional AI-assisted analysis to BuildKit Diagnostics → Error Analysis using any OpenAI-compatible Chat Completions endpoint.

## Provider settings
Settings → AI Provider:
- Enable AI Error Analysis
- Base URL
- Model
- API key
- Temperature
- Max output tokens
- Timeout
- Include BuildKit logs
- Maximum log characters
- Test connection

Compatible request:
`POST <baseUrl>/chat/completions`

Local HTTP is allowed only for localhost/loopback. Remote endpoints require HTTPS.

## Security & privacy
AI execution is explicit; no request is sent until the user selects **Analyze with AI**.
Electron Main re-fetches Build Diagnostics, redacts secret-like evidence, bounds logs, and sends the request. Renderer cannot submit arbitrary prompt/log data to the provider endpoint.

API keys are encrypted using Electron `safeStorage` and only the encrypted blob is persisted in SQLite. The API key is never returned to Renderer; Renderer receives only `apiKeyConfigured`.

Prompt and AI response are not persisted.

## Analysis model
Local deterministic findings remain visible and independent. AI is a second opinion that returns:
- summary
- confidence
- potential root causes with evidence
- prioritized recommended actions

The system prompt treats BuildKit logs as untrusted data and instructs the model not to follow prompt-like instructions embedded in logs.

## Acceptance criteria
- [x] OpenAI-compatible provider.
- [x] AI Provider settings page.
- [x] SQLite persistence for provider settings.
- [x] safeStorage-encrypted API key in SQLite.
- [x] Connection test.
- [x] Explicit Analyze with AI button.
- [x] Main-owned provider request.
- [x] Secret redaction.
- [x] Bounded log payload.
- [x] Rule-based Error Analysis retained.
- [x] AI output normalized to a bounded typed structure.
