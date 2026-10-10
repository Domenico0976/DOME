import * as React from 'react'
import { cn } from '../../lib/utils'

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string
  labelId?: string
  helper?: string
  error?: string
  invalid?: boolean
  value?: React.ReactNode
  control?: React.ReactNode
  controlId?: string
  orientation?: 'row' | 'column'
}

const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  (
    {
      label,
      labelId,
      helper,
      error,
      invalid = false,
      value,
      control,
      controlId,
      orientation = 'column',
      className,
      children,
      id,
      ...props
    },
    ref,
  ) => {
    const fieldId = id ?? `field-${React.useId()}`
    const labelTarget = labelId ?? (label ? `${fieldId}-label` : undefined)
    const controlTarget = typeId(controlId, control, fieldId)

    return (
      <div
        id={fieldId}
        ref={ref}
        data-invalid={invalid ? 'true' : undefined}
        className={cn(
          'flex gap-[var(--field-gap,8px)]',
          orientation === 'row' ? 'flex-row items-center' : 'flex-col',
          className,
        )}
        {...props}
      >
        {label && (
          <label
            id={labelTarget}
            className={cn(
              'text-[12px] font-medium text-muted-foreground leading-none',
              orientation === 'row' && 'shrink-0',
            )}
            htmlFor={controlTarget}
          >
            {label}
          </label>
        )}
        <div className="flex items-center gap-[var(--field-gap,8px)] min-w-0">
          {control ?? children}
          {value != null && (
            <span
              className={cn(
                'font-mono text-[12px] tabular-nums text-muted-foreground shrink-0',
              )}
              aria-live="off"
            >
              {value}
            </span>
          )}
        </div>
        {(helper || error) && (
          <p
            className={cn(
              'text-[11px] leading-tight',
              invalid ? 'text-[var(--danger)]' : 'text-muted-foreground',
            )}
            role={invalid ? 'alert' : undefined}
          >
            {invalid ? (error ?? helper) : helper}
          </p>
        )}
      </div>
    )
  },
)
Field.displayName = 'Field'

function typeId(explicit?: string, control?: React.ReactNode, fallback?: string): string | undefined {
  if (explicit) return explicit
  if (control && (control as React.ReactElement).props?.id) {
    return (control as React.ReactElement).props.id as string
  }
  return fallback
}

export { Field }