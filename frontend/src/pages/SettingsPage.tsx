import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/auth'
import { planningApi } from '@/api/planning'
import { gdprApi } from '@/api/gdpr'
import { useAuthStore } from '@/store/authStore'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { LoadingPage } from '@/components/ui/EmptyState'
import { fmtDate, DAY_LABELS, ENERGY_PERIOD_LABELS, getApiError, today } from '@/lib/utils'
import type { DayOfWeek } from '@/types'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const qc = useQueryClient()
  const { user, setUser, logout } = useAuthStore()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const { data: fullUser, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.getMe,
    staleTime: 60_000,
  })

  // Sync fullUser → auth store when data arrives (onSuccess removed in react-query v5)
  useEffect(() => { if (fullUser) setUser(fullUser) }, [fullUser])

  const toggleAIMutation = useMutation({
    mutationFn: (enabled: boolean) => authApi.toggleAI(enabled),
    onSuccess: (_, enabled) => {
      toast.success(`IA ${enabled ? 'activée ✅' : 'désactivée'}`)
      qc.invalidateQueries({ queryKey: ['me'] })
      if (user) setUser({ ...user, ai_enabled: enabled })
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  const deleteAccountMutation = useMutation({
    mutationFn: gdprApi.deleteAccount,
    onSuccess: () => {
      toast.success('Compte supprimé')
      logout()
    },
    onError: (e) => toast.error(getApiError(e)),
  })

  async function handleExport() {
    try {
      const raw = await gdprApi.export()
      // Normalize — guarantee all arrays exist
      const data = {
        user:            raw.user           ?? {},
        tasks:           Array.isArray(raw.tasks)           ? raw.tasks           : [],
        scores:          Array.isArray(raw.scores)          ? raw.scores          : [],
        executions:      Array.isArray(raw.executions)      ? raw.executions      : [],
        availabilities:  Array.isArray(raw.availabilities)  ? raw.availabilities  : [],
        energy_profiles: Array.isArray(raw.energy_profiles) ? raw.energy_profiles : [],
      } as any

      // ── jsPDF (loaded from CDN in index.html) ──────────────────────────
      const { jsPDF } = (window as any).jspdf
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })

      const W = 210, margin = 18, lineH = 7
      let y = 20

      const brand: [number,number,number] = [99, 102, 241]
      const dark:  [number,number,number] = [30, 41, 59]
      const gray:  [number,number,number] = [100, 116, 139]
      const white: [number,number,number] = [255, 255, 255]

      function pageHeader() {
        doc.setFillColor(...dark)
        doc.rect(0, 0, W, 14, 'F')
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white)
        doc.text('DAILFOW', margin, 9.5)
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...gray)
        doc.text(`Export du ${new Date().toLocaleDateString('fr-FR')}`, W - margin, 9.5, { align: 'right' })
      }
      pageHeader()

      function sectionTitle(title: string) {
        if (y > 260) { doc.addPage(); pageHeader(); y = 24 }
        doc.setFillColor(...brand)
        doc.rect(margin, y - 1, W - margin * 2, 8, 'F')
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(...white)
        doc.text(title, margin + 3, y + 4.5)
        y += 12
      }

      function row(label: string, value: string) {
        if (y > 270) { doc.addPage(); pageHeader(); y = 24 }
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...dark)
        doc.text(label, margin + 3, y)
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...gray)
        // Use direct text (not splitTextToSize) to avoid character spacing issues
        const val = String(value ?? '—')
        const maxW = W - 105 - margin - 5
        if (doc.getTextWidth(val) <= maxW) {
          doc.text(val, 105, y)
          y += lineH
        } else {
          // Only split long values
          const lines = doc.splitTextToSize(val, maxW)
          doc.text(lines, 105, y)
          y += lines.length * 5.5
        }
      }

      function divider() {
        doc.setDrawColor(226, 232, 240)
        doc.line(margin, y - 1, W - margin, y - 1)
        y += 2
      }

      // Section 1 — Profil
      sectionTitle('Profil utilisateur')
      const u = data.user
      row("Nom d'utilisateur", u.username ?? '—')
      row('Email', u.email ?? '—')
      row('Compte créé le', u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : '—')
      row('IA activée', u.ai_enabled ? 'Oui' : 'Non')
      y += 4

      // Section 2 — Tâches
      sectionTitle(`Tâches (${data.tasks.length})`)
      if (data.tasks.length === 0) {
        doc.setFontSize(8.5); doc.setTextColor(...gray)
        doc.text('Aucune tâche', margin + 3, y); y += lineH
      } else {
        data.tasks.forEach((t: any, i: number) => {
          if (y > 255) { doc.addPage(); pageHeader(); y = 24 }
          doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...dark)
          doc.text(`${i + 1}. ${t.title ?? 'Sans titre'}`, margin + 3, y)
          doc.setFont('helvetica', 'normal'); doc.setTextColor(...gray)
          const dur = t.estimated_duration_minutes ? `${t.estimated_duration_minutes}min` : ''
          const due = t.due_date && t.due_date !== 'None' ? ` · Échéance: ${new Date(t.due_date).toLocaleDateString('fr-FR')}` : ''
          doc.text(`${(t.priority ?? '').toUpperCase()} · ${t.status ?? ''}${dur ? ' · ' + dur : ''}${due}`, margin + 6, y + 5)
          y += 12
          if (i < data.tasks.length - 1) divider()
        })
      }
      y += 4

      // Section 3 — Disponibilités
      sectionTitle(`Disponibilités (${data.availabilities.length})`)
      if (data.availabilities.length === 0) {
        doc.setFontSize(8.5); doc.setTextColor(...gray)
        doc.text('Aucune disponibilité configurée', margin + 3, y); y += lineH
      } else {
        data.availabilities.forEach((a: any) => {
          const day = (a.day_of_week ?? '').charAt(0).toUpperCase() + (a.day_of_week ?? '').slice(1)
          const timeVal = `${(a.start_time || '').slice(0,5)} - ${(a.end_time || '').slice(0,5)}`
          doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...dark)
          if (y > 270) { doc.addPage(); pageHeader(); y = 24 }
          doc.text(day, margin + 3, y)
          doc.setFont('helvetica', 'normal'); doc.setTextColor(...gray)
          doc.text(timeVal, 105, y)
          y += lineH
        })
      }
      y += 4

      // Section 4 — Énergie
      sectionTitle(`Profils énergie (${data.energy_profiles.length})`)
      if (data.energy_profiles.length === 0) {
        doc.setFontSize(8.5); doc.setTextColor(...gray)
        doc.text('Aucun profil configuré', margin + 3, y); y += lineH
      } else {
        data.energy_profiles.forEach((e: any) => {
          const period = (e.period ?? '').charAt(0).toUpperCase() + (e.period ?? '').slice(1)
          row(period, `Niveau ${e.energy_level ?? '—'}/10`)
        })
      }
      y += 4

      // Section 5 — Scores
      if (data.scores.length > 0) {
        sectionTitle(`Scores (${data.scores.length} journées)`)
        data.scores.slice(0, 15).forEach((s: any) => {
          const dateStr = s.date ? new Date(s.date).toLocaleDateString('fr-FR') : (s.score_date ? new Date(s.score_date).toLocaleDateString('fr-FR') : '—')
          const scoreVal = s.total_score != null ? Number(s.total_score).toFixed(1) : '—'
          row(dateStr, `Score: ${scoreVal}/100`)
        })
        if (data.scores.length > 15) {
          doc.setFontSize(7.5); doc.setTextColor(...gray)
          doc.text(`… et ${data.scores.length - 15} autres journées`, margin + 3, y); y += lineH
        }
      }

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p)
        doc.setFontSize(7); doc.setTextColor(...gray)
        doc.text(`DAILFOW · Export personnel · Page ${p}/${pageCount}`, W / 2, 292, { align: 'center' })
      }

      doc.save(`dailfow-export-${today()}.pdf`)
      toast.success('Export PDF téléchargé')
    } catch (e) {
      console.error('PDF export error:', e)
      toast.error('Erreur export: ' + getApiError(e))
    }
  }


  function handleDeleteConfirm() {
    if (deleteConfirm !== 'SUPPRIMER') {
      toast.error('Tapez exactement "SUPPRIMER"')
      return
    }
    deleteAccountMutation.mutate()
  }

  const currentUser = fullUser ?? user

  if (isLoading && !currentUser) return <LoadingPage />

  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-2xl font-bold">Paramètres</h1>

      {/* Profile */}
      <Card>
        <CardHeader><CardTitle>👤 Profil</CardTitle></CardHeader>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Email</div>
            <div className="text-sm font-mono text-slate-300">{currentUser?.email}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Nom d'utilisateur</div>
            <div className="text-sm font-semibold">{currentUser?.username}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Rôle</div>
            <Badge variant="info">{currentUser?.role}</Badge>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">Membre depuis</div>
            <div className="text-sm font-mono text-slate-400">{fmtDate(currentUser?.created_at)}</div>
          </div>
        </div>
      </Card>

      {/* AI Toggle */}
      <Card>
        <CardHeader><CardTitle>🤖 Intelligence Artificielle</CardTitle></CardHeader>
        <div className="flex items-center justify-between p-4 bg-dark-surface border border-dark-border rounded-xl">
          <div>
            <div className="text-sm font-medium">Activer l'IA</div>
            <div className="text-xs text-slate-400 mt-0.5">L'IA analyse vos habitudes pour recommander les meilleurs créneaux</div>
          </div>
          <label className="relative w-11 h-6 flex-shrink-0 cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={currentUser?.ai_enabled ?? false}
              onChange={(e) => toggleAIMutation.mutate(e.target.checked)}
            />
            <div className="w-11 h-6 bg-dark-border2 rounded-full peer peer-checked:bg-brand-primary transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
          </label>
        </div>
      </Card>

      {/* Availabilities */}
      <Card>
        <CardHeader><CardTitle>📆 Disponibilités hebdomadaires</CardTitle></CardHeader>
        <AvailabilitiesSection />
      </Card>

      {/* Energy Profile */}
      <Card>
        <CardHeader><CardTitle>⚡ Profil Énergie</CardTitle></CardHeader>
        <EnergySection />
      </Card>

      {/* GDPR */}
      <Card>
        <CardHeader><CardTitle>🛡️ RGPD & Données personnelles</CardTitle></CardHeader>
        <p className="text-sm text-slate-400 mb-4">Vous avez le droit d'exporter ou de supprimer toutes vos données.</p>
        <div className="flex gap-3 flex-wrap">
          <Button variant="secondary" onClick={handleExport}>
            📥 Exporter mes données (PDF)
          </Button>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            🗑 Supprimer mon compte
          </Button>
        </div>
      </Card>

      {/* Delete Account Modal */}
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="⚠️ Supprimer mon compte">
        <p className="text-sm text-slate-300 mb-1">
          Cette action est <strong className="text-red-400">irréversible</strong>. Toutes vos données seront définitivement supprimées.
        </p>
        <p className="text-xs text-slate-500 mb-5">Tâches, analytics, planning, historique... Tout sera effacé.</p>

        <Input
          label='Tapez "SUPPRIMER" pour confirmer'
          placeholder="SUPPRIMER"
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          className="mb-4"
        />

        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setDeleteOpen(false)}>
            Annuler
          </Button>
          <Button
            variant="danger"
            fullWidth
            loading={deleteAccountMutation.isPending}
            onClick={handleDeleteConfirm}
          >
            Supprimer définitivement
          </Button>
        </div>
      </Modal>
    </div>
  )
}

// ── Availabilities sub-section ────────────────────────────────────────────────
function AvailabilitiesSection() {
  const qc = useQueryClient()
  const { data: avails = [] } = useQuery({
    queryKey: ['availabilities'],
    queryFn: planningApi.listAvailabilities,
    staleTime: 60_000,
  })

  const [day, setDay] = useState<DayOfWeek>('monday')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')

  const createMutation = useMutation({
    mutationFn: () =>
      planningApi.createAvailability({ day_of_week: day, start_time: start + ':00', end_time: end + ':00' }),
    onSuccess: () => { toast.success('Disponibilité ajoutée ✅'); qc.invalidateQueries({ queryKey: ['availabilities'] }) },
    onError: (e) => toast.error(getApiError(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => planningApi.deleteAvailability(id),
    onSuccess: () => { toast.success('Supprimée'); qc.invalidateQueries({ queryKey: ['availabilities'] }) },
    onError: (e) => toast.error(getApiError(e)),
  })

  return (
    <>
      {avails.length === 0 ? (
        <p className="text-sm text-slate-500 mb-4">Aucune disponibilité configurée</p>
      ) : (
        <div className="space-y-1.5 mb-4">
          {avails.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-3 py-2.5 bg-dark-surface border border-dark-border rounded-lg">
              <span className="text-sm font-medium min-w-[80px]">{DAY_LABELS[a.day_of_week] ?? a.day_of_week}</span>
              <span className="text-xs font-mono text-slate-400">{a.start_time.slice(0, 5)} → {a.end_time.slice(0, 5)}</span>
              <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(a.id)}>🗑</Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-3 items-end flex-wrap border-t border-dark-border pt-4">
        <Select
          label="Jour"
          value={day}
          onChange={(e) => setDay(e.target.value as DayOfWeek)}
          options={Object.entries(DAY_LABELS).map(([k, v]) => ({ value: k, label: v }))}
          className="min-w-[140px]"
        />
        <Input label="Début" type="time" value={start} onChange={(e) => setStart(e.target.value)} className="min-w-[120px]" />
        <Input label="Fin" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="min-w-[120px]" />
        <Button variant="primary" loading={createMutation.isPending} onClick={() => createMutation.mutate()}>
          + Ajouter
        </Button>
      </div>
    </>
  )
}

// ── Energy sub-section ────────────────────────────────────────────────────────
function EnergySection() {
  const qc = useQueryClient()
  const { data: profiles = [] } = useQuery({
    queryKey: ['energy'],
    queryFn: planningApi.listEnergy,
    staleTime: 60_000,
  })

  const profileMap = Object.fromEntries(profiles.map((p) => [p.period, p.energy_level]))
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const upsertMutation = useMutation({
    mutationFn: planningApi.upsertEnergy,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['energy'] }),
    onError: (e) => toast.error(getApiError(e)),
  })

  function handleChange(period: string, value: number) {
    clearTimeout(debounceRefs.current[period])
    debounceRefs.current[period] = setTimeout(() => {
      upsertMutation.mutate({ period: period as any, energy_level: value })
      toast.success(`Énergie ${period} → ${value}/10`)
    }, 600)
  }

  return (
    <div className="space-y-3">
      {ENERGY_PERIOD_LABELS.map(({ key, label, sub }) => (
        <EnergySliderRow
          key={key}
          period={key}
          label={label}
          sub={sub}
          initialValue={profileMap[key] ?? 5}
          onChange={(v) => handleChange(key, v)}
        />
      ))}
    </div>
  )
}

function EnergySliderRow({ period, label, sub, initialValue, onChange }: {
  period: string; label: string; sub: string; initialValue: number; onChange: (v: number) => void
}) {
  const [val, setVal] = useState(initialValue)
  useEffect(() => setVal(initialValue), [initialValue])
  const color = val >= 7 ? '#10B981' : val >= 4 ? '#F59E0B' : '#EF4444'

  return (
    <div className="p-3.5 bg-dark-surface border border-dark-border rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-slate-500">{sub}</div>
        </div>
        <span className="text-sm font-mono font-bold" style={{ color }}>{val}/10</span>
      </div>
      <input
        type="range" min={1} max={10} value={val}
        className="w-full h-1 rounded-full outline-none cursor-pointer"
        style={{ accentColor: color }}
        onChange={(e) => { const v = parseInt(e.target.value); setVal(v); onChange(v) }}
      />
    </div>
  )
}
