# PoyoX Financials

**PoyoX Financials** is a web-based, AI-assisted startup valuation predictor. It helps founders, investors, and analysts estimate what an early-stage company might be worth using traction, financials, team strength, and market context—without building complex spreadsheets or financial models.

> *"PoyoX Financials helps founders understand what their startup is worth—instantly, intelligently, and without complexity."*

---

## What it does

Users enter startup details (industry, country, revenue, growth, team, market size, competition, and more). The app runs a **hybrid valuation model**:

- **Rule-based scoring** with industry revenue multiples (e.g. SaaS 5×–12×, Marketplace 3×–8×)
- **Adjustment factors** for growth, team, market, margins, and burn
- **AI-style insights** with weaknesses and actionable recommendations

The **results dashboard** shows:

- Estimated valuation **range** and **median**
- **Confidence score** (%)
- Breakdown: revenue, growth, market, and team impact
- Weakness indicators and suggestions to improve valuation

Additional features include **scenario growth tweaking**, **save reports**, **export to PDF** (print), **share links**, and a **searchable country dropdown**.

---

## Who it’s for

- Startup founders (pre-seed → Series B)
- Angel investors and VCs
- Business analysts
- Incubators and accelerators

---

## Access the app (local)

**URL:** [http://localhost:3000](http://localhost:3000)

### Start the server

From the project folder:

```bash
cd /Users/poyo/poyox-financials
node server.js
```

Then open **http://localhost:3000** in your browser.

> **Note:** This link only works on your machine while the server is running. There is no public hosting URL unless you deploy the app (e.g. Render, Railway, Fly.io).

---

## Tech stack

| Layer | Details |
|--------|---------|
| **Frontend** | HTML, CSS, vanilla JavaScript (responsive, fintech-style UI) |
| **Backend** | Node.js HTTP server (`server.js`) |
| **API** | `POST /api/valuate`, `POST /api/auth`, `GET/POST /api/reports` |
| **Storage** | `db.json` (users, reports, inputs) + browser `localStorage` fallback |

---

## Pages

1. **Landing** — product overview and CTA  
2. **Valuation form** — full PRD input fields  
3. **Results** — valuation, breakdown, insights, disclaimer  
4. **Dashboard** — saved reports  
5. **Auth** — email/password (Google sign-in placeholder)

---

## Disclaimer

This valuation is an **estimate** based on user-provided data and should **not** be considered financial or investment advice.

---

## Project location

`/Users/poyo/poyox-financials`
