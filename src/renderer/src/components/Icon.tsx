import type { ComponentProps } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'

type HugeiconsProps = ComponentProps<typeof HugeiconsIcon>

type Props = Omit<HugeiconsProps, 'icon'> & {
  icon: HugeiconsProps['icon']
  label?: string
  decorative?: boolean
}

export function AppIcon({
  icon,
  label,
  decorative = !label,
  size = 18,
  strokeWidth = 1.8,
  color = 'currentColor',
  ...rest
}: Props) {
  return (
    <span
      className="icon-shell"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
    >
      <HugeiconsIcon
        icon={icon}
        size={size}
        color={color}
        strokeWidth={strokeWidth}
        aria-hidden="true"
        focusable={false}
        {...rest}
      />
    </span>
  )
}
