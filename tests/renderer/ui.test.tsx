// @vitest-environment jsdom
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState, ConfirmButton } from '../../src/renderer/src/components/ui'

describe('shared renderer UI', () => {
  it('renders accessible empty-state messaging', () => {
    render(<EmptyState title="No containers" text="Docker returned no containers." />)
    expect(screen.getByText('No containers')).toBeInTheDocument()
    expect(screen.getByText('Docker returned no containers.')).toBeInTheDocument()
  })

  it('does not execute a destructive callback when confirmation is rejected', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const onConfirm = vi.fn()
    render(<ConfirmButton danger message="Delete?" onConfirm={onConfirm}>Remove</ConfirmButton>)
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('executes after explicit confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onConfirm = vi.fn()
    render(<ConfirmButton danger message="Delete?" onConfirm={onConfirm}>Remove</ConfirmButton>)
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
