import { useState } from 'react'
import { v4 as uuid } from 'uuid'
import { Pencil, Trash2, Plus, X } from 'lucide-react'

export default function EntryManager({ entries, onChange }) {
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ title: '', description: '' })
  const [error, setError] = useState('')

  const openAdd = () => {
    setEditing(null)
    setForm({ title: '', description: '' })
    setError('')
    setShowForm(true)
  }

  const openEdit = (entry) => {
    setEditing(entry)
    setForm({ title: entry.title, description: entry.description })
    setError('')
    setShowForm(true)
  }

  const close = () => {
    setShowForm(false)
    setEditing(null)
    setError('')
  }

  const submit = () => {
    const title = form.title.trim()
    const description = form.description.trim()
    if (!title) return setError('词条名称不能为空')
    if (!description) return setError('注释内容不能为空')
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
        {entries.length === 0 && (
          <div className="text-center text-[#555570] py-10 text-sm">
            暂无词条，点击下方按钮添加
          </div>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className="group flex items-start gap-3 p-3 rounded-lg bg-[#14141e] border border-[#2e2e45] hover:border-violet-500/40 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-violet-300">@{entry.title}</div>
              <div className="text-xs text-[#888899] mt-1 leading-relaxed line-clamp-2">{entry.description}</div>
            </div>
            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => openEdit(entry)} className="p-1.5 rounded-md hover:bg-[#252538] text-[#666688] hover:text-violet-300 transition-colors">
                <Pencil size={13} />
              </button>
              <button onClick={() => remove(entry.id)} className="p-1.5 rounded-md hover:bg-[#252538] text-[#666688] hover:text-red-400 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
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
            <label className="text-xs text-[#888899] mb-1 block">详细注释（会附加到生成文本开头）</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="描述这个词条的详细内容，例如角色设定、背景信息等…"
              rows={4}
              className="w-full bg-[#0f0f13] border border-[#2e2e45] rounded-lg px-3 py-2 text-sm text-white placeholder-[#444460] focus:outline-none focus:border-violet-500/70 transition-colors resize-none leading-relaxed"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={close} className="px-4 py-1.5 text-sm text-[#666688] hover:text-white transition-colors">取消</button>
            <button onClick={submit} className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-colors">
              {editing ? '保存' : '创建'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
