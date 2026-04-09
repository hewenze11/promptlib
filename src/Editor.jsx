import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Mention } from '@tiptap/extension-mention'
import tippy from 'tippy.js'
import { createRoot } from 'react-dom/client'
import { useRef } from 'react'
import MentionList from './MentionList'
import MentionExtension from './MentionExtension'
import EntryPanel from './EntryPanel'
import { getEntryColor, computeLevels } from './colors'

/**
 * 递归解析词条注释，将 @引用 展开为对应词条描述
 */
function resolveDescription(entry, entries, visited = new Set()) {
  if (!entry) return ''
  if (visited.has(entry.id)) return `[循环引用: ${entry.title}]`
  visited.add(entry.id)
  const desc = entry.description || ''
  return desc.replace(/@([\w\u4e00-\u9fa5\-_]+)/g, (match, name) => {
    const ref = entries.find((e) => e.title === name)
    if (!ref) return match
    return resolveDescription(ref, entries, new Set(visited))
  })
}

function collectAnnotations(mentionNodes, entries) {
  const seen = new Set()
  const result = []
  for (const m of mentionNodes) {
    if (m.mode !== 'A') continue
    if (seen.has(m.id)) continue
    seen.add(m.id)
    const entry = entries.find((e) => e.id === m.id)
    if (!entry) continue
    const resolved = resolveDescription(entry, entries)
    result.push(`【${entry.title}】${resolved}`)
  }
  return result
}

export default function Editor({ entries, colorMode, onColorModeChange, onGenerate }) {
  const reactRendererRef = useRef(null)
  const tippyInstanceRef = useRef(null)
  // 保留 editor ref 用于面板插入
  const editorRef = useRef(null)

  const levels = computeLevels(entries)

  const editor = useEditor({
    extensions: [
      StarterKit,
      MentionExtension,
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        suggestion: {
          items: ({ query }) => {
            if (!entries.length) return []
            return entries
              .filter((e) => e.title.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 8)
          },
          render: () => {
            let container, root
            return {
              onStart(props) {
                container = document.createElement('div')
                document.body.appendChild(container)
                root = createRoot(container)
                root.render(<MentionList ref={reactRendererRef} {...props} />)
                tippyInstanceRef.current = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: container,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                })[0]
              },
              onUpdate(props) {
                root.render(<MentionList ref={reactRendererRef} {...props} />)
                tippyInstanceRef.current?.setProps({ getReferenceClientRect: props.clientRect })
              },
              onKeyDown(props) {
                if (props.event.key === 'Escape') { tippyInstanceRef.current?.hide(); return true }
                return reactRendererRef.current?.onKeyDown(props) ?? false
              },
              onExit() {
                tippyInstanceRef.current?.destroy()
                root?.unmount()
                container?.remove()
              },
              command({ editor, range, props }) {
                const entry = entries.find((e) => e.id === props.id)
                const color = entry ? getEntryColor(entry, colorMode, levels) : '#7c3aed'
                editor
                  .chain().focus().deleteRange(range)
                  .insertContent({ type: 'mention', attrs: { id: props.id, label: props.label, mode: 'A', color } })
                  .insertContent(' ')
                  .run()
              },
            }
          },
        },
      }),
    ],
    onCreate({ editor }) { editorRef.current = editor },
    content: '',
    editorProps: {
      attributes: { 'data-placeholder': '在这里输入内容，用 @ 引用词条…' },
    },
  })

  // 面板点击插入
  const handlePanelInsert = (entry, color) => {
    const e = editorRef.current
    if (!e) return
    e.chain().focus()
      .insertContent({ type: 'mention', attrs: { id: entry.id, label: entry.title, mode: 'A', color } })
      .insertContent(' ')
      .run()
  }

  const handleGenerate = () => {
    if (!editor) return
    const mentionNodes = []
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'mention') mentionNodes.push(node.attrs)
    })
    const annotations = collectAnnotations(mentionNodes, entries)
    let bodyText = ''
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'text') bodyText += node.text
      else if (node.type.name === 'mention') bodyText += `[${node.attrs.label}]`
      else if (node.type.name === 'paragraph' && bodyText.length) bodyText += '\n'
    })
    bodyText = bodyText.trim()
    let result = ''
    if (annotations.length) {
      result += '---词条注释---\n'
      result += annotations.join('\n') + '\n'
      result += '--------------\n\n'
    }
    result += bodyText
    onGenerate(result)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="tiptap-editor bg-[#14141e] border border-[#2e2e45] rounded-xl overflow-hidden focus-within:border-violet-500/50 transition-colors">
        <EditorContent editor={editor} />
      </div>
      <div className="flex justify-end">
        <button
          onClick={handleGenerate}
          className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          生成文本 →
        </button>
      </div>

      {/* 词条快捷面板 */}
      <EntryPanel
        entries={entries}
        colorMode={colorMode}
        onColorModeChange={onColorModeChange}
        onInsert={handlePanelInsert}
      />
    </div>
  )
}
