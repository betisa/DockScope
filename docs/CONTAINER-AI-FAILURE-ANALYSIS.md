# Container AI Failure Analysis

## Objective

Extend **Container Workspace → Advisor** with an optional AI-assisted second opinion when Docker evidence indicates a runtime or health problem.

AI is offered for conditions such as:

- container state is not `running`;
- non-zero exit code;
- OOM kill;
- restart-loop evidence;
- Docker health status is `unhealthy`;
- a health check is configured but Docker reports health as `unknown` / unavailable;
- warning/critical deterministic Advisor findings exist.

AI is not automatically called. The user must choose **Analyze failure with AI**.

## Health semantics

A missing health check is not considered a health failure.

```text
Healthcheck not configured
→ informational context only

Healthcheck configured + unhealthy
→ failure evidence

Healthcheck configured + unknown
→ health unavailable evidence
```

The deterministic Advisor now emits a `health-unavailable` warning when a healthcheck exists but Docker cannot provide an assessable health status.

## Provider

The feature uses the existing OpenAI-compatible provider configured in:

```text
Settings → AI Provider
```

No second API key or provider configuration is required.

## Main-process evidence pipeline

```text
Renderer
  ↓ container id only
Validated IPC
  ↓
Electron Main
  ↓
containerAdvisor(containerId)
  + recent docker logs
  ↓
secret redaction
  ↓
bounded log tail
  ↓
OpenAI-compatible /chat/completions
```

Renderer cannot submit arbitrary logs or a custom prompt to the provider.

## Evidence sent

The bounded prompt may include:

- container ID/name/image/platform;
- runtime state and exit code;
- OOM/restart/state-error evidence;
- restart policy;
- entrypoint/command;
- environment **names only**, never environment values;
- healthcheck definition/status/failing streak;
- bounded recent health output;
- point-in-time stats when available;
- deterministic rule findings;
- bounded recent application logs when enabled in AI Provider settings.

## Privacy

Before sending evidence, Electron Main performs best-effort redaction for:

- Bearer tokens;
- API keys/tokens/secrets/passwords;
- credential-bearing URLs;
- common cloud/GitHub/NPM/Docker credential variables;
- private keys.

Health-check output and container logs are treated as untrusted data and are never treated as instructions.

The AI response and prompt are not persisted.

## AI result

The UI displays:

- confidence;
- provider model;
- rule findings used;
- log characters sent;
- AI summary;
- health assessment;
- reasons AI analysis was offered;
- evidence-backed potential root causes;
- prioritized safe actions.

The local deterministic Advisor findings remain visible below the AI result.

## Safety constraints

The system prompt instructs the model to:

- use only supplied evidence;
- distinguish an intentional stop from a failure when evidence is ambiguous;
- lower confidence instead of inventing a cause;
- not treat missing healthcheck configuration as a health failure;
- explain missing evidence when health is unavailable;
- prioritize reversible diagnostic actions;
- never recommend disabling TLS, authentication, healthchecks, least privilege, or other security controls merely to make a workload run.

## Acceptance criteria

- [x] AI analysis is available for stopped/failed container evidence.
- [x] AI analysis is available for unhealthy health status.
- [x] AI analysis is available when a configured healthcheck is unknown/unavailable.
- [x] Missing healthcheck alone is not treated as failure.
- [x] Existing OpenAI-compatible Settings are reused.
- [x] User action is explicit.
- [x] Main re-fetches Docker evidence.
- [x] Renderer cannot provide arbitrary prompt/log text.
- [x] Logs and health output are redacted and bounded.
- [x] Environment values are not sent; only variable names are included.
- [x] Local rule findings remain available without AI.
