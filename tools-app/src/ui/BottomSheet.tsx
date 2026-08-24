import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

export type BottomSheetSize = 'small' | 'medium' | 'large'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: BottomSheetSize
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Modal bottom sheet for mobile-first flows. Sits above palette/inspector but
// below the (future) toast layer. Contains no audio logic: it never touches
// AudioContext, so opening/closing it is always gesture-safe.
export function BottomSheet({ isOpen, onClose, title, children, size = 'medium' }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const sheet = sheetRef.current
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    sheet?.focus()

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || sheet === null) return
      const focusable = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      } else if (!sheet.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <>
      <div className="bottom-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={`bottom-sheet bottom-sheet--${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="bottom-sheet-handle" aria-hidden="true" />
        <header className="bottom-sheet-header">
          <span className="bottom-sheet-title">{title}</span>
          <button type="button" className="bottom-sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="bottom-sheet-body">{children}</div>
      </div>
    </>
  )
}
