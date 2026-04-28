import { forwardRef, useImperativeHandle, useState } from 'react'

/**
 * @mention 下拉列表组件
 * items 里每个条目可以有 displayTitle（冲突时显示 库名.词条名）
 */
const MentionList = forwardRef(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const safeSelectedIndex = items.length === 0 ? 0 : Math.min(selectedIndex, items.length - 1)

  const selectItem = (index) => {
    const item = items[index]
    if (item) command({
      id: item.id,
      label: item.title,
      libraryId: item.libraryId || null,
      libraryName: item.libraryName || null,
    })
  }

  const upHandler = () =>
    setSelectedIndex((i) => (i + items.length - 1) % items.length)
  const downHandler = () =>
    setSelectedIndex((i) => (i + 1) % items.length)
  const enterHandler = () => selectItem(safeSelectedIndex)

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') { upHandler(); return true }
      if (event.key === 'ArrowDown') { downHandler(); return true }
      if (event.key === 'Enter') { enterHandler(); return true }
      return false
    },
  }))

  if (!items.length) return null

  return (
    <div className="mention-dropdown">
      {items.map((item, index) => (
        <div
          key={`${item.id}-${item.libraryId || 'local'}`}
          className={`mention-item${index === safeSelectedIndex ? ' is-selected' : ''}`}
          onClick={() => selectItem(index)}
        >
          <span className="mention-item-title">@{item.displayTitle || item.title}</span>
          <span className="mention-item-desc">{item.description}</span>
        </div>
      ))}
    </div>
  )
})

MentionList.displayName = 'MentionList'
export default MentionList
