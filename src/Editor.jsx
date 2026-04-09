import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Mention } from '@tiptap/extension-mention'
import tippy from 'tippy.js'
import { createRoot } from 'react-dom/client'
import { useRef } from 'react'
import MentionList from './MentionList'
import MentionExtension from './MentionExtension'

/**
 * 递归解析词条注释，将注释中的 @引用 展开为对应词条描述。
 * 防止循环引用：visited 记录已访问的词条 id。
 */
function resolveDescription(entry, entries, visited = new Set()) {
  if (!entry) return ''
  if (visited.has(entry.id)) return `[循环引用: ${entry.title}]`
  visited.add(entry.id)

  const desc = entry.description || ''
  // 替换 @词条名 为对应词条的完整描述（递归）
  return desc.replace(/@([\w\u4e00-\u9fa5\-_]+)/g, (match, name) => {
    const ref = entries.find((e) => e.title === name)
    if (!ref) return match
    return resolveDescription(ref, entries, new Set(visited))
  })
}

/**
 * 收集编辑器中所有 A 模式词条，递归展开其描述（去重，按首次出现顺序）
 */
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

export default function Editor({ entries, onGenerate }) {
  const reactRendererRef = useRef(null)
  const tippyInstanceRef = useRef(null)

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
              .filter((e) =>
                e.title.toLowerCase().includes(query.toLowerCase())
              )
              .slice(0, 8)
          },

          render: () => {
            let container
            let root

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
                tippyInstanceRef.current?.setProps({
                  getReferenceClientRect: props.clientRect,
                })
              },

              onKeyDown(props) {
                if (props.event.key === 'Escape') {
                  tippyInstanceRef.current?.hide()
                  return true
                }
                return reactRendererRef.current?.onKeyDown(props) ?? false
              },

              onExit() {
                tippyInstanceRef.current?.destroy()
                root?.unmount()
                container?.remove()
              },

              command({ editor, range, props }) {
                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .insertContent({
                    type: 'mention',
                    attrs: { id: props.id, label: props.label, mode: 'A' },
                  })
                  .insertContent(' ')
                  .run()
              },
            }
          },
        },
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        'data-placeholder': '在这里输入内容，用 @ 引用词条…',
      },
    },
  })

  const handleGenerate = () => {
    if (!editor) return

    // 遍历文档，收集所有 mention 节点（保留顺序）
    const mentionNodes = []
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'mention') {
        mentionNodes.push(node.attrs)
      }
    })

    // A 模式词条 → 递归展开注释，拼成开头块
    const annotations = collectAnnotations(mentionNodes, entries)

    // 正文：mention 节点统一替换为 [词条名]（不再用 @）
    let bodyText = ''
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'text') bodyText += node.text
      else if (node.type.name === 'mention') bodyText += `[${node.attrs.label}]`
      else if (node.type.name === 'paragraph' && bodyText.length) bodyText += '\n'
    })
    bodyText = bodyText.trim()

    // 拼接最终文本
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
      <button
        onClick={handleGenerate}
        className="self-end px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        生成文本 →
      </button>
    </div>
  )
}
