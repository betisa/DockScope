# M11 — Settings, Profiles & Advanced Configuration

## Objective
Centralize behavior that had previously been spread across Runtime, Monitoring, Cleanup, Storage and UI surfaces.

## Delivered
- Persistent application settings in Electron Main
- Typed Settings IPC
- Settings workspace with eight categories
- Development profile
- Conservative profile
- CI / Build Heavy profile
- Low Disk Space profile
- Automatic Custom profile after edits
- Theme: System / Dark / Light
- Windows startup policy
- Close-to-tray / start-minimized preferences
- Docker CLI path
- Docker Context
- Docker command timeout
- Operational Intelligence synchronization
- Cleanup defaults
- Build-cache keep-storage preference
- Terminal/log defaults
- Native notification policy
- Custom VHDX path preference
- Security and retention policy
- Reset-to-default flow

## Runtime application
Saving settings updates:
- `DSM_DOCKER_CLI`
- `DOCKER_CONTEXT`
- `DSM_COMMAND_TIMEOUT_MS`
- Windows login-item preference when packaged
- Operational Intelligence monitoring policy

## Profiles

### Development
Balanced local-development defaults.

### Conservative
Slower monitoring, larger cache retention, Force Remove disabled.

### CI / Build Heavy
Higher build-cache thresholds and larger cache/log retention.

### Low Disk Space
Lower storage thresholds and Balanced Cleanup defaults, while volumes remain excluded from automation.

### Custom
Automatically selected after the user modifies any profile value.

## Safety properties
No profile can:
- automatically delete volumes
- automatically execute VHDX compaction
- bypass typed confirmation for critical operations without an explicit Custom change
- expose Node or filesystem APIs to the Renderer
