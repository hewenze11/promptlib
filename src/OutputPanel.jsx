import { useState } from 'react'
import { Copy, Check, RotateCcw, Sparkles } from 'lucide-react'
import { renderDescription } from './richText'

/**
 * 将带 markdown 链接格式的文本按行渲染
 * [text](url) → <a>，其他保持原样
 */
function RichText({ text }) {
  return (
    <div className="whitespace-pre-wrap break-words text-sm text-[#c8c8e0] leading-relaxed">
      {text.split('\n').map((line, i) => (
        <div key={i}>
          {renderDescription(line, null)}
        </div>
      ))}
    </div>
  )
}

export default function OutputPanel({ text, onClear, onTextChange }) {
  const [copied, setCopied] = useState(false)
  const [polishing, setPolishing] = useState(false)
  const [polishMsg, setPolishMsg] = useState('')
  const [polishMsgType, setPolishMsgType] = useState('info') // 'info' | 'error'

  // 复制时用纯文本（保留 markdown 链接格式）
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePolish = async () => {
    if (!text || polishing) return
    setPolishing(true)
    setPolishMsg('')
    try {
      const res = await fetch('/api/ai/polish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('pl_token')}`,
        },
        body: JSON.stringify({ text }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        if (onTextChange && data.text) {
          onTextChange(data.text)
        }
      } else {
        const code = data.code || ''
        if (code === 'NOT_CONFIGURED') {
          setPolishMsgType('info')
          setPolishMsg('AI润色功能暂未开放，敬请期待')
        } else {
          setPolishMsgType('error')
          setPolishMsg('AI服务暂时不可用，请稍后重试')
        }
        setTimeout(() => setPolishMsg(''), 4000)
      }
    } catch {
      setPolishMsgType('error')
      setPolishMsg('AI服务暂时不可用，请稍后重试')
      setTimeout(() => setPolishMsg(''), 4000)
    } finally {
      setPolishing(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-[#14141e] border border-[#2e2e45] rounded-xl p-4 min-h-[180px]">
        {text
          ? <RichText text={text} />
          : <span className="text-[#444460] text-sm">生成的文本会显示在这里…</span>
        }
      </div>

      {polishMsg && (
        <p className={`text-xs px-1 ${polishMsgType === 'error' ? 'text-red-400' : 'text-violet-300'}`}>
          {polishMsg}
        </p>
      )}

      <div className="flex gap-2 justify-end">
        {text && (
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#666688] hover:text-white border border-[#2e2e45] hover:border-[#44446a] rounded-lg transition-colors"
          >
            <RotateCcw size={12} /> 清空
          </button>
        )}
        <button
          onClick={handlePolish}
          disabled={!text || polishing}
          title={!text ? '请先生成文本' : 'AI润色'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#1a1a2e] hover:bg-[#252540] border border-violet-600/30 hover:border-violet-500/60 text-violet-300 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Sparkles size={12} /> {polishing ? '润色中...' : '✨ AI润色'}
        </button>
        {text && (
          <button
            onClick={copy}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-[#1e1e30] hover:bg-[#252540] border border-[#2e2e45] hover:border-violet-500/50 text-[#c8c8e0] rounded-lg transition-colors"
          >
            {copied
              ? <><Check size={12} className="text-green-400" /> 已复制</>
              : <><Copy size={12} /> 复制</>
            }
          </button>
        )}
      </div>
    </div>
  )
}
