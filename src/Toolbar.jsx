import { useRef } from 'react'
import { Download, Upload } from 'lucide-react'
import { exportEntries, importEntries } from './storage'

export default function Toolbar({ entries, onImport }) {
  const fileRef = useRef()

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const imported = await importEntries(file)
      const merge = confirm(
        `词库文件包含 ${imported.length} 个词条。\n点确定：合并到现有词库\n点取消：替换现有词库`
      )
      if (merge) {
        // 合并，以 id 去重
        const existingIds = new Set(entries.map((e) => e.id))
        const newEntries = imported.filter((e) => !existingIds.has(e.id))
        onImport([...entries, ...newEntries])
      } else {
        onImport(imported)
      }
    } catch {
      alert('导入失败，请确认文件格式正确')
    }
    e.target.value = ''
  }

  return (
    <div className="flex items-center gap-2">
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      <button
        onClick={() => fileRef.current.click()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#888899] hover:text-white border border-[#2e2e45] hover:border-[#44446a] rounded-lg transition-colors"
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
