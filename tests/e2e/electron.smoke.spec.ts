import path from 'node:path'
import { test, expect, _electron as electron } from '@playwright/test'

test('desktop shell opens and renders dashboard with mocked Docker data', async () => {
  const app = await electron.launch({
    args: [path.resolve('out/main/index.js')],
    env: {
      ...process.env,
      DSM_DOCKER_MOCK_SCRIPT: path.resolve('tests/mock/docker-cli.mjs'),
      DSM_MOCK_SCENARIO: 'success',
      NODE_ENV: 'test'
    }
  })

  try {
    const window = await app.firstWindow()
    await expect(window).toHaveTitle(/DockScope/)
    await expect(window.getByText('Docker workstation overview')).toBeVisible()
    await expect(window.getByText(/Docker Engine Running/i)).toBeVisible()
  } finally {
    await app.close()
  }
})

test('renderer starts when Docker daemon is unavailable', async () => {
  const app = await electron.launch({
    args: [path.resolve('out/main/index.js')],
    env: {
      ...process.env,
      DSM_DOCKER_MOCK_SCRIPT: path.resolve('tests/mock/docker-cli.mjs'),
      DSM_MOCK_SCENARIO: 'daemon-down',
      NODE_ENV: 'test'
    }
  })

  try {
    const window = await app.firstWindow()
    await expect(window.getByText('Docker workstation overview')).toBeVisible()
    await expect(window.getByText(/Unavailable/i).first()).toBeVisible()
  } finally {
    await app.close()
  }
})


test('command palette is keyboard accessible and restores focus', async () => {
  const app = await electron.launch({
    args: [path.resolve('out/main/index.js')],
    env: {
      ...process.env,
      DSM_DOCKER_MOCK_SCRIPT: path.resolve('tests/mock/docker-cli.mjs'),
      DSM_MOCK_SCENARIO: 'success',
      NODE_ENV: 'test'
    }
  })

  try {
    const window = await app.firstWindow()
    const trigger = window.getByRole('button', { name: 'Open global command palette' })
    await trigger.focus()
    await window.keyboard.press('Control+K')

    const dialog = window.getByRole('dialog', { name: 'Command palette' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByPlaceholder('Search resources or type an action…')).toBeFocused()

    await window.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  } finally {
    await app.close()
  }
})

test('skip link and primary navigation are exposed to keyboard users', async () => {
  const app = await electron.launch({
    args: [path.resolve('out/main/index.js')],
    env: {
      ...process.env,
      DSM_DOCKER_MOCK_SCRIPT: path.resolve('tests/mock/docker-cli.mjs'),
      DSM_MOCK_SCENARIO: 'success',
      NODE_ENV: 'test'
    }
  })

  try {
    const window = await app.firstWindow()
    await expect(window.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible()
    const skip = window.getByRole('link', { name: 'Skip to main content' })
    await expect(skip).toHaveAttribute('href', '#main-content')
  } finally {
    await app.close()
  }
})


test('dashboard renders live Docker charts from mocked Docker data', async () => {
  const app = await electron.launch({
    args: [path.resolve('out/main/index.js')],
    env: {
      ...process.env,
      DSM_DOCKER_MOCK_SCRIPT: path.resolve('tests/mock/docker-cli.mjs'),
      DSM_MOCK_SCENARIO: 'success',
      NODE_ENV: 'test'
    }
  })

  try {
    const window = await app.firstWindow()
    await expect(window.getByRole('img', { name: /Images: .* allocated/i })).toBeVisible()
    await expect(window.getByRole('img', { name: /containers:/i })).toBeVisible()
    await expect(window.getByText('Allocated vs reclaimable')).toBeVisible()
    await expect(window.getByText('Container states')).toBeVisible()
  } finally {
    await app.close()
  }
})
