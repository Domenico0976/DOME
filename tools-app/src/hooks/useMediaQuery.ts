import { useEffect, useState } from 'react'

export const MOBILE_QUERY = '(max-width: 900px)'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const list = window.matchMedia(query)
    const update = (): void => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])

  return matches
}

export function useIsMobileViewport(): boolean {
  return useMediaQuery(MOBILE_QUERY)
}
