import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { loadContentBundle } from './contentRepository'
import type { ContentBundle } from '../types/content'

interface ContentState {
  content: ContentBundle | null
  loading: boolean
  error: string | null
}

const ContentContext = createContext<ContentState>({
  content: null,
  loading: true,
  error: null,
})

export function ContentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ContentState>({
    content: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    let active = true
    loadContentBundle()
      .then((content) => {
        if (active) setState({ content, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            content: null,
            loading: false,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })
    return () => {
      active = false
    }
  }, [])

  return <ContentContext.Provider value={state}>{children}</ContentContext.Provider>
}

export function useContent() {
  return useContext(ContentContext)
}
