import { useState, useEffect, useCallback } from 'react'
import { BookOpen, FileText, Info, LogIn, LogOut, User, Cloud, CloudOff } from 'lucide-react'
import Editor from './Editor'
import EntryManager from './EntryManager'
import OutputPanel from './OutputPanel'
import Toolbar from './Toolbar'
import AuthModal from './AuthModal'
import { loadEntries, saveEntries } from './storage'
import { auth, libraries, entries as entriesApi, activelibsApi } from './api'

const TABS = [
  { id: 'editor', label: '编辑器', icon: FileText },
  { id: 'library', label: '词库管理', icon: BookOpen },
]

// 默认词库（未登录/登录后首个词库）
const DEFAULT_LIB_KEY = 'pl_default_lib_id'

export default function App() {
  // ── 本地状态 ──
  const [entries, setEntries] = useState(() => loadEntries())
  const [output, setOutput] = useState('')
  const [tab, setTab] = useState('editor')
  const [showHelp, setShowHelp] = useState(false)
  const [colorMode, setColorMode] = useState('uniform')

  // ── 登录状态 ──
  const [user, setUser] = useState(null)            // { username }
  const [showAuth, setShowAuth] = useState(false)
  const [cloudMode, setCloudMode] = useState(false) // 是否已接入云端词库
  const [defaultLibId, setDefaultLibId] = useState(
    () => localStorage.getItem(DEFAULT_LIB_KEY) || null
  )

  // ── 初始化：检查已有 token ──
  useEffect(() => {
    const token = localStorage.getItem('pl_token')
    if (!token) return
    auth.getSelf()
      .then((u) => { setUser(u); syncFromCloud(u) })
      .catch(() => localStorage.removeItem('pl_token'))
  }, [])

  // ── 云端同步：拉取词条 ──
  const syncFromCloud = useCallback(async (u) => {
    try {
      const libs = await libraries.list()
      let lib = libs.data?.[0]

      if (!lib) {
        // 首次登录：把本地 localStorage 词条迁移到云端
        lib = await libraries.create({
          name: '我的词库',
          slug: `${(u?.username || 'user')}-default`,
          visibility: 'private',
        })
        const localEntries = loadEntries()
        for (const e of localEntries) {
          await entriesApi.create(lib.id, {
            id: e.id,
            title: e.title,
            description: e.description || '',
            color: e.color || '#7c3aed',
          }).catch(() => {}) // 忽略重复
        }
      }

      localStorage.setItem(DEFAULT_LIB_KEY, lib.id)
      setDefaultLibId(lib.id)

      // 拉取云端词条
      const remote = await entriesApi.list(lib.id)
      const cloudEntries = (remote.data || []).map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        color: e.color,
      }))
      setEntries(cloudEntries)
      saveEntries(cloudEntries)
      setCloudMode(true)
    } catch (err) {
      console.warn('cloud sync failed, using local', err)
    }
  }, [])

  // ── 词条变更：本地 + 云端双写 ──
  const handleEntriesChange = useCallback(async (newEntries) => {
    setEntries(newEntries)
    saveEntries(newEntries)

    if (!cloudMode || !defaultLibId) return

    // 简单策略：全量替换
    // 找新增的（本地有、上次没有）和删除的
    const remote = await entriesApi.list(defaultLibId).then(r => r.data || []).catch(() => [])
    const remoteIds = new Set(remote.map(e => e.id))
    const localIds = new Set(newEntries.map(e => e.id))

    // 删除云端已删除的
    for (const re of remote) {
      if (!localIds.has(re.id)) {
        await entriesApi.del(defaultLibId, re.id).catch(() => {})
      }
    }
    // 新增或更新
    for (const e of newEntries) {
      if (!remoteIds.has(e.id)) {
        await entriesApi.create(defaultLibId, {
          id: e.id,
          title: e.title,
          description: e.description || '',
          color: e.color || '#7c3aed',
        }).catch(() => {})
      } else {
        await entriesApi.update(defaultLibId, e.id, {
          title: e.title,
          description: e.description || '',
          color: e.color || '#7c3aed',
        }).catch(() => {})
      }
    }
  }, [cloudMode, defaultLibId])

  // ── 本地模式：单纯 localStorage ──
  const handleEntriesLocal = useCallback((newEntries) => {
    setEntries(newEntries)
    saveEntries(newEntries)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('pl_token')
    setUser(null)
    setCloudMode(false)
    // 恢复本地词条
    setEntries(loadEntries())
  }

  const onChangeEntries = cloudMode ? handleEntriesChange : handleEntriesLocal

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
            {/* 云端状态指示 */}
            {user && (
              <span className={`flex items-center gap-1 text-xs ${cloudMode ? 'text-violet-400' : 'text-[#555570]'}`}>
                {cloudMode ? <Cloud size={12} /> : <CloudOff size={12} />}
                {cloudMode ? '云端同步' : '本地模式'}
              </span>
            )}

            <Toolbar entries={entries} onImport={onChangeEntries} />

            {/* 登录/用户 */}
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
              <p className="text-violet-300 font-semibold mb-2">词库数据</p>
              <ul className="list-disc list-inside space-y-1 text-xs leading-relaxed">
                <li>未登录时，词库保存在浏览器本地</li>
                <li>登录后自动同步到云端，多设备共享</li>
                <li>首次登录会自动把本地词条迁移到云端</li>
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
              {id === 'library' && entries.length > 0 && (
                <span className="ml-1 text-[10px] bg-violet-600/30 text-violet-300 px-1.5 py-0.5 rounded-full">
                  {entries.length}
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
            {entries.length === 0 && (
              <div className="text-xs text-[#555570] bg-[#14141e] border border-[#2e2e45] rounded-lg px-4 py-3">
                词库为空。切换到「词库管理」添加词条后，即可在编辑器中使用 @ 引用。
              </div>
            )}
            <section>
              <h2 className="text-xs font-semibold text-[#666688] uppercase tracking-wider mb-3">编辑区</h2>
              <Editor entries={entries} colorMode={colorMode} onColorModeChange={setColorMode} onGenerate={setOutput} />
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
          <div className="max-w-xl">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-white mb-1">词条管理</h2>
              <p className="text-xs text-[#666688]">
                词条由「名称」和「详细注释」组成。在编辑器中输入 @ 名称来引用词条。
                {cloudMode && <span className="ml-1 text-violet-400">· 云端同步已开启</span>}
              </p>
            </div>
            <EntryManager entries={entries} onChange={onChangeEntries} />
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
