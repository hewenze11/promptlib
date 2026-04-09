import { useState, useEffect } from 'react'
import { BookOpen, FileText, Info } from 'lucide-react'
import Editor from './Editor'
import EntryManager from './EntryManager'
import OutputPanel from './OutputPanel'
import Toolbar from './Toolbar'
import { loadEntries, saveEntries } from './storage'

const TABS = [
  { id: 'editor', label: '编辑器', icon: FileText },
  { id: 'library', label: '词库管理', icon: BookOpen },
]

export default function App() {
  const [entries, setEntries] = useState(() => loadEntries())
  const [output, setOutput] = useState('')
  const [tab, setTab] = useState('editor')
  const [showHelp, setShowHelp] = useState(false)
  const [colorMode, setColorMode] = useState('uniform') // 'uniform' | 'level' | 'custom'

  useEffect(() => {
    saveEntries(entries)
  }, [entries])

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
            <Toolbar entries={entries} onImport={setEntries} />
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
                <li>点击词条可切换模式：<span className="text-violet-300">◆ A模式</span>（注释附加到开头）/ <span className="text-[#666688]">◇ B模式</span>（只输出标题）</li>
                <li>点击「生成文本」，A模式词条的完整注释会自动附加在文本最前面</li>
              </ol>
            </div>
            <div>
              <p className="text-violet-300 font-semibold mb-2">词库数据</p>
              <ul className="list-disc list-inside space-y-1 text-xs leading-relaxed">
                <li>词库仅保存在当前浏览器本地，不上传任何服务器</li>
                <li>换浏览器或换设备前，点右上角「导出词库」下载备份文件</li>
                <li>在新设备上点「导入词库」，拖入或选择备份文件即可恢复</li>
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
              </p>
            </div>
            <EntryManager entries={entries} onChange={setEntries} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1e1e2e] text-center py-4 text-xs text-[#333350]">
        PromptLib v1.3.0 · 数据仅保存在本地浏览器
      </footer>
    </div>
  )
}
