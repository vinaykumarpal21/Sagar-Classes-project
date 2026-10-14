# Sagar Classes – Website + Monitoring

Coaching-institute website (Frontend) ke saath ek chhota Node.js backend jo **Prometheus metrics** deta hai.
Sab kuch Docker Compose se ek command me chalta hai.

## 1. Project Structure

```
SAGAR-TUTION/
├── frontend/                  # User interface (static website, nginx se serve hota hai)
│   ├── index.html             # Home
│   ├── about.html             # About Us
│   ├── academic.html          # Student Attendance form
│   ├── attendance.html        # Attendance hub (Student / Staff choose karo)
│   ├── staff.html             # Staff Attendance form
│   ├── admin.html             # Admin portal
│   ├── contact.html           # Contact & Branches
│   ├── facility.html          # Facilities
│   ├── functions.html         # Events & Celebrations
│   ├── toppers.html           # Toppers & Results
│   ├── css/style.css          # Poori website ki ek stylesheet
│   ├── js/
│   │   ├── admin.js           # Admin panel logic
│   │   ├── layout.js          # Shared navbar + footer + page-view beacon
│   │   ├── script.js          # Public pages ka logic
│   │   ├── store.js           # Data storage (localStorage), ranking, export
│   │   └── theme.js           # Light / Dark mode
│   ├── images/                # logo.jpeg, hero.svg, batches/, events/
│   ├── nginx.conf             # nginx config (static + /track proxy)
│   └── Dockerfile             # nginx based image
│
├── backend/                   # Monitoring server
│   ├── server.js              # Express + prom-client (/health, /metrics, /track/pageview)
│   ├── package.json
│   └── Dockerfile             # Node.js based image
│
├── prometheus.yml             # Prometheus scrape config
├── docker-compose.yml         # Teeno services ek saath chalata hai
├── Jenkinsfile                # CI/CD pipeline (Jenkins)
└── README.md
```

## 2. Architecture

```
                      ┌────────────────────────── Docker network: sagar-net ───────────────────────────┐
                      │                                                                                │
  Browser ──:8081───► │  ┌──────────────────┐   POST /track/pageview    ┌─────────────────────────┐    │
  (student/admin)     │  │ frontend (nginx) │ ────────────────────────► │ backend (Node + Express)│    │
                      │  │ static HTML/CSS/ │   GET  /health            │  /health                │    │
                      │  │ JS + images      │                           │  /metrics  ◄────────────┼─┐  │
                      │  └──────────────────┘                           │  /track/pageview        │ │  │
                      │                                                 └─────────────────────────┘ │  │
                      │                                                                             │  │
  Browser ──:9091───► │  ┌──────────────────┐        scrape every 15s (GET backend:3000/metrics)    │  │
  (Prometheus UI)     │  │   prometheus     │ ──────────────────────────────────────────────────────┘  │
                      │  └──────────────────┘                                                          │
                      └────────────────────────────────────────────────────────────────────────────────┘
```

**Kaise kaam karta hai**

1. Visitor `http://localhost:8081` kholta hai → **nginx** HTML/CSS/JS/images deta hai.
2. Website ka data (students, staff, toppers, attendance, admin login) **browser ke localStorage** me rehta hai (`js/store.js`). Isliye website ko database ki zaroorat nahi.
3. Har page load par `layout.js` ek anonymous beacon `POST /track/pageview` bhejta hai. nginx ise **backend** ko forward karta hai.
4. **backend** `sagar_page_views_total{page="..."}` counter badhata hai (sirf known pages allowed hain, to fake labels nahi ban sakte).
5. **Prometheus** har 15 second me `backend:3000/metrics` scrape karta hai aur graph/query ke liye store karta hai.
6. `/metrics` nginx se public nahi hai – sirf Prometheus internal network se padhta hai.

Metrics jo milte hain: `sagar_page_views_total`, `http_requests_total`, `http_request_duration_seconds`, aur Node.js default metrics (CPU, memory, event-loop, GC).

## 3. Run karne ke steps

### Option A – Docker Compose (recommended)

Pehle Docker + Docker Compose install hona chahiye.

```bash
# 1. Project folder me jao
cd SAGAR-TUTION

# 2. Build + start (background me)
docker compose up -d --build

# 3. Status check
docker compose ps
```

| Service | URL |
|---|---|
| Website | http://localhost:8081 |
| Backend health | http://localhost:3000/health |
| Backend metrics | http://localhost:3000/metrics |
| Prometheus UI | http://localhost:9091 |

Band karne ke liye:

```bash
docker compose down          # containers band
docker compose down -v       # + Prometheus ka saved data bhi delete
```

Logs dekhne ke liye: `docker compose logs -f backend`

### Option B – Bina Docker ke

```bash
# Frontend: koi bhi static server
cd frontend && python3 -m http.server 8081      # ya seedha index.html double-click karo

# Backend (alag terminal)
cd backend && npm install && npm start          # http://localhost:3000
```

> Bina nginx ke page-view beacon backend tak nahi pahunchta (website phir bhi bilkul theek chalti hai).

## 4. Prometheus me check karna

1. http://localhost:9091/targets kholo → `sagar-backend` **UP** hona chahiye.
2. Website ke 2–3 pages kholo.
3. Prometheus → **Graph** me ye queries chalao:

```promql
sum by (page) (sagar_page_views_total)             # page-wise views
rate(http_requests_total[1m])                      # requests per second
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
process_resident_memory_bytes                      # backend memory
```

## 5. Admin Panel

`/admin.html` kholo → login: **admin / admin@123**

Login badalne ke liye browser console me:
`SCStore.setAdmin('myuser', 'strong-password')`

Admin se: students, staff, toppers, events, notices, website images manage karo, attendance register dekho aur Excel/PDF export karo.

> Dhyan do: data sirf us browser me save hota hai. Backup: `SCStore.exportJSON()` · Reset: `SCStore.reset()`.

## 6. Pages ka mapping (purane project se)

| Purana | Naya |
|---|---|
| `html/facilities.html` | `frontend/facility.html` |
| `html/staff-attendance.html` | `frontend/staff.html` |
| `html/academic.html` (Student Attendance) | `frontend/academic.html` |
| — | `frontend/attendance.html` (naya hub page) |
| baaki `html/*.html` | `frontend/*.html` (same naam) |

Ab saare pages ek hi folder me hain, isliye `../` wale paths hat gaye.

## 7. Jenkins CI/CD

Pipeline code `Jenkinsfile` me hai (project ke saath hi). Jenkins me alag se kuch likhna nahi padta.

**Pipeline stages:** Checkout → Validate → Build Images → Deploy → Smoke Test (backend `/health`, frontend homepage, Prometheus ready).

**Setup (ek baar):**

1. Jenkins me Docker chalne layak banao: Jenkins jis machine par chal raha hai wahan Docker + Docker Compose installed ho, aur Jenkins ka user Docker chala sake.
   - Linux: `sudo usermod -aG docker jenkins` phir `sudo systemctl restart jenkins`
   - Windows: Docker Desktop chalu rakho aur Jenkins service ko usi user se chalao jisme Docker Desktop chalta hai.
2. Project ko GitHub par push karo.
3. Jenkins → **New Item** → naam `sagar-classes` → **Pipeline** → OK.
4. **Pipeline** section me:
   - Definition: `Pipeline script from SCM`
   - SCM: `Git`, Repository URL: apni GitHub repo ka link
   - Branch: `*/main`
   - Script Path: `Jenkinsfile`
5. **Save** → **Build Now**.
6. Build ke baad website `http://localhost:8081` aur Prometheus `http://localhost:9091` par khulte hain.

> Jenkins khud `8080` par chalta hai, isliye website `8081` par rakhi gayi hai.

**Auto build (optional):** GitHub repo → Settings → Webhooks → `http://<jenkins-url>/github-webhook/`, aur Jenkins job me "GitHub hook trigger for GITScm polling" ON karo. Local Jenkins ke liye isme "Poll SCM" (`H/5 * * * *`) use karna aasan hai.

**Agar build fail ho:**

| Error | Wajah / Solution |
|---|---|
| `docker: command not found` | Jenkins machine par Docker install nahi ya PATH me nahi |
| `permission denied ... docker.sock` | Jenkins user ko docker group me daalo (upar step 1) |
| `port is already allocated` | `docker-compose.yml` me left wala port badlo |
| Smoke Test fail | Console Output me last 50 lines of logs dekho |

## 8. Production tips

- Port `8081` ko reverse proxy / domain + HTTPS (Caddy, Traefik ya Cloudflare) ke peeche lagao.
- Prometheus (`9091`) ko public internet par expose mat karo.
- Default admin password turant badlo.
