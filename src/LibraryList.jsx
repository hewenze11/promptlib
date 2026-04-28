import { useState, useEffect, useCallback } from 'react'
import { Plus, Share2, Check, Link, Globe, Lock, X, ChevronRight, Download, Trash2 } from 'lucide-react'
import { libraries as librariesApi } from './api'

export default function LibraryList({
  user,
  selectedLibId,
  onSelectLib,
  activeLibIds,
  onActiveLibsChange,
  onLibrariesReload,
}) {
  const [libs, setLibs] = useState([])
  const [loading, setLoading] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', slug: '', visibility: 'public' })
  const [newFormError, setNewFormError] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const fetchLibs = useCallback(async () => {
    if (!user) {
      setLibs([{ id: '__local__', name: '本地词库', slug: 'local', visibility: 'private', isLocal: true }])
      return
    }

    setLoading(true)
    try {
      const data = await librariesApi.list()
      setLibs(data)
      if (!selectedLibId && data.length > 0) {
        const preferred = data.find((lib) => !lib.is_system) || data[0]
        onSelectLib(preferred.id)
      }
    } catch (err) {
      console.warn('Failed to load libraries', err)
    } finally {
      setLoading(false)
    }
  }, [user, selectedLibId, onSelectLib])

  useEffect(() => {
    fetchLibs()
  }, [fetchLibs])

  useEffect(() => {
    if (!user) {
      const localLib = { id: '__local__', name: '本地词库', slug: 'local', visibility: 'private', isLocal: true }
      setLibs([localLib])
      if (!selectedLibId) onSelectLib('__local__')
    }
  }, [user, selectedLibId, onSelectLib])

  const handleToggleActive = async (libId) => {
    const newActive = activeLibIds.includes(libId)
      ? activeLibIds.filter((id) => id !== libId)
      : [...activeLibIds, libId]
    await onActiveLibsChange(newActive)
  }

  const handleCreateLib = async () => {
    const name = newForm.name.trim()
    const slug = newForm.slug.trim()
    if (!name) return setNewFormError('请输入词库名称')
    if (!slug) return setNewFormError('请输入词库标识符 (slug)')
    if (!/^[a-z0-9_-]+$/.test(slug)) return setNewFormError('slug 只能包含小写字母、数字、连字符和下划线')

    try {
      const lib = await librariesApi.create({ name, slug, visibility: newForm.visibility })
      setLibs((prev) => [lib, ...prev])
      setShowNewForm(false)
      setNewForm({ name: '', slug: '', visibility: 'public' })
      setNewFormError('')
      onSelectLib(lib.id)
      await onLibrariesReload?.({ selectedId: lib.id })
    } catch (err) {
      setNewFormError(err?.response?.data?.error || '创建失败，请重试')
    }
  }

  const handleCopyShare = (lib) => {
    if (!user) return
    const link = `${window.location.origin}/@${user.username}/${lib.slug}`
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(lib.id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const handleDeleteLib = (lib) => {
    if (lib.is_system) {
      alert('系统词库不可删除')
      return
    }
    setDeleteConfirm(lib)
    setDeleteError('')
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await librariesApi.del(deleteConfirm.id)
      const remaining = libs.filter((l) => l.id !== deleteConfirm.id)
      setLibs(remaining)
      const nextActive = activeLibIds.filter((id) => id !== deleteConfirm.id)
      await onActiveLibsChange(nextActive)

      if (selectedLibId === deleteConfirm.id) {
        const preferred = remaining.find((lib) => !lib.is_system) || remaining[0] || { id: '__local__' }
        onSelectLib(preferred.id)
      }

      await onLibrariesReload?.({ selectedId: selectedLibId === deleteConfirm.id ? undefined : selectedLibId })
      setDeleteConfirm(null)
    } catch (err) {
      setDeleteError(err?.response?.data?.error || '删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }

  const handleImportFromUrl = async () => {
    const url = importUrl.trim()
    if (!url) return

    setImportError('')
    setImportSuccess('')

    const match = url.match(/\/@([\w-]+)\/([\w-]+)/)
    if (!match) {
      setImportError('格式不正确，请粘贴类似 /@用户名/slug 的链接')
      return
    }

    if (!user) {
      setImportError('请先登录后再导入词库')
      return
    }

    const [, username, slug] = match
    setImporting(true)
    try {
      const lib = await librariesApi.fork(username, slug)
      setLibs((prev) => [lib, ...prev])
      setImportUrl('')
      setImportSuccess(`已成功导入词库「${lib.name}」`)
      onSelectLib(lib.id)
      await onLibrariesReload?.({ selectedId: lib.id })
      await onActiveLibsChange([...activeLibIds, lib.id])
      setTimeout(() => setImportSuccess(''), 3000)
    } catch (err) {
      setImportError(`导入失败：${err?.response?.data?.error || err.message}`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-[#888899] uppercase tracking-wider">我的词库</span>
        {user && (
          <button
            onClick={() => setShowNewForm((v) => !v)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-violet-300 hover:text-violet-200 bg-violet-600/10 hover:bg-violet-600/20 rounded-lg border border-violet-600/20 transition-colors"
          >
            <Plus size={12} /> 新建
          </button>
        )}
      </div>

      {showNewForm && (
        <div className="mb-3 p-3 rounded-xl bg-[#14141e] border border-violet-500/30 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-violet-300">新建词库</span>
            <button onClick={() => { setShowNewForm(false); setNewFormError('') }} className="text-[#555570] hover:text-white"><X size={13} /></button>
          </div>
          <input
            autoFocus
            value={newForm.name}
            onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="词库名称"
            className="bg-[#0f0f13] border border-[#2e2e45] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#444460] focus:outline-none focus:border-violet-500/70"
          />
          <input
            value={newForm.slug}
            onChange={(e) => setNewForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s/g, '-') }))}
            placeholder="标识符 (slug)，如：my-lib"
            className="bg-[#0f0f13] border border-[#2e2e45] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#444460] focus:outline-none focus:border-violet-500/70 font-mono"
          />
          <select
            value={newForm.visibility}
            onChange={(e) => setNewForm((f) => ({ ...f, visibility: e.target.value }))}
            className="bg-[#0f0f13] border border-[#2e2e45] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/70"
          >
            <option value="public">公开</option>
            <option value="private">私有</option>
          </select>
          {newFormError && <p className="text-xs text-red-400">{newFormError}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowNewForm(false); setNewFormError('') }} className="px-3 py-1 text-xs text-[#666688] hover:text-white transition-colors">取消</button>
            <button onClick={handleCreateLib} className="px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg transition-colors">创建</button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1 flex-1 overflow-y-auto">
        {loading && <div className="text-xs text-[#555570] py-4 text-center">加载中…</div>}
        {libs.map((lib) => {
          const isActive = activeLibIds.includes(lib.id)
          const isSelected = selectedLibId === lib.id
          return (
            <div
              key={lib.id}
              onClick={() => onSelectLib(lib.id)}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                isSelected ? 'bg-[#1e1e30] border border-violet-500/30' : 'hover:bg-[#14141e] border border-transparent'
              }`}
            >
              <button
                onClick={(e) => { e.stopPropagation(); handleToggleActive(lib.id) }}
                title={isActive ? '已激活（点击取消）' : '未激活（点击激活）'}
                className="shrink-0 w-3 h-3 rounded-full border-2 transition-all hover:scale-110"
                style={{
                  background: isActive ? '#22c55e' : 'transparent',
                  borderColor: isActive ? '#22c55e' : '#444460',
                }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm truncate ${isSelected ? 'text-white' : 'text-[#a0a0c0]'}`}>{lib.name}</span>
                  {lib.visibility === 'public' ? (
                    <Globe size={10} className="text-[#444460] shrink-0" />
                  ) : (
                    <Lock size={10} className="text-[#444460] shrink-0" />
                  )}
                </div>
                {lib.slug && !lib.isLocal && (
                  <div className="text-[10px] text-[#555570] font-mono truncate">{lib.slug}</div>
                )}
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                {isSelected && <ChevronRight size={12} className="text-violet-400" />}
                {user && !lib.isLocal && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopyShare(lib) }}
                    className="p-1 rounded hover:bg-[#252538] text-[#555570] hover:text-violet-300 transition-colors"
                    title="复制分享链接"
                  >
                    {copiedId === lib.id ? <Check size={11} className="text-green-400" /> : <Share2 size={11} />}
                  </button>
                )}
                {user && !lib.isLocal && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteLib(lib) }}
                    className={`p-1 rounded hover:bg-[#252538] transition-colors ${
                      lib.is_system ? 'text-[#333350] cursor-not-allowed' : 'text-[#555570] hover:text-red-400'
                    }`}
                    title={lib.is_system ? '系统词库不可删除' : '删除词库'}
                    disabled={lib.is_system}
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-[#1e1e2e]">
        <p className="text-[10px] text-[#555570] mb-1.5 flex items-center gap-1">
          <Download size={10} /> 从链接导入词库
        </p>
        <div className="flex gap-1.5">
          <input
            value={importUrl}
            onChange={(e) => { setImportUrl(e.target.value); setImportError(''); setImportSuccess('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleImportFromUrl()}
            placeholder="粘贴 /@用户名/slug 链接"
            className="flex-1 bg-[#0f0f13] border border-[#2e2e45] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[#333350] focus:outline-none focus:border-violet-500/50 font-mono"
          />
          <button
            onClick={handleImportFromUrl}
            disabled={importing || !importUrl.trim()}
            className="px-2.5 py-1.5 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 text-xs rounded-lg border border-violet-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            <Link size={11} /> {importing ? '…' : '导入'}
          </button>
        </div>
        {importError && <p className="text-[11px] text-red-400 mt-1">{importError}</p>}
        {importSuccess && <p className="text-[11px] text-green-400 mt-1">{importSuccess}</p>}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-[#14141e] border border-[#2e2e45] rounded-xl p-5 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white mb-2">确定要删除词库「{deleteConfirm.name}」吗？</h3>
            <p className="text-xs text-[#888899] mb-4">此操作不可恢复，词库内所有词条将被删除。</p>
            {deleteError && <p className="text-xs text-red-400 mb-2">{deleteError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs text-[#666688] hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
              >
                {deleting ? '删除中...' : '确定删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
