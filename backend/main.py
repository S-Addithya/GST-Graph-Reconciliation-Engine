"""
GST Reconciliation Engine — FastAPI + Neo4j Backend
----------------------------------------------------
Runs locally on http://localhost:8000
Neo4j expected at bolt://localhost:7687
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from neo4j import GraphDatabase
import os

# ─── CONFIG ──────────────────────────────────────────────────────────────────
NEO4J_URI      = os.getenv("NEO4J_URI",      "bolt://localhost:7687")
NEO4J_USER     = os.getenv("NEO4J_USER",     "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")   # change to your password

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

app = FastAPI(title="GST Reconciliation Engine", version="2.4")

# ── CORS — allow all origins so React (port 5173) can call this (port 8000) ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── MODELS ──────────────────────────────────────────────────────────────────
class InvoicePayload(BaseModel):
    invoice_number: str
    irn: Optional[str] = None
    supplier_gstin: str
    supplier_name: str
    buyer_gstin: str
    amount: float
    date: str
    riskScore: Optional[int] = 50

# ─── HELPERS ─────────────────────────────────────────────────────────────────
def build_traversal_result(risk_score: int, inv: dict) -> dict:
    supplier_gstin = inv.get("supplier_gstin", "")
    if risk_score >= 90:
        level = "VERIFIED"
        stages = [
            {"key": "supplier_verification", "label": "Supplier Verification", "status": "PASS",    "detail": f"Invoice issued by GSTIN {supplier_gstin}", "tooltip": "Supplier is active and GST-registered"},
            {"key": "einvoice_check",        "label": "E-Invoice Check",       "status": "PASS",    "detail": f"Registered with IRN: {inv.get('irn','N/A')}", "tooltip": "IRN validated against IRP portal"},
            {"key": "logistics_check",       "label": "Logistics Check",       "status": "PASS",    "detail": "e-Way Bill verified. Physical movement confirmed.", "tooltip": "EWB matches invoice value and route"},
            {"key": "portal_visibility",     "label": "Portal Visibility",     "status": "PASS",    "detail": "Visible in Recipient's GSTR-2B", "tooltip": "Auto-populated from supplier's GSTR-1"},
        ]
    elif risk_score >= 75:
        level = "SECURE"
        stages = [
            {"key": "supplier_verification", "label": "Supplier Verification", "status": "PASS",    "detail": f"Invoice issued by GSTIN {supplier_gstin}", "tooltip": "Supplier active, compliance score 91%"},
            {"key": "einvoice_check",        "label": "E-Invoice Check",       "status": "PASS",    "detail": f"Registered with IRN: {inv.get('irn','N/A')}", "tooltip": "IRN validated successfully"},
            {"key": "logistics_check",       "label": "Logistics Check",       "status": "WARNING", "detail": "No e-Way Bill linked. Physical movement unverified.", "tooltip": "EWB missing — acceptable for exempt goods under 50K"},
            {"key": "portal_visibility",     "label": "Portal Visibility",     "status": "PASS",    "detail": "Visible in Recipient's GSTR-2B", "tooltip": "Reflected in auto-populated GSTR-2B"},
        ]
    elif risk_score >= 60:
        level = "WATCHLIST"
        stages = [
            {"key": "supplier_verification", "label": "Supplier Verification", "status": "PASS",    "detail": f"Invoice issued by GSTIN {supplier_gstin}", "tooltip": "Supplier active but filing rate is 67%"},
            {"key": "einvoice_check",        "label": "E-Invoice Check",       "status": "PASS",    "detail": f"Registered with IRN: {inv.get('irn') or 'PENDING'}", "tooltip": "IRN present but e-Invoice portal confirmation delayed"},
            {"key": "logistics_check",       "label": "Logistics Check",       "status": "WARNING", "detail": "e-Way Bill present but route deviation detected.", "tooltip": "EWB route mismatch - manual verification recommended"},
            {"key": "portal_visibility",     "label": "Portal Visibility",     "status": "FAIL",    "detail": "Not yet reflected in GSTR-2B. Period mismatch suspected.", "tooltip": "GSTR-2B sync may be delayed by 1 filing period"},
        ]
    elif risk_score >= 40:
        level = "HIGH_RISK"
        stages = [
            {"key": "supplier_verification", "label": "Supplier Verification", "status": "WARNING", "detail": f"GSTIN {supplier_gstin} has prior ITC mismatches.", "tooltip": "Supplier compliance score dropped below 55%"},
            {"key": "einvoice_check",        "label": "E-Invoice Check",       "status": "FAIL",    "detail": "No IRN found in e-Invoice registry.", "tooltip": "Invoice above 5Cr threshold must have IRN"},
            {"key": "logistics_check",       "label": "Logistics Check",       "status": "FAIL",    "detail": "e-Way Bill expired before delivery.", "tooltip": "EWB validity lapsed before delivery date"},
            {"key": "portal_visibility",     "label": "Portal Visibility",     "status": "FAIL",    "detail": "Not declared in supplier's GSTR-1 for the period.", "tooltip": "ITC claim has no corresponding supply declaration"},
        ]
    else:
        level = "CRITICAL"
        stages = [
            {"key": "supplier_verification", "label": "Supplier Verification", "status": "FAIL",    "detail": f"GSTIN {supplier_gstin} is suspended.", "tooltip": "Taxpayer cancelled - all ITC claims invalid"},
            {"key": "einvoice_check",        "label": "E-Invoice Check",       "status": "FAIL",    "detail": "IRN not found. Forged invoice suspected.", "tooltip": "IRP has no record of this invoice number"},
            {"key": "logistics_check",       "label": "Logistics Check",       "status": "FAIL",    "detail": "No e-Way Bill. Circular trading pattern detected.", "tooltip": "Graph traversal found invoice in circular supply chain"},
            {"key": "portal_visibility",     "label": "Portal Visibility",     "status": "FAIL",    "detail": "Supplier has not filed GSTR-1 for 3 consecutive periods.", "tooltip": "Immediate department referral recommended"},
        ]
    return {"level": level, "stages": stages}


def record_to_dict(record) -> dict:
    node = record["i"]
    return {
        "invoice_number": node.get("invoice_number"),
        "irn":            node.get("irn"),
        "supplier_gstin": node.get("supplier_gstin"),
        "supplier_name":  node.get("supplier_name"),
        "buyer_gstin":    node.get("buyer_gstin"),
        "amount":         node.get("amount"),
        "tax":            node.get("tax"),
        "date":           node.get("date"),
        "riskScore":      node.get("riskScore"),
    }

# ─── INVOICE ROUTES ───────────────────────────────────────────────────────────

@app.get("/")
def health():
    return {"status": "ok", "service": "GST Reconciliation Engine v2.4"}


@app.get("/api/registry")
def get_registry():
    with driver.session() as session:
        result  = session.run("MATCH (i:Invoice) RETURN i ORDER BY i.invoice_number")
        records = [record_to_dict(r) for r in result]
    return {"count": len(records), "invoices": records}


@app.get("/api/search")
def search_invoices(q: str = Query(..., min_length=1)):
    cypher = """
    MATCH (i:Invoice)
    WHERE toLower(i.invoice_number) CONTAINS toLower($q)
       OR toLower(i.supplier_gstin) CONTAINS toLower($q)
       OR toLower(i.supplier_name)  CONTAINS toLower($q)
       OR (i.irn IS NOT NULL AND toLower(i.irn) CONTAINS toLower($q))
    RETURN i LIMIT 6
    """
    with driver.session() as session:
        result  = session.run(cypher, q=q)
        records = [record_to_dict(r) for r in result]
    return {"results": records}


@app.post("/api/run-audit")
def run_audit(body: dict):
    invoice_number = body.get("invoice_number", "").strip()
    if not invoice_number:
        raise HTTPException(status_code=400, detail="invoice_number is required.")
    cypher = """
    MATCH (s:Supplier)-[:ISSUED]->(i:Invoice {invoice_number: $inv})-[:RECEIVED_BY]->(b:Buyer)
    RETURN i, s, b
    """
    with driver.session() as session:
        result = session.run(cypher, inv=invoice_number)
        record = result.single()
    if not record:
        with driver.session() as session:
            result = session.run("MATCH (i:Invoice {invoice_number: $inv}) RETURN i", inv=invoice_number)
            record = result.single()
        if not record:
            raise HTTPException(status_code=404, detail=f'Invoice "{invoice_number}" not found in registry.')
    inv       = record_to_dict(record)
    traversal = build_traversal_result(inv["riskScore"] or 50, inv)
    return {
        "invoice":    inv,
        "traversal":  traversal,
        "graph_path": [
            f"Supplier ({inv['supplier_gstin']})",
            f"-> Invoice {inv['invoice_number']}",
            f"-> Buyer ({inv['buyer_gstin']})",
        ],
    }


@app.post("/api/add-invoice")
def add_invoice(payload: InvoicePayload):
    tax = round(payload.amount * 0.18)
    with driver.session() as session:
        dup = session.run("MATCH (i:Invoice {invoice_number: $inv}) RETURN i", inv=payload.invoice_number).single()
        if dup:
            raise HTTPException(status_code=409, detail=f'Invoice "{payload.invoice_number}" already exists.')
    cypher = """
    MERGE (s:Supplier {gstin: $supplier_gstin})
      ON CREATE SET s.name = $supplier_name
    MERGE (b:Buyer {gstin: $buyer_gstin})
    CREATE (i:Invoice {
        invoice_number: $invoice_number, irn: $irn,
        supplier_gstin: $supplier_gstin, supplier_name: $supplier_name,
        buyer_gstin: $buyer_gstin, amount: $amount, tax: $tax,
        date: $date, riskScore: $riskScore
    })
    CREATE (s)-[:ISSUED]->(i)
    CREATE (i)-[:RECEIVED_BY]->(b)
    RETURN i
    """
    with driver.session() as session:
        result = session.run(cypher,
            invoice_number=payload.invoice_number, irn=payload.irn,
            supplier_gstin=payload.supplier_gstin, supplier_name=payload.supplier_name,
            buyer_gstin=payload.buyer_gstin, amount=payload.amount, tax=tax,
            date=payload.date, riskScore=payload.riskScore,
        )
        record = result.single()
    node = record["i"]
    return {
        "message": "Invoice inserted into graph.",
        "record": {
            "invoice_number": node["invoice_number"], "irn": node.get("irn"),
            "supplier_gstin": node["supplier_gstin"], "supplier_name": node["supplier_name"],
            "buyer_gstin":    node["buyer_gstin"],    "amount": node["amount"],
            "tax":            node["tax"],            "date":   node["date"],
            "riskScore":      node["riskScore"],
        }
    }


@app.delete("/api/invoice/{invoice_number}")
def delete_invoice(invoice_number: str):
    with driver.session() as session:
        result = session.run(
            "MATCH (i:Invoice {invoice_number: $inv}) DETACH DELETE i RETURN count(i) as deleted",
            inv=invoice_number
        )
        count = result.single()["deleted"]
    if count == 0:
        raise HTTPException(status_code=404, detail=f'Invoice "{invoice_number}" not found.')
    return {"message": f'Invoice "{invoice_number}" deleted.'}


# ─── STATE FILING ROUTES ──────────────────────────────────────────────────────

@app.get("/api/states")
def get_states():
    cypher = """
    MATCH (s:State)-[:HAS_FILING]->(f:FilingRecord)
    WITH s, f ORDER BY f.date DESC
    WITH s, collect(f)[0] AS latest
    RETURN s.name AS name, s.code AS code,
           latest.fill_pct      AS fill_pct,
           latest.eligible      AS eligible,
           latest.total_filed   AS total_filed,
           latest.filed_on_time AS filed_on_time,
           latest.date          AS latest_date
    ORDER BY s.name
    """
    with driver.session() as session:
        result  = session.run(cypher)
        records = [dict(r) for r in result]
    return {"count": len(records), "states": records}


@app.get("/api/states/{state_code}/filings")
def get_state_filings(state_code: str, limit: int = 24):
    cypher = """
    MATCH (s:State {code: $code})-[:HAS_FILING]->(f:FilingRecord)
    RETURN f.date AS date, f.year AS year, f.month AS month,
           f.eligible AS eligible, f.total_filed AS total_filed,
           f.filed_on_time AS filed_on_time, f.filed_late AS filed_late,
           f.fill_pct AS fill_pct
    ORDER BY f.date DESC LIMIT $limit
    """
    with driver.session() as session:
        result  = session.run(cypher, code=state_code.zfill(2), limit=limit)
        records = [dict(r) for r in result]
    if not records:
        raise HTTPException(status_code=404, detail=f"State '{state_code}' not found.")
    return {"state_code": state_code, "filings": records}


@app.get("/api/stats/national")
def get_national_stats():
    cypher = """
    MATCH (s:State)-[:HAS_FILING]->(f:FilingRecord)
    WITH max(f.date) AS latest_date
    MATCH (s:State)-[:HAS_FILING]->(f:FilingRecord {date: latest_date})
    WHERE f.eligible IS NOT NULL
    RETURN
        latest_date          AS period,
        count(s)             AS state_count,
        sum(f.eligible)      AS total_eligible,
        sum(f.total_filed)   AS total_filed,
        sum(f.filed_on_time) AS total_on_time,
        avg(f.fill_pct)      AS avg_fill_pct,
        min(f.fill_pct)      AS min_fill_pct,
        max(f.fill_pct)      AS max_fill_pct
    """
    with driver.session() as session:
        result = session.run(cypher)
        record = result.single()
    return dict(record)


@app.get("/api/stats/low-compliance")
def get_low_compliance_states(threshold: float = 0.90):
    cypher = """
    MATCH (s:State)-[:HAS_FILING]->(f:FilingRecord)
    WITH s, max(f.date) AS latest
    MATCH (s)-[:HAS_FILING]->(f:FilingRecord {date: latest})
    WHERE f.fill_pct IS NOT NULL AND f.fill_pct < $threshold
    RETURN s.name AS state, s.code AS code,
           f.fill_pct AS fill_pct, f.eligible AS eligible,
           f.total_filed AS total_filed, f.date AS date
    ORDER BY f.fill_pct ASC
    """
    with driver.session() as session:
        result  = session.run(cypher, threshold=threshold)
        records = [dict(r) for r in result]
    return {"threshold": threshold, "count": len(records), "states": records}


# ─── AI CHAT PROXY (Gemini) ──────────────────────────────────────────────────
# Proxies chat to Google Gemini API so the browser isn't blocked by CORS.
# Set your Gemini API key as an environment variable:
#   Windows:   $env:GEMINI_API_KEY="your-key-here"
#   Mac/Linux: export GEMINI_API_KEY="your-key-here"
# Get your key at: https://aistudio.google.com/app/apikey

import httpx

class ChatRequest(BaseModel):
    messages: list
    system: str

@app.post("/api/chat")
async def chat_proxy(body: ChatRequest):
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="GEMINI_API_KEY not set. Run: $env:GEMINI_API_KEY='your-key-here' in your terminal, then restart uvicorn."
        )

    # Convert messages from {role, content} to Gemini format {role, parts}
    # Gemini uses "model" instead of "assistant" for role
    gemini_contents = []
    for m in body.messages:
        role = "model" if m["role"] == "assistant" else "user"
        gemini_contents.append({
            "role": role,
            "parts": [{"text": m["content"]}]
        })

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            url,
            headers={"content-type": "application/json"},
            json={
                "system_instruction": {"parts": [{"text": body.system}]},
                "contents": gemini_contents,
                "generationConfig": {"maxOutputTokens": 1000, "temperature": 0.7},
            },
        )

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    data = response.json()
    reply = data["candidates"][0]["content"]["parts"][0]["text"]
    return {"reply": reply}