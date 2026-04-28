import { useRef, useState } from 'react'
import { Download, Upload, AlertCircle } from 'lucide-react'
import { exportEntries, importEntries } from './storage'

export default function Toolbar({ entries, onImport, disabled = false }) {
  const fileRef = useRef()
  const [mode, setMode] = useState('merge')

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const imported = await importEntries(file)
      onImport({ targetLibId: '__local__', mode, entries: imported })
    } catch {
      alert('恢复失败，请确认文件格式正确')
    }
    e.target.value = ''
  }

  return (
    <div className="flex items-center gap-2">
      {disabled && (
        <span className="hidden sm:flex items-center gap-1 text-[10px] text-amber-400/80">
          <AlertCircle size={11} /> 云端词库请用左侧链接导入或 Fork
        </span>
      )}

      <div className="hidden sm:flex items-center rounded-lg border border-[#2e2e45] overflow-hidden">
        <button
          onClick={() => setMode('merge')}
          className={`px-2 py-1 text-[10px] transition-colors ${mode === 'merge' ? 'bg-violet-600/30 text-violet-200' : 'text-[#666688] hover:text-white hover:bg-[#1e1e30]'}`}
        >
          合并
        </button>
        <button
          onClick={() => setMode('replace')}
          className={`px-2 py-1 text-[10px] border-l border-[#2e2e45] transition-colors ${mode === 'replace' ? 'bg-violet-600/30 text-violet-200' : 'text-[#666688] hover:text-white hover:bg-[#1e1e30]'}`}
        >
          覆盖本地
        </button>
      </div>

      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      <button
        onClick={() => fileRef.current.click()}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#888899] hover:text-white border border-[#2e2e45] hover:border-[#44446a] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        title={disabled ? '云端模式下只支持导入到本地词库' : '导入本地词库 JSON'}
      >
        <Upload size={12} /> 导入词库
      </button>
      <button
        onClick={() => exportEntries(entries)}
        disabled={entries.length === 0}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#888899] hover:text-white border border-[#2e2e45] hover:border-[#44446a] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Download size={12} /> 导出词库
      </button>
    </div>
  )
}
