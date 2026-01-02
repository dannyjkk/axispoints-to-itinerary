
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
🚧 Frontend wiring in progress  
🔜 Flow B and AI itinerary generation planned
