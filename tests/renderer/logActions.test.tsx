// @vitest-environment jsdom
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ColoredLogConsole } from '../../src/renderer/src/components/ColoredLogConsole'
import { LogActions } from '../../src/renderer/src/components/LogActions'

describe('log actions', () => {
  const writeText = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    writeText.mockClear()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })
  })

  it('copies all logs from the toolbar', async () => {
    render(<LogActions value={'first line\nsecond line'} fileName="container-api-logs.log" />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy all' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('first line\nsecond line'))
    expect(screen.getByRole('status')).toHaveTextContent('Copied')
  })

  it('offers copy selection, copy all and export from the context menu', async () => {
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'second line' } as Selection)
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:logs')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    render(<ColoredLogConsole value={'first line\nsecond line'} emptyText="No logs" ariaLabel="Logs" exportFileName="logs.txt" />)
    fireEvent.contextMenu(screen.getByRole('log'), { clientX: 40, clientY: 50 })

    expect(screen.getByRole('menuitem', { name: 'Copy selection' })).toBeEnabled()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy selection' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('second line'))

    fireEvent.contextMenu(screen.getByRole('log'), { clientX: 40, clientY: 50 })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export logs' }))
    expect(createObjectURL).toHaveBeenCalled()
    expect(anchorClick).toHaveBeenCalled()
  })
})
