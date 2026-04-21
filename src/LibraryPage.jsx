import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { GitFork, Star, ArrowLeft, Copy, Check, Download, LogIn } from 'lucide-react'
import { libraries, entries as entriesApi, auth } from './api'
import { saveEntries, loadEntries } from './storage'

export default function LibraryPage() {
  const { username, slug } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [lib, setLib] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [imported, setImported] = useState(false)
  const [user, setUser] = useState(null)

  // 原语句（来自 URL ?text=xxx）
  const sharedText = searchParams.get('text') || ''

  useEffect(() => {
    // 检查登录状态
    const token = localStorage.getItem('pl_token')
    if (token) {
      auth.getSelf().then(setUser).catch(() => {})
    }

    // 加载词库
    fetch(`/api/users/${username}/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error('词库不存在或无权限访问')
        return r.json()
      })
      .then((data) => {
        setLib(data.library)
        setEntries(data.entries || [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [username, slug])

  // 复制分享链接
  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // 一键导入到本地（未登录）
  const importToLocal = () => {
    const mapped = entries.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      color: e.color || '#7c3aed',
    }))
    const existing = loadEntries()
    // 去重：不覆盖已有同名词条
    const newOnes = mapped.filter((e) => !existing.find((x) => x.title === e.title))
    saveEntries([...existing, ...newOnes])
    setImported(true)

    // 如果有原语句，跳转到编辑器并带上 text 参数
    if (sharedText) {
      navigate(`/?text=${encodeURIComponent(sharedText)}`)
    } else {
      navigate('/')
    }
  }

  // Fork 到云端（已登录）
  const forkToCloud = async () => {
    try {
      await fetch(`/api/users/${username}/${slug}/fork`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('pl_token')}` },
      })
      setImported(true)
      if (sharedText) {
        navigate(`/?text=${encodeURIComponent(sharedText)}`)
      } else {
        navigate('/')
      }
    } catch {
      alert('Fork 失败，请稍后再试')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#666688]">
        加载中...
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-[#666688]">
        <p className="text-red-400">{error}</p>
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-violet-400 hover:text-violet-300 text-sm">
          <ArrowLeft size={14} /> 返回首页
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a10]">
      {/* Header */}
      <header className="border-b border-[#1e1e2e] bg-[#0a0a10]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-[#666688] hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={14} /> PromptLib
          </button>
          <button
            onClick={copyShareLink}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#888899] hover:text-white border border-[#2a2a40] rounded-lg transition-colors"
          >
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            {copied ? '已复制' : '复制链接'}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
        {/* 词库信息 */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[#666688] text-sm mb-2">
                <span className="text-violet-400 font-medium">@{username}</span>
                <span>/</span>
                <span className="text-white font-semibold">{lib?.name || slug}</span>
              </div>
              {lib?.description && (
                <p className="text-sm text-[#888899]">{lib.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-[#555570]">
                <span className="flex items-center gap-1"><Star size={11} /> {lib?.star_count || 0}</span>
                <span>{entries.length} 个词条</span>
                {lib?.tags?.length > 0 && lib.tags.map((t) => (
                  <span key={t.name} className="bg-violet-600/20 text-violet-400 px-2 py-0.5 rounded">{t.name}</span>
                ))}
              </div>
            </div>

            {/* 导入按钮 */}
            <div className="shrink-0">
              {user ? (
                <button
                  onClick={forkToCloud}
                  disabled={imported}
                  className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
                >
                  <GitFork size={14} />
                  {imported ? '已导入' : 'Fork 到我的词库'}
                </button>
              ) : (
                <div className="flex flex-col gap-2 items-end">
                  <button
                    onClick={importToLocal}
                    disabled={imported}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#1a1a2e] hover:bg-[#252540] border border-[#2a2a40] disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
                  >
                    <Download size={14} />
                    {imported ? '已导入' : '导入到本地'}
                  </button>
                  <p className="text-[10px] text-[#444460]">
                    <button onClick={() => navigate('/')} className="text-violet-400 hover:text-violet-300">登录</button>
                    {' '}后可 Fork 到云端
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 原语句预览 */}
        {sharedText && (
          <div className="mb-6 p-4 rounded-xl bg-[#14141e] border border-violet-500/30">
            <p className="text-xs text-violet-400 font-semibold mb-2">附带原语句</p>
            <p className="text-sm text-[#c0c0d8] leading-relaxed whitespace-pre-wrap">
              {sharedText.split(/(@[\w\u4e00-\u9fa5\-_]+)/g).map((part, i) => {
                if (part.startsWith('@')) {
                  const name = part.slice(1)
                  const found = entries.find((e) => e.title === name)
                  return (
                    <span
                      key={i}
                      style={{ color: found?.color || '#a78bfa', background: (found?.color || '#7c3aed') + '22' }}
                      className="px-1 py-0.5 rounded font-medium"
                    >
                      {part}
                    </span>
                  )
                }
                return <span key={i}>{part}</span>
              })}
            </p>
          </div>
        )}

        {/* 词条列表 */}
        <div>
          <h2 className="text-xs font-semibold text-[#666688] uppercase tracking-wider mb-3">
            词条（{entries.length}）
          </h2>
          <div className="flex flex-col gap-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-[#14141e] border border-[#2e2e45]"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0 mt-1"
                  style={{ background: entry.color || '#7c3aed' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-violet-300">@{entry.title}</div>
                  <div className="text-xs text-[#888899] mt-0.5 leading-relaxed line-clamp-3">
                    {entry.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
