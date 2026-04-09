import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

/**
 * @mention 下拉列表组件
 */
const MentionList = forwardRef(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectItem = (index) => {
    const item = items[index]
    if (item) command({ id: item.id, label: item.title })
  }

  const upHandler = () =>
    setSelectedIndex((i) => (i + items.length - 1) % items.length)
  const downHandler = () =>
    setSelectedIndex((i) => (i + 1) % items.length)
  const enterHandler = () => selectItem(selectedIndex)

  useEffect(() => setSelectedIndex(0), [items])

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
          key={item.id}
          className={`mention-item${index === selectedIndex ? ' is-selected' : ''}`}
          onClick={() => selectItem(index)}
        >
          <span className="mention-item-title">@{item.title}</span>
          <span className="mention-item-desc">{item.description}</span>
        </div>
      ))}
    </div>
  )
})

MentionList.displayName = 'MentionList'
export default MentionList
