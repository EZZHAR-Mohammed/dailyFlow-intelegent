# 🧠 DAILFOW Backend

**Intelligent Daily Flow Manager** — FastAPI + MySQL + AI

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your MySQL credentials and secret key
```

### 3. Create MySQL database (via XAMPP or CLI)
```sql
CREATE DATABASE dailfow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. Run the server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Open interactive API docs
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

---

## 🧪 Run Tests

```bash
# All tests (unit + integration + AI)
pytest

# With coverage
pytest --cov=app --cov-report=html

# Specific suite
pytest tests/unit/
pytest tests/integration/
pytest tests/ai/
```

---

## 🗄️ Database Migrations (Alembic)

```bash
# Create a migration
alembic revision --autogenerate -m "initial"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

---

## 📁 Architecture

```
backend/
 ├─ app/
 │   ├─ api/
 │   │   ├─ routes/          # HTTP handlers only — no business logic
 │   │   │   ├─ auth.py      # Register, Login, JWT refresh
 │   │   │   ├─ tasks.py     # CRUD + mark done/postpone
 │   │   │   ├─ planning.py  # Classic + AI planning
 │   │   │   ├─ analytics.py # Scores, trends, burnout
 │   │   │   ├─ notifications.py
 │   │   │   └─ gdpr.py      # Export + delete account
 │   │   ├─ dependencies/    # Auth middleware
 │   │   └─ schemas.py       # Pydantic request/response models
 │   │
 │   ├─ domain/
 │   │   ├─ models/          # Pure Python entities (no ORM)
 │   │   │   ├─ user.py
 │   │   │   ├─ task.py      # Business rules: composite_score, postpone penalty
 │   │   │   ├─ energy.py    # Availability, EnergyProfile
 │   │   │   └─ schedule.py  # ScheduledSlot, AIDecision, Score
 │   │   └─ services/
 │   │       ├─ planning_engine.py  # Classic heuristic planner
 │   │       └─ score_calculator.py # Daily/weekly score computation
 │   │
 │   ├─ infrastructure/
 │   │   ├─ database/
 │   │   │   ├─ session.py   # SQLAlchemy engine
 │   │   │   └─ models.py    # ORM models (all tables)
 │   │   ├─ repositories/    # DB access layer
 │   │   ├─ security/        # JWT, password hashing
 │   │   └─ ai/
 │   │       └─ smart_planner.py  # ML-powered slot recommender
 │   │
 │   └─ core/
 │       ├─ config.py         # Settings via .env
 │       └─ logging.py        # Structured logging
 │
 ├─ alembic/                  # DB migrations
 ├─ tests/
 │   ├─ unit/                 # Domain logic tests (no DB)
 │   ├─ integration/          # API tests (SQLite in-memory)
 │   └─ ai/                   # AI planner tests
 └─ requirements.txt
```

---

## 🔑 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Get JWT tokens |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET | `/api/v1/auth/me` | Current user profile |
| GET | `/api/v1/tasks` | List tasks (filterable) |
| POST | `/api/v1/tasks` | Create task |
| PATCH | `/api/v1/tasks/{id}` | Update task |
| POST | `/api/v1/tasks/{id}/done` | Mark done |
| POST | `/api/v1/tasks/{id}/postpone` | Postpone task |
| POST | `/api/v1/planning/generate` | Generate daily plan |
| POST | `/api/v1/planning/ai/recommend/{task_id}` | AI slot recommendation |
| GET | `/api/v1/analytics/daily` | Daily score |
| GET | `/api/v1/analytics/weekly` | Weekly summary |
| GET | `/api/v1/analytics/trends` | Score trends (30d) |
| GET | `/api/v1/analytics/burnout-prediction` | Burnout forecast |
| GET | `/api/v1/gdpr/export` | Export all data |
| DELETE | `/api/v1/gdpr/delete-account` | Erase account |
| GET | `/health` | Health check |

---

## ⚙️ Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL connection string | `mysql+pymysql://root:@localhost:3306/dailfow` |
| `SECRET_KEY` | JWT signing key | ⚠️ Change in production |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token TTL | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token TTL | `7` |
| `REDIS_URL` | Redis for Celery | `redis://localhost:6379/0` |
| `DEBUG` | Enable debug mode | `True` |



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
