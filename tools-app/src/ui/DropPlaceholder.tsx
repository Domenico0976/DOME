import { cn } from '../lib/utils'

export function DropPlaceholder({ active }: { active: boolean }) {
  return (
    <div
      role="separator"
      aria-label="Drop position"
      aria-hidden={!active}
      data-testid="drop-placeholder"
      data-active={active ? 'true' : 'false'}
      className={cn(
        'shrink-0 overflow-hidden rounded-md border border-dashed border-primary/60 bg-primary/10',
        'transition-all ease-out',
        active ? 'my-1 h-10 opacity-100' : 'h-0 border-transparent opacity-0',
      )}
      style={{ transitionDuration: 'var(--motion-fast, 120ms)' }}
    />
  )
}
