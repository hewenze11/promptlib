import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'

/* ── React 渲染组件 ───────────────────────────────────── */
function MentionChip({ node, updateAttributes }) {
  const { label, mode } = node.attrs

  const toggle = () => {
    updateAttributes({ mode: mode === 'A' ? 'B' : 'A' })
  }

  return (
    <NodeViewWrapper as="span" style={{ display: 'inline' }}>
      <span
        className="mention"
        data-mode={mode}
        onClick={toggle}
        title={mode === 'A' ? '点击切换为 B 模式（灰色）' : '点击切换为 A 模式（高亮注释）'}
        contentEditable={false}
      >
        {mode === 'A' ? '◆' : '◇'} @{label}
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

  addAttributes() {
    return {
      id: { default: null },
      label: { default: null },
      mode: { default: 'A' }, // 'A' 高亮注释 | 'B' 灰色仅标题
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
