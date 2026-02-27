# GST Reconciliation Engine 🧾
### Knowledge Graph · ITC Intelligence · v2.4

A full-stack GST compliance and audit intelligence dashboard powered by **React**, **FastAPI**, **Neo4j**, and **Gemini AI**.

---

## 🚀 Features

- **Knowledge Graph Traversal** — Multi-hop audit paths via Neo4j: `(Supplier)-[:ISSUED]->(Invoice)-[:RECEIVED_BY]->(Buyer)`
- **Real State Filing Data** — 3,000+ records across 38 Indian states/UTs (2017–2024) from actual GST filing dataset
- **5-Level Risk Classification** — VERIFIED / SECURE / WATCHLIST / HIGH RISK / CRITICAL
- **AI Assistant** — Gemini-powered chatbot with live dashboard context
- **ITC Analysis** — Input Tax Credit mismatch detection across GSTR-1, GSTR-2B, GSTR-3B
- **Audit Trail** — Root cause explanations for flagged invoices
- **Live REST API** — FastAPI backend with full Swagger docs

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Python FastAPI |
| Graph Database | Neo4j (local) |
| AI Assistant | Google Gemini API |
| Graph Protocol | Bolt (neo4j://) |
| Styling | Inline CSS (dark theme) |

---

## 📁 Project Structure

```
gst-reconciliation-engine/
│
├── frontend/
│   └── src/
│       └── App.jsx                  ← Main React dashboard
│
├── backend/
│   ├── main.py                      ← FastAPI server + Neo4j + Gemini proxy
│   ├── seed.py                      ← Seeds invoice data into Neo4j
│   ├── seed_states.py               ← Seeds 3000+ state filing records
│   ├── requirements.txt             ← Python dependencies
│   └── data_set_for_hackathon.csv   ← Real GST filing dataset
│
└── README.md
```

---

## ⚙️ Local Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- Neo4j Desktop — https://neo4j.com/download/

---

### Step 1 — Neo4j

1. Open **Neo4j Desktop** → New Project → Add Local DBMS
2. Name it `GST Reconciliation Engine`, set a password (e.g. `password`)
3. Click **Start** → wait for green **Active** status

---

### Step 2 — Backend

```bash
cd backend
python -m venv venv

# Activate:
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

Update your Neo4j password in `main.py` line 14:
```python
NEO4J_PASSWORD = "your_password_here"
```

Seed the database:
```bash
python seed.py
python seed_states.py
```

Set your Gemini API key and start the server:
```bash
# Windows PowerShell:
$env:GEMINI_API_KEY="your-gemini-key-here"

# Mac/Linux:
export GEMINI_API_KEY="your-gemini-key-here"

uvicorn main:app --reload --port 8000
```

Get your Gemini API key at → https://aistudio.google.com/app/apikey

---

### Step 3 — Frontend

```bash
cd frontend
npm install
npm run dev
```

Open → **http://localhost:5173**

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/registry` | All invoices in Neo4j |
| GET | `/api/search?q=...` | Full-text invoice search |
| POST | `/api/run-audit` | Multi-hop graph traversal |
| POST | `/api/add-invoice` | Add invoice to graph |
| GET | `/api/states` | All 38 states with filing stats |
| GET | `/api/states/{code}/filings` | Monthly history for a state |
| GET | `/api/stats/national` | National aggregate stats |
| GET | `/api/stats/low-compliance` | States below threshold |
| POST | `/api/chat` | Gemini AI chat proxy |

Swagger UI → **http://localhost:8000/docs**

---

## 🧪 Test Invoices (Run Traversal tab)

| Invoice | Risk Level | Score |
|---|---|---|
| `INV/24-25/0002` | ✦ VERIFIED | 95% |
| `INV/24-25/0001` | ● SECURE | 80% |
| `INV/24-25/0003` | ◐ WATCHLIST | 65% |
| `INV/24-25/0004` | ▲ HIGH RISK | 45% |
| `INV/24-25/0005` | ⚑ CRITICAL | 18% |

---

## 📊 Dataset

`data_set_for_hackathon.csv` — State-wise GSTR-3B filing statistics
- **Rows:** 3,107
- **Period:** July 2017 – April 2024
- **States/UTs:** 38
- **Fields:** eligible taxpayers, filed by due date, filed after due date, total filed, filling percentage

---

## 🤖 AI Assistant

The built-in GST Assistant is powered by **Gemini 2.0 Flash Lite** and has full context of:
- Live invoice registry from Neo4j
- National filing statistics
- All 38 state compliance levels
- GST domain knowledge (ITC, IRN, GSTR-1/2B/3B, e-Way Bill, circular trading)

---

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `NEO4J_URI` | Neo4j connection URI (default: `bolt://localhost:7687`) |
| `NEO4J_USER` | Neo4j username (default: `neo4j`) |
| `NEO4J_PASSWORD` | Neo4j password |
| `GEMINI_API_KEY` | Google Gemini API key |

---

## 📄 License

MIT License — free to use, modify, and distribute.
