import matter from 'gray-matter'

export interface ParsedMarkdown<T = Record<string, unknown>> {
  metadata: T
  body: string
}

// 递归处理 metadata，将 Date 对象转换为字符串
function processMetadata(obj: unknown): unknown {
  if (obj instanceof Date) {
    return obj.toISOString()
  }
  if (Array.isArray(obj)) {
    return obj.map(processMetadata)
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = processMetadata(value)
    }
    return result
  }
  return obj
}

export function parseMarkdown<T = Record<string, unknown>>(content: string): ParsedMarkdown<T> {
  const { data, content: body } = matter(content)
  // 处理 gray-matter 自动解析的 Date 对象
  const processedData = processMetadata(data) as T
  return {
    metadata: processedData,
    body: body.trim(),
  }
}

export function stringifyMarkdown<T = Record<string, unknown>>(
  metadata: T,
  body: string
): string {
  const frontMatter = Object.entries(metadata as Record<string, unknown>)
    .map(([key, value]) => {
      if (value === undefined || value === null) return null
      if (Array.isArray(value)) {
        return `${key}: [${value.map(v => 
          typeof v === 'string' ? `"${v}"` : JSON.stringify(v)
        ).join(', ')}]`
      }
      if (typeof value === 'object') {
        return `${key}: ${JSON.stringify(value)}`
      }
      if (typeof value === 'string') {
        if (value.includes('\n') || value.includes(':') || value.includes('#')) {
          const escaped = value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/"/g, '\\"')
          return `${key}: "${escaped}"`
        }
        return `${key}: ${value}`
      }
      return `${key}: ${value}`
    })
    .filter(Boolean)
    .join('\n')

  return `---\n${frontMatter}\n---\n\n${body}`
}

export function extractYamlField(content: string, field: string): unknown {
  const { metadata } = parseMarkdown(content)
  return metadata[field]
}

export function updateYamlField<T = Record<string, unknown>>(
  content: string,
  updates: Partial<T>
): string {
  const { metadata, body } = parseMarkdown<T>(content)
  const updatedMetadata = { ...metadata, ...updates } as T
  return stringifyMarkdown(updatedMetadata, body)
}

export function extractTitle(body: string): string | null {
  const match = body.match(/^#\s+(.+)$/m)
  return match ? match[1] : null
}

export function extractHeadings(body: string): Array<{ level: number; text: string }> {
  const regex = /^(#{1,6})\s+(.+)$/gm
  const headings: Array<{ level: number; text: string }> = []
  let match

  while ((match = regex.exec(body)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2],
    })
  }

  return headings
}

export function extractTables(body: string): Array<{ headers: string[]; rows: string[][] }> {
  const tables: Array<{ headers: string[]; rows: string[][] }> = []
  const regex = /\|(.+)\|\n\|[-\s|:]+\|\n((?:\|.+\|\n?)+)/g
  let match

  while ((match = regex.exec(body)) !== null) {
    const headers = match[1]
      .split('|')
      .map(h => h.trim())
      .filter(Boolean)
    
    const rows = match[2]
      .trim()
      .split('\n')
      .map(row =>
        row
          .split('|')
          .map(cell => cell.trim())
          .filter(Boolean)
      )

    tables.push({ headers, rows })
  }

  return tables
}

export function extractListItems(body: string): string[] {
  const regex = /^[-*]\s+(.+)$/gm
  const items: string[] = []
  let match

  while ((match = regex.exec(body)) !== null) {
    items.push(match[1])
  }

  return items
}

export function extractCodeBlocks(body: string): Array<{ language: string; code: string }> {
  const regex = /```(\w*)\n([\s\S]*?)```/g
  const blocks: Array<{ language: string; code: string }> = []
  let match

  while ((match = regex.exec(body)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
    })
  }

  return blocks
}
