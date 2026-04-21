import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, FileText, Info, LogIn, LogOut, User, Cloud, CloudOff } from 'lucide-react'
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

export default function App() {
  // ── 本地状态 ──
  const [localEntries, setLocalEntries] = useState(() => loadEntries())
  const [output, setOutput] = useState('')
  const [tab, setTab] = useState('editor')
  const [showHelp, setShowHelp] = useState(false)
  const [colorMode, setColorMode] = useState('uniform')

  // ── URL 参数 ──
  const [searchParams] = useSearchParams()
  const [initText] = useState(() => searchParams.get('text') || '')

  // ── 登录状态 ──
  const [user, setUser] = useState(null)
  const [showAuth, setShowAuth] = useState(false)
  const [cloudMode, setCloudMode] = useState(false)

  // ── 多词库状态 ──
  const [selectedLibId, setSelectedLibId] = useState(null)   // 当前词库管理页选中的词库
  const [activeLibIds, setActiveLibIds] = useState([])       // 激活的词库（编辑器 @ 使用）
  const [activeLibEntries, setActiveLibEntries] = useState([]) // 所有激活词库的词条合并
  const [libEntriesCache, setLibEntriesCache] = useState({})  // libId → entries[]
  const [libMetaCache, setLibMetaCache] = useState({})        // libId → {name, slug}

  // ── 初始化：检查 token ──
  useEffect(() => {
    const token = localStorage.getItem('pl_token')
    if (!token) {
      // 未登录：激活本地词库
      setActiveLibIds(['__local__'])
      setLibMetaCache({ '__local__': { name: '本地词库', slug: '__local__' } })
      return
    }
    auth.getSelf()
      .then((u) => { setUser(u); syncFromCloud(u) })
      .catch(() => {
        localStorage.removeItem('pl_token')
        setActiveLibIds(['__local__'])
      })
  }, [])

  // ── 云端初始化：拉取词库列表 + 激活词库 ──
  const syncFromCloud = useCallback(async (u) => {
    try {
      const libs = await librariesApi.list()
      const libList = libs.data || libs || []

      if (libList.length === 0) {
        // 首次登录：迁移本地词条
        const newLib = await librariesApi.create({
          name: '我的词库',
          slug: `${(u?.username || 'user')}-default`,
          visibility: 'public',
        })
        const localEnts = loadEntries()
        for (const e of localEnts) {
          await entriesApi.create(newLib.id, {
            id: e.id,
            title: e.title,
            description: e.description || '',
            color: e.color || '#7c3aed',
          }).catch(() => {})
        }
        libList.push(newLib)
      }

      // 拉取激活词库
      let activeIds = []
      try {
        const activeRes = await activelibsApi.get()
        activeIds = activeRes.ids || activeRes || []
      } catch {
        // default: first lib
        activeIds = libList.length > 0 ? [libList[0].id] : []
      }
      if (activeIds.length === 0 && libList.length > 0) {
        activeIds = [libList[0].id]
      }

      setActiveLibIds(activeIds)
      setSelectedLibId(libList[0]?.id || null)
      setCloudMode(true)

      // 构建词库元数据缓存
      const metaCache = { '__local__': { name: '本地词库', slug: '__local__' } }
      for (const lib of libList) {
        metaCache[lib.id] = { name: lib.name, slug: lib.slug }
      }
      setLibMetaCache(metaCache)

      // 拉取所有激活词库的词条
      const cache = {}
      for (const id of activeIds) {
        try {
          const res = await entriesApi.list(id)
          cache[id] = (res.data || res || []).map((e) => ({
            id: e.id, title: e.title, description: e.description, color: e.color,
          }))
        } catch { cache[id] = [] }
      }
      setLibEntriesCache(cache)
      updateMergedEntries(activeIds, cache)
    } catch (err) {
      console.warn('cloud sync failed, using local', err)
      setActiveLibIds(['__local__'])
    }
  }, [])

  // ── 合并所有激活词库词条 ──
  const updateMergedEntries = (activeIds, cache) => {
    // Merge, handle conflicts by prefixing lib id
    const merged = []
    const titleCount = {}
    for (const id of activeIds) {
      for (const e of (cache[id] || [])) {
        titleCount[e.title] = (titleCount[e.title] || 0) + 1
      }
    }
    for (const id of activeIds) {
      for (const e of (cache[id] || [])) {
        if (titleCount[e.title] > 1) {
          // prefix with lib slug (use id slice as fallback)
          merged.push({ ...e, title: `${id.slice(0, 6)}/${e.title}` })
        } else {
          merged.push(e)
        }
      }
    }
    setActiveLibEntries(merged)
    // Also save to local so Tiptap mentions stay in sync
    saveEntries(merged)
  }

  // ── 激活词库变更 ──
  const handleActiveLibsChange = useCallback(async (newActiveIds) => {
    setActiveLibIds(newActiveIds)
    // Fetch any missing entries
    const cache = { ...libEntriesCache }
    for (const id of newActiveIds) {
      if (!cache[id] && id !== '__local__' && cloudMode) {
        try {
          const res = await entriesApi.list(id)
          cache[id] = (res.data || res || []).map((e) => ({
            id: e.id, title: e.title, description: e.description, color: e.color,
          }))
        } catch { cache[id] = [] }
      }
    }
    if (!cache['__local__']) cache['__local__'] = localEntries
    setLibEntriesCache(cache)
    updateMergedEntries(newActiveIds, cache)
  }, [libEntriesCache, cloudMode, localEntries])

  // ── 计算 activeLibraries（含 name）供 Editor 使用 ──
  const activeLibraries = activeLibIds.map((id) => ({
    id,
    name: (libMetaCache[id] || {}).name || (id === '__local__' ? '本地词库' : id.slice(0, 8)),
    entries: id === '__local__' ? localEntries : (libEntriesCache[id] || []),
  }))

  // ── 词条在 EntryManager 中变更：更新缓存 ──
  const handleEntriesChange = useCallback((libId, newEntries) => {
    if (libId === '__local__') {
      setLocalEntries(newEntries)
      saveEntries(newEntries)
    }
    setLibEntriesCache((prev) => {
      const next = { ...prev, [libId]: newEntries }
      updateMergedEntries(activeLibIds, next)
      return next
    })
  }, [activeLibIds])

  // ── 备份/恢复（Toolbar 用到的全量 entries） ──
  const allEntries = cloudMode ? activeLibEntries : localEntries
  const handleToolbarImport = useCallback((newEntries) => {
    setLocalEntries(newEntries)
    saveEntries(newEntries)
    if (!cloudMode) {
      const cache = { ...libEntriesCache, '__local__': newEntries }
      setLibEntriesCache(cache)
      updateMergedEntries(activeLibIds, cache)
    }
  }, [cloudMode, libEntriesCache, activeLibIds])

  const handleLogout = () => {
    localStorage.removeItem('pl_token')
    setUser(null)
    setCloudMode(false)
    setActiveLibIds(['__local__'])
    setLibEntriesCache({})
    setActiveLibEntries([])
    setSelectedLibId(null)
    setLocalEntries(loadEntries())
  }

  // ── 编辑器用的 entries（所有激活词库合并） ──
  const editorEntries = cloudMode ? activeLibEntries : localEntries

  // ── 本地词库始终加入缓存 ──
  useEffect(() => {
    setLibEntriesCache((prev) => ({ ...prev, '__local__': localEntries }))
  }, [localEntries])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
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

            <Toolbar entries={allEntries} onImport={handleToolbarImport} />

            {user ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-[#a0a0c0]">
                  <User size={12} /> {user.username}
                </span>
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

      {/* Help banner */}
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

      {/* Tabs */}
      <div className="border-b border-[#1e1e2e]">
        <div className="max-w-6xl mx-auto px-6 flex gap-1 pt-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                tab === id
                  ? 'border-violet-500 text-violet-300 bg-[#14141e]'
                  : 'border-transparent text-[#666688] hover:text-[#a0a0c0]'
              }`}
            >
              <Icon size={14} />
              {label}
              {id === 'library' && editorEntries.length > 0 && (
                <span className="ml-1 text-[10px] bg-violet-600/30 text-violet-300 px-1.5 py-0.5 rounded-full">
                  {editorEntries.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-6">
        {tab === 'editor' && (
          <div className="flex flex-col gap-6">
            {/* Active libs badge bar */}
            {activeLibIds.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-[#555570]">激活词库：</span>
                {activeLibIds.map((id) => {
                  const count = (libEntriesCache[id] || (id === '__local__' ? localEntries : [])).length
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
              <Editor entries={editorEntries} activeLibraries={activeLibraries} colorMode={colorMode} onColorModeChange={setColorMode} onGenerate={setOutput} initialText={initText} />
            </section>
            {output && (
              <section>
                <h2 className="text-xs font-semibold text-[#666688] uppercase tracking-wider mb-3">生成结果</h2>
                <OutputPanel text={output} onClear={() => setOutput('')} />
              </section>
            )}
          </div>
        )}

        {tab === 'library' && (
          <div className="flex gap-6 min-h-[500px]">
            {/* Left: Library list */}
            <div className="w-56 shrink-0 flex flex-col">
              <LibraryList
                user={user}
                selectedLibId={selectedLibId}
                onSelectLib={setSelectedLibId}
                activeLibIds={activeLibIds}
                onActiveLibsChange={handleActiveLibsChange}
              />
            </div>

            {/* Right: Entry manager for selected lib */}
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
        PromptLib v2.0.0 · {user ? `已登录为 ${user.username}` : '数据保存在本地浏览器'}
      </footer>

      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onLogin={(u) => { setUser(u); syncFromCloud(u) }}
        />
      )}
    </div>
  )
}
