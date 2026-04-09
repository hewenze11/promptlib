import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Pencil, Trash2, Plus, X, Code, AlignLeft } from 'lucide-react'

/** 从描述文本中提取所有 @引用词条名 */
function extractRefs(text) {
  const matches = [...text.matchAll(/@([\w\u4e00-\u9fa5\-_]+)/g)]
  return [...new Set(matches.map((m) => m[1]))]
}

/** 校验 JSON 字符串 */
function validateJson(str) {
  try {
    JSON.parse(str)
    return null
  } catch (e) {
    return e.message
  }
}

export default function EntryManager({ entries, onChange }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ title: '', description: '', mode: 'text' })
  // mode: 'text' | 'json'
  const [jsonError, setJsonError] = useState('')
  const [error, setError] = useState('')

  const openAdd = () => {
    setEditing(null)
    setForm({ title: '', description: '', mode: 'text' })
    setError('')
    setJsonError('')
    setShowForm(true)
  }

  const openEdit = (entry) => {
    setEditing(entry)
    // 尝试判断是否是 JSON 内容
    const isJson = (() => {
      try { JSON.parse(entry.description); return true } catch { return false }
    })()
    setForm({ title: entry.title, description: entry.description, mode: isJson ? 'json' : 'text' })
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
    // 切换到 JSON 时，如果当前内容不是空，尝试包一层
    let desc = form.description
    if (newMode === 'json' && desc && validateJson(desc)) {
      // 不是合法 JSON，自动转成 {"content": "..."} 格式
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

    if (editing) {
      onChange(entries.map((e) => e.id === editing.id ? { ...e, title, description } : e))
    } else {
      onChange([...entries, { id: uuid(), title, description, createdAt: Date.now() }])
    }
    close()
  }

  const remove = (id) => {
    if (!confirm('确认删除这个词条？')) return
    onChange(entries.filter((e) => e.id !== id))
  }

  // 当前描述中引用到的词条
  const refs = extractRefs(form.description)
  const refEntries = refs.map((name) => entries.find((e) => e.title === name && e.id !== editing?.id)).filter(Boolean)

  return (
    <div className="flex flex-col gap-3">
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
                  <div className="text-sm font-semibold text-violet-300">@{entry.title}</div>
                  {isJson && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">JSON</span>}
                </div>
                <div className="text-xs text-[#888899] mt-1 leading-relaxed line-clamp-2">{entry.description}</div>
                {refs.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {refs.map((r) => (
                      <span key={r} className="text-[10px] bg-violet-500/15 text-violet-400 px-1.5 py-0.5 rounded">
                        @{r}
                      </span>
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

      {/* 添加按钮 */}
      {!showForm && (
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 border border-dashed border-[#2e2e45] hover:border-violet-500/50 rounded-lg text-[#666688] hover:text-violet-300 text-sm transition-colors">
          <Plus size={14} /> 新建词条
        </button>
      )}

      {/* 表单 */}
      {showForm && (
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-[#14141e] border border-violet-500/40">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-violet-300">{editing ? '编辑词条' : '新建词条'}</span>
            <button onClick={close} className="text-[#666688] hover:text-white transition-colors"><X size={15} /></button>
          </div>

          {/* 词条名称 */}
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

          {/* 注释内容 + 格式切换 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-[#888899]">
                详细注释
                {form.mode === 'text' && <span className="ml-1 text-[#555570]">（支持 @词条名 引用其他词条）</span>}
              </label>
              {/* 格式切换按钮 */}
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

            <textarea
              value={form.description}
              onChange={(e) => handleDescChange(e.target.value)}
              placeholder={form.mode === 'json'
                ? '输入 JSON 数据，例如：{\n  "role": "你是一个...",\n  "style": "简洁"\n}'
                : '描述这个词条的详细内容。可以用 @其他词条名 引用已有词条…'}
              rows={form.mode === 'json' ? 7 : 4}
              className={`w-full bg-[#0f0f13] border rounded-lg px-3 py-2 text-sm text-white placeholder-[#444460] focus:outline-none transition-colors resize-none leading-relaxed ${
                form.mode === 'json'
                  ? `font-mono text-xs ${jsonError ? 'border-red-500/60 focus:border-red-500' : 'border-[#2e2e45] focus:border-amber-500/70'}`
                  : 'border-[#2e2e45] focus:border-violet-500/70'
              }`}
              spellCheck={false}
            />

            {/* JSON 错误提示 */}
            {form.mode === 'json' && jsonError && (
              <p className="text-[11px] text-red-400 mt-1 font-mono">{jsonError}</p>
            )}

            {/* 引用预览 */}
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
