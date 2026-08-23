import { useEffect, useMemo, useState } from 'react'
import type { AiProviderSettings, AppSettings, SettingsProfile } from '../../../shared/contracts'
import { Badge, EmptyState, Switch } from '../components/ui'
import { PageTitle } from '../components/PageTitle'
import { AppIcon } from '../components/Icon'
import {
  Alert02Icon,
  CleanIcon,
  ContainerIcon,
  Database01Icon,
  HardDriveIcon,
  Home01Icon,
  Layers01Icon,
  Notification03Icon,
  Settings01Icon
} from '@hugeicons/core-free-icons'

type Section =
  | 'general' | 'docker' | 'monitoring' | 'cleanup'
  | 'terminal' | 'notifications' | 'storage' | 'ai' | 'security'

const sections: Array<{id:Section;label:string;icon:any}> = [
  {id:'general',label:'General',icon:Home01Icon},
  {id:'docker',label:'Docker',icon:ContainerIcon},
  {id:'monitoring',label:'Monitoring',icon:Alert02Icon},
  {id:'cleanup',label:'Cleanup',icon:CleanIcon},
  {id:'terminal',label:'Terminal & Logs',icon:Layers01Icon},
  {id:'notifications',label:'Notifications',icon:Notification03Icon},
  {id:'storage',label:'Storage',icon:HardDriveIcon},
  {id:'ai',label:'AI Provider',icon:Settings01Icon},
  {id:'security',label:'Security',icon:Database01Icon}
]

export function SettingsPage({ onThemeChange }: { onThemeChange: (theme:'system'|'dark'|'light') => void }) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [profiles, setProfiles] = useState<SettingsProfile[]>([])
  const [aiSettings, setAiSettings] = useState<AiProviderSettings | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [clearApiKey, setClearApiKey] = useState(false)
  const [aiTestState, setAiTestState] = useState<'idle'|'testing'|'success'|'error'>('idle')
  const [aiTestMessage, setAiTestMessage] = useState('')
  const [section, setSection] = useState<Section>('general')
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')

  const load = async () => {
    const [s,p,ai] = await Promise.all([
      window.dockerApi.settings.get(),
      window.dockerApi.settings.profiles(),
      window.dockerApi.ai.settings()
    ])
    setSettings(s)
    setProfiles(p)
    setAiSettings(ai)
    setApiKeyInput('')
    setClearApiKey(false)
    setAiTestState('idle')
    setAiTestMessage('')
    setDirty(false)
  }

  useEffect(() => { load() }, [])

  const activeProfile = useMemo(
    () => profiles.find(p => p.id === settings?.profileId),
    [profiles, settings]
  )

  if (!settings || !aiSettings) return <EmptyState title="Loading settings" text="Reading application and AI provider configuration…" />

  const mutate = (fn:(draft:AppSettings)=>void) => {
    const next = structuredClone(settings)
    fn(next)
    next.profileId = 'custom'
    setSettings(next)
    setDirty(true)
  }

  const mutateAi = (fn:(draft:AiProviderSettings)=>void) => {
    const next = structuredClone(aiSettings)
    fn(next)
    setAiSettings(next)
    setDirty(true)
    setAiTestState('idle')
    setAiTestMessage('')
  }

  const aiUpdatePayload = () => ({
    enabled: aiSettings.enabled,
    baseUrl: aiSettings.baseUrl,
    model: aiSettings.model,
    temperature: aiSettings.temperature,
    maxOutputTokens: aiSettings.maxOutputTokens,
    timeoutSeconds: aiSettings.timeoutSeconds,
    includeBuildLogs: aiSettings.includeBuildLogs,
    maxLogChars: aiSettings.maxLogChars,
    ...(apiKeyInput.trim() ? { apiKey:apiKeyInput.trim() } : {}),
    clearApiKey
  })

  const save = async () => {
    const [saved, savedAi] = await Promise.all([
      window.dockerApi.settings.save(settings),
      window.dockerApi.ai.saveSettings(aiUpdatePayload())
    ])
    setSettings(saved)
    setAiSettings(savedAi)
    setApiKeyInput('')
    setClearApiKey(false)
    setDirty(false)
    onThemeChange(saved.general.theme)
    setMessage('Settings saved and applied.')
  }

  const testAiConnection = async () => {
    setAiTestState('testing')
    setAiTestMessage('')
    try {
      const result = await window.dockerApi.ai.testConnection(aiUpdatePayload())
      setAiTestState(result.ok ? 'success' : 'error')
      setAiTestMessage(`${result.message} Model: ${result.model}. ${result.latencyMs} ms.`)
    } catch (value) {
      setAiTestState('error')
      setAiTestMessage(value instanceof Error ? value.message : String(value))
    }
  }

  const applyProfile = async (id: SettingsProfile['id']) => {
    if (dirty && !window.confirm('Discard unsaved changes and apply this profile?')) return
    const saved = await window.dockerApi.settings.applyProfile(id)
    setSettings(saved)
    setDirty(false)
    onThemeChange(saved.general.theme)
    setMessage(`${profiles.find(p=>p.id===id)?.name ?? id} profile applied.`)
  }

  return (
    <div className="page">
      <div className="page-heading">
        <PageTitle page="settings" title="Settings & Profiles" subtitle="Central policy for Docker, monitoring, cleanup, terminal, notifications, storage, AI and security." />
        <div className="inline-actions">
          {dirty && <Badge tone="warn">Unsaved</Badge>}
          <button className="button secondary" onClick={load}>Reload</button>
          <button className="button primary" disabled={!dirty} onClick={save}>Save & Apply</button>
        </div>
      </div>

      <section className="profile-grid">
        {profiles.map(profile => (
          <button
            key={profile.id}
            className={`card profile-card ${settings.profileId === profile.id ? 'selected-profile' : ''}`}
            onClick={() => applyProfile(profile.id)}
          >
            <div className="section-row">
              <div className="profile-title-row">
                <span className="profile-icon"><AppIcon icon={profileIcon(profile.id)} size={18} /></span>
                <div><div className="eyebrow">Profile</div><h2>{profile.name}</h2></div>
              </div>
              {settings.profileId === profile.id && <Badge tone="ok">Active</Badge>}
            </div>
            <p>{profile.description}</p>
          </button>
        ))}
        <div className={`card profile-card custom-profile ${settings.profileId === 'custom' ? 'selected-profile' : ''}`}>
          <div className="section-row">
            <div className="profile-title-row">
              <span className="profile-icon"><AppIcon icon={Settings01Icon} size={18} /></span>
              <div><div className="eyebrow">Profile</div><h2>Custom</h2></div>
            </div>
            {settings.profileId === 'custom' && <Badge tone="info">Active</Badge>}
          </div>
          <p>Activated automatically when you edit profile values.</p>
        </div>
      </section>

      {message && <div className="success-banner">{message}</div>}

      <div className="settings-workspace">
        <aside className="settings-nav card">
          {sections.map(x => (
            <button key={x.id} className={`settings-nav-item ${section === x.id ? 'active' : ''}`} onClick={() => setSection(x.id)}>
              <span className="settings-nav-icon"><AppIcon icon={x.icon} size={17} /></span>
              <span>{x.label}</span>
            </button>
          ))}
        </aside>

        <section className="card settings-panel">
          {section === 'general' && <>
            <Heading icon={Home01Icon} title="General" text="Desktop startup, tray and appearance behavior." />
            <Select label="Theme" value={settings.general.theme} options={['system','dark','light']} onChange={v=>mutate(s=>s.general.theme=v as any)} />
            <Toggle label="Start with Windows" checked={settings.general.startWithWindows} onChange={v=>mutate(s=>s.general.startWithWindows=v)} />
            <Toggle label="Close window to system tray" checked={settings.general.closeToTray} onChange={v=>mutate(s=>s.general.closeToTray=v)} />
            <Toggle label="Start minimized" checked={settings.general.startMinimized} onChange={v=>mutate(s=>s.general.startMinimized=v)} />
          </>}

          {section === 'docker' && <>
            <Heading icon={ContainerIcon} title="Docker" text="CLI location, Docker Context and command execution timeout." />
            <TextField label="Docker CLI path" value={settings.docker.cliPath} placeholder="docker" onChange={v=>mutate(s=>s.docker.cliPath=v)} />
            <TextField label="Docker Context" value={settings.docker.context} placeholder="desktop-linux (blank = Docker default)" onChange={v=>mutate(s=>s.docker.context=v)} />
            <NumberField label="Command timeout (seconds)" value={settings.docker.commandTimeoutSeconds} min={10} max={3600} onChange={v=>mutate(s=>s.docker.commandTimeoutSeconds=v)} />
            <div className="info-banner">Changing CLI path or context applies to all subsequent Docker and Compose commands after Save.</div>
          </>}

          {section === 'monitoring' && <>
            <Heading icon={Alert02Icon} title="Monitoring" text="Operational Intelligence polling and alert thresholds." />
            <Toggle label="Enable background monitoring" checked={settings.monitoring.enabled} onChange={v=>mutate(s=>s.monitoring.enabled=v)} />
            <NumberField label="Poll interval (seconds)" value={settings.monitoring.pollIntervalSeconds} min={10} max={3600} onChange={v=>mutate(s=>s.monitoring.pollIntervalSeconds=v)} />
            <NumberField label="VHDX warning (GB)" value={settings.monitoring.vhdxWarningGb} min={1} onChange={v=>mutate(s=>s.monitoring.vhdxWarningGb=v)} />
            <NumberField label="Build cache warning (GB)" value={settings.monitoring.buildCacheWarningGb} min={1} onChange={v=>mutate(s=>s.monitoring.buildCacheWarningGb=v)} />
            <Toggle label="Unhealthy container alerts" checked={settings.monitoring.unhealthyAlerts} onChange={v=>mutate(s=>s.monitoring.unhealthyAlerts=v)} />
            <Toggle label="Unexpected exit alerts" checked={settings.monitoring.unexpectedExitAlerts} onChange={v=>mutate(s=>s.monitoring.unexpectedExitAlerts=v)} />
            <Toggle label="Restart-loop alerts" checked={settings.monitoring.restartLoopAlerts} onChange={v=>mutate(s=>s.monitoring.restartLoopAlerts=v)} />
            <Toggle label="Storage alerts" checked={settings.monitoring.storageAlerts} onChange={v=>mutate(s=>s.monitoring.storageAlerts=v)} />
            <Toggle label="Build cache alerts" checked={settings.monitoring.buildCacheAlerts} onChange={v=>mutate(s=>s.monitoring.buildCacheAlerts=v)} />
          </>}

          {section === 'cleanup' && <>
            <Heading icon={CleanIcon} title="Cleanup Policy" text="Defaults only; destructive workflows still require their own confirmation." />
            <Select label="Default cleanup mode" value={settings.cleanup.defaultMode} options={['safe','balanced']} onChange={v=>mutate(s=>s.cleanup.defaultMode=v as any)} />
            <Toggle label="Include unused images in balanced cleanup" checked={settings.cleanup.includeUnusedImages} onChange={v=>mutate(s=>s.cleanup.includeUnusedImages=v)} />
            <NumberField label="Keep Build Cache (GB)" value={settings.cleanup.buildCacheKeepGb} min={0} onChange={v=>mutate(s=>s.cleanup.buildCacheKeepGb=v)} />
            <Toggle label="Require cleanup preview" checked={settings.cleanup.requirePreview} onChange={v=>mutate(s=>s.cleanup.requirePreview=v)} />
            <div className="warning-banner"><strong>Volumes remain protected.</strong> No profile enables automatic volume deletion.</div>
          </>}

          {section === 'terminal' && <>
            <Heading icon={Layers01Icon} title="Terminal & Logs" text="Defaults used by runtime diagnostics workspaces." />
            <Select label="Default shell" value={settings.terminal.defaultShell} options={['auto','bash','sh','pwsh','powershell','cmd']} onChange={v=>mutate(s=>s.terminal.defaultShell=v as any)} />
            <NumberField label="Default log tail" value={settings.terminal.logTailLines} min={50} max={5000} onChange={v=>mutate(s=>s.terminal.logTailLines=v)} />
            <NumberField label="Stats refresh (seconds)" value={settings.terminal.statsRefreshSeconds} min={1} max={30} onChange={v=>mutate(s=>s.terminal.statsRefreshSeconds=v)} />
            <NumberField label="Maximum retained log lines" value={settings.terminal.maxLogLines} min={1000} max={100000} onChange={v=>mutate(s=>s.terminal.maxLogLines=v)} />
          </>}

          {section === 'notifications' && <>
            <Heading icon={Notification03Icon} title="Notifications" text="Native Windows notification policy." />
            <Toggle label="Enable Windows notifications" checked={settings.notifications.nativeNotifications} onChange={v=>mutate(s=>s.notifications.nativeNotifications=v)} />
            <Toggle label="Success notifications" checked={settings.notifications.notifyOnSuccess} onChange={v=>mutate(s=>s.notifications.notifyOnSuccess=v)} />
            <Toggle label="Warning notifications" checked={settings.notifications.notifyOnWarning} onChange={v=>mutate(s=>s.notifications.notifyOnWarning=v)} />
            <Toggle label="Critical notifications" checked={settings.notifications.notifyOnCritical} onChange={v=>mutate(s=>s.notifications.notifyOnCritical=v)} />
          </>}

          {section === 'storage' && <>
            <Heading icon={HardDriveIcon} title="Storage" text="Docker disk image preferences and compaction policy." />
            <TextField label="Custom Docker VHDX path" value={settings.storage.customVhdxPath} placeholder="C:\\...\\docker_data.vhdx" onChange={v=>mutate(s=>s.storage.customVhdxPath=v)} />
            <Toggle label="Compact after cleanup by default" checked={settings.storage.compactAfterCleanup} onChange={v=>mutate(s=>s.storage.compactAfterCleanup=v)} />
            <Toggle label="Warn before shutting down WSL" checked={settings.storage.warnBeforeWslShutdown} onChange={v=>mutate(s=>s.storage.warnBeforeWslShutdown=v)} />
          </>}

          {section === 'ai' && <>
            <Heading icon={Settings01Icon} title="AI Provider" text="OpenAI-compatible provider used only when you explicitly request AI diagnostics for BuildKit errors or container runtime/health failures." />
            <Toggle label="Enable AI Diagnostics" checked={aiSettings.enabled} onChange={v=>mutateAi(s=>s.enabled=v)} />
            <TextField
              label="Base URL"
              value={aiSettings.baseUrl}
              placeholder="http://127.0.0.1:11434/v1 or https://api.example.com/v1"
              onChange={v=>mutateAi(s=>s.baseUrl=v)}
            />
            <TextField
              label="Model"
              value={aiSettings.model}
              placeholder="gpt-4.1-mini, qwen2.5-coder, llama3.1, ..."
              onChange={v=>mutateAi(s=>s.model=v)}
            />
            <SecretField
              label="API key"
              value={apiKeyInput}
              placeholder={aiSettings.apiKeyConfigured && !clearApiKey ? 'Configured — enter a new key to replace it' : 'Optional for local providers'}
              configured={aiSettings.apiKeyConfigured && !clearApiKey}
              onChange={value => {
                setApiKeyInput(value)
                if (value) setClearApiKey(false)
                setDirty(true)
                setAiTestState('idle')
              }}
            />
            <div className="setting-row">
              <strong>Stored API key</strong>
              <div className="inline-actions">
                <Badge tone={aiSettings.apiKeyConfigured && !clearApiKey ? 'ok' : 'neutral'}>
                  {aiSettings.apiKeyConfigured && !clearApiKey ? 'Encrypted & configured' : 'Not configured'}
                </Badge>
                {aiSettings.apiKeyConfigured && !clearApiKey && (
                  <button className="button danger" onClick={() => {
                    setClearApiKey(true)
                    setApiKeyInput('')
                    setDirty(true)
                    setAiTestState('idle')
                  }}>
                    Clear saved key
                  </button>
                )}
              </div>
            </div>
            <NumberField label="Temperature" value={aiSettings.temperature} min={0} max={2} step={0.1} onChange={v=>mutateAi(s=>s.temperature=v)} />
            <NumberField label="Max output tokens" value={aiSettings.maxOutputTokens} min={128} max={8192} onChange={v=>mutateAi(s=>s.maxOutputTokens=v)} />
            <NumberField label="Request timeout (seconds)" value={aiSettings.timeoutSeconds} min={5} max={300} onChange={v=>mutateAi(s=>s.timeoutSeconds=v)} />
            <Toggle label="Include bounded diagnostics logs in AI request" checked={aiSettings.includeBuildLogs} onChange={v=>mutateAi(s=>s.includeBuildLogs=v)} />
            <NumberField label="Maximum log characters sent" value={aiSettings.maxLogChars} min={1000} max={100000} onChange={v=>mutateAi(s=>s.maxLogChars=v)} />

            <div className="ai-settings-actions">
              <button className="button secondary" disabled={aiTestState === 'testing'} onClick={() => void testAiConnection()}>
                {aiTestState === 'testing' ? 'Testing…' : 'Test connection'}
              </button>
              {aiTestMessage && (
                <span className={aiTestState === 'success' ? 'ai-test-success' : 'ai-test-error'}>{aiTestMessage}</span>
              )}
            </div>

            <div className="info-banner">
              Compatible endpoint: <code>POST &lt;baseUrl&gt;/chat/completions</code>. Local HTTP is allowed only for localhost/loopback; remote providers must use HTTPS.
            </div>
            <div className="warning-banner">
              <strong>Privacy boundary:</strong> AI requests are never automatic. Build/container evidence is redacted in Electron Main and logs are bounded before being sent. The API key is encrypted with Electron safeStorage and the encrypted value is persisted in SQLite.
            </div>
          </>}

          {section === 'security' && <>
            <Heading icon={Database01Icon} title="Security" text="Safety controls for secrets, critical actions and recovery history." />
            <Toggle label="Mask secret-like environment values" checked={settings.security.maskSecrets} onChange={v=>mutate(s=>s.security.maskSecrets=v)} />
            <Toggle label="Require typed confirmation for critical actions" checked={settings.security.requireTypedConfirmationForCritical} onChange={v=>mutate(s=>s.security.requireTypedConfirmationForCritical=v)} />
            <Toggle label="Allow Force Remove actions" checked={settings.security.allowForceRemove} onChange={v=>mutate(s=>s.security.allowForceRemove=v)} />
            <NumberField label="Audit retention entries" value={settings.security.auditRetention} min={100} max={10000} onChange={v=>mutate(s=>s.security.auditRetention=v)} />
            <NumberField label="Recovery snapshot retention" value={settings.security.recoverySnapshotRetention} min={100} max={5000} onChange={v=>mutate(s=>s.security.recoverySnapshotRetention=v)} />
          </>}

          <div className="settings-footer">
            <button className="button secondary" onClick={async()=>{
              if (!window.confirm('Reset all settings to default Development values?')) return
              const saved = await window.dockerApi.settings.reset()
              setSettings(saved); setDirty(false); onThemeChange(saved.general.theme); setMessage('Default settings restored.')
            }}>Reset defaults</button>
            <button className="button primary" disabled={!dirty} onClick={save}>Save & Apply</button>
          </div>
        </section>
      </div>
    </div>
  )
}

function Heading({icon,title,text}:{icon:any;title:string;text:string}) {
  return <div className="settings-heading">
    <div className="settings-heading-title">
      <span className="settings-section-icon"><AppIcon icon={icon} size={20} /></span>
      <div><div className="eyebrow">Configuration</div><h2>{title}</h2></div>
    </div>
    <p>{text}</p>
  </div>
}

function profileIcon(id: SettingsProfile['id']) {
  if (id === 'development') return Home01Icon
  if (id === 'conservative') return Database01Icon
  if (id === 'ci-build-heavy') return Layers01Icon
  if (id === 'low-disk-space') return HardDriveIcon
  return Settings01Icon
}
function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(v:boolean)=>void}) {
  return <div className="setting-row"><Switch checked={checked} onChange={onChange} label={label} /></div>
}
function TextField({label,value,placeholder,onChange}:{label:string;value:string;placeholder?:string;onChange:(v:string)=>void}) {
  return <label className="setting-row setting-column"><strong>{label}</strong><input className="setting-input" value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} /></label>
}
function NumberField({label,value,min,max,step,onChange}:{label:string;value:number;min?:number;max?:number;step?:number;onChange:(v:number)=>void}) {
  return <label className="setting-row"><strong>{label}</strong><input className="setting-number" type="number" value={value} min={min} max={max} step={step} onChange={e=>onChange(Number(e.target.value))} /></label>
}
function SecretField({label,value,placeholder,configured,onChange}:{label:string;value:string;placeholder?:string;configured:boolean;onChange:(v:string)=>void}) {
  return <label className="setting-row setting-column">
    <strong>{label}{configured ? ' · configured' : ''}</strong>
    <input className="setting-input mono" type="password" autoComplete="new-password" value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} />
  </label>
}
function Select({label,value,options,onChange}:{label:string;value:string;options:string[];onChange:(v:string)=>void}) {
  return <label className="setting-row"><strong>{label}</strong><select className="select" value={value} onChange={e=>onChange(e.target.value)}>{options.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
}
