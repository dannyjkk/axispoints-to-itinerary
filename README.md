
# Points → Itinerary (MVP)

A product prototype that helps users understand **what flights they can realistically book using credit card reward points**, starting with Axis Bank EDGE Rewards and airline miles.

This project focuses on **decision feasibility**, not booking — answering:
> “Given my points, what trips are actually possible?”

---

## 🧩 Problem Statement

Credit card reward points are opaque:
- Users don’t know what their points are *worth*
- Bank portals show transfer partners but not **real availability**
- Award searches are fragmented across airline websites

This leads to:
- Trial-and-error searches
- Overestimating what points can buy
- Poor redemption decisions

---

## 💡 Solution Overview

This MVP converts **credit card points → partner airline miles**, then checks **real award availability** using cached airline data to show **bookable options**.

### Current Scope (Flow A)
> “I have X EDGE points. What flights can I book?”

---

## 🔁 Flow A – Points → Available Flights

### User Inputs
- Credit card (e.g. Axis Burgundy)
- Available EDGE reward points
- Origin & destination (airport or city)
- Travel month
- Cabin preference (Economy / Business)

### System Steps
1. Convert EDGE points → airline miles (based on card-specific ratios)
2. Query cached award availability (Seats.aero)
3. Filter results by:
   - Cabin availability
   - Miles required ≤ available miles
4. Return **actionable options**, not raw flight noise

### Example Output
- Program: United MileagePlus  
- Route: DEL → BKK  
- Cabin: Economy  
- Miles required: 22,500  
- EDGE points required: 28,125  
- Available across multiple dates in Feb 2026

---

## 🏗️ Architecture (High Level)

Frontend (Vite + React)
↓
Backend (Node.js / Express)
↓
Award Availability Cache (Seats.aero)


### Why cached availability?
- Faster than live airline searches
- Sufficient for feasibility decisions
- Lower cost and latency
- Live “Get Trips” APIs are reserved for post-intent stages

---

## 🚫 What This MVP Intentionally Does NOT Do

- ❌ Flight booking
- ❌ Showing flight numbers / exact schedules
- ❌ Live pricing checks
- ❌ Multi-city or complex routings

These are **deliberate product decisions** to keep the MVP focused on:
> *“Can I book this with my points?”*

---

## 🔮 Planned Extensions

- **Flow B**: Destination → points required
- Business / Premium Economy toggles
- Multi-program comparisons
- Optional itinerary deep-dive (Get Trips)
- AI-generated day-by-day itineraries (post-selection)

---

## 🛠️ Tech Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Data: Seats.aero cached award availability
- Config: dotenv (API keys never committed)

---

## 🔧 Local Dev & API Base

### Quick Start (Local)

```bash
# Terminal 1 - Backend (Express server for local dev)
npm run server

# Terminal 2 - Frontend (Vite dev server)
npm run dev -- --host
```

### Environment Variables

Create a `.env` file in the project root (not committed):

```env
# Required for Seats.aero API calls
SEATS_API_KEY=your_seats_api_key

# Required for OpenAI trip summaries
OPENAI_API_KEY=your_openai_api_key

# Optional: Override API base URL for frontend
# Leave unset to use Vite proxy or same-origin in production
# VITE_API_URL=http://localhost:3001
```

### API Base Resolution Order (Frontend)

The `getApiBase()` helper in `src/app/lib/api.ts` resolves the API URL:
1. `VITE_API_URL` or `VITE_API_BASE` env vars (if set)
2. `http://localhost:3001` in development mode
3. Same-origin (empty string) in production — routes to Vercel serverless functions

### Vite Proxy (Dev)

The `vite.config.ts` proxies `/api` routes to `http://localhost:3001` during development,
so you can use relative `/api/...` paths without CORS issues.

### Vercel Deployment

For Vercel, set these environment variables in the Vercel dashboard
(Settings → Environment Variables → apply to Production, Preview, Development):

| Variable | Description |
|----------|-------------|
| `SEATS_API_KEY` | Seats.aero Partner API key |
| `OPENAI_API_KEY` | OpenAI API key for trip summaries |

**Important**: Do NOT set `VITE_API_URL` in Vercel — leave it unset so the frontend
uses same-origin routing to Vercel's `/api` serverless functions.

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate-itinerary` | POST | Generate itinerary options from EDGE points |
| `/api/ping` | GET | Health check |
| `/api/seats/date-pairs` | GET | Get up to 3 date-pair cards with flight details |
| `/api/seats/trips` | GET | Proxy to Seats.aero Get Trips (debugging) |

### Date Pairs Endpoint Query Params

`GET /api/seats/date-pairs`

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `origin_airport` | Yes | — | IATA code (e.g., "BLR") |
| `destination_airport` | Yes | — | IATA code (e.g., "BKK") |
| `start_date` | Yes | — | YYYY-MM-DD (month start) |
| `end_date` | Yes | — | YYYY-MM-DD (month end) |
| `min_nights` | No | 3 | Minimum trip length |
| `max_nights` | No | 10 | Maximum trip length |
| `cabin_pref` | No | "economy" | Cabin preference ("economy" or "business") |

---

## 🔐 Security & Secrets

- All API keys stored in `.env`
- `.env` excluded via `.gitignore`
- `.env.example` provided for setup guidance

---

## 🎯 Why This Project Matters (PM Perspective)

This project demonstrates:
- Translating user pain → scoped product flow
- API trade-off decisions (cached vs live)
- Cost / latency / UX considerations
- Clear MVP boundaries with extensibility

It is designed as a **PM-led technical prototype**, not a full booking engine.

---

## 📌 Status

✅ Flow A complete and functional  
✅ "See exact dates & stays" modal with date pairs  
🚧 Hotel integration placeholder (stub)  
🔜 Flow B and AI itinerary generation planned

---

## ✅ Testing & Deployment Checklist

### Local Testing

1. **Start backend**: `npm run server` → should show "Server running on http://localhost:3001"
2. **Start frontend**: `npm run dev -- --host` → open the displayed URL
3. **Ping test**: Click "Ping API" button → should show "pong"
4. **Generate itinerary**:
   - Select Axis card, enter points (e.g., 100000)
   - Choose origin, destination (e.g., "Bangkok"), travel month
   - Click "Find Available Trips"
   - Verify results appear
5. **Date pairs modal**:
   - On any result card, click "See exact dates & stays"
   - Modal should open with loading skeleton
   - After loading, should show 0-3 date pair cards with flight details
   - Hotels section should show 3 placeholder tiles

### Vercel Preview Testing

1. Push branch to GitHub
2. Vercel auto-deploys preview
3. Open preview URL
4. Repeat steps 3-5 from local testing
5. Check Network tab: `/api/seats/date-pairs` should return 200
6. Verify no `localhost` calls in Network tab

### Production Deployment

1. Merge to `main` branch
2. Vercel auto-deploys to production
3. Verify all features work on production URL
4. Monitor Vercel logs for any 500 errors

### One Real Seats Request Test

```bash
# Test date-pairs endpoint directly
curl "https://your-app.vercel.app/api/seats/date-pairs?\
origin_airport=BLR&\
destination_airport=BKK&\
start_date=2026-02-01&\
end_date=2026-02-28&\
min_nights=3&\
max_nights=10&\
cabin_pref=economy"
```

Expected: JSON with `cards` array containing 0-3 date pair objects.
