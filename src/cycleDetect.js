/**
 * 检测词库中存在循环引用的词条
 * 返回 [{ from: entry, to: entry, path: string[] }] 列表
 */
export function detectCycles(entries) {
  const titleToEntry = {}
  entries.forEach((e) => { titleToEntry[e.title] = e })

  function getDeps(entry) {
    const matches = [...(entry.description || '').matchAll(/@([\w\u4e00-\u9fa5\-_]+)/g)]
    return matches
      .map((m) => titleToEntry[m[1]])
      .filter((e) => e && e.id !== entry.id)
  }

  const cycles = []
  const reported = new Set() // 避免重复报告同一个环

  function dfs(entry, path, visiting) {
    if (visiting.has(entry.id)) {
      // 找到环，提取环的部分
      const cycleStart = path.indexOf(entry.title)
      const cyclePath = path.slice(cycleStart)
      const key = [...cyclePath].sort().join('→')
      if (!reported.has(key)) {
        reported.add(key)
        cycles.push({
          path: [...cyclePath, entry.title], // 闭合显示
        })
      }
      return
    }
    visiting.add(entry.id)
    for (const dep of getDeps(entry)) {
      dfs(dep, [...path, entry.title], visiting)
    }
    visiting.delete(entry.id)
  }

  for (const entry of entries) {
    dfs(entry, [], new Set())
  }

  return cycles
}
