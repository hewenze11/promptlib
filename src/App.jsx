import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, FileText, Info, LogIn, LogOut, User, Cloud, CloudOff, Settings } from 'lucide-react'
import Editor from './Editor'
import EntryManager from './EntryManager'
import OutputPanel from './OutputPanel'
import Toolbar from './Toolbar'
import AuthModal from './AuthModal'
import LibraryList from './LibraryList'
import { loadEntries, saveEntries } from './storage'
import { auth, libraries as librariesApi, entries as entriesApi, activelibsApi } from './api'

const TABS = [
  { id: 'editor', label: '编辑器', icon: FileText },
  { id: 'library', label: '词库管理', icon: BookOpen },
]

function normalizeEntry(entry) {
  return {
    id: entry.id,
    title: entry.title,
    description: entry.description || '',
    color: entry.color || '#7c3aed',
  }
}

export default function App() {
  const [localEntries, setLocalEntries] = useState(() => loadEntries())
  const [output, setOutput] = useState('')
  const [tab, setTab] = useState('editor')
  const [showHelp, setShowHelp] = useState(false)
  const [colorMode, setColorMode] = useState('uniform')

  const [searchParams] = useSearchParams()
  const [initText] = useState(() => searchParams.get('text') || '')

  const [user, setUser] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [cloudMode, setCloudMode] = useState(false)

  const [selectedLibId, setSelectedLibId] = useState('__local__')
  const [activeLibIds, setActiveLibIds] = useState(['__local__'])
  const [activeLibEntries, setActiveLibEntries] = useState([])
  const [libEntriesCache, setLibEntriesCache] = useState(() => ({ '__local__': loadEntries() }))
  const [libMetaCache, setLibMetaCache] = useState({ '__local__': { name: '本地词库', slug: '__local__' } })

  const updateMergedEntries = useCallback((activeIds, cache) => {
    const merged = []
    const seenEntryIds = new Set()

    for (const id of activeIds) {
      const sourceEntries = id === '__local__' ? localEntries : (cache[id] || [])
      for (const rawEntry of sourceEntries) {
        const entry = normalizeEntry(rawEntry)
        const dedupeKey = `${id}:${entry.id}`
        if (seenEntryIds.has(dedupeKey)) continue
        seenEntryIds.add(dedupeKey)
        merged.push({ ...entry, sourceLibraryId: id })
      }
    }

    setActiveLibEntries(merged)
  }, [localEntries])

  const persistActiveLibs = useCallback(async (newActiveIds) => {
    if (!user) return
    const cloudIds = newActiveIds.filter((id) => id !== '__local__')
    await activelibsApi.put(cloudIds)
  }, [user])

  const syncFromCloud = useCallback(async (u) => {
    try {
      const libs = await librariesApi.list()
      const libList = Array.isArray(libs) ? libs : []

      const metaCache = { '__local__': { name: '本地词库', slug: '__local__' } }
      for (const lib of libList) {
        metaCache[lib.id] = { name: lib.name, slug: lib.slug, visibility: lib.visibility, isSystem: !!lib.is_system }
      }
      setLibMetaCache(metaCache)

      let activeLibsPayload = []
      try {
        activeLibsPayload = await activelibsApi.get()
      } catch {
        activeLibsPayload = []
      }

      let derivedActiveIds = []
      const cache = { '__local__': localEntries }

      if (Array.isArray(activeLibsPayload) && activeLibsPayload.length > 0) {
        for (const item of activeLibsPayload) {
          const libId = item.library_id || item.id
          if (!libId) continue
          if (!derivedActiveIds.includes(libId)) derivedActiveIds.push(libId)

          if (Array.isArray(item.entries)) {
            cache[libId] = item.entries.map(normalizeEntry)
          } else {
            try {
              const entries = await entriesApi.list(libId)
              cache[libId] = entries.map(normalizeEntry)
            } catch {
              cache[libId] = []
            }
          }
        }
      }

      if (derivedActiveIds.length === 0 && libList.length > 0) {
        const preferred = libList.find((lib) => !lib.is_system) || libList[0]
        derivedActiveIds = preferred ? [preferred.id] : []
      }

      if (libList.length === 1 && libList[0]?.is_system && localEntries.length > 0) {
        derivedActiveIds = ['__local__', libList[0].id]
      }

      if (derivedActiveIds.length === 0) {
        derivedActiveIds = ['__local__']
      }

      setCloudMode(true)
      setSelectedLibId((prev) => prev && (prev === '__local__' || libList.some((lib) => lib.id === prev)) ? prev : derivedActiveIds[0] || libList[0]?.id || '__local__')
      setActiveLibIds(derivedActiveIds)
      setLibEntriesCache(cache)
      updateMergedEntries(derivedActiveIds, cache)

      if ((activeLibsPayload?.length || 0) === 0 && derivedActiveIds.some((id) => id !== '__local__')) {
        persistActiveLibs(derivedActiveIds).catch(() => {})
      }

      if (libList.length === 0) {
        const newLib = await librariesApi.create({
          name: '我的词库',
          slug: `${(u?.username || 'user')}-default`,
          visibility: 'public',
        })
        const localEnts = loadEntries()
        for (const e of localEnts) {
          await entriesApi.create(newLib.id, normalizeEntry(e)).catch(() => {})
        }
        const nextCache = { '__local__': localEntries, [newLib.id]: localEnts.map(normalizeEntry) }
        const nextMeta = {
          ...metaCache,
          [newLib.id]: { name: newLib.name, slug: newLib.slug, visibility: newLib.visibility, isSystem: !!newLib.is_system },
        }
        setLibMetaCache(nextMeta)
        setLibEntriesCache(nextCache)
        setActiveLibIds([newLib.id])
        setSelectedLibId(newLib.id)
        updateMergedEntries([newLib.id], nextCache)
        persistActiveLibs([newLib.id]).catch(() => {})
      }
    } catch (err) {
      console.warn('cloud sync failed, using local', err)
      setCloudMode(false)
      setActiveLibIds(['__local__'])
      setLibEntriesCache({ '__local__': localEntries })
      updateMergedEntries(['__local__'], { '__local__': localEntries })
    }
  }, [localEntries, persistActiveLibs, updateMergedEntries])

  useEffect(() => {
    const token = localStorage.getItem('pl_token')
    if (!token) return

    auth.getSelf()
      .then((u) => {
        setUser(u)
        syncFromCloud(u)
      })
      .catch(() => {
        localStorage.removeItem('pl_token')
        setCloudMode(false)
        setActiveLibIds(['__local__'])
        setLibEntriesCache({ '__local__': localEntries })
      })
  }, [localEntries, syncFromCloud])

  const handleActiveLibsChange = useCallback(async (newActiveIds) => {
    const uniqueIds = [...new Set(newActiveIds)]
    setActiveLibIds(uniqueIds)

    const cache = { ...libEntriesCache, '__local__': localEntries }
    for (const id of uniqueIds) {
      if (id === '__local__') continue
      if (!cache[id]) {
        try {
          const fetched = await entriesApi.list(id)
          cache[id] = fetched.map(normalizeEntry)
        } catch {
          cache[id] = []
        }
      }
    }

    setLibEntriesCache(cache)
    updateMergedEntries(uniqueIds, cache)
    persistActiveLibs(uniqueIds).catch((err) => console.warn('save active libs failed', err))
  }, [libEntriesCache, localEntries, persistActiveLibs, updateMergedEntries])

  const activeLibraries = activeLibIds.map((id) => ({
    id,
    name: (libMetaCache[id] || {}).name || (id === '__local__' ? '本地词库' : id.slice(0, 8)),
    entries: (id === '__local__' ? localEntries : (libEntriesCache[id] || [])).map(normalizeEntry),
  }))

  const handleEntriesChange = useCallback((libId, newEntries) => {
    const normalizedEntries = newEntries.map(normalizeEntry)

    if (libId === '__local__') {
      setLocalEntries(normalizedEntries)
      saveEntries(normalizedEntries)
    }

    setLibEntriesCache((prev) => {
      const next = { ...prev, [libId]: normalizedEntries, '__local__': libId === '__local__' ? normalizedEntries : localEntries }
      updateMergedEntries(activeLibIds, next)
      return next
    })
  }, [activeLibIds, localEntries, updateMergedEntries])

  const handleToolbarImport = useCallback(({ targetLibId = '__local__', mode = 'merge', entries }) => {
    const importedEntries = entries.map(normalizeEntry)

    if (targetLibId !== '__local__') return

    const nextEntries = mode === 'replace'
      ? importedEntries
      : [...localEntries, ...importedEntries.filter((entry) => !localEntries.some((existing) => existing.id === entry.id || existing.title === entry.title))]

    setLocalEntries(nextEntries)
    saveEntries(nextEntries)

    setLibEntriesCache((prev) => {
      const next = { ...prev, '__local__': nextEntries }
      updateMergedEntries(activeLibIds, next)
      return next
    })
  }, [activeLibIds, localEntries, updateMergedEntries])

  const handleLibrariesReload = useCallback(async ({ selectedId } = {}) => {
    if (!user) return
    const libs = await librariesApi.list()
    const metaCache = { '__local__': { name: '本地词库', slug: '__local__' } }
    for (const lib of libs) {
      metaCache[lib.id] = { name: lib.name, slug: lib.slug, visibility: lib.visibility, isSystem: !!lib.is_system }
    }
    setLibMetaCache(metaCache)

    if (selectedId) {
      setSelectedLibId(selectedId)
      if (!activeLibIds.includes(selectedId)) {
        handleActiveLibsChange([...activeLibIds, selectedId])
      }
    } else if (!selectedLibId && libs[0]) {
      setSelectedLibId(libs[0].id)
    }
  }, [activeLibIds, handleActiveLibsChange, selectedLibId, user])

  const handleLogout = () => {
    localStorage.removeItem('pl_token')
    setUser(null)
    setCloudMode(false)
    setActiveLibIds(['__local__'])
    setLibEntriesCache({ '__local__': loadEntries() })
    setActiveLibEntries([])
    setSelectedLibId('__local__')
    setLocalEntries(loadEntries())
    setLibMetaCache({ '__local__': { name: '本地词库', slug: '__local__' } })
  }

  const editorEntries = cloudMode ? activeLibEntries : localEntries

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[#1e1e2e] bg-[#0a0a10]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center text-white font-bold text-xs">P</div>
            <span className="font-semibold text-white text-sm tracking-wide">PromptLib</span>
            <span className="text-xs text-[#444460] hidden sm:block">提示词片段库</span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className={`flex items-center gap-1 text-xs ${cloudMode ? 'text-violet-400' : 'text-[#555570]'}`}>
                {cloudMode ? <Cloud size={12} /> : <CloudOff size={12} />}
                {cloudMode ? '云端同步' : '本地模式'}
              </span>
            )}

            <Toolbar entries={localEntries} onImport={handleToolbarImport} disabled={cloudMode && selectedLibId !== '__local__'} />

            {user ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-[#a0a0c0]">
                  <User size={12} /> {user.username}
                </span>
                {user.role === 2 && (
                  <button
                    onClick={() => { window.location.href = '/admin' }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-violet-300 hover:text-violet-200 bg-violet-600/10 hover:bg-violet-600/20 rounded-lg border border-violet-600/20 transition-colors"
                    title="管理后台"
                  >
                    <Settings size={12} /> 管理后台
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-[#555570] hover:text-red-400 transition-colors"
                  title="退出登录"
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 rounded-lg border border-violet-600/30 transition-colors"
              >
                <LogIn size={13} /> 登录 / 注册
              </button>
            )}

            <button
              onClick={() => setShowHelp((v) => !v)}
              className="p-1.5 text-[#555570] hover:text-violet-300 transition-colors"
              title="使用说明"
            >
              <Info size={16} />
            </button>
          </div>
        </div>
      </header>

      {showHelp && (
        <div className="bg-[#14141e] border-b border-[#1e1e2e] text-sm text-[#a0a0c0]">
          <div className="max-w-6xl mx-auto px-6 py-4 grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-violet-300 font-semibold mb-2">如何使用</p>
              <ol className="list-decimal list-inside space-y-1 text-xs leading-relaxed">
                <li>在「词库管理」中添加词条（名称 + 详细注释）</li>
                <li>在编辑器中输入 <code className="bg-[#1e1e30] px-1 rounded">@</code> 然后输入词条名来引用</li>
                <li>点击词条可切换：<span className="text-violet-300">◆ A模式</span>（注释附加到开头）/ <span className="text-[#666688]">◇ B模式</span>（只输出标题）</li>
                <li>点击「生成文本」，A模式词条的完整注释会自动附加</li>
              </ol>
            </div>
            <div>
              <p className="text-violet-300 font-semibold mb-2">多词库</p>
              <ul className="list-disc list-inside space-y-1 text-xs leading-relaxed">
                <li>词库管理页左栏可新建/切换多个词库</li>
                <li>点击绿点激活词库，编辑器 @ 引用所有激活词库的词条</li>
                <li>可从他人词库链接导入（Fork）</li>
                <li>登录后自动同步到云端，多设备共享</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-[#1e1e2e]">
        <div className="max-w-6xl mx-auto px-6 flex gap-1 pt-2">
          {TABS.map((tabItem) => {
            const TabIcon = tabItem.icon
            return (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                tab === tabItem.id
                  ? 'border-violet-500 text-violet-300 bg-[#14141e]'
                  : 'border-transparent text-[#666688] hover:text-[#a0a0c0]'
              }`}
            >
              <TabIcon size={14} />
              {tabItem.label}
              {tabItem.id === 'library' && editorEntries.length > 0 && (
                <span className="ml-1 text-[10px] bg-violet-600/30 text-violet-300 px-1.5 py-0.5 rounded-full">
                  {editorEntries.length}
                </span>
              )}
            </button>
            )
          })}
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-6">
        {tab === 'editor' && (
          <div className="flex flex-col gap-6">
            {activeLibIds.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-[#555570]">激活词库：</span>
                {activeLibIds.map((id) => {
                  const count = (id === '__local__' ? localEntries : (libEntriesCache[id] || [])).length
                  const label = (libMetaCache[id] || {}).name || (id === '__local__' ? '本地词库' : id.slice(0, 8))
                  return (
                    <span key={id} className="flex items-center gap-1 text-[10px] bg-[#14141e] border border-[#2e2e45] text-violet-300 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                      {label}
                      <span className="text-[#555570] ml-0.5">{count}</span>
                    </span>
                  )
                })}
                {activeLibIds.length === 0 && (
                  <span className="text-[10px] text-[#555570]">无激活词库，切换到「词库管理」激活词库</span>
                )}
              </div>
            )}

            {editorEntries.length === 0 && (
              <div className="text-xs text-[#555570] bg-[#14141e] border border-[#2e2e45] rounded-lg px-4 py-3">
                词库为空。切换到「词库管理」添加词条后，即可在编辑器中使用 @ 引用。
              </div>
            )}
            <section>
              <h2 className="text-xs font-semibold text-[#666688] uppercase tracking-wider mb-3">编辑区</h2>
              <Editor
                entries={editorEntries}
                activeLibraries={activeLibraries}
                colorMode={colorMode}
                onColorModeChange={setColorMode}
                onGenerate={setOutput}
                initialText={initText}
              />
            </section>
            {output && (
              <section>
                <h2 className="text-xs font-semibold text-[#666688] uppercase tracking-wider mb-3">生成结果</h2>
                <OutputPanel text={output} onClear={() => setOutput('')} onTextChange={setOutput} />
              </section>
            )}
          </div>
        )}

        {tab === 'library' && (
          <div className="flex gap-6 min-h-[500px]">
            <div className="w-56 shrink-0 flex flex-col">
              <LibraryList
                user={user}
                selectedLibId={selectedLibId}
                onSelectLib={setSelectedLibId}
                activeLibIds={activeLibIds}
                onActiveLibsChange={handleActiveLibsChange}
                onLibrariesReload={handleLibrariesReload}
              />
            </div>

            <div className="flex-1 min-w-0">
              {selectedLibId ? (
                <div>
                  <div className="mb-4">
                    <h2 className="text-sm font-semibold text-white mb-1">词条管理</h2>
                    <p className="text-xs text-[#666688]">
                      词条由「名称」和「详细注释」组成。在编辑器中输入 @ 名称来引用词条。
                      {cloudMode && selectedLibId !== '__local__' && (
                        <span className="ml-1 text-violet-400">· 云端同步已开启</span>
                      )}
                    </p>
                  </div>
                  <EntryManager
                    entries={selectedLibId === '__local__' ? localEntries : (libEntriesCache[selectedLibId] || [])}
                    onChange={(newEntries) => handleEntriesChange(selectedLibId, newEntries)}
                    libId={selectedLibId}
                    cloudMode={cloudMode && selectedLibId !== '__local__'}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-[#555570] text-sm">
                  请在左侧选择一个词库
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-[#1e1e2e] text-center py-4 text-xs text-[#333350]">
        PromptLib v2.0.1 · {user ? `已登录为 ${user.username}` : '数据保存在本地浏览器'}
      </footer>

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onLogin={(u) => {
            setUser(u)
            syncFromCloud(u)
          }}
        />
      )}
    </div>
  )
}
