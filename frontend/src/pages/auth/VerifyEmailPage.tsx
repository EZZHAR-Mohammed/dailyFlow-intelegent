import { useEffect, useState, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Zap, CheckCircle, XCircle, Loader } from 'lucide-react'
import { authApi } from '@/api/auth'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const called = useRef(false)

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Token manquant.'); return }
    if (called.current) return
    called.current = true

    authApi.verifyEmail(token)
      .then(res => { setStatus('success'); setMessage(res.message) })
      .catch(e => { setStatus('error'); setMessage(e?.response?.data?.detail || 'Token invalide ou expiré.') })
  }, [token])

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-violet flex items-center justify-center">
            <Zap size={18} className="text-white" />
          </div>
          <span className="text-2xl font-bold gradient-text">DAILFOW</span>
        </div>

        <div className="bg-dark-card border border-dark-border2 rounded-2xl p-8">
          {status === 'loading' && (
            <>
              <Loader size={48} className="mx-auto mb-4 text-brand-primary animate-spin" />
              <p className="text-slate-400">Vérification en cours…</p>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle size={52} className="mx-auto mb-4 text-emerald-400" />
              <h2 className="text-xl font-semibold mb-2">Email vérifié ✅</h2>
              <p className="text-sm text-slate-400 mb-6">{message}</p>
              <Link
                to="/login"
                className="block w-full bg-gradient-to-r from-brand-primary to-brand-violet text-white font-semibold py-3 rounded-xl text-center hover:opacity-90 transition"
              >
                Se connecter →
              </Link>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle size={52} className="mx-auto mb-4 text-red-400" />
              <h2 className="text-xl font-semibold mb-2">Lien invalide</h2>
              <p className="text-sm text-slate-400 mb-6">{message}</p>
              <Link to="/register" className="text-brand-primary text-sm hover:underline">
                ← Créer un nouveau compte
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
