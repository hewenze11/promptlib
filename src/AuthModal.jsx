import { useState } from 'react'
import { X, User, Lock, Loader2 } from 'lucide-react'
import { auth } from './api'

export default function AuthModal({ onClose, onLogin }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fn = mode === 'login' ? auth.login : auth.register
      const res = await fn(username, password)
      localStorage.setItem('pl_token', res.token)
      onLogin(res.user || { username })
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || '请求失败，请稍后再试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f0f1a] border border-[#2a2a40] rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-semibold">
            {mode === 'login' ? '登录' : '注册'}
          </h2>
          <button onClick={onClose} className="text-[#555570] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555570]" />
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名"
              required
              className="w-full bg-[#1a1a2e] border border-[#2a2a40] rounded-lg py-2.5 pl-8 pr-3 text-sm text-white placeholder-[#555570] outline-none focus:border-violet-500"
            />
          </div>
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555570]" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              required
              className="w-full bg-[#1a1a2e] border border-[#2a2a40] rounded-lg py-2.5 pl-8 pr-3 text-sm text-white placeholder-[#555570] outline-none focus:border-violet-500"
            />
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg text-sm text-white font-medium flex items-center justify-center gap-2 transition-colors"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-[#555570]">
          {mode === 'login' ? '还没有账号？' : '已有账号？'}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            className="ml-1 text-violet-400 hover:text-violet-300"
          >
            {mode === 'login' ? '注册' : '去登录'}
          </button>
        </p>
      </div>
    </div>
  )
}
