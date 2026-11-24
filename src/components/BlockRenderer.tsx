import { contentAssetUrl } from '../content/contentRepository'
import type { ContentBlock, ContentLink, ContentTextRun } from '../types/content'
import { ContentAction, ContentInlineLink, ContentLinkButton } from './ContentLink'

function blockLabel(item: string | ContentLink) {
  return typeof item === 'string' ? item : item.title ?? 'Materiał'
}

function RichText({ text = '', runs }: { text?: string, runs?: ContentTextRun[] }) {
  const values = runs?.length ? runs : inferRuns(text)
  return <>{values.map((run, index) => {
    let value = <>{run.text}</>
    if (run.bold) value = <strong>{value}</strong>
    if (run.italic) value = <em>{value}</em>
    if (run.underline) value = <u>{value}</u>
    if (run.link) {
      value = <ContentInlineLink item={run.link}>{value}</ContentInlineLink>
    }
    return <span key={index}>{value}</span>
  })}</>
}

function inferRuns(text: string): ContentTextRun[] {
  const colon = text.indexOf(':')
  if (colon > 0 && colon <= 72) {
    const lead = text.slice(0, colon)
    if (!lead.includes('.') && !lead.includes(';')) {
      return [{ text: text.slice(0, colon + 1), bold: true }, { text: text.slice(colon + 1) }]
    }
  }
  return [{ text }]
}

function InlineListItem({ item }: { item: string | ContentLink }) {
  if (typeof item === 'string') return <>{item}</>
  const label = blockLabel(item)
  return <ContentInlineLink item={item}>{label}</ContentInlineLink>
}

export function BlockRenderer({ blocks }: { blocks?: ContentBlock[] }) {
  if (!blocks?.length) return null
  return (
    <div className="content-blocks">
      {blocks.map((block, index) => (
        <ContentBlockView key={`${block.type}-${index}`} block={block} />
      ))}
    </div>
  )
}

function ContentBlockView({ block }: { block: ContentBlock }) {
  if (block.type === 'heading') {
    const level = Math.min(Math.max(Number(block.level ?? 2), 2), 4)
    if (level === 2) return <h2><RichText text={block.text} runs={block.runs} /></h2>
    if (level === 3) return <h3><RichText text={block.text} runs={block.runs} /></h3>
    return <h4><RichText text={block.text} runs={block.runs} /></h4>
  }
  if (block.type === 'paragraph') {
    const text = block.text?.trim() ?? ''
    const letters = text.replace(/[^a-ząćęłńóśźż]/gi, '')
    const emphasis = text.length > 90 && letters.length > 40 && letters === letters.toLocaleUpperCase('pl')
    return text ? <p className={emphasis ? 'content-callout' : undefined}><RichText text={block.text} runs={block.runs} /></p> : null
  }
  if (block.type === 'list') {
    const items = block.items ?? []
    const ListTag = block.ordered ? 'ol' : 'ul'
    return (
      <ListTag>
        {items.map((item, index) => (
          <li key={`${blockLabel(item)}-${index}`}><InlineListItem item={item} /></li>
        ))}
      </ListTag>
    )
  }
  if (block.type === 'section') {
    return (
      <div className="content-columns">
        {(block.columns ?? []).map((column, index) => (
          <div key={index}>
            <BlockRenderer blocks={column.blocks} />
          </div>
        ))}
      </div>
    )
  }
  if (block.type === 'image' && block.path) {
    const source = contentAssetUrl(block.path)
    if (!source) return null
    const image = (
      <img
        className="content-image"
        src={source}
        alt={block.alt ?? block.caption ?? ''}
        loading="lazy"
        decoding="async"
      />
    )
    return (
      <figure className={`content-figure ${block.action ? 'is-linked' : ''}`}>
        {block.action
          ? <ContentAction item={block.action} ariaLabel={block.action.title ?? block.alt ?? 'Otwórz'}>{image}</ContentAction>
          : image}
        {block.caption && <figcaption>{block.caption}</figcaption>}
        {block.action && <ContentLinkButton item={block.action} />}
      </figure>
    )
  }
  if (block.type === 'links') {
    return (
      <div className="content-links">
        {block.title && <h3>{block.title}</h3>}
        {(block.items ?? [])
          .filter((item): item is ContentLink => typeof item !== 'string')
          .map((item, index) => <ContentLinkButton key={index} item={item} />)}
      </div>
    )
  }
  return null
}
