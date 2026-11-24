import { Download, ExternalLink, Eye, RefreshCw } from 'lucide-react'
import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { contentAssetUrl } from '../content/contentRepository'
import { safeExternalUrl, safeRouteId } from '../security/safeLinks'
import type { ContentLink } from '../types/content'
import { useMaterialAccess } from './MaterialAccessProvider'

export function contentLinkTarget(item: ContentLink) {
  if (item.targetKind === 'page' && item.targetId) {
    const pageAliases: Record<string, string> = {
      'wydzielona-strona-ssi': 'system-stopni-instruktorskich-w-zhp',
      'proces-pracy-z-kadra-2-rozwoj-przez-dzialanie-inf-zwrotna': 'proces-pracy-z-kadra-3-podsumowanie-pracy-rozmowa-inf-zwrotna',
    }
    const id = safeRouteId(pageAliases[item.targetId] ?? item.targetId)
    return id ? `/page/${id}` : ''
  }
  if (item.targetKind === 'module' && item.targetId) {
    const id = safeRouteId(item.targetId)
    return id ? `/module/${id}` : ''
  }
  if (item.targetKind === 'planning') {
    const id = safeRouteId(item.targetId)
    return `/planning${id ? `?analysis=${encodeURIComponent(id)}` : ''}`
  }
  if (item.targetKind === 'dashboard') {
    const id = safeRouteId(item.targetId)
    return `/dashboard${id ? `?tab=${encodeURIComponent(id)}` : ''}`
  }
  if (item.path) return contentAssetUrl(item.path)
  return safeExternalUrl(item.url)
}

function isLocalMaterial(item: ContentLink, target: string) {
  return Boolean(item.path) && Boolean(target)
}

function materialExtension(item: ContentLink, target: string) {
  const fileName = typeof item.fileName === 'string' ? item.fileName : ''
  const source = fileName || item.path || target
  const match = source.split(/[?#]/)[0].match(/\.([a-z0-9]{2,5})$/i)
  return match?.[1].toLocaleUpperCase('en') ?? 'PLIK'
}

function opensInBrowser(extension: string) {
  return ['PDF', 'PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG', 'TXT'].includes(extension)
}

function materialRequest(item: ContentLink, target: string) {
  const path = item.path ?? target.replace(/^\/content\//, '')
  const fileName = typeof item.fileName === 'string' ? item.fileName : ''
  return {
    key: target,
    path,
    target,
    title: item.title?.trim() || fileName.trim() || 'Materiał',
  }
}

function MaterialButton({ item, target, label }: { item: ContentLink; target: string; label: string }) {
  const { openingKey, openMaterial } = useMaterialAccess()
  const request = materialRequest(item, target)
  const opening = openingKey === request.key
  const extension = materialExtension(item, target)
  const viewable = opensInBrowser(extension)
  return (
    <button className="content-link material-link" type="button" disabled={opening} onClick={() => void openMaterial(request)}>
      <span className="content-link-copy">
        <span>{label}</span>
        <small>{viewable ? 'Otwórz' : 'Pobierz'} {extension}</small>
      </span>
      {opening ? <RefreshCw className="spin" aria-hidden="true" /> : viewable ? <Eye aria-hidden="true" /> : <Download aria-hidden="true" />}
    </button>
  )
}

export function ContentLinkButton({ item }: { item: ContentLink }) {
  const target = contentLinkTarget(item)
  if (!target) return null
  const label = item.title?.trim() || 'Otwórz materiał'
  const internal = target.startsWith('/') && !target.startsWith('/content/')

  if (internal) {
    return (
      <Link className="content-link" to={target}>
        <span>{label}</span>
      </Link>
    )
  }
  if (isLocalMaterial(item, target)) return <MaterialButton item={item} target={target} label={label} />
  return (
    <a className="content-link" href={target} target="_blank" rel="noopener noreferrer">
      <span>{label}</span>
      <ExternalLink aria-hidden="true" />
    </a>
  )
}

export function ContentInlineLink({ item, children }: { item: ContentLink; children: ReactNode }) {
  const target = contentLinkTarget(item)
  const { openingKey, openMaterial } = useMaterialAccess()
  if (!target) return <>{children}</>
  if (target.startsWith('/') && !target.startsWith('/content/')) return <Link to={target}>{children}</Link>
  if (isLocalMaterial(item, target)) {
    const request = materialRequest(item, target)
    return (
      <button className="inline-content-link" type="button" disabled={openingKey === request.key} onClick={() => void openMaterial(request)}>
        {children}
      </button>
    )
  }
  return <a href={target} target="_blank" rel="noopener noreferrer">{children}</a>
}

export function ContentAction({ item, children, ariaLabel }: { item: ContentLink; children: ReactNode; ariaLabel: string }) {
  const target = contentLinkTarget(item)
  const { openingKey, openMaterial } = useMaterialAccess()
  if (!target) return <>{children}</>
  if (target.startsWith('/') && !target.startsWith('/content/')) return <Link to={target} aria-label={ariaLabel}>{children}</Link>
  if (isLocalMaterial(item, target)) {
    const request = materialRequest(item, target)
    return (
      <button className="content-image-action" type="button" disabled={openingKey === request.key} onClick={() => void openMaterial(request)} aria-label={ariaLabel}>
        {children}
      </button>
    )
  }
  return <a href={target} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel}>{children}</a>
}
