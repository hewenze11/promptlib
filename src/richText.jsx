/**
 * 将描述文本渲染为 React 节点：
 * - [文字](url) → 可点击链接
 * - @词条名 → 可点击的词条引用（onMentionClick 回调）
 * - 普通文字 → span
 */
export function renderDescription(text, onMentionClick) {
  if (!text) return null

  // 按 [text](url) 和 @mention 分割
  const parts = []
  // 匹配 markdown 链接 或 @mention
  const regex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)|@([\w\u4e00-\u9fa5\-_]+)/g
  let last = 0
  let m

  while ((m = regex.exec(text)) !== null) {
    // 前面的普通文字
    if (m.index > last) {
      parts.push({ type: 'text', value: text.slice(last, m.index) })
    }

    if (m[1] && m[2]) {
      // markdown 链接
      parts.push({ type: 'link', label: m[1], url: m[2] })
    } else if (m[3]) {
      // @mention 引用
      parts.push({ type: 'mention', name: m[3] })
    }

    last = m.index + m[0].length
  }

  if (last < text.length) {
    parts.push({ type: 'text', value: text.slice(last) })
  }

  return parts.map((p, i) => {
    if (p.type === 'text') {
      return <span key={i}>{p.value}</span>
    }
    if (p.type === 'link') {
      return (
        <a
          key={i}
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-400 underline underline-offset-2 hover:text-sky-300 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {p.label}
        </a>
      )
    }
    if (p.type === 'mention') {
      return (
        <span
          key={i}
          className="text-violet-400 cursor-pointer hover:text-violet-300 transition-colors"
          onClick={(e) => { e.stopPropagation(); onMentionClick?.(p.name) }}
        >
          @{p.name}
        </span>
      )
    }
    return null
  })
}

/**
 * 从文本中提取所有 [text](url) 链接，返回 { label, url }[]
 */
export function extractLinks(text) {
  const regex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g
  const results = []
  let m
  while ((m = regex.exec(text)) !== null) {
    results.push({ label: m[1], url: m[2] })
  }
  return results
}

/**
 * 将文本中的 [text](url) 在纯文本输出时保留为 text (url) 格式
 */
export function textifyDescription(text) {
  return text.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '$1 ($2)')
}
