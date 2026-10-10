import * as React from 'react'
import { cn } from '../../lib/utils'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title?: string
  description?: string
  action?: React.ReactNode
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, className, children, ...props }, ref) => {
    const hasChildren = children != null && (!Array.isArray(children) || children.length > 0)

    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center text-center gap-[var(--empty-state-gap,12px)] p-[var(--empty-state-padding,32px)]',
          className,
        )}
        {...props}
      >
        {icon && (
          <div
            className="flex items-center justify-center w-[var(--empty-state-icon-size,32px)] h-[var(--empty-state-icon-size,32px)] text-muted-foreground"
            aria-hidden
          >
            {icon}
          </div>
        )}
        {title && (
          <h3 className="text-[var(--empty-state-title-size,16px)] font-[var(--empty-state-title-weight,600)] text-foreground">
            {title}
          </h3>
        )}
        {description && (
          <p className="text-[var(--empty-state-description-size,13px)] leading-relaxed text-muted-foreground max-w-sm">
            {description}
          </p>
        )}
        {action && <div className="flex items-center gap-2 mt-1">{action}</div>}
        {hasChildren && children}
      </div>
    )
  },
)
EmptyState.displayName = 'EmptyState'

export { EmptyState }