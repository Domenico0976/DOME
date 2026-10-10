import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '../lib/utils'
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react'

export type ToastKind = 'info' | 'success' | 'warning' | 'error'

export interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastEntry {
  id: string
  message: string
  kind: ToastKind
  timeoutMs: number | null
  actions?: ToastAction[]
}

interface ToastContextValue {
  toast: (
    message: string,
    opts?: { kind?: ToastKind; timeoutMs?: number | null; actions?: ToastAction[] },
  ) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let toastCounter = 0

const noopToast: ToastContextValue = { toast: () => {} }

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) return noopToast
  return ctx
}

const ICONS: Record<ToastKind, ReactNode> = {
  info: <Info className="h-4 w-4" />,
  success: <CheckCircle className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  error: <AlertCircle className="h-4 w-4" />,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toast = useCallback(
    (
      message: string,
      opts?: { kind?: ToastKind; timeoutMs?: number | null; actions?: ToastAction[] },
    ) => {
      const id = `t_${++toastCounter}_${Date.now().toString(36)}`
      const kind = opts?.kind ?? 'info'
      // Errors persist (manual dismiss + action buttons). Everything else auto-dismisses at 4s.
      const timeoutMs = opts?.timeoutMs ?? (kind === 'error' ? null : 4000)
      setToasts((prev) => [...prev, { id, message, kind, timeoutMs, actions: opts?.actions }].slice(-3))
      if (timeoutMs && timeoutMs > 0) {
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id))
        }, timeoutMs)
      }
    },
    [],
  )

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[320px] max-w-[calc(100vw-2rem)] pointer-events-none"
        role="status"
        aria-live="polite"
        aria-relevant="additions"
        data-testid="toast-viewport"
      >
        {toasts.map((t) => {
          const isError = t.kind === 'error'
          const ring = isError ? 'border-destructive/40' : 'border-border'
          const bg = isError ? 'bg-destructive/10' : 'bg-surface'
          const iconColor = isError ? 'text-destructive' : 'text-primary'
          return (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 shadow-xl backdrop-blur-sm',
                ring,
                bg,
                reduceMotion ? '' : 'animate-in slide-in-from-right-2',
              )}
              role={isError ? 'alert' : 'status'}
              data-testid={`toast-${t.kind}`}
            >
              <span className={cn('mt-0.5 shrink-0', iconColor)}>{ICONS[t.kind]}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-[13px] leading-tight text-foreground">{t.message}</span>
                {t.actions && t.actions.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {t.actions.map((a, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={a.onClick}
                        className="text-[12px] font-medium text-primary hover:underline"
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="shrink-0 grid place-items-center h-6 w-6 rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}