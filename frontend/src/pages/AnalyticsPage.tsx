import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { analyticsApi } from '@/api/analytics'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { Badge } from '@/components/ui/Badge'
import { ScoreRing, ProgressBar } from '@/components/ui/ProgressBar'
import { LoadingPage } from '@/components/ui/EmptyState'
import { today, getMondayOfWeek, scoreColor, riskColor, cn } from '@/lib/utils'
import type { BurnoutLabel } from '@/types'

// ── Recharts theme ───────────────────────────────────────────────────────────
const CHART_COLORS = {
  primary: '#6366F1',
  violet: '#8B5CF6',
  emerald: '#10B981',
  amber: '#F59E0B',
  red: '#EF4444',
  cyan: '#06B6D4',
  muted: '#334155',
  text: '#64748B',
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-card border border-dark-border2 rounded-xl p-3 text-xs shadow-lg">
      <p className="text-slate-400 mb-2 font-medium">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300">{p.name}:</span>
          <span className="font-mono font-bold" style={{ color: p.color }}>
            {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Metric Card Component ────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color, progress }: {
  label: string; value: string; sub: string; color: string; progress?: number
}) {
  return (
    <Card>
      <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">{label}</div>
      <div className="text-3xl font-bold font-mono mb-1" style={{ color }}>{value}</div>
      <div className="text-xs text-slate-500 mb-2">{sub}</div>
      {progress !== undefined && (
        <ProgressBar value={progress} color={color} height="xs" />
      )}
    </Card>
  )
}

export default function AnalyticsPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Aujourd'hui</TabsTrigger>
          <TabsTrigger value="week">Cette semaine</TabsTrigger>
          <TabsTrigger value="trends">Tendances</TabsTrigger>
          <TabsTrigger value="burnout">Burnout</TabsTrigger>
        </TabsList>

        <TabsContent value="today"><TodayTab /></TabsContent>
        <TabsContent value="week"><WeekTab /></TabsContent>
        <TabsContent value="trends"><TrendsTab /></TabsContent>
        <TabsContent value="burnout"><BurnoutTab /></TabsContent>
      </Tabs>
    </div>
  )
}

// ── Today Tab ─────────────────────────────────────────────────────────────────
function TodayTab() {
  const { data: score, isLoading } = useQuery({
    queryKey: ['analytics', 'daily', today()],
    queryFn: () => analyticsApi.getDaily(today()),
    staleTime: 60_000,
  })

  if (isLoading) return <LoadingPage />
  if (!score) return <p className="text-slate-400">Aucune donnée pour aujourd'hui</p>

  const radarData = [
    { subject: 'Score', value: score.total_score, fullMark: 100 },
    { subject: 'Discipline', value: score.discipline_score * 10, fullMark: 100 },
    { subject: 'Focus', value: score.focus_score * 10, fullMark: 100 },
    { subject: 'Énergie', value: score.energy_alignment_rate * 100, fullMark: 100 },
    { subject: 'Complétion', value: score.completion_rate * 100, fullMark: 100 },
    { subject: 'Anti-Burnout', value: (1 - score.burnout_risk_index) * 100, fullMark: 100 },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="🏆 Score total" value={String(Math.round(score.total_score))} sub="/100" color={scoreColor(score.total_score)} progress={score.total_score} />
        <MetricCard label="⚡ Discipline" value={score.discipline_score.toFixed(1)} sub="/10" color={CHART_COLORS.primary} progress={score.discipline_score * 10} />
        <MetricCard label="🎯 Focus" value={score.focus_score.toFixed(1)} sub="/10" color={CHART_COLORS.violet} progress={score.focus_score * 10} />
        <MetricCard label="🔋 Énergie alignée" value={Math.round(score.energy_alignment_rate * 100) + '%'} sub="des tâches" color={CHART_COLORS.cyan} progress={score.energy_alignment_rate * 100} />
        <MetricCard
          label="✅ Taux complétion"
          value={Math.round(score.completion_rate * 100) + '%'}
          sub={`${score.tasks_completed}/${score.tasks_total} tâches`}
          color={CHART_COLORS.emerald}
          progress={score.completion_rate * 100}
        />
        <MetricCard
          label="🔥 Risque burnout"
          value={Math.round(score.burnout_risk_index * 100) + '%'}
          sub={score.burnout_label}
          color={riskColor(score.burnout_risk_index)}
          progress={score.burnout_risk_index * 100}
        />
      </div>

      <Card>
        <CardHeader><CardTitle>Radar des performances</CardTitle></CardHeader>
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={radarData}>
            <PolarGrid stroke={CHART_COLORS.muted} />
            <PolarAngleAxis dataKey="subject" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} />
            <Radar
              name="Aujourd'hui"
              dataKey="value"
              stroke={CHART_COLORS.primary}
              fill={CHART_COLORS.primary}
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}

// ── Week Tab ──────────────────────────────────────────────────────────────────
function WeekTab() {
  const { data: weekly, isLoading: loadingWeekly } = useQuery({
    queryKey: ['analytics', 'weekly', getMondayOfWeek()],
    queryFn: () => analyticsApi.getWeekly(getMondayOfWeek()),
    staleTime: 60_000,
  })

  const { data: trends7 = [] } = useQuery({
    queryKey: ['analytics', 'trends', 7],
    queryFn: () => analyticsApi.getTrends(7),
    staleTime: 60_000,
  })

  if (loadingWeekly) return <LoadingPage />

  const barData = trends7.map((d) => ({
    date: format(parseISO(d.date), 'EEE', { locale: fr }),
    score: Math.round(d.total_score),
    fill: scoreColor(d.total_score),
  }))

  return (
    <div className="space-y-4">
      {weekly && (
        <div className="grid grid-cols-3 gap-4">
          <MetricCard label="🏆 Score moyen" value={String(Math.round(weekly.total_score))} sub="/100" color={scoreColor(weekly.total_score)} progress={weekly.total_score} />
          <MetricCard label="⚡ Discipline" value={weekly.discipline_score.toFixed(1)} sub="/10" color={CHART_COLORS.primary} progress={weekly.discipline_score * 10} />
          <MetricCard label="🎯 Focus" value={weekly.focus_score.toFixed(1)} sub="/10" color={CHART_COLORS.violet} progress={weekly.focus_score * 10} />
          <MetricCard label="🔋 Énergie" value={Math.round(weekly.energy_alignment_rate * 100) + '%'} sub="alignement" color={CHART_COLORS.cyan} progress={weekly.energy_alignment_rate * 100} />
          <MetricCard label="✅ Complétion" value={Math.round(weekly.completion_rate * 100) + '%'} sub={`${weekly.tasks_completed}/${weekly.tasks_total}`} color={CHART_COLORS.emerald} progress={weekly.completion_rate * 100} />
          <MetricCard label="🔥 Burnout" value={Math.round(weekly.burnout_risk_index * 100) + '%'} sub={weekly.burnout_label} color={riskColor(weekly.burnout_risk_index)} progress={weekly.burnout_risk_index * 100} />
        </div>
      )}

      {barData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Scores de la semaine</CardTitle></CardHeader>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.muted} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: CHART_COLORS.text, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.05)' }} />
              <Bar dataKey="score" name="Score" radius={[6, 6, 0, 0]} fill={CHART_COLORS.primary} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}

// ── Trends Tab ────────────────────────────────────────────────────────────────
function TrendsTab() {
  const [days, setDays] = useState(30)
  const PERIOD_OPTIONS = [7, 14, 30, 90]

  const { data: trends = [], isLoading } = useQuery({
    queryKey: ['analytics', 'trends', days],
    queryFn: () => analyticsApi.getTrends(days),
    staleTime: 60_000,
  })

  const chartData = trends.map((d) => ({
    date: format(parseISO(d.date), 'dd/MM'),
    score: Math.round(d.total_score),
    discipline: Math.round(d.discipline_score * 10),
    completion: Math.round(d.completion_rate * 100),
    burnout: Math.round(d.burnout_risk_index * 100),
  }))

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex gap-2">
        {PERIOD_OPTIONS.map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
              days === d
                ? 'bg-brand-primary/15 border-brand-primary text-brand-primary'
                : 'bg-dark-card border-dark-border text-slate-400 hover:text-slate-200'
            )}
          >
            {d} jours
          </button>
        ))}
      </div>

      {isLoading ? <LoadingPage /> : (
        <>
          <Card>
            <CardHeader><CardTitle>Évolution des scores</CardTitle></CardHeader>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.muted} />
                <XAxis dataKey="date" tick={{ fill: CHART_COLORS.text, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fill: CHART_COLORS.text, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ color: CHART_COLORS.text, fontSize: 11 }} />
                <Line type="monotone" dataKey="score" name="Score" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="discipline" name="Discipline" stroke={CHART_COLORS.violet} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="completion" name="Complétion" stroke={CHART_COLORS.emerald} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <CardHeader><CardTitle>Risque Burnout</CardTitle></CardHeader>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="burnoutGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.muted} />
                <XAxis dataKey="date" tick={{ fill: CHART_COLORS.text, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={[0, 100]} tick={{ fill: CHART_COLORS.text, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="burnout" name="Burnout %" stroke={CHART_COLORS.red} strokeWidth={2} fill="url(#burnoutGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  )
}

// ── Burnout Tab ───────────────────────────────────────────────────────────────
function BurnoutTab() {
  const { data: burnout, isLoading } = useQuery({
    queryKey: ['analytics', 'burnout'],
    queryFn: analyticsApi.getBurnoutPrediction,
    staleTime: 60_000,
  })

  const { data: trends30 = [] } = useQuery({
    queryKey: ['analytics', 'trends', 30],
    queryFn: () => analyticsApi.getTrends(30),
    staleTime: 60_000,
  })

  if (isLoading) return <LoadingPage />

  const pct = burnout?.risk_level !== 'UNKNOWN'
    ? Math.round((burnout?.predicted_burnout_risk ?? 0) * 100)
    : null

  const color = pct !== null ? riskColor((pct ?? 0) / 100) : '#64748B'

  const trendIconMap: Record<string, React.ReactNode> = {
    increasing: <TrendingUp size={20} className="text-red-400" />,
    decreasing: <TrendingDown size={20} className="text-emerald-400" />,
    stable: <Minus size={20} className="text-amber-400" />,
  }

  const burnoutChartData = trends30.map((d) => ({
    date: format(parseISO(d.date), 'dd/MM'),
    burnout: Math.round(d.burnout_risk_index * 100),
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Ring card */}
        <Card className="flex flex-col items-center gap-5 py-8">
          <div className="relative">
            <ScoreRing value={pct ?? 0} color={color} size={160} strokeWidth={10} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold font-mono" style={{ color }}>
                {pct !== null ? pct + '%' : '?'}
              </span>
              <span className="text-xs text-slate-500 mt-1">Risque prédit</span>
            </div>
          </div>

          {burnout && burnout.risk_level !== 'UNKNOWN' && (
            <div className="flex items-center gap-3">
              <Badge variant={burnout.risk_level as BurnoutLabel}>{burnout.risk_level}</Badge>
              {trendIconMap[burnout.trend ?? 'stable']}
            </div>
          )}
        </Card>

        {/* Recommendation card */}
        <Card>
          <CardHeader><CardTitle>Analyse & Recommandation</CardTitle></CardHeader>
          {burnout && burnout.risk_level !== 'UNKNOWN' ? (
            <>
              <p className="text-sm text-slate-200 leading-relaxed mb-4">{burnout.recommendation}</p>
              <div className="pt-3 border-t border-dark-border">
                <p className="text-xs text-slate-500">
                  Basé sur{' '}
                  <span className="font-mono text-brand-primary">{burnout.based_on_days}</span>{' '}
                  jours d'analyse
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">
              Pas assez de données. Utilisez l'application quelques jours pour obtenir une prédiction.
            </p>
          )}
        </Card>
      </div>

      {burnoutChartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Historique Burnout (30 jours)</CardTitle></CardHeader>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={burnoutChartData}>
              <defs>
                <linearGradient id="burnoutGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tick={{ fill: '#64748B', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="burnout" name="Risque %" stroke="#EF4444" strokeWidth={2} fill="url(#burnoutGrad2)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}
