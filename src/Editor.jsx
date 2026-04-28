import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Mention } from '@tiptap/extension-mention'
import tippy from 'tippy.js'
import { createRoot } from 'react-dom/client'
import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import MentionList from './MentionList'
import MentionExtension from './MentionExtension'
import EntryPanel from './EntryPanel'
import { getEntryColor, computeLevels } from './colors'
import { X, ChevronDown, ChevronUp, Plus } from 'lucide-react'

/**
 * 从输入解析 username 和 slug
 */
function parseLibraryUrl(input) {
  const match = input.match(/\/@([\w-]+)\/([\w-]+)/)
  if (match) return { username: match[1], slug: match[2] }
  return null
}

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

/**
 * Editor component
 * @param {Object} props
 * @param {Array}  props.entries        - flat merged entries (for backward compat)
 * @param {Array}  props.activeLibraries - [{id, name, entries:[]}] array of active libs
 * @param {string} props.colorMode
 * @param {Function} props.onColorModeChange
 * @param {Function} props.onGenerate
 * @param {string} props.initialText
 */
export default function Editor({ entries, activeLibraries = [], colorMode, onColorModeChange, onGenerate, initialText }) {
  const reactRendererRef = useRef(null)
  const tippyInstanceRef = useRef(null)
  const editorRef = useRef(null)
  const initApplied = useRef(false)

  // 面板模式：'insert'（插入模式）| 'read'（阅读模式）
  const [panelMode, setPanelMode] = useState('insert')

  // ── 临时加载词库 ──
  const [tempLibs, setTempLibs] = useState([]) // [{id, name, slug, entries:[]}]
  const [extLoadOpen, setExtLoadOpen] = useState(false)
  const [extInput, setExtInput] = useState('')
  const [extLoading, setExtLoading] = useState(false)
  const [extError, setExtError] = useState('')

  // ── 计算冲突 map：Map<词条名, 出现次数> ──
  // 考虑 activeLibraries + tempLibs
  const conflictMap = useMemo(() => {
    const map = new Map()
    const allLibs = [...activeLibraries, ...tempLibs]
    for (const lib of allLibs) {
      for (const e of (lib.entries || [])) {
        map.set(e.title, (map.get(e.title) || 0) + 1)
      }
    }
    return map
  }, [activeLibraries, tempLibs])

  // ── 候选词条：来自所有激活词库 + 临时词库，冲突时显示完整 库名.词条名 ──
  const candidateEntries = useMemo(() => {
    const result = []
    const dedupe = new Set()
    const allLibs = [...activeLibraries, ...tempLibs]

    for (const lib of allLibs) {
      for (const e of (lib.entries || [])) {
        const dedupeKey = `${lib.id}:${e.id}`
        if (dedupe.has(dedupeKey)) continue
        dedupe.add(dedupeKey)

        const hasConflict = conflictMap.get(e.title) > 1
        result.push({
          ...e,
          libraryId: lib.id,
          libraryName: lib.name,
          displayTitle: hasConflict ? `${lib.name}.${e.title}` : e.title,
        })
      }
    }
    return result
  }, [activeLibraries, tempLibs, conflictMap])

  const levels = computeLevels(entries)

  // Update extension conflictMap option whenever it changes
  const conflictMapRef = useRef(conflictMap)
  useEffect(() => {
    conflictMapRef.current = conflictMap
    if (editorRef.current) {
      // Trigger a view update so node views re-render
      editorRef.current.commands.blur()
      editorRef.current.commands.focus()
    }
  }, [conflictMap])

  const editor = useEditor({
    extensions: [
      StarterKit,
      MentionExtension.configure({ conflictMap }),
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        suggestion: {
          items: ({ query }) => {
            if (!candidateEntries.length) return []
            return candidateEntries
              .filter((e) => {
                const q = query.toLowerCase()
                return e.title.toLowerCase().includes(q) || e.displayTitle.toLowerCase().includes(q)
              })
              .slice(0, 10)
          },
          render: () => {
            let container, root
            return {
              onStart(props) {
                container = document.createElement('div')
                document.body.appendChild(container)
                root = createRoot(container)
                root.render(<MentionList ref={reactRendererRef} {...props} conflictMap={conflictMapRef.current} />)
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
                root.render(<MentionList ref={reactRendererRef} {...props} conflictMap={conflictMapRef.current} />)
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
                const entry = candidateEntries.find((e) => e.id === props.id && e.libraryId === props.libraryId)
                  || candidateEntries.find((e) => e.id === props.id)
                const color = entry ? getEntryColor(entry, colorMode, levels) : '#7c3aed'
                editor
                  .chain().focus().deleteRange(range)
                  .insertContent({
                    type: 'mention',
                    attrs: {
                      id: props.id,
                      label: props.label,
                      mode: 'A',
                      color,
                      libraryId: props.libraryId || entry?.libraryId || null,
                      libraryName: props.libraryName || entry?.libraryName || null,
                    }
                  })
                  .insertContent(' ')
                  .run()
              },
            }
          },
        },
      }),
    ],
    onCreate({ editor }) {
      editorRef.current = editor
      if (initialText && !initApplied.current) {
        initApplied.current = true
        editor.commands.setContent(initialText)
      }
    },
    content: '',
    editorProps: {
      attributes: { 'data-placeholder': '在这里输入内容，用 @ 引用词条…' },
    },
  })

  // ── 色系联动 ──
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

  // ── 临时加载外部词库 ──
  const handleLoadExtLib = useCallback(async () => {
    const parsed = parseLibraryUrl(extInput.trim())
    if (!parsed) {
      setExtError('无法解析地址，请输入 /@用户名/slug 或完整 URL')
      return
    }
    setExtLoading(true)
    setExtError('')
    try {
      const { username, slug } = parsed
      // Detect base URL: if input contains http, use that host; otherwise use current origin
      let baseUrl = window.location.origin
      const urlMatch = extInput.match(/^(https?:\/\/[^/]+)/)
      if (urlMatch) baseUrl = urlMatch[1]
      const res = await fetch(`${baseUrl}/api/users/${username}/${slug}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      // data may be { library: {..., entries: []}, entries: [] } or just the library object
      const libData = data.library || data
      const libEntries = (data.entries || libData.entries || []).map(e => ({
        id: e.id,
        title: e.title,
        description: e.description || '',
        color: e.color || '#7c3aed',
      }))
      const libName = libData.name || slug
      const libId = libData.id || `tmp-${username}-${slug}`
      // Avoid duplicate load
      setTempLibs(prev => {
        if (prev.find(l => l.id === libId)) return prev
        return [...prev, { id: libId, name: libName, slug, entries: libEntries }]
      })
      setExtInput('')
    } catch (err) {
      setExtError(`加载失败：${err.message}`)
    } finally {
      setExtLoading(false)
    }
  }, [extInput])

  const handleRemoveTempLib = (id) => {
    setTempLibs(prev => prev.filter(l => l.id !== id))
  }

  // 面板点击插入
  const handlePanelInsert = (entry, color) => {
    const e = editorRef.current
    if (!e) return
    e.chain().focus()
      .insertContent({
        type: 'mention',
        attrs: {
          id: entry.id,
          label: entry.title,
          mode: 'A',
          color,
          libraryId: entry.libraryId || null,
          libraryName: entry.libraryName || null,
        },
      })
      .insertContent(' ')
      .run()
  }

  const handlePanelModeChange = (newMode) => {
    setPanelMode(newMode)
    if (newMode === 'read' && editor) {
      const docJson = editor.getJSON()
      const parsed = parseTextToMentions(docJson, entries)
      editor.commands.setContent(parsed, false)
    }
  }

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
      {/* 临时加载外部词库 */}
      <div className="border border-[#2e2e45] rounded-xl overflow-hidden">
        <button
          onClick={() => setExtLoadOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-[#888899] hover:text-white hover:bg-[#14141e] transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Plus size={12} /> 加载外部词库
            {tempLibs.length > 0 && (
              <span className="ml-1 text-[10px] bg-violet-600/30 text-violet-300 px-1.5 py-0.5 rounded-full">
                {tempLibs.length} 已加载
              </span>
            )}
          </span>
          {extLoadOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {extLoadOpen && (
          <div className="px-4 pb-4 pt-1 bg-[#0e0e18] border-t border-[#2e2e45]">
            <p className="text-[10px] text-[#555570] mb-2">
              输入 /@用户名/slug 或完整 URL，临时加入 @ 候选（不保存）
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={extInput}
                onChange={e => setExtInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLoadExtLib()}
                placeholder="/@wenze/ai-prompts 或 http://47.239.171.228:9093/@wenze/ai-prompts"
                className="flex-1 bg-[#14141e] border border-[#2e2e45] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#444460] focus:outline-none focus:border-violet-500/60"
              />
              <button
                onClick={handleLoadExtLib}
                disabled={extLoading || !extInput.trim()}
                className="px-3 py-1.5 text-xs bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-600/30 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {extLoading ? '加载中…' : '加载'}
              </button>
            </div>
            {extError && <p className="mt-1 text-[10px] text-red-400">{extError}</p>}

            {/* 已加载的临时词库 badge */}
            {tempLibs.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tempLibs.map(lib => (
                  <span
                    key={lib.id}
                    className="flex items-center gap-1 text-[10px] bg-[#1e1e30] border border-[#3e3e5a] text-violet-300 px-2 py-0.5 rounded-full"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
                    {lib.name}
                    <span className="text-[#555570] ml-0.5">{lib.entries.length}</span>
                    <button
                      onClick={() => handleRemoveTempLib(lib.id)}
                      className="ml-0.5 text-[#555570] hover:text-red-400 transition-colors"
                      title="移除"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
        entries={candidateEntries}
        colorMode={colorMode}
        onColorModeChange={onColorModeChange}
        onInsert={handlePanelInsert}
        panelMode={panelMode}
        onPanelModeChange={handlePanelModeChange}
      />
    </div>
  )
}
