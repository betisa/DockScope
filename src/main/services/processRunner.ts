import { spawn } from 'node:child_process'
import type { CommandResult } from '../../shared/contracts'

export function resolveCommand(command: string, args: string[]) {
  const mockScript = process.env.DSM_DOCKER_MOCK_SCRIPT
  if (command === 'docker' && mockScript) {
    return { command: process.execPath, args: [mockScript, ...args] }
  }

  const configuredDocker = process.env.DSM_DOCKER_CLI
  if (command === 'docker' && configuredDocker && configuredDocker !== 'docker') {
    command = configuredDocker
  }
  return { command, args }
}

export function run(
  command: string,
  args: string[] = [],
  timeoutMs = Number(process.env.DSM_COMMAND_TIMEOUT_MS) || 120_000
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const resolved = resolveCommand(command, args)
    const child = spawn(resolved.command, resolved.args, {
      windowsHide: true,
      shell: false
    })

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (!settled) {
        child.kill()
        settled = true
        resolve({
          exitCode: -2,
          stdout,
          stderr: `${stderr}\nCommand timed out after ${timeoutMs}ms`.trim(),
          ok: false
        })
      }
    }, timeoutMs)

    child.stdout?.on('data', (d) => (stdout += d.toString()))
    child.stderr?.on('data', (d) => (stderr += d.toString()))

    child.on('error', (error) => {
      clearTimeout(timer)
      if (settled) return
      settled = true
      resolve({ exitCode: -1, stdout, stderr: error.message, ok: false })
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (settled) return
      settled = true
      const exitCode = code ?? -1
      resolve({ exitCode, stdout, stderr, ok: exitCode === 0 })
    })
  })
}
