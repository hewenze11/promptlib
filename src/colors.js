/**
 * 颜色工具：计算词条在各着色模式下的实际显示颜色
 *
 * colorMode: 'uniform' | 'level' | 'custom'
 * - uniform: 全部用统一紫色
 * - level:   按词条层级（1/2/3+）分色
 * - custom:  使用词条自身存储的 color 字段
 */

// 模式一：统一色
export const UNIFORM_COLOR = '#7c3aed' // violet-700

// 模式二：层级色
export const LEVEL_COLORS = {
  1: '#0ea5e9', // sky-500  一级（无引用）
  2: '#10b981', // emerald-500  二级
  3: '#f59e0b', // amber-500  三级及以上
}

// 默认词条颜色（新建时默认值）
export const DEFAULT_ENTRY_COLOR = '#7c3aed'

// 预设可选颜色盘
export const COLOR_PRESETS = [
  '#7c3aed', // violet
  '#2563eb', // blue
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#14b8a6', // teal
  '#f97316', // orange
]

/**
 * 计算所有词条的层级（1 / 2 / 3+）
 * 一级 = 注释中没有 @引用其他词条
 * 二级 = 最高引用了一级词条
 * 三级 = 最高引用了二级词条（含更高）
 */
export function computeLevels(entries) {
  const titleToId = {}
  entries.forEach((e) => { titleToId[e.title] = e.id })

  // 提取每个词条直接引用了哪些 id
  function getDeps(entry) {
    const matches = [...(entry.description || '').matchAll(/@([\w\u4e00-\u9fa5\-_]+)/g)]
    return matches
      .map((m) => titleToId[m[1]])
      .filter(Boolean)
      .filter((id) => id !== entry.id)
  }

  const levels = {}
  const visited = new Set()

  function getLevel(id, stack = new Set()) {
    if (levels[id] !== undefined) return levels[id]
    if (stack.has(id)) return 1 // 循环引用，视为一级
    stack.add(id)
    const entry = entries.find((e) => e.id === id)
    if (!entry) return 1
    const deps = getDeps(entry)
    if (deps.length === 0) {
      levels[id] = 1
    } else {
      const maxDepLevel = Math.max(...deps.map((depId) => getLevel(depId, new Set(stack))))
      levels[id] = Math.min(maxDepLevel + 1, 3)
    }
    return levels[id]
  }

  entries.forEach((e) => getLevel(e.id))
  return levels
}

/**
 * 根据着色模式返回词条的显示颜色
 */
export function getEntryColor(entry, colorMode, levels) {
  if (colorMode === 'custom') {
    return entry.color || DEFAULT_ENTRY_COLOR
  }
  if (colorMode === 'level') {
    const lv = levels?.[entry.id] || 1
    return LEVEL_COLORS[lv] || LEVEL_COLORS[3]
  }
  // uniform
  return UNIFORM_COLOR
}

/**
 * 将 hex 颜色转为带透明度的 rgba（用于背景）
 */
export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
