import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { hexToRgba } from './colors'

/* ── React 渲染组件 ───────────────────────────────────── */
function MentionChip({ node, updateAttributes, extension }) {
  const { label, mode, color, libraryName } = node.attrs

  const toggle = () => {
    updateAttributes({ mode: mode === 'A' ? 'B' : 'A' })
  }

  // B 模式固定灰色，A 模式用传入颜色
  const chipColor = mode === 'B' ? '#555570' : (color || '#7c3aed')

  const style = mode === 'A'
    ? {
        background: hexToRgba(chipColor, 0.18),
        color: chipColor,
        border: `1px solid ${hexToRgba(chipColor, 0.5)}`,
      }
    : {
        background: 'rgba(100,100,120,0.12)',
        color: '#555570',
        border: '1px solid rgba(100,100,120,0.25)',
      }

  // conflictMap 从 extension.options 传入（Map<词条名, 出现次数>）
  const conflictMap = extension?.options?.conflictMap
  let displayLabel = label
  if (conflictMap && conflictMap.get && conflictMap.get(label) > 1 && libraryName) {
    displayLabel = `${libraryName}.${label}`
  }

  return (
    <NodeViewWrapper as="span" style={{ display: 'inline' }}>
      <span
        className="mention"
        data-mode={mode}
        onClick={toggle}
        title={mode === 'A' ? '点击切换为 B 模式（灰色）' : '点击切换为 A 模式（高亮注释）'}
        contentEditable={false}
        style={style}
      >
        {mode === 'A' ? '◆' : '◇'} @{displayLabel}
      </span>
    </NodeViewWrapper>
  )
}

/* ── TipTap Extension ─────────────────────────────────── */
const MentionExtension = Node.create({
  name: 'mention',
  group: 'inline',
  inline: true,
  selectable: false,
  atom: true,

  addOptions() {
    return {
      conflictMap: new Map(), // Map<词条名, 出现次数>
    }
  },

  addAttributes() {
    return {
      id:          { default: null },
      label:       { default: null },
      mode:        { default: 'A' },
      color:       { default: '#7c3aed' },
      libraryId:   { default: null },   // uuid of the source library
      libraryName: { default: null },   // human-readable library name
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-mention]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-mention': '' }, HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MentionChip)
  },
})

export default MentionExtension
