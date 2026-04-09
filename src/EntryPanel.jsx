import { useState } from 'react'
import { Palette, Layers, Wand2, PlusCircle, BookOpen } from 'lucide-react'
import { LEVEL_COLORS, computeLevels, getEntryColor, hexToRgba } from './colors'
import EntryTooltip from './EntryTooltip'

const MODES = [
  { id: 'uniform', label: '模式一', desc: '统一颜色', icon: Palette },
  { id: 'level',   label: '模式二', desc: '层级分色', icon: Layers },
  { id: 'custom',  label: '模式三', desc: '词库色系', icon: Wand2 },
]

export default function EntryPanel({ entries, colorMode, onColorModeChange, onInsert, panelMode, onPanelModeChange }) {
  const [showModeMenu, setShowModeMenu] = useState(false)
  const [tooltip, setTooltip] = useState(null) // { entry, x, y }

  if (entries.length === 0) return null

  const levels = computeLevels(entries)
  const isInsert = panelMode === 'insert'

  const handleChipClick = (e, entry) => {
    if (isInsert) {
      const color = getEntryColor(entry, colorMode, levels)
      onInsert(entry, color)
    } else {
      setTooltip({
        entry,
        x: e.clientX,
        y: e.clientY,
      })
    }
  }

  return (
    <div className="mt-3">
      {/* 面板头 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#555570] font-medium">词条库</span>

          {/* 插入模式 / 阅读模式 互斥按钮 */}
          <div className="flex items-center rounded-lg border border-[#2e2e45] overflow-hidden">
            <button
              onClick={() => onPanelModeChange?.('insert')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold transition-all ${
                isInsert
                  ? 'bg-violet-600/30 text-violet-200 border-r border-violet-500/40'
                  : 'text-[#666688] hover:text-white hover:bg-[#1e1e30] border-r border-[#2e2e45]'
              }`}
              title="插入模式：点击词条将插入到编辑器"
            >
              <PlusCircle size={10} />
              插入模式
            </button>
            <button
              onClick={() => onPanelModeChange?.('read')}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold transition-all ${
                !isInsert
                  ? 'bg-violet-600/30 text-violet-200'
                  : 'text-[#666688] hover:text-white hover:bg-[#1e1e30]'
              }`}
              title="阅读模式：点击词条查看详情卡片，并自动反解编辑器中的【词条名】"
            >
              <BookOpen size={10} />
              阅读模式
            </button>
          </div>

          <span className="text-[10px] text-[#333350]">
            {isInsert ? '点击词条 → 插入编辑器' : '点击词条 → 查看详情'}
          </span>
        </div>

        {/* 色系切换 */}
        <div className="relative">
          <button
            onClick={() => setShowModeMenu((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#2e2e45] hover:border-violet-500/50 text-[10px] text-[#888899] hover:text-violet-300 transition-colors"
          >
            <Palette size={11} />
            {MODES.find((m) => m.id === colorMode)?.label ?? '模式一'}
          </button>

          {showModeMenu && (
            <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-[#1a1a26] border border-[#2e2e45] rounded-xl shadow-2xl overflow-hidden">
              {MODES.map((m) => {
                const Icon = m.icon
                const active = colorMode === m.id
                return (
                  <button
                    key={m.id}
                    onClick={() => { onColorModeChange(m.id); setShowModeMenu(false) }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors border-b border-[#22223a] last:border-0 ${
                      active ? 'bg-violet-600/20 text-violet-200' : 'text-[#888899] hover:bg-[#252538] hover:text-white'
                    }`}
                  >
                    <Icon size={12} />
                    <div className="text-left">
                      <div className="font-semibold">{m.label} · {m.desc}</div>
                      {m.id === 'level' && (
                        <div className="flex gap-1 mt-0.5">
                          {[1,2,3].map((lv) => (
                            <span key={lv} className="w-2 h-2 rounded-full inline-block" style={{ background: LEVEL_COLORS[lv] }} />
                          ))}
                          <span className="text-[10px] text-[#555570]">一/二/三级</span>
                        </div>
                      )}
                      {m.id === 'custom' && <div className="text-[10px] text-[#555570]">使用词库存储的颜色</div>}
                    </div>
                    {active && <span className="ml-auto text-violet-400">✓</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 词条标签云 */}
      <div className="flex flex-wrap gap-2 p-3 bg-[#0d0d18] rounded-xl border border-[#1e1e2e] min-h-[56px]">
        {entries.map((entry) => {
          const color = getEntryColor(entry, colorMode, levels)
          return (
            <button
              key={entry.id}
              onClick={(e) => handleChipClick(e, entry)}
              title={isInsert ? `插入 ${entry.title}` : `查看 ${entry.title} 详情`}
              style={{
                background: hexToRgba(color, 0.15),
                color: color,
                border: `1px solid ${hexToRgba(color, 0.4)}`,
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              {isInsert ? '＋' : '◆'} {entry.title}
            </button>
          )
        })}
      </div>

      {/* 悬浮详情卡片 */}
      {tooltip && (
        <EntryTooltip
          entry={tooltip.entry}
          entries={entries}
          colorMode={colorMode}
          levels={levels}
          anchorPos={{ x: tooltip.x, y: tooltip.y }}
          onClose={() => setTooltip(null)}
        />
      )}
    </div>
  )
}
