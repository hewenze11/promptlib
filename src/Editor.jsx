import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Mention } from '@tiptap/extension-mention'
import tippy from 'tippy.js'
import { createRoot } from 'react-dom/client'
import { useRef } from 'react'
import MentionList from './MentionList'
import MentionExtension from './MentionExtension'

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

    // 遍历文档，找出所有 mention 节点
    const mentionNodes = []
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'mention') {
        mentionNodes.push(node.attrs)
      }
    })

    // A 模式词条 → 从词库里找到完整描述，拼成开头注释
    const aMentions = mentionNodes.filter((m) => m.mode === 'A')
    const annotations = aMentions
      .map((m) => {
        const entry = entries.find((e) => e.id === m.id)
        return entry ? `【${entry.title}】${entry.description}` : null
      })
      .filter(Boolean)

    // 获取纯文本正文（mention 替换为标题）
    let bodyText = ''
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'text') bodyText += node.text
      else if (node.type.name === 'mention') bodyText += `@${node.attrs.label}`
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
