import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit2, Check, X, EyeOff, Eye } from 'lucide-react'
import { auth } from './api'

const TABS = ['系统配置', '用户管理', '词库审核', '数据统计']

/* ── Tab 1: 系统配置 ── */
function ConfigTab() {
  const [configs, setConfigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/admin/configs', {
      headers: { Authorization: `Bearer ${localStorage.getItem('pl_token')}` },
    })
      .then((r) => r.json())
      .then((d) => setConfigs(d.configs || d || []))
      .catch(() => setConfigs([]))
      .finally(() => setLoading(false))
  }, [])

  const startEdit = (cfg) => {
    setEditingKey(cfg.key)
    setEditValue(cfg.value || '')
    setMsg('')
  }

  const saveEdit = async (key) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/configs/${key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('pl_token')}`,
        },
        body: JSON.stringify({ value: editValue }),
      })
      if (!res.ok) throw new Error('保存失败')
      setConfigs((prev) => prev.map((c) => c.key === key ? { ...c, value: editValue, updated_at: new Date().toISOString() } : c))
      setEditingKey(null)
      setMsg('保存成功')
      setTimeout(() => setMsg(''), 2000)
    } catch (err) {
      setMsg(err.message)
    } finally {
      setSaving(false)
    }
  }

  const maskValue = (key, value) => {
    if (key?.toLowerCase().includes('key') || key?.toLowerCase().includes('secret')) {
      return value ? '****' : ''
    }
    return value || ''
  }

  if (loading) return <div className="text-[#555570] text-sm py-8 text-center">加载中...</div>

  return (
    <div>
      {msg && <p className="text-xs text-green-400 mb-3">{msg}</p>}
      <div className="border border-[#2e2e45] rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-[#1a1a2e]">
            <tr>
              <th className="text-left px-4 py-2.5 text-[#888899] font-semibold">配置项</th>
              <th className="text-left px-4 py-2.5 text-[#888899] font-semibold">值</th>
              <th className="text-left px-4 py-2.5 text-[#888899] font-semibold">最后更新</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {configs.map((cfg) => (
              <tr key={cfg.key} className="border-t border-[#2e2e45] hover:bg-[#14141e] transition-colors">
                <td className="px-4 py-2.5 font-mono text-violet-300">{cfg.key}</td>
                <td className="px-4 py-2.5 text-[#a0a0c0]">
                  {editingKey === cfg.key ? (
                    <div className="flex gap-1.5 items-center">
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="bg-[#0f0f13] border border-violet-500/50 rounded px-2 py-1 text-xs text-white w-48 focus:outline-none"
                      />
                      <button
                        onClick={() => saveEdit(cfg.key)}
                        disabled={saving}
                        className="p-1 text-green-400 hover:text-green-300"
                      ><Check size={13} /></button>
                      <button
                        onClick={() => setEditingKey(null)}
                        className="p-1 text-[#555570] hover:text-white"
                      ><X size={13} /></button>
                    </div>
                  ) : (
                    <span>{maskValue(cfg.key, cfg.value)}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-[#555570]">
                  {cfg.updated_at ? new Date(cfg.updated_at).toLocaleString('zh-CN') : '-'}
                </td>
                <td className="px-4 py-2.5">
                  {editingKey !== cfg.key && (
                    <button
                      onClick={() => startEdit(cfg)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-[#666688] hover:text-white border border-[#2e2e45] hover:border-violet-500/40 rounded-lg transition-colors"
                    >
                      <Edit2 size={11} /> 编辑
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {configs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-[#555570]">暂无配置项</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Tab 2: 用户管理 ── */
function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${localStorage.getItem('pl_token')}` },
    })
      .then((r) => r.json())
      .then((d) => setUsers(d.users || d || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }, [])

  const toggleAdmin = async (u) => {
    const newRole = u.role === 2 ? 1 : 2
    setUpdatingId(u.id)
    try {
      const res = await fetch(`/api/admin/users/${u.id}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('pl_token')}`,
        },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) throw new Error('操作失败')
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, role: newRole } : x))
      setMsg(`已${newRole === 2 ? '设为管理员' : '取消管理员'}：${u.username}`)
      setTimeout(() => setMsg(''), 3000)
    } catch (err) {
      setMsg(err.message)
    } finally {
      setUpdatingId(null)
    }
  }

  const filtered = users.filter((u) =>
    !search || u.username?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="text-[#555570] text-sm py-8 text-center">加载中...</div>

  return (
    <div>
      {msg && <p className="text-xs text-green-400 mb-3">{msg}</p>}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜索用户名..."
        className="w-full max-w-xs bg-[#14141e] border border-[#2e2e45] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#444460] focus:outline-none focus:border-violet-500/60 mb-3"
      />
      <div className="border border-[#2e2e45] rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-[#1a1a2e]">
            <tr>
              <th className="text-left px-4 py-2.5 text-[#888899] font-semibold">用户名</th>
              <th className="text-left px-4 py-2.5 text-[#888899] font-semibold">邮箱</th>
              <th className="text-left px-4 py-2.5 text-[#888899] font-semibold">角色</th>
              <th className="text-left px-4 py-2.5 text-[#888899] font-semibold">注册时间</th>
              <th className="text-left px-4 py-2.5 text-[#888899] font-semibold">词库数</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-[#2e2e45] hover:bg-[#14141e] transition-colors">
                <td className="px-4 py-2.5 text-white font-medium">{u.username}</td>
                <td className="px-4 py-2.5 text-[#888899]">{u.email || '-'}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    u.role === 2 ? 'bg-violet-600/30 text-violet-300' : 'bg-[#2e2e45] text-[#888899]'
                  }`}>
                    {u.role === 2 ? '管理员' : '普通用户'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[#555570]">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString('zh-CN') : '-'}
                </td>
                <td className="px-4 py-2.5 text-[#888899]">{u.library_count ?? '-'}</td>
                <td className="px-4 py-2.5">
                  <button
                    onClick={() => toggleAdmin(u)}
                    disabled={updatingId === u.id}
                    className="px-2 py-1 text-xs border border-[#2e2e45] hover:border-violet-500/40 text-[#888899] hover:text-white rounded-lg transition-colors disabled:opacity-40"
                  >
                    {updatingId === u.id ? '...' : (u.role === 2 ? '取消管理员' : '设为管理员')}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[#555570]">
                  {search ? '未找到用户' : '暂无用户'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Tab 3: 词库审核 ── */
function LibrariesTab() {
  const [libs, setLibs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch('/api/admin/libraries', {
      headers: { Authorization: `Bearer ${localStorage.getItem('pl_token')}` },
    })
      .then((r) => r.json())
      .then((d) => setLibs(d.libraries || d || []))
      .catch(() => setLibs([]))
      .finally(() => setLoading(false))
  }, [])

  const setPrivate = async (lib) => {
    setUpdatingId(lib.id)
    try {
      const res = await fetch(`/api/admin/libraries/${lib.id}/visibility`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('pl_token')}`,
        },
        body: JSON.stringify({ visibility: 'private' }),
      })
      if (!res.ok) throw new Error('操作失败')
      setLibs((prev) => prev.map((l) => l.id === lib.id ? { ...l, visibility: 'private' } : l))
      setMsg(`词库「${lib.name}」已设为私有`)
      setTimeout(() => setMsg(''), 3000)
    } catch (err) {
      setMsg(err.message)
    } finally {
      setUpdatingId(null)
    }
  }

  const filtered = libs.filter((l) =>
    !search || l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.owner_username?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <div className="text-[#555570] text-sm py-8 text-center">加载中...</div>

  return (
    <div>
      {msg && <p className="text-xs text-green-400 mb-3">{msg}</p>}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜索词库名或作者..."
        className="w-full max-w-xs bg-[#14141e] border border-[#2e2e45] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#444460] focus:outline-none focus:border-violet-500/60 mb-3"
      />
      <div className="border border-[#2e2e45] rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-[#1a1a2e]">
            <tr>
              <th className="text-left px-4 py-2.5 text-[#888899] font-semibold">词库名</th>
              <th className="text-left px-4 py-2.5 text-[#888899] font-semibold">作者</th>
              <th className="text-left px-4 py-2.5 text-[#888899] font-semibold">可见性</th>
              <th className="text-left px-4 py-2.5 text-[#888899] font-semibold">词条数</th>
              <th className="text-left px-4 py-2.5 text-[#888899] font-semibold">创建时间</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lib) => (
              <tr key={lib.id} className="border-t border-[#2e2e45] hover:bg-[#14141e] transition-colors">
                <td className="px-4 py-2.5 text-white font-medium">{lib.name}</td>
                <td className="px-4 py-2.5 text-violet-300">@{lib.owner_username || '-'}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    lib.visibility === 'public' ? 'bg-green-600/20 text-green-400' : 'bg-[#2e2e45] text-[#555570]'
                  }`}>
                    {lib.visibility === 'public' ? '公开' : '私有'}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[#888899]">{lib.entry_count ?? '-'}</td>
                <td className="px-4 py-2.5 text-[#555570]">
                  {lib.created_at ? new Date(lib.created_at).toLocaleDateString('zh-CN') : '-'}
                </td>
                <td className="px-4 py-2.5">
                  {lib.visibility === 'public' && (
                    <button
                      onClick={() => setPrivate(lib)}
                      disabled={updatingId === lib.id}
                      className="flex items-center gap-1 px-2 py-1 text-xs border border-[#2e2e45] hover:border-red-500/40 text-[#888899] hover:text-red-400 rounded-lg transition-colors disabled:opacity-40"
                    >
                      <EyeOff size={11} /> {updatingId === lib.id ? '...' : '设为私有'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[#555570]">暂无词库</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Tab 4: 数据统计 ── */
function StatsTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${localStorage.getItem('pl_token')}` },
    })
      .then((r) => r.json())
      .then(setStats)
      .catch((e) => setError('加载失败：' + e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-[#555570] text-sm py-8 text-center">加载中...</div>
  if (error) return <div className="text-red-400 text-sm py-8 text-center">{error}</div>

  const cards = [
    { label: '总用户数', value: stats?.total_users ?? '-', color: 'violet' },
    { label: '总词库数', value: stats?.total_libraries ?? '-', color: 'sky' },
    { label: '总词条数', value: stats?.total_entries ?? '-', color: 'green' },
    { label: '今日注册', value: stats?.today_registrations ?? '-', color: 'amber' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`p-5 rounded-xl border bg-[#14141e] border-[#2e2e45] flex flex-col gap-1`}
        >
          <div className={`text-2xl font-bold ${
            c.color === 'violet' ? 'text-violet-300' :
            c.color === 'sky' ? 'text-sky-300' :
            c.color === 'green' ? 'text-green-300' :
            'text-amber-300'
          }`}>{c.value}</div>
          <div className="text-xs text-[#666688]">{c.label}</div>
        </div>
      ))}
    </div>
  )
}

/* ── Main AdminPanel ── */
export default function AdminPanel() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(0)
  const [checking, setChecking] = useState(true)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('pl_token')
    if (!token) {
      navigate('/')
      return
    }
    auth.getSelf()
      .then((u) => {
        if (u.role !== 2) {
          alert('无权限')
          navigate('/')
        } else {
          setAuthed(true)
        }
      })
      .catch(() => navigate('/'))
      .finally(() => setChecking(false))
  }, [navigate])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#666688]">
        验证权限...
      </div>
    )
  }

  if (!authed) return null

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a10]">
      {/* Header */}
      <header className="border-b border-[#1e1e2e] bg-[#0a0a10]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-[#666688] hover:text-white text-sm transition-colors"
            >
              <ArrowLeft size={14} /> PromptLib
            </button>
            <span className="text-[#444460]">/</span>
            <span className="text-white font-semibold text-sm">管理后台</span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[#1e1e2e] pb-0">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === i
                  ? 'border-violet-500 text-violet-300 bg-[#14141e]'
                  : 'border-transparent text-[#666688] hover:text-[#a0a0c0]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 0 && <ConfigTab />}
        {activeTab === 1 && <UsersTab />}
        {activeTab === 2 && <LibrariesTab />}
        {activeTab === 3 && <StatsTab />}
      </main>
    </div>
  )
}
