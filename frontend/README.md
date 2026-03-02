# DAILFOW — Frontend React

Interface utilisateur complète de DAILFOW, une application de productivité intelligente.

## Stack technique

- **React 18** + **TypeScript** strict
- **Vite** (bundler, proxy API intégré)
- **TailwindCSS** (dark mode, design system custom)
- **TanStack Query v5** (data fetching, cache, auto-refresh)
- **React Hook Form** + **Zod** (formulaires validés)
- **Zustand** + persist (auth globale)
- **Recharts** (graphiques analytics)
- **Lucide React** (icônes)
- **date-fns** + locale fr (dates)
- **react-hot-toast** (notifications)

## Démarrage rapide

### Prérequis
- Node.js 18+
- Backend DAILFOW tournant sur `http://localhost:8000`

### Installation

```bash
cd dailfow-frontend
npm install
npm run dev
```

L'app est disponible sur **http://localhost:3000**

Le proxy Vite redirige automatiquement `/api/*` vers `http://localhost:8000`.

### Build production

```bash
npm run build
npm run preview
```

## Structure du projet

```
src/
├── api/          # Couche HTTP (axios + endpoints)
│   ├── axios.ts  # Instance + interceptors + auto-refresh JWT
│   ├── auth.ts
│   ├── tasks.ts
│   ├── planning.ts
│   ├── analytics.ts
│   ├── notifications.ts
│   └── gdpr.ts
│
├── store/
│   └── authStore.ts  # Zustand + localStorage persist
│
├── types/
│   └── index.ts  # Tous les types TypeScript (sync avec backend)
│
├── lib/
│   └── utils.ts  # Helpers (dates, couleurs, formatage)
│
├── components/
│   ├── ui/       # Composants génériques (Button, Card, Modal…)
│   ├── layout/   # Sidebar, Header, Layout
│   └── tasks/    # TaskCard, TaskForm
│
└── pages/
    ├── auth/     # Login, Register
    ├── DashboardPage.tsx
    ├── TasksPage.tsx
    ├── PlanningPage.tsx
    ├── AnalyticsPage.tsx
    ├── NotificationsPage.tsx
    └── SettingsPage.tsx
```

## Configuration

Variables d'environnement (`.env.local`) :

```env
VITE_API_URL=http://localhost:8000/api/v1
```

Par défaut, le proxy Vite redirige `/api` → `http://localhost:8000`.

## Fonctionnalités

| Page | Fonctionnalités |
|---|---|
| **Dashboard** | Score ring animé, burnout live, planning du jour, top 5 tâches, ajout rapide |
| **Tâches** | CRUD complet, filtres status/priorité, done/postpone/edit/delete |
| **Planning Classique** | Génération, timeline visuelle, alertes surcharge/fallback |
| **Planning IA** | Select tâche → recommandation avec critères, barre confiance |
| **Config Planning** | Disponibilités (ajout/suppression), sliders énergie debounced |
| **Analytics** | Radar, BarChart, LineChart multi-courbes, AreaChart burnout |
| **Notifications** | Liste live, mark read au click, badge counter auto-refresh 30s |
| **Paramètres** | Toggle IA, disponibilités, énergie, export JSON, suppression compte |
