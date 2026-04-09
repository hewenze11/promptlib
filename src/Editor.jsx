import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Mention } from '@tiptap/extension-mention'
import tippy from 'tippy.js'
import { createRoot } from 'react-dom/client'
import { useRef, useEffect, useState } from 'react'
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

/**
 * 将编辑器 doc JSON 中的文本节点里的 【xxx】 切分为 mention 节点（B 模式）
 * 用于阅读模式反解
 */
function parseTextToMentions(docJson, entries) {
  const titleMap = {}
  entries.forEach((e) => { titleMap[e.title] = e })

  function processNode(node) {
    if (node.type === 'text' && node.text) {
      const regex = /【([^】]+)】/g
      const parts = []
      let last = 0
      let m
      while ((m = regex.exec(node.text)) !== null) {
        if (m.index > last) {
          parts.push({ type: 'text', text: node.text.slice(last, m.index), marks: node.marks })
        }
        const name = m[1]
        const entry = titleMap[name]
        if (entry) {
          parts.push({
            type: 'mention',
            attrs: { id: entry.id, label: entry.title, mode: 'B', color: '#7c3aed' },
          })
        } else {
          parts.push({ type: 'text', text: m[0], marks: node.marks })
        }
        last = m.index + m[0].length
      }
      if (last < node.text.length) {
        parts.push({ type: 'text', text: node.text.slice(last), marks: node.marks })
      }
      return parts.length > 0 ? parts : [node]
    }
    if (node.content && Array.isArray(node.content)) {
      const newContent = []
      for (const child of node.content) {
        const result = processNode(child)
        newContent.push(...(Array.isArray(result) ? result : [result]))
      }
      return [{ ...node, content: newContent }]
    }
    return [node]
  }

  const processed = processNode(docJson)
  return processed[0] || docJson
}

export default function Editor({ entries, colorMode, onColorModeChange, onGenerate }) {
  const reactRendererRef = useRef(null)
  const tippyInstanceRef = useRef(null)
  const editorRef = useRef(null)

  // 面板模式：'insert'（插入模式）| 'read'（阅读模式）
  const [panelMode, setPanelMode] = useState('insert')

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

  // ── 色系联动：colorMode 变化时更新所有 mention 节点的颜色 ──
  useEffect(() => {
    if (!editor || !entries.length) return
    const lvs = computeLevels(entries)
    editor.chain().focus().command(({ tr, state }) => {
      state.doc.descendants((node, pos) => {
        if (node.type.name === 'mention') {
          const entry = entries.find(e => e.id === node.attrs.id)
          const color = entry ? getEntryColor(entry, colorMode, lvs) : '#7c3aed'
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, color })
        }
      })
      return true
    }).run()
  }, [colorMode, editor]) // eslint-disable-line react-hooks/exhaustive-deps

  // 面板点击插入（插入模式）
  const handlePanelInsert = (entry, color) => {
    const e = editorRef.current
    if (!e) return
    e.chain().focus()
      .insertContent({ type: 'mention', attrs: { id: entry.id, label: entry.title, mode: 'A', color } })
      .insertContent(' ')
      .run()
  }

  // 切换面板模式
  const handlePanelModeChange = (newMode) => {
    setPanelMode(newMode)
    if (newMode === 'read' && editor) {
      // 反解编辑器中的 【词条名】 为 mention 节点
      const docJson = editor.getJSON()
      const parsed = parseTextToMentions(docJson, entries)
      editor.commands.setContent(parsed, false)
    }
  }

  // ── 生成文本（降级：所有词条 → 【词条名】，无注释）──
  const handleGenerateText = () => {
    if (!editor) return
    let bodyText = ''
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'text') bodyText += node.text
      else if (node.type.name === 'mention') bodyText += `【${node.attrs.label}】`
      else if (node.type.name === 'paragraph' && bodyText.length) bodyText += '\n'
    })
    onGenerate(bodyText.trim())
  }

  // ── 生成富文本（A 模式附注释，正文用 ⟦词条名⟧）──
  const handleGenerateRichText = () => {
    if (!editor) return
    const mentionNodes = []
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'mention') mentionNodes.push(node.attrs)
    })
    const annotations = collectAnnotations(mentionNodes, entries)
    let bodyText = ''
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'text') bodyText += node.text
      else if (node.type.name === 'mention') bodyText += `⟦${node.attrs.label}⟧`
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
      <div className="flex justify-end gap-2">
        <button
          onClick={handleGenerateText}
          className="px-4 py-2 bg-[#1e1e30] hover:bg-[#2a2a40] border border-[#2e2e45] hover:border-violet-500/40 text-[#a0a0c0] hover:text-violet-200 text-sm font-semibold rounded-lg transition-colors"
          title="所有词条降级为【词条名】，不附加注释（适合分享给他人阅读）"
        >
          生成文本
        </button>
        <button
          onClick={handleGenerateRichText}
          className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors"
          title="A模式词条注释附加到开头，正文词条用 ⟦词条名⟧"
        >
          生成富文本 →
        </button>
      </div>

      {/* 词条快捷面板 */}
      <EntryPanel
        entries={entries}
        colorMode={colorMode}
        onColorModeChange={onColorModeChange}
        onInsert={handlePanelInsert}
        panelMode={panelMode}
        onPanelModeChange={handlePanelModeChange}
      />
    </div>
  )
}
