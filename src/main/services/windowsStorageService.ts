import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { run } from './processRunner'
import type { VhdxInfo } from '../../shared/contracts'

function human(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(i >= 3 ? 2 : 1)} ${units[i]}`
}

async function driveFree(filePath: string): Promise<string> {
  const drive = path.parse(filePath).root.replace(/\\$/, '')
  const ps = await run('powershell.exe', [
    '-NoProfile',
    '-Command',
    `(Get-PSDrive -Name '${drive[0]}').Free`
  ])
  const bytes = Number(ps.stdout.trim())
  return Number.isFinite(bytes) ? human(bytes) : 'Unknown'
}

export const windowsStorageService = {
  async findVhdx(): Promise<VhdxInfo[]> {
    const local = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local')
    const configured = String(process.env.DSM_CUSTOM_VHDX_PATH ?? '').trim()
    const candidates = [
      ...(configured ? [configured] : []),
      path.join(local, 'Docker', 'wsl', 'data', 'docker_data.vhdx'),
      path.join(local, 'Docker', 'wsl', 'disk', 'docker_data.vhdx'),
      path.join(local, 'Docker', 'wsl', 'data', 'ext4.vhdx')
    ]

    const found: VhdxInfo[] = []
    for (const candidate of [...new Set(candidates)]) {
      try {
        const stat = await fs.stat(candidate)
        found.push({
          path: candidate,
          bytes: stat.size,
          size: human(stat.size),
          driveFree: await driveFree(candidate)
        })
      } catch {
        // Not present on this Docker Desktop installation.
      }
    }
    return found
  },

  async compactVhdx(vhdxPath: string) {
    const normalized = path.resolve(vhdxPath)
    if (!normalized.toLowerCase().endsWith('.vhdx')) {
      return { exitCode: -1, stdout: '', stderr: 'Only .vhdx files are accepted.', ok: false }
    }

    await run('docker', ['desktop', 'stop'], 60_000)
    await run('wsl.exe', ['--shutdown'], 60_000)

    const optimize = await run('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-Command',
      `if (Get-Command Optimize-VHD -ErrorAction SilentlyContinue) { Optimize-VHD -Path '${normalized.replaceAll("'", "''")}' -Mode Full; exit 0 } else { exit 7 }`
    ], 20 * 60_000)

    if (optimize.ok) return optimize

    const scriptPath = path.join(os.tmpdir(), `dsm-${Date.now()}.txt`)
    await fs.writeFile(
      scriptPath,
      `select vdisk file="${normalized}"\r\ncompact vdisk\r\nexit\r\n`,
      'utf8'
    )

    const fallback = await run('diskpart.exe', ['/s', scriptPath], 20 * 60_000)
    await fs.unlink(scriptPath).catch(() => undefined)
    return fallback
  }
}
