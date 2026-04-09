// 词库的本地存储 key
const STORAGE_KEY = 'promptlib_entries_v1'

/**
 * 从 localStorage 读取词库
 * @returns {Array} entries
 */
export function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/**
 * 保存词库到 localStorage
 * @param {Array} entries
 */
export function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

/**
 * 导出词库为 JSON 文件下载
 * @param {Array} entries
 */
export function exportEntries(entries) {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    entries,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `promptlib_${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * 从文件导入词库（返回 Promise<Array>）
 * @param {File} file
 * @returns {Promise<Array>}
 */
export function importEntries(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        // 兼容直接是数组的格式
        const entries = Array.isArray(data) ? data : data.entries
        if (!Array.isArray(entries)) throw new Error('格式不正确')
        resolve(entries)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}
