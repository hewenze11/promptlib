import { useState } from 'react'
import { Palette, Layers, Wand2 } from 'lucide-react'
import { LEVEL_COLORS, COLOR_PRESETS, computeLevels, getEntryColor, hexToRgba } from './colors'

const MODES = [
  { id: 'uniform', label: '模式一', desc: '统一颜色', icon: Palette },
  { id: 'level',   label: '模式二', desc: '层级分色', icon: Layers },
  { id: 'custom',  label: '模式三', desc: '词库色系', icon: Wand2 },
]

/**
 * 编辑器下方的词条快捷面板
 * - 显示所有词条，点击插入
 * - 右上角切换着色模式
 */
export default function EntryPanel({ entries, colorMode, onColorModeChange, onInsert }) {
  const [showModeMenu, setShowModeMenu] = useState(false)

  if (entries.length === 0) return null

  const levels = computeLevels(entries)

  return (
    <div className="mt-3">
      {/* 面板头 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[#555570] font-medium">词条库 · 点击插入</span>

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
              onClick={() => onInsert(entry, color)}
              title={entry.description}
              style={{
                background: hexToRgba(color, 0.15),
                color: color,
                border: `1px solid ${hexToRgba(color, 0.4)}`,
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              ◆ @{entry.title}
            </button>
          )
        })}
      </div>
    </div>
  )
}
