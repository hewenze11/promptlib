import { useState, useRef, useEffect } from 'react'
import { v4 as uuid } from 'uuid'
import { Pencil, Trash2, Plus, X, Code, AlignLeft, AlertTriangle, Link } from 'lucide-react'
import { COLOR_PRESETS, DEFAULT_ENTRY_COLOR, hexToRgba } from './colors'
import { detectCycles } from './cycleDetect'

/** 从描述文本中提取所有 @引用词条名 */
function extractRefs(text) {
  const matches = [...text.matchAll(/@([\w\u4e00-\u9fa5\-_]+)/g)]
  return [...new Set(matches.map((m) => m[1]))]
}

/** 校验 JSON 字符串 */
function validateJson(str) {
  try { JSON.parse(str); return null } catch (e) { return e.message }
}

/**
 * 带 @ 补全的 textarea 组件
 */
function MentionTextarea({ value, onChange, entries, currentId, placeholder, rows = 4, className = '' }) {
  const ref = useRef()
  const [popup, setPopup] = useState(null)
  // popup: { query, start, end, items, selected }

  const handleKeyDown = (e) => {
    if (!popup) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setPopup((p) => ({ ...p, selected: (p.selected + 1) % p.items.length }))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setPopup((p) => ({ ...p, selected: (p.selected - 1 + p.items.length) % p.items.length }))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (popup.items.length > 0) {
        e.preventDefault()
        insertMention(popup.items[popup.selected])
      }
    } else if (e.key === 'Escape') {
      setPopup(null)
    }
  }

  const handleInput = (e) => {
    const text = e.target.value
    onChange(text)

    const cursor = e.target.selectionStart
    // 向左找最近的 @
    const before = text.slice(0, cursor)
    const match = before.match(/@([\w\u4e00-\u9fa5\-_]*)$/)
    if (match) {
      const query = match[1]
      const start = cursor - match[0].length
      const items = entries
        .filter((en) => en.id !== currentId && en.title.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 6)
      if (items.length > 0) {
        setPopup({ query, start, end: cursor, items, selected: 0 })
      } else {
        setPopup(null)
      }
    } else {
      setPopup(null)
    }
  }

  const insertMention = (entry) => {
    if (!popup) return
    const text = value
    const before = text.slice(0, popup.start)
    const after = text.slice(popup.end)
    const inserted = `@${entry.title}`
    const newText = before + inserted + after
    onChange(newText)
    setPopup(null)
    // 移动光标到插入后
    requestAnimationFrame(() => {
      if (ref.current) {
        const pos = popup.start + inserted.length
        ref.current.setSelectionRange(pos, pos)
        ref.current.focus()
      }
    })
  }

  // 点击外部关闭
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setPopup(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className}
        spellCheck={false}
      />
      {popup && popup.items.length > 0 && (
        <div className="absolute left-0 z-50 mt-1 w-64 bg-[#1a1a26] border border-[#2e2e45] rounded-xl shadow-2xl overflow-hidden"
          style={{ top: '100%' }}
        >
          {popup.items.map((item, i) => (
            <div
              key={item.id}
              className={`flex flex-col px-3 py-2 cursor-pointer border-b border-[#22223a] last:border-0 transition-colors ${i === popup.selected ? 'bg-[#252538]' : 'hover:bg-[#1e1e30]'}`}
              onMouseDown={(e) => { e.preventDefault(); insertMention(item) }}
            >
              <span className="text-xs font-semibold text-violet-300">@{item.title}</span>
              <span className="text-[11px] text-[#666688] truncate mt-0.5">{item.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EntryManager({ entries, onChange }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', mode: 'text', color: DEFAULT_ENTRY_COLOR })
  const [jsonError, setJsonError] = useState('')
  const [error, setError] = useState('')
  const [dismissedCycles, setDismissedCycles] = useState(false)

  // 循环引用检测
  const cycles = detectCycles(entries)

  const openAdd = () => {
    setEditing(null)
    setForm({ title: '', description: '', mode: 'text', color: DEFAULT_ENTRY_COLOR })
    setError('')
    setJsonError('')
    setShowForm(true)
  }

  const openEdit = (entry) => {
    setEditing(entry)
    const isJson = (() => { try { JSON.parse(entry.description); return true } catch { return false } })()
    setForm({ title: entry.title, description: entry.description, mode: isJson ? 'json' : 'text', color: entry.color || DEFAULT_ENTRY_COLOR })
    setError('')
    setJsonError('')
    setShowForm(true)
  }

  const close = () => {
    setShowForm(false)
    setEditing(null)
    setError('')
    setJsonError('')
  }

  const handleDescChange = (val) => {
    setForm((f) => ({ ...f, description: val }))
    if (form.mode === 'json') {
      setJsonError(validateJson(val) || '')
    } else {
      setJsonError('')
    }
  }

  const switchMode = (newMode) => {
    let desc = form.description
    if (newMode === 'json' && desc && validateJson(desc)) {
      desc = JSON.stringify({ content: desc }, null, 2)
    }
    setForm((f) => ({ ...f, mode: newMode, description: desc }))
    setJsonError(newMode === 'json' ? (validateJson(desc) || '') : '')
  }

  const submit = () => {
    const title = form.title.trim()
    const description = form.description.trim()
    if (!title) return setError('词条名称不能为空')
    if (!description) return setError('注释内容不能为空')
    if (form.mode === 'json' && validateJson(description)) return setError('JSON 格式有误，请修正后再保存')
    const dup = entries.find((e) => e.title === title && e.id !== editing?.id)
    if (dup) return setError('词条名称已存在')

    const color = form.color || DEFAULT_ENTRY_COLOR
    if (editing) {
      onChange(entries.map((e) => e.id === editing.id ? { ...e, title, description, color } : e))
    } else {
      onChange([...entries, { id: uuid(), title, description, color, createdAt: Date.now() }])
    }
    close()
  }

  const remove = (id) => {
    if (!confirm('确认删除这个词条？')) return
    onChange(entries.filter((e) => e.id !== id))
  }

  const refs = extractRefs(form.description)
  const refEntries = refs
    .map((name) => entries.find((e) => e.title === name && e.id !== editing?.id))
    .filter(Boolean)

  const textareaClass = `w-full bg-[#0f0f13] border rounded-lg px-3 py-2 text-sm text-white placeholder-[#444460] focus:outline-none transition-colors resize-none leading-relaxed ${
    form.mode === 'json'
      ? `font-mono text-xs ${jsonError ? 'border-red-500/60 focus:border-red-500' : 'border-[#2e2e45] focus:border-amber-500/70'}`
      : 'border-[#2e2e45] focus:border-violet-500/70'
  }`

  return (
    <div className="flex flex-col gap-3">
      {/* 循环引用警告 */}
      {cycles.length > 0 && !dismissedCycles && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-300 mb-1">存在循环引用（不影响使用）</p>
            {cycles.map((c, i) => (
              <p key={i} className="text-[11px] text-amber-400/80 font-mono">
                位置 → {c.path.join(' → ')}
              </p>
            ))}
          </div>
          <button onClick={() => setDismissedCycles(true)} className="text-amber-500/60 hover:text-amber-300 transition-colors shrink-0">
            <X size={13} />
          </button>
        </div>
      )}

      {/* 词条列表 */}
      <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
        {entries.length === 0 && (
          <div className="text-center text-[#555570] py-10 text-sm">暂无词条，点击下方按钮添加</div>
        )}
        {entries.map((entry) => {
          const refs = extractRefs(entry.description)
          const isJson = (() => { try { JSON.parse(entry.description); return true } catch { return false } })()
          return (
            <div key={entry.id} className="group flex items-start gap-3 p-3 rounded-lg bg-[#14141e] border border-[#2e2e45] hover:border-violet-500/40 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: entry.color || DEFAULT_ENTRY_COLOR }} />
                  <div className="text-sm font-semibold text-violet-300">@{entry.title}</div>
                  {isJson && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">JSON</span>}
                </div>
                <div className="text-xs text-[#888899] mt-1 leading-relaxed line-clamp-2">{entry.description}</div>
                {refs.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {refs.map((r) => (
                      <span key={r} className="text-[10px] bg-violet-500/15 text-violet-400 px-1.5 py-0.5 rounded">@{r}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(entry)} className="p-1.5 rounded-md hover:bg-[#252538] text-[#666688] hover:text-violet-300 transition-colors"><Pencil size={13} /></button>
                <button onClick={() => remove(entry.id)} className="p-1.5 rounded-md hover:bg-[#252538] text-[#666688] hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
              </div>
            </div>
          )
        })}
      </div>

      {!showForm && (
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 border border-dashed border-[#2e2e45] hover:border-violet-500/50 rounded-lg text-[#666688] hover:text-violet-300 text-sm transition-colors">
          <Plus size={14} /> 新建词条
        </button>
      )}

      {showForm && (
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-[#14141e] border border-violet-500/40">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-violet-300">{editing ? '编辑词条' : '新建词条'}</span>
            <button onClick={close} className="text-[#666688] hover:text-white transition-colors"><X size={15} /></button>
          </div>

          <div>
            <label className="text-xs text-[#888899] mb-1 block">词条名称（用于 @ 引用）</label>
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="例：我的角色"
              className="w-full bg-[#0f0f13] border border-[#2e2e45] rounded-lg px-3 py-2 text-sm text-white placeholder-[#444460] focus:outline-none focus:border-violet-500/70 transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-[#888899]">
                详细注释
                {form.mode === 'text' && <span className="ml-1 text-[#555570]">（输入 @ 引用词条，[文字](链接) 插入链接）</span>}
              </label>
              <div className="flex rounded-md overflow-hidden border border-[#2e2e45] text-[10px]">
                <button
                  onClick={() => switchMode('text')}
                  className={`flex items-center gap-1 px-2 py-1 transition-colors ${form.mode === 'text' ? 'bg-violet-600/40 text-violet-200' : 'text-[#555570] hover:text-white'}`}
                >
                  <AlignLeft size={10} /> 文本
                </button>
                <button
                  onClick={() => switchMode('json')}
                  className={`flex items-center gap-1 px-2 py-1 transition-colors ${form.mode === 'json' ? 'bg-amber-500/30 text-amber-200' : 'text-[#555570] hover:text-white'}`}
                >
                  <Code size={10} /> JSON
                </button>
              </div>
            </div>

            {form.mode === 'text' ? (
              <MentionTextarea
                value={form.description}
                onChange={handleDescChange}
                entries={entries}
                currentId={editing?.id}
                placeholder="描述这个词条的详细内容。输入 @ 可以引用已有词条…"
                rows={4}
                className={textareaClass}
              />
            ) : (
              <textarea
                value={form.description}
                onChange={(e) => handleDescChange(e.target.value)}
                placeholder={'输入 JSON 数据，例如：{\n  "role": "你是一个...",\n  "style": "简洁"\n}'}
                rows={7}
                className={textareaClass}
                spellCheck={false}
              />
            )}

            {form.mode === 'json' && jsonError && (
              <p className="text-[11px] text-red-400 mt-1 font-mono">{jsonError}</p>
            )}

            {form.mode === 'text' && refEntries.length > 0 && (
              <div className="mt-2 p-2 rounded-lg bg-[#0f0f13] border border-[#2e2e45]">
                <p className="text-[10px] text-[#666688] mb-1.5">引用了以下词条：</p>
                {refEntries.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 mb-1">
                    <span className="text-[10px] text-violet-400 shrink-0 mt-0.5">@{e.title}</span>
                    <span className="text-[10px] text-[#666688] line-clamp-1">{e.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 颜色选择 */}
          <div>
            <label className="text-xs text-[#888899] mb-2 block">词条颜色（在词库色系模式下生效）</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  style={{ background: c, boxShadow: form.color === c ? `0 0 0 3px ${hexToRgba(c, 0.5)}` : 'none' }}
                  className="w-6 h-6 rounded-full transition-all hover:scale-110"
                  title={c}
                />
              ))}
              {/* 自定义颜色 */}
              <label className="w-6 h-6 rounded-full border-2 border-dashed border-[#444460] flex items-center justify-center cursor-pointer hover:border-violet-400 transition-colors overflow-hidden" title="自定义颜色">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="opacity-0 absolute w-0 h-0"
                />
                <span style={{ background: COLOR_PRESETS.includes(form.color) ? 'transparent' : form.color }} className="w-full h-full rounded-full" />
              </label>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 justify-end">
            <button onClick={close} className="px-4 py-1.5 text-sm text-[#666688] hover:text-white transition-colors">取消</button>
            <button
              onClick={submit}
              disabled={form.mode === 'json' && !!jsonError}
              className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {editing ? '保存' : '创建'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
