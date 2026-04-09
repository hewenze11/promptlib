import { useState, useEffect, useRef } from 'react'
import { renderDescription } from './richText'
import { getEntryColor, hexToRgba } from './colors'
import { X, ExternalLink } from 'lucide-react'

/**
 * 悬浮词条详情卡片
 * - 跟随鼠标位置出现
 * - 卡片内 @引用 可点击，展开下一层（面包屑导航）
 */
export default function EntryTooltip({ entry, entries, colorMode, levels, anchorPos, onClose }) {
  const ref = useRef()
  const [stack, setStack] = useState([entry]) // 导航栈，支持点击引用深入

  // 点击外部关闭
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // 计算卡片位置：跟随锚点，避免超出视口
  const pos = (() => {
    const cardW = 320
    const cardH = 240
    let x = anchorPos.x + 12
    let y = anchorPos.y + 12
    if (x + cardW > window.innerWidth - 16) x = anchorPos.x - cardW - 8
    if (y + cardH > window.innerHeight - 16) y = anchorPos.y - cardH - 8
    return { left: x, top: y }
  })()

  const current = stack[stack.length - 1]
  const color = current ? getEntryColor(current, colorMode, levels) : '#7c3aed'

  const handleMentionClick = (name) => {
    const target = entries.find((e) => e.title === name)
    if (!target) return
    // 防止循环展开
    if (stack.some((s) => s.id === target.id)) return
    setStack((s) => [...s, target])
  }

  if (!current) return null

  return (
    <div
      ref={ref}
      className="fixed z-[9999] w-80 rounded-xl shadow-2xl overflow-hidden"
      style={{
        ...pos,
        background: '#1a1a26',
        border: `1px solid ${hexToRgba(color, 0.5)}`,
      }}
    >
      {/* 顶部面包屑 + 关闭 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#22223a]">
        <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
          {stack.map((s, i) => (
            <span key={s.id} className="flex items-center gap-1">
              {i > 0 && <span className="text-[#333350] text-xs">›</span>}
              <button
                onClick={() => setStack(stack.slice(0, i + 1))}
                className={`text-xs font-medium transition-colors ${
                  i === stack.length - 1
                    ? 'text-violet-300'
                    : 'text-[#666688] hover:text-violet-300'
                }`}
              >
                @{s.title}
              </button>
            </span>
          ))}
        </div>
        <button onClick={onClose} className="ml-2 text-[#555570] hover:text-white transition-colors shrink-0">
          <X size={13} />
        </button>
      </div>

      {/* 内容 */}
      <div className="px-3 py-3 max-h-52 overflow-y-auto">
        <div
          className="text-xs leading-relaxed text-[#c8c8e0]"
          style={{ wordBreak: 'break-word' }}
        >
          {renderDescription(current.description, handleMentionClick)}
        </div>
      </div>

      {/* 底部：显示颜色标记 */}
      <div className="px-3 py-2 border-t border-[#1e1e2e] flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="text-[10px] text-[#555570]">词条详情</span>
        </span>
        {stack.length > 1 && (
          <button
            onClick={() => setStack([entry])}
            className="text-[10px] text-[#555570] hover:text-violet-300 transition-colors"
          >
            返回顶层
          </button>
        )}
      </div>
    </div>
  )
}
