import { useEffect, useMemo, useState } from 'react'
import Editor, { DiffEditor } from '@monaco-editor/react'
import type { ComposeFileDocument, ComposeProject } from '../../../shared/contracts'
import { CodePanel, EmptyState, InlineAlert, LoadingState } from './ui'

export function ComposeEditorPanel({ project, onRedeployed }: { project: ComposeProject; onRedeployed: () => void }) {
  const [doc, setDoc] = useState<ComposeFileDocument | null>(null)
  const [value, setValue] = useState('')
  const [validation, setValidation] = useState<{ valid: boolean; text: string } | null>(null)
  const [mode, setMode] = useState<'edit' | 'diff'>('edit')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const dirty = Boolean(doc && value !== doc.content)

  const load = async () => {
    setLoading(true)
    setLoadError('')
    setOutput('')
    try {
      const x = await window.dockerApi.compose.readFile(project)
      if (!x || typeof x.path !== 'string' || typeof x.content !== 'string') {
        throw new Error('Compose file endpoint returned an invalid document.')
      }
      setDoc(x)
      setValue(x.content)
      setValidation(null)
      setMode('edit')
    } catch (error) {
      setDoc(null)
      setValue('')
      setValidation(null)
      setLoadError(error instanceof Error ? error.message : String(error))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [project.name, project.configFiles])

  const validate = async () => {
    if (!doc) return false
    setBusy(true)
    try {
      const r = await window.dockerApi.compose.configValidate(project, value, doc.path)
      setValidation({
        valid: r.valid,
        text: r.valid ? 'Compose configuration is valid.' : (r.stderr || r.stdout || 'Validation failed.')
      })
      return r.valid
    } catch (error) {
      setValidation({ valid:false, text:error instanceof Error ? error.message : String(error) })
      return false
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!doc || !dirty) return
    if (!(await validate())) return
    if (!window.confirm('Save the validated Compose file? A .dsm.bak backup will be created.')) return

    setBusy(true)
    try {
      const r = await window.dockerApi.compose.saveFile(project, doc.path, value, doc.content)
      setOutput(r.stdout || r.stderr || (r.ok ? 'Compose file saved.' : 'Compose save failed.'))
      if (r.ok) await load()
    } catch (error) {
      setOutput(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const redeploy = async () => {
    if (dirty && !window.confirm('There are unsaved changes. Redeploy using the configuration currently on disk?')) return

    setBusy(true)
    try {
      const r = await window.dockerApi.compose.up(project, false)
      setOutput(r.stdout || r.stderr || 'Redeploy completed.')
      if (r.ok) onRedeployed()
    } catch (error) {
      setOutput(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'vs-dark'
  const configuredFiles = useMemo(
    () => project.configFiles.split(',').map(item => item.trim()).filter(Boolean),
    [project.configFiles]
  )

  if (loading) {
    return (
      <section className="card compose-editor-loading">
        <LoadingState label="Loading Compose source file" rows={9} />
      </section>
    )
  }

  if (loadError) {
    return (
      <div className="compose-editor-workspace">
        <InlineAlert tone="danger" title="Compose source file could not be opened">
          {loadError}
        </InlineAlert>

        <section className="card compose-editor-load-error">
          <div className="section-row">
            <div>
              <div className="eyebrow">Compose source</div>
              <h3>Editor unavailable</h3>
              <p className="muted">
                Docker can manage this project even when its source Compose file is no longer accessible to DockScope.
              </p>
            </div>
            <button className="button primary" onClick={() => void load()}>Retry</button>
          </div>

          <div className="compose-editor-error-details">
            <span>Project</span>
            <strong>{project.name}</strong>
            <span>Docker reported config files</span>
            <div>
              {configuredFiles.length
                ? configuredFiles.map(file => <code className="wrap" key={file}>{file}</code>)
                : <code>No configuration file reported</code>}
            </div>
          </div>

          <EmptyState
            title="Why can this happen?"
            text="The project may have been started from WSL, another host path, a deleted/renamed Compose file, or a path that the Electron process cannot read. Other Compose tabs remain usable because Docker itself still knows the project."
          />
        </section>
      </div>
    )
  }

  if (!doc) {
    return (
      <EmptyState
        title="No Compose source document"
        text="No editable Compose source file was returned. Retry the editor or use the resolved Overview/Services/Topology tabs."
      />
    )
  }

  return (
    <div className="compose-editor-workspace">
      <div className="runtime-toolbar compose-editor-toolbar">
        <strong className="mono wrap">{doc.path}</strong>
        <span className={dirty ? 'editor-dirty' : 'muted'}>{dirty ? '● Modified' : 'Saved'}</span>
        <button
          className="button secondary"
          onClick={() => setMode(mode === 'edit' ? 'diff' : 'edit')}
          disabled={busy}
        >
          {mode === 'edit' ? 'Preview diff' : 'Back to editor'}
        </button>
        <button className="button secondary" onClick={() => void validate()} disabled={busy}>Validate</button>
        <button className="button primary" onClick={() => void save()} disabled={!dirty || busy}>Validate & save</button>
        <button className="button secondary" onClick={() => void load()} disabled={busy}>Reload</button>
        <button className="button secondary" onClick={() => void redeploy()} disabled={busy}>Redeploy</button>
      </div>

      {validation && (
        <div className={validation.valid ? 'validation-ok' : 'validation-error'}>
          {validation.text}
        </div>
      )}

      <div className="monaco-shell">
        {mode === 'edit' ? (
          <Editor
            height="580px"
            language="yaml"
            theme={theme}
            value={value}
            onChange={(x) => setValue(x ?? '')}
            options={{
              minimap:{ enabled:false },
              fontSize:13,
              wordWrap:'on',
              automaticLayout:true,
              scrollBeyondLastLine:false
            }}
          />
        ) : (
          <DiffEditor
            height="580px"
            language="yaml"
            theme={theme}
            original={doc.content}
            modified={value}
            options={{
              minimap:{ enabled:false },
              fontSize:13,
              wordWrap:'on',
              automaticLayout:true,
              readOnly:true
            }}
          />
        )}
      </div>

      {output && <CodePanel title="Compose editor operation" value={output} />}
    </div>
  )
}
