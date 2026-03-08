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
  username: z.string().min(3, 'Min. 3 caractères').max(50, 'Max. 50 caractères'),
  password: z.string().min(8, 'Min. 8 caractères'),
  terms_accepted: z.boolean().refine(v => v === true, {
    message: "Vous devez accepter les conditions d'utilisation"
  }),
})

type FormValues = z.infer<typeof schema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setTokens, setUser } = useAuthStore()
  const [showPwd, setShowPwd] = useState(false)
  const [apiError, setApiError] = useState('')
  const [terms, setTerms] = useState(false)

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { terms_accepted: false },
  })

  function toggleTerms() {
    const next = !terms
    setTerms(next)
    setValue('terms_accepted', next, { shouldValidate: true })
  }

  async function onSubmit(data: FormValues) {
    setApiError('')
    try {
      await authApi.register(data)
      const tokens = await authApi.login({ email: data.email, password: data.password })
      setTokens(tokens.access_token, tokens.refresh_token)
      const user = await authApi.getMe()
      setUser(user)
      toast.success('Compte créé avec succès ! 🎉')
      navigate('/dashboard')
    } catch (e) {
      setApiError(getApiError(e))
    }
  }

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-brand-violet/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-violet flex items-center justify-center shadow-glow">
              <Zap size={18} className="text-white" />
            </div>
            <span className="text-2xl font-bold gradient-text tracking-tight">DAILFOW</span>
          </div>
          <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">Intelligent Daily Flow</p>
        </div>

        <div className="bg-dark-card border border-dark-border2 rounded-2xl p-8 shadow-lg">
          <h1 className="text-xl font-semibold mb-1">Créer un compte</h1>
          <p className="text-sm text-slate-400 mb-7">Commencez à optimiser votre productivité</p>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="vous@email.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              label="Nom d'utilisateur"
              placeholder="johndoe"
              error={errors.username?.message}
              {...register('username')}
            />

            <div className="relative">
              <Input
                label="Mot de passe"
                type={showPwd ? 'text' : 'password'}
                placeholder="8 caractères minimum"
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

            {/* CGU Checkbox */}
            <div>
              <button
                type="button"
                onClick={toggleTerms}
                className="flex items-start gap-3 w-full text-left group"
              >
                <div className={[
                  'mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                  terms
                    ? 'bg-brand-primary border-brand-primary'
                    : 'border-dark-border2 group-hover:border-brand-primary/50'
                ].join(' ')}>
                  {terms && <span className="text-white text-[11px] font-bold">✓</span>}
                </div>
                <span className="text-sm text-slate-400 leading-relaxed">
                  J'accepte les{' '}
                  <span className="text-brand-primary underline">conditions d'utilisation</span>
                  {' '}et la{' '}
                  <span className="text-brand-primary underline">politique de confidentialité</span>
                  {' '}de DAILFOW
                </span>
              </button>
              {errors.terms_accepted && (
                <p className="text-xs text-red-400 mt-1.5 ml-8">{errors.terms_accepted.message}</p>
              )}
            </div>

            {apiError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-400">
                {apiError}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              loading={isSubmitting}
              className="mt-2"
              disabled={!terms}
            >
              Créer mon compte
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-brand-primary hover:text-brand-violet transition-colors font-medium">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
