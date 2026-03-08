import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Zap } from 'lucide-react'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { getApiError } from '@/lib/utils'
import toast from 'react-hot-toast'

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Min. 8 caractères'),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()
  const [showPwd, setShowPwd] = useState(false)
  const [apiError, setApiError] = useState('')
  const [unverifiedEmail, setUnverifiedEmail] = useState('')
  const [resendSent, setResendSent] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormValues) {
    setApiError('')
    try {
      const tokens = await authApi.login(data)
      setTokens(tokens.access_token, tokens.refresh_token)
      const user = await authApi.getMe()
      setUser(user)
      toast.success(`Bienvenue, ${user.username} ! 👋`)
      navigate('/dashboard')
    } catch (e) {
      const msg = getApiError(e)
      if (msg.toLowerCase().includes('non vérifié') || msg.toLowerCase().includes('email')) {
        setUnverifiedEmail(data.email)
      }
      setApiError(msg)
    }
  }

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-brand-violet/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-violet flex items-center justify-center shadow-glow">
              <Zap size={18} className="text-white" />
            </div>
            <span className="text-2xl font-bold gradient-text tracking-tight">DAILFOW</span>
          </div>
          <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">Intelligent Daily Flow</p>
        </div>

        {/* Card */}
        <div className="bg-dark-card border border-dark-border2 rounded-2xl p-8 shadow-lg">
          <h1 className="text-xl font-semibold mb-1">Connexion</h1>
          <p className="text-sm text-slate-400 mb-7">Accédez à votre espace personnel</p>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="vous@email.com"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />

            <div className="relative">
              <Input
                label="Mot de passe"
                type={showPwd ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                error={errors.password?.message}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 bottom-3 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {apiError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                <p>{apiError}</p>
                {unverifiedEmail && !resendSent && (
                  <button
                    type="button"
                    className="mt-2 text-brand-primary text-xs underline hover:no-underline"
                    onClick={async () => {
                      try {
                        await authApi.resendVerification(unverifiedEmail)
                        setResendSent(true)
                        toast.success('Email de vérification renvoyé !')
                      } catch {}
                    }}
                  >
                    📬 Renvoyer l'email de vérification
                  </button>
                )}
                {resendSent && (
                  <p className="mt-2 text-emerald-400 text-xs">✅ Email renvoyé ! Vérifiez votre boîte mail.</p>
                )}
              </div>
            )}

            <Button type="submit" variant="primary" fullWidth size="lg" loading={isSubmitting} className="mt-2">
              Se connecter
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Pas de compte ?{' '}
            <Link to="/register" className="text-brand-primary hover:text-brand-violet transition-colors font-medium">
              S'inscrire
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
