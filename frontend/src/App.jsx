import { useState, useEffect, useRef, useCallback } from "react";

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const VENDORS = [
  { gstin: "29ABCDE1234F1Z5", name: "TechSupply Pvt Ltd", state: "Karnataka", sector: "Electronics", riskScore: 78, filingRate: 42, itcMismatch: 3, lastFiled: "2024-02-15", txnValue: 1250000, status: "HIGH_RISK" },
  { gstin: "27XYZAB5678G2H6", name: "Maharashtra Traders", state: "Maharashtra", sector: "Textiles", riskScore: 34, filingRate: 91, itcMismatch: 0, lastFiled: "2024-03-10", txnValue: 890000, status: "LOW_RISK" },
  { gstin: "09PQRST9012I3J7", name: "UP Logistics Corp", state: "Uttar Pradesh", sector: "Logistics", riskScore: 61, filingRate: 67, itcMismatch: 2, lastFiled: "2024-02-28", txnValue: 3450000, status: "MODERATE" },
  { gstin: "33LMNOP3456K4L8", name: "Tamil Nadu Steel Works", state: "Tamil Nadu", sector: "Manufacturing", riskScore: 22, filingRate: 98, itcMismatch: 0, lastFiled: "2024-03-11", txnValue: 5670000, status: "LOW_RISK" },
  { gstin: "06UVWXY7890M5N9", name: "Haryana Agro Exports", state: "Haryana", sector: "Agriculture", riskScore: 89, filingRate: 28, itcMismatch: 7, lastFiled: "2024-01-20", txnValue: 2100000, status: "FRAUD_SUSPICION" },
  { gstin: "19GHIJK2345O6P0", name: "West Bengal Chemicals", state: "West Bengal", sector: "Chemicals", riskScore: 55, filingRate: 74, itcMismatch: 1, lastFiled: "2024-03-05", txnValue: 1780000, status: "MODERATE" },
  { gstin: "07DEFGH6789Q7R1", name: "Delhi Pharma House", state: "Delhi", sector: "Pharma", riskScore: 18, filingRate: 99, itcMismatch: 0, lastFiled: "2024-03-12", txnValue: 8900000, status: "LOW_RISK" },
  { gstin: "24IJKLM1234S8T2", name: "Gujarat Petrochemicals", state: "Gujarat", sector: "Petroleum", riskScore: 71, filingRate: 53, itcMismatch: 4, lastFiled: "2024-02-10", txnValue: 12500000, status: "HIGH_RISK" },
];

const INVOICES = [
  { irn: "INV-89234", vendor: "29ABCDE1234F1Z5", buyer: "27XYZAB5678G2H6", amount: 1250000, tax: 225000, date: "2024-03-01", gstr1: false, gstr2b: true, irnValid: false, status: "MISMATCH", risk: "HIGH" },
  { irn: "INV-45612", vendor: "27XYZAB5678G2H6", buyer: "09PQRST9012I3J7", amount: 890000, tax: 160200, date: "2024-03-05", gstr1: true, gstr2b: true, irnValid: true, status: "MATCHED", risk: "LOW" },
  { irn: "INV-78923", vendor: "06UVWXY7890M5N9", buyer: "33LMNOP3456K4L8", amount: 450000, tax: 81000, date: "2024-02-20", gstr1: false, gstr2b: false, irnValid: false, status: "MISSING", risk: "FRAUD" },
  { irn: "INV-34521", vendor: "09PQRST9012I3J7", buyer: "29ABCDE1234F1Z5", amount: 2340000, tax: 421200, date: "2024-03-08", gstr1: true, gstr2b: false, irnValid: true, status: "PARTIAL", risk: "MODERATE" },
  { irn: "INV-67890", vendor: "19GHIJK2345O6P0", buyer: "07DEFGH6789Q7R1", amount: 780000, tax: 140400, date: "2024-03-10", gstr1: true, gstr2b: true, irnValid: true, status: "MATCHED", risk: "LOW" },
  { irn: "INV-11234", vendor: "24IJKLM1234S8T2", buyer: "06UVWXY7890M5N9", amount: 5600000, tax: 1008000, date: "2024-02-15", gstr1: true, gstr2b: false, irnValid: false, status: "MISMATCH", risk: "HIGH" },
];

const AUDIT_TRAILS = [
  {
    id: "AUD-001",
    invoiceIrn: "INV-89234",
    vendorGstin: "29ABCDE1234F1Z5",
    vendorName: "TechSupply Pvt Ltd",
    itcClaimed: 225000,
    month: "March 2024",
    path: ["Buyer (27XYZAB)", "→ Invoice INV-89234", "→ Vendor (29ABCDE)", "→ GSTR-1 ✗ NOT FOUND", "→ IRN ✗ INVALID", "→ e-Invoice ✗ MISSING"],
    rootCause: "Vendor did not declare invoice in GSTR-1. No IRN found in e-Invoice portal.",
    complianceScore: 42,
    risk: "HIGH",
    exposure: 225000,
    explanation: "Invoice INV-89234 issued by Vendor GSTIN 29ABCDE1234F1Z5 was claimed for ITC in March 2024. However, the vendor did not declare this invoice in GSTR-1, and no corresponding IRN was found in the e-Invoice registry. Vendor compliance score: 42%. Risk classification: High Exposure. Immediate scrutiny recommended.",
  },
  {
    id: "AUD-002",
    invoiceIrn: "INV-78923",
    vendorGstin: "06UVWXY7890M5N9",
    vendorName: "Haryana Agro Exports",
    itcClaimed: 81000,
    month: "February 2024",
    path: ["Buyer (33LMNOP)", "→ Invoice INV-78923", "→ Vendor (06UVWXY)", "→ GSTR-1 ✗ NOT FILED", "→ GSTR-3B ✗ TAX UNPAID", "→ Circular Trading Pattern Detected"],
    rootCause: "Vendor has not filed GSTR-1 for the period. Tax payment not confirmed. Circular trading pattern detected in supply chain.",
    complianceScore: 28,
    risk: "FRAUD",
    exposure: 81000,
    explanation: "Invoice INV-78923 shows signs of fraudulent circular trading. Vendor 06UVWXY7890M5N9 has not filed GSTR-1 or paid corresponding taxes for February 2024. Graph traversal detected a 3-hop circular pattern involving 4 related GSTINs. Risk Score: 89%. Fraud Suspicion flagged for department action.",
  },
  {
    id: "AUD-003",
    invoiceIrn: "INV-34521",
    vendorGstin: "09PQRST9012I3J7",
    vendorName: "UP Logistics Corp",
    itcClaimed: 421200,
    month: "March 2024",
    path: ["Buyer (29ABCDE)", "→ Invoice INV-34521", "→ Vendor (09PQRST)", "→ GSTR-1 ✓", "→ IRN ✓ VALID", "→ GSTR-2B ✗ NOT REFLECTED"],
    rootCause: "Invoice declared in GSTR-1 with valid IRN but not reflected in buyer's GSTR-2B. Timing mismatch suspected.",
    complianceScore: 67,
    risk: "MODERATE",
    exposure: 421200,
    explanation: "Invoice INV-34521 from UP Logistics Corp was declared in their GSTR-1 filing with a valid IRN. However, the corresponding entry is missing from buyer's auto-populated GSTR-2B. This may indicate a period mismatch or portal sync delay. Monitoring recommended for next filing period.",
  },
];

// ─── EXTENSION: AUDIT TRAVERSAL MOCK DATA ────────────────────────────────────
// Seeded test records demonstrating all 5 risk levels.
// In production these come from POST /api/run-audit → traversal engine.
const AUDIT_INVOICE_REGISTRY = [
  {
    invoice_number: "INV/24-25/0001",
    irn: "A9E84BECCE3C4B828B9ABE9ECD4FDE5C",
    supplier_gstin: "27AAAAA1006A1Z1",
    supplier_name: "Reliable Auto Parts Ltd",
    buyer_gstin: "29ABCDE1234F1Z5",
    amount: 1450000,
    tax: 261000,
    date: "2024-03-01",
    riskScore: 80,
  },
  {
    invoice_number: "INV/24-25/0002",
    irn: "B1C2D3E4F5A6B7C8D9E0F1A2B3C4D5E6",
    supplier_gstin: "33LMNOP3456K4L8",
    supplier_name: "Tamil Nadu Steel Works",
    buyer_gstin: "07DEFGH6789Q7R1",
    amount: 3200000,
    tax: 576000,
    date: "2024-03-03",
    riskScore: 95,
  },
  {
    invoice_number: "INV/24-25/0003",
    irn: "C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8",
    supplier_gstin: "09PQRST9012I3J7",
    supplier_name: "UP Logistics Corp",
    buyer_gstin: "19GHIJK2345O6P0",
    amount: 980000,
    tax: 176400,
    date: "2024-02-28",
    riskScore: 65,
  },
  {
    invoice_number: "INV/24-25/0004",
    irn: null,
    supplier_gstin: "24IJKLM1234S8T2",
    supplier_name: "Gujarat Petrochemicals",
    buyer_gstin: "06UVWXY7890M5N9",
    amount: 7800000,
    tax: 1404000,
    date: "2024-02-10",
    riskScore: 45,
  },
  {
    invoice_number: "INV/24-25/0005",
    irn: null,
    supplier_gstin: "06UVWXY7890M5N9",
    supplier_name: "Haryana Agro Exports",
    buyer_gstin: "29ABCDE1234F1Z5",
    amount: 2100000,
    tax: 378000,
    date: "2024-01-20",
    riskScore: 18,
  },
  {
    invoice_number: "INV-89234",
    irn: null,
    supplier_gstin: "29ABCDE1234F1Z5",
    supplier_name: "TechSupply Pvt Ltd",
    buyer_gstin: "27XYZAB5678G2H6",
    amount: 1250000,
    tax: 225000,
    date: "2024-03-01",
    riskScore: 28,
  },
  {
    invoice_number: "INV-45612",
    irn: "E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0",
    supplier_gstin: "27XYZAB5678G2H6",
    supplier_name: "Maharashtra Traders",
    buyer_gstin: "09PQRST9012I3J7",
    amount: 890000,
    tax: 160200,
    date: "2024-03-05",
    riskScore: 76,
  },
];

// Traversal stage definitions per risk level.
// Each scenario maps to VERIFIED / SECURE / WATCHLIST / HIGH_RISK / CRITICAL
const buildTraversalResult = (inv) => {
  const s = inv.riskScore;
  if (s >= 90) return {
    level: "VERIFIED",
    stages: [
      { key: "supplier_verification", label: "Supplier Verification", status: "PASS", detail: `Invoice issued by GSTIN ${inv.supplier_gstin}`, tooltip: "Supplier is active and GST-registered" },
      { key: "einvoice_check", label: "E-Invoice Check", status: "PASS", detail: `Registered with IRN: ${inv.irn}`, tooltip: "IRN validated against IRP portal" },
      { key: "logistics_check", label: "Logistics Check", status: "PASS", detail: "e-Way Bill verified. Physical movement confirmed.", tooltip: "EWB matches invoice value and route" },
      { key: "portal_visibility", label: "Portal Visibility", status: "PASS", detail: "Visible in Recipient's GSTR-2B", tooltip: "Auto-populated from supplier's GSTR-1" },
    ],
  };
  if (s >= 75) return {
    level: "SECURE",
    stages: [
      { key: "supplier_verification", label: "Supplier Verification", status: "PASS", detail: `Invoice issued by GSTIN ${inv.supplier_gstin}`, tooltip: "Supplier active, compliance score 91%" },
      { key: "einvoice_check", label: "E-Invoice Check", status: "PASS", detail: `Registered with IRN: ${inv.irn}`, tooltip: "IRN validated successfully" },
      { key: "logistics_check", label: "Logistics Check", status: "WARNING", detail: "No e-Way Bill linked. Physical movement unverified.", tooltip: "EWB missing — acceptable for exempt goods under ₹50K" },
      { key: "portal_visibility", label: "Portal Visibility", status: "PASS", detail: "Visible in Recipient's GSTR-2B", tooltip: "Reflected in auto-populated GSTR-2B" },
    ],
  };
  if (s >= 60) return {
    level: "WATCHLIST",
    stages: [
      { key: "supplier_verification", label: "Supplier Verification", status: "PASS", detail: `Invoice issued by GSTIN ${inv.supplier_gstin}`, tooltip: "Supplier active but filing rate is 67%" },
      { key: "einvoice_check", label: "E-Invoice Check", status: "PASS", detail: `Registered with IRN: ${inv.irn || "PENDING"}`, tooltip: "IRN present but e-Invoice portal confirmation delayed" },
      { key: "logistics_check", label: "Logistics Check", status: "WARNING", detail: "e-Way Bill present but route deviation detected.", tooltip: "EWB route mismatch — manual verification recommended" },
      { key: "portal_visibility", label: "Portal Visibility", status: "FAIL", detail: "Not yet reflected in GSTR-2B. Period mismatch suspected.", tooltip: "GSTR-2B sync may be delayed by 1 filing period" },
    ],
  };
  if (s >= 40) return {
    level: "HIGH_RISK",
    stages: [
      { key: "supplier_verification", label: "Supplier Verification", status: "WARNING", detail: `GSTIN ${inv.supplier_gstin} has 4 prior ITC mismatches.`, tooltip: "Supplier compliance score dropped below 55%" },
      { key: "einvoice_check", label: "E-Invoice Check", status: "FAIL", detail: "No IRN found in e-Invoice registry.", tooltip: "Invoice above ₹5Cr threshold must have IRN" },
      { key: "logistics_check", label: "Logistics Check", status: "FAIL", detail: "e-Way Bill expired before delivery. Goods status unknown.", tooltip: "EWB validity lapsed 3 days before delivery date" },
      { key: "portal_visibility", label: "Portal Visibility", status: "FAIL", detail: "Not declared in supplier's GSTR-1 for the period.", tooltip: "ITC claim has no corresponding supply declaration" },
    ],
  };
  return {
    level: "CRITICAL",
    stages: [
      { key: "supplier_verification", label: "Supplier Verification", status: "FAIL", detail: `GSTIN ${inv.supplier_gstin} is suspended. Vendor inactive since Jan 2024.`, tooltip: "Taxpayer cancelled — all ITC claims invalid" },
      { key: "einvoice_check", label: "E-Invoice Check", status: "FAIL", detail: "IRN not found. Forged invoice suspected.", tooltip: "IRP has no record of this invoice number" },
      { key: "logistics_check", label: "Logistics Check", status: "FAIL", detail: "No e-Way Bill. Circular trading pattern detected (3-hop).", tooltip: "Graph traversal found invoice in circular supply chain" },
      { key: "portal_visibility", label: "Portal Visibility", status: "FAIL", detail: "Supplier has not filed GSTR-1 for 3 consecutive periods.", tooltip: "Immediate department referral recommended" },
    ],
  };
};

const GRAPH_NODES = [
  { id: "B1", label: "Buyer\n27XYZAB", type: "buyer", x: 100, y: 200 },
  { id: "B2", label: "Buyer\n33LMNOP", type: "buyer", x: 100, y: 400 },
  { id: "V1", label: "TechSupply\n29ABCDE", type: "vendor_high", x: 350, y: 150 },
  { id: "V2", label: "MH Traders\n27XYZAB", type: "vendor_low", x: 350, y: 300 },
  { id: "V3", label: "Haryana Agro\n06UVWXY", type: "vendor_fraud", x: 350, y: 450 },
  { id: "G1", label: "GSTR-1\nMissing", type: "gstr_fail", x: 580, y: 150 },
  { id: "G2", label: "GSTR-1\nFiled", type: "gstr_ok", x: 580, y: 300 },
  { id: "G3", label: "GSTR-1\nNot Filed", type: "gstr_fail", x: 580, y: 450 },
  { id: "I1", label: "IRN\nINVALID", type: "irn_fail", x: 780, y: 150 },
  { id: "I2", label: "IRN\nVALID", type: "irn_ok", x: 780, y: 300 },
  { id: "P1", label: "Tax\nUNPAID", type: "pay_fail", x: 950, y: 450 },
];

const GRAPH_EDGES = [
  { from: "B1", to: "V1", label: "INV-89234 ₹12.5L", color: "#ef4444" },
  { from: "B1", to: "V2", label: "INV-45612 ₹8.9L", color: "#22c55e" },
  { from: "B2", to: "V3", label: "INV-78923 ₹4.5L", color: "#dc2626" },
  { from: "V1", to: "G1", label: "FILED", color: "#ef4444" },
  { from: "V2", to: "G2", label: "FILED", color: "#22c55e" },
  { from: "V3", to: "G3", label: "NOT FILED", color: "#dc2626" },
  { from: "G1", to: "I1", label: "HAS_IRN", color: "#ef4444" },
  { from: "G2", to: "I2", label: "HAS_IRN", color: "#22c55e" },
  { from: "V3", to: "P1", label: "TAX_STATUS", color: "#dc2626" },
];

const MONTHLY_DATA = [
  { month: "Oct", filed: 82, itcClaimed: 8.2, mismatch: 12, score: 71 },
  { month: "Nov", filed: 78, itcClaimed: 9.1, mismatch: 18, score: 65 },
  { month: "Dec", filed: 85, itcClaimed: 10.4, mismatch: 8, score: 79 },
  { month: "Jan", filed: 72, itcClaimed: 7.8, mismatch: 22, score: 61 },
  { month: "Feb", filed: 69, itcClaimed: 8.9, mismatch: 31, score: 54 },
  { month: "Mar", filed: 88, itcClaimed: 11.2, mismatch: 7, score: 83 },
];

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const fmtL = (n) => `₹${(n / 100000).toFixed(1)}L`;
const getRiskColor = (risk) => ({ LOW_RISK: "#22c55e", LOW: "#22c55e", MODERATE: "#f59e0b", MATCHED: "#22c55e", HIGH_RISK: "#ef4444", HIGH: "#ef4444", FRAUD_SUSPICION: "#dc2626", FRAUD: "#dc2626", MISSING: "#dc2626", PARTIAL: "#f59e0b" }[risk] || "#94a3b8");
const getRiskBg = (risk) => ({ LOW_RISK: "#052e16", LOW: "#052e16", MODERATE: "#1c1108", MATCHED: "#052e16", HIGH_RISK: "#1c0a0a", HIGH: "#1c0a0a", FRAUD_SUSPICION: "#150404", FRAUD: "#150404", MISSING: "#150404", PARTIAL: "#1c1108" }[risk] || "#0f172a");

// ─── EXTENSION: RISK LEVEL MAPPER ────────────────────────────────────────────
// mapRiskLevel(score) → { label, color, bgColor, borderColor, barColor }
// Extends existing risk visualization without touching getRiskColor/getRiskBg.
const mapRiskLevel = (score) => {
  if (score >= 90) return { label: "VERIFIED",   color: "#22d3ee", bgColor: "#0c1f24", borderColor: "#22d3ee33", barColor: "#22d3ee", icon: "✦" };
  if (score >= 75) return { label: "SECURE",     color: "#22c55e", bgColor: "#052e16", borderColor: "#22c55e33", barColor: "#22c55e", icon: "●" };
  if (score >= 60) return { label: "WATCHLIST",  color: "#f59e0b", bgColor: "#1c1108", borderColor: "#f59e0b33", barColor: "#f59e0b", icon: "◐" };
  if (score >= 40) return { label: "HIGH RISK",  color: "#ef4444", bgColor: "#1c0a0a", borderColor: "#ef444433", barColor: "#ef4444", icon: "▲" };
  return              { label: "CRITICAL",    color: "#dc2626", bgColor: "#150404", borderColor: "#dc262633", barColor: "#7f1d1d", icon: "⚑" };
};

// ─── API CONFIG ───────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:8000";

// POST /api/run-audit — Neo4j multi-hop traversal
const simulateRunAudit = async (invoice_number) => {
  const res = await fetch(`${API_BASE}/api/run-audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoice_number }),
  });
  const data = await res.json();
  if (!res.ok) throw { code: "NOT_FOUND", message: data.detail || "Traversal failed." };
  return data;
};

// POST /api/add-invoice — inserts node + relationships into Neo4j
const simulateAddInvoice = async (payload, registry, setRegistry) => {
  const res = await fetch(`${API_BASE}/api/add-invoice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw { code: res.status === 409 ? "DUPLICATE" : "ERROR", message: data.detail || "Failed to add invoice." };
  setRegistry((prev) => [data.record, ...prev]);
  return data;
};

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

// ─── FEATURE 1: SearchAuditExtension ─────────────────────────────────────────
// Plugs into existing layout. Uses existing theme styles. No global state changes.
function SearchAuditExtension({ registry }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);   // { invoice, traversal }
  const [error, setError] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);

  // Debounced autocomplete — mirrors GET /api/search?q=...
  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setSelected(null);
    setResult(null);
    setError(null);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setSuggestions([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(() => {
      const q = val.toLowerCase();
      const matches = registry.filter(
        (r) =>
          r.invoice_number.toLowerCase().includes(q) ||
          r.supplier_gstin.toLowerCase().includes(q) ||
          r.irn?.toLowerCase().includes(q) ||
          r.supplier_name.toLowerCase().includes(q)
      ).slice(0, 6);
      setSuggestions(matches);
      setShowDropdown(true);
    }, 280);
  };

  const handleSelect = (rec) => {
    setSelected(rec);
    setQuery(rec.invoice_number);
    setSuggestions([]);
    setShowDropdown(false);
    setResult(null);
    setError(null);
  };

  const handleRunTraversal = async () => {
    if (!selected) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      // Calls POST /api/run-audit (FastAPI + Neo4j).
      // If backend is offline, falls back to local traversal so the UI stays functional.
      let data;
      try {
        data = await simulateRunAudit(selected.invoice_number);
      } catch (apiErr) {
        if (apiErr.code === "NOT_FOUND") throw apiErr;
        data = { invoice: selected, traversal: buildTraversalResult(selected) };
      }
      setResult(data);
    } catch (err) {
      setError(err.message || "Traversal failed.");
    } finally {
      setLoading(false);
    }
  };

  const riskLevel = result ? mapRiskLevel(result.invoice.riskScore) : null;

  const stageIcon = (status) =>
    status === "PASS"    ? { icon: "✓", color: "#22c55e", bg: "#052e16", border: "#22c55e44" } :
    status === "WARNING" ? { icon: "⚠", color: "#f59e0b", bg: "#1c1108", border: "#f59e0b44" } :
                           { icon: "✗", color: "#ef4444", bg: "#1c0a0a", border: "#ef444444" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20, alignItems: "flex-start" }}>
      {/* ── Left Panel: Search + Controls ── */}
      <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#f59e0b", fontSize: 18 }}>⌕</span>
          <span style={{ color: "#f1f5f9", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>Analyze Chain</span>
        </div>

        {/* Search Input */}
        <div style={{ position: "relative" }}>
          <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Select Document</div>
          <input
            value={query}
            onChange={handleQueryChange}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
            placeholder="INV/24-25/0001 or GSTIN..."
            style={{ width: "100%", background: "#060a0f", border: "1px solid #1e3a5f", borderRadius: 8, padding: "12px 14px", color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontSize: 13, outline: "none", boxSizing: "border-box" }}
          />
          {/* Autocomplete dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#0d1117", border: "1px solid #1e3a5f", borderRadius: 8, zIndex: 200, marginTop: 4, overflow: "hidden", boxShadow: "0 8px 32px #000a" }}>
              {suggestions.map((s) => (
                <div key={s.invoice_number} onMouseDown={() => handleSelect(s)}
                  style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #060a0f", transition: "background 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#1e2d3d"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600 }}>{s.invoice_number}</div>
                  <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10, marginTop: 2 }}>{s.supplier_name} · {s.supplier_gstin}</div>
                </div>
              ))}
              {suggestions.length === 0 && (
                <div style={{ padding: "10px 14px", color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>No results found</div>
              )}
            </div>
          )}
        </div>

        {/* Selected record preview */}
        {selected && (
          <div style={{ background: "#060a0f", border: "1px solid #1e3a5f", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ color: "#3b82f6", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.08em", marginBottom: 8 }}>SELECTED RECORD</div>
            {[
              ["Supplier", selected.supplier_name],
              ["GSTIN", selected.supplier_gstin],
              ["Amount", `₹${(selected.amount / 100000).toFixed(1)}L`],
              ["Date", selected.date],
              ["IRN", selected.irn ? selected.irn.slice(0, 16) + "…" : "Not available"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{k}</span>
                <span style={{ color: "#94a3b8", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Run Button */}
        <button onClick={handleRunTraversal} disabled={!selected || loading}
          style={{ background: selected && !loading ? "#d97706" : "#1c1108", border: "none", borderRadius: 8, padding: "14px 20px", color: selected && !loading ? "#000" : "#475569", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", cursor: selected && !loading ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all 0.2s" }}>
          {loading ? (
            <><span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>◌</span> TRAVERSING GRAPH…</>
          ) : (
            <>RUN AUDIT TRAVERSAL ↗</>
          )}
        </button>

        {/* Risk Assessment Panel */}
        {result && riskLevel && (
          <div style={{ background: riskLevel.bgColor, border: `1px solid ${riskLevel.borderColor}`, borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Risk Assessment</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ color: riskLevel.color, fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, letterSpacing: "0.05em" }}>
                {riskLevel.icon} LEVEL: {riskLevel.label}
              </div>
              <div style={{ color: riskLevel.color, fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 800 }}>
                {result.invoice.riskScore}%
              </div>
            </div>
            {/* Risk progress bar */}
            <div style={{ height: 8, background: "#0d1117", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${result.invoice.riskScore}%`, height: "100%", background: riskLevel.barColor, borderRadius: 4, transition: "width 1s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <span style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10 }}>CRITICAL</span>
              <span style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10 }}>VERIFIED</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div style={{ background: "#150404", border: "1px solid #dc262633", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ color: "#ef4444", fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>TRAVERSAL ERROR</div>
            <div style={{ color: "#94a3b8", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{error}</div>
          </div>
        )}
      </div>

      {/* ── Right Panel: Audit Stage Results ── */}
      <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 14, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <span style={{ color: "#22c55e", fontSize: 18 }}>↗</span>
          <span style={{ color: "#f1f5f9", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>Graph Audit Results</span>
          {result && riskLevel && (
            <span style={{ marginLeft: "auto", background: riskLevel.bgColor, color: riskLevel.color, border: `1px solid ${riskLevel.borderColor}`, borderRadius: 6, padding: "3px 12px", fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 700 }}>
              {riskLevel.icon} {riskLevel.label}
            </span>
          )}
        </div>

        {!result && !loading && !error && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 280, gap: 14, opacity: 0.35 }}>
            <div style={{ fontSize: 48 }}>⬡</div>
            <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>Search an invoice and run traversal to see audit stages</div>
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {["Supplier Verification", "E-Invoice Check", "Logistics Check", "Portal Visibility"].map((label, i) => (
              <div key={label} style={{ display: "flex", gap: 16, alignItems: "center", opacity: 0.3 + i * 0.1, animation: `pulse ${1 + i * 0.2}s infinite` }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1e2d3d" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ background: "#1e2d3d", height: 14, borderRadius: 4, width: "40%", marginBottom: 6 }} />
                  <div style={{ background: "#1e2d3d", height: 10, borderRadius: 4, width: "70%" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {/* Invoice meta row */}
            <div style={{ background: "#060a0f", borderRadius: 8, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 24, flexWrap: "wrap" }}>
              {[
                ["Invoice", result.invoice.invoice_number],
                ["Supplier", result.invoice.supplier_name],
                ["Buyer GSTIN", result.invoice.buyer_gstin],
                ["Tax Exposure", `₹${(result.invoice.tax / 100000).toFixed(1)}L`],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10 }}>{k}</div>
                  <div style={{ color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontSize: 12, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Audit Stages */}
            {result.traversal.stages.map((stage, i) => {
              const si = stageIcon(stage.status);
              const isLast = i === result.traversal.stages.length - 1;
              return (
                <div key={stage.key} style={{ display: "flex", gap: 16, position: "relative" }}>
                  {/* Connector line */}
                  {!isLast && (
                    <div style={{ position: "absolute", left: 17, top: 40, width: 2, height: "calc(100% - 8px)", background: "#1e2d3d" }} />
                  )}
                  {/* Status circle */}
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: si.bg, border: `2px solid ${si.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: si.color, fontSize: 15, fontWeight: 700, flexShrink: 0, zIndex: 1 }}>
                    {si.icon}
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, paddingBottom: isLast ? 0 : 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <div style={{ color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, letterSpacing: "0.04em" }}>{stage.label.toUpperCase()}</div>
                      <span style={{ background: si.bg, color: si.color, border: `1px solid ${si.border}`, borderRadius: 4, padding: "1px 8px", fontFamily: "'DM Mono', monospace", fontSize: 10 }}>{stage.status}</span>
                    </div>
                    <div style={{ color: "#94a3b8", fontFamily: "'DM Mono', monospace", fontSize: 12, lineHeight: 1.5, marginBottom: 4 }}>{stage.detail}</div>
                    {/* Tooltip/hint */}
                    <div style={{ color: "#334155", fontFamily: "'DM Mono', monospace", fontSize: 11, fontStyle: "italic" }}>ⓘ {stage.tooltip}</div>
                  </div>
                </div>
              );
            })}

            {/* Traversal path summary */}
            <div style={{ marginTop: 20, background: "#060a0f", border: "1px solid #1e2d3d", borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em", marginBottom: 8 }}>CYPHER TRAVERSAL PATH</div>
              <div style={{ color: "#3b82f6", fontFamily: "'DM Mono', monospace", fontSize: 11, lineHeight: 1.8, overflowX: "auto", whiteSpace: "nowrap" }}>
                (Buyer:{result.invoice.buyer_gstin.slice(0, 6)}) →[RECEIVED]→ (Invoice:{result.invoice.invoice_number}) →[ISSUED_BY]→ (Vendor:{result.invoice.supplier_gstin.slice(0, 6)}) →[FILED]→ (GSTR1) →[HAS_IRN]→ (IRN) →[PAID_TAX]→ (Payment) →[REFLECTED_IN]→ (GSTR3B)
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FEATURE 3: AddInvoiceModal ───────────────────────────────────────────────
// Self-contained modal. Calls simulateAddInvoice (swap for POST /api/add-invoice).
const EMPTY_FORM = { invoice_number: "", supplier_gstin: "", supplier_name: "", buyer_gstin: "", amount: "", date: "", irn: "", eway_bill: "" };

function AddInvoiceModal({ onClose, registry, setRegistry }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await simulateAddInvoice(form, registry, setRegistry);
      setSuccess(res.message);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: "invoice_number", label: "Invoice Number *", placeholder: "INV/24-25/0008", required: true },
    { key: "supplier_gstin", label: "Supplier GSTIN *", placeholder: "27AAAAA1006A1Z1", required: true },
    { key: "supplier_name",  label: "Supplier Name", placeholder: "Vendor Name" },
    { key: "buyer_gstin",    label: "Buyer GSTIN *", placeholder: "29ABCDE1234F1Z5", required: true },
    { key: "amount",         label: "Invoice Amount (₹) *", placeholder: "1500000", required: true },
    { key: "date",           label: "Invoice Date *", placeholder: "YYYY-MM-DD", required: true },
    { key: "irn",            label: "IRN (optional)", placeholder: "64-char hash" },
    { key: "eway_bill",      label: "e-Way Bill No. (optional)", placeholder: "EWB-xxxxxx" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000c", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#0d1117", border: "1px solid #1e3a5f", borderRadius: 16, width: 560, maxHeight: "90vh", overflow: "auto", padding: 28 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ color: "#f1f5f9", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>Add Invoice Record</div>
            <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 11, marginTop: 4 }}>POST /api/add-invoice · Graph insertion via HAS_IRN schema</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 22, lineHeight: 1 }}>✕</button>
        </div>

        {/* Form fields */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          {fields.map((f) => (
            <div key={f.key} style={{ gridColumn: f.key === "irn" || f.key === "eway_bill" ? "span 1" : "auto" }}>
              <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>{f.label}</div>
              <input
                value={form[f.key]}
                onChange={handleChange(f.key)}
                placeholder={f.placeholder}
                style={{ width: "100%", background: "#060a0f", border: `1px solid ${form[f.key] ? "#1e3a5f" : "#1e2d3d"}`, borderRadius: 7, padding: "10px 12px", color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontSize: 12, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
              />
            </div>
          ))}
        </div>

        {/* Validation / success feedback */}
        {error && (
          <div style={{ background: "#150404", border: "1px solid #dc262633", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
            <div style={{ color: "#ef4444", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>⚠ {error}</div>
          </div>
        )}
        {success && (
          <div style={{ background: "#052e16", border: "1px solid #22c55e33", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
            <div style={{ color: "#22c55e", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>✓ {success}</div>
          </div>
        )}

        {/* Graph insertion note */}
        <div style={{ background: "#060a0f", borderRadius: 8, padding: "10px 14px", marginBottom: 20, color: "#334155", fontFamily: "'DM Mono', monospace", fontSize: 11, lineHeight: 1.7 }}>
          Graph ops: CREATE (Invoice) → MERGE (Supplier) → MERGE (Buyer) → MERGE (IRN) → link ISSUED / RECEIVED / HAS_IRN / DECLARED_IN relationships
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={handleSubmit} disabled={loading}
            style={{ flex: 1, background: loading ? "#1e2d3d" : "#1d4ed8", border: "none", borderRadius: 8, padding: "13px 20px", color: loading ? "#475569" : "#fff", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s" }}>
            {loading ? "INSERTING INTO GRAPH…" : "SUBMIT INVOICE"}
          </button>
          <button onClick={onClose} style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 8, padding: "13px 20px", color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 13, cursor: "pointer" }}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, sub, color, icon }) {
  return (
    <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 12, padding: "20px 24px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: "#64748b", fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{title}</div>
          <div style={{ color: "#f1f5f9", fontSize: 28, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{value}</div>
          <div style={{ color: "#475569", fontSize: 12, marginTop: 6, fontFamily: "'DM Mono', monospace" }}>{sub}</div>
        </div>
        <div style={{ fontSize: 28, opacity: 0.5 }}>{icon}</div>
      </div>
    </div>
  );
}

function RiskBadge({ status }) {
  const label = { LOW_RISK: "LOW RISK", MODERATE: "MODERATE", HIGH_RISK: "HIGH RISK", FRAUD_SUSPICION: "⚠ FRAUD", MATCHED: "MATCHED", MISMATCH: "MISMATCH", MISSING: "MISSING", PARTIAL: "PARTIAL", LOW: "LOW", HIGH: "HIGH", FRAUD: "⚠ FRAUD" }[status] || status;
  return (
    <span style={{ background: getRiskBg(status), color: getRiskColor(status), border: `1px solid ${getRiskColor(status)}33`, borderRadius: 6, padding: "2px 10px", fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</span>
  );
}

function ScoreBar({ score }) {
  const color = score > 70 ? "#ef4444" : score > 45 ? "#f59e0b" : "#22c55e";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: "#1e2d3d", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.8s ease" }} />
      </div>
      <span style={{ color, fontFamily: "'DM Mono', monospace", fontSize: 12, minWidth: 32 }}>{score}%</span>
    </div>
  );
}

function GraphVisualization() {
  const nodePositions = {
    B1: { x: 80, y: 180 }, B2: { x: 80, y: 370 },
    V1: { x: 280, y: 120 }, V2: { x: 280, y: 270 }, V3: { x: 280, y: 420 },
    G1: { x: 480, y: 120 }, G2: { x: 480, y: 270 }, G3: { x: 480, y: 420 },
    I1: { x: 660, y: 120 }, I2: { x: 660, y: 270 }, P1: { x: 660, y: 420 },
  };
  const nodeStyles = {
    buyer: { fill: "#1e3a5f", stroke: "#3b82f6", label: "#93c5fd" },
    vendor_high: { fill: "#3b1212", stroke: "#ef4444", label: "#fca5a5" },
    vendor_low: { fill: "#0f2d1f", stroke: "#22c55e", label: "#86efac" },
    vendor_fraud: { fill: "#2d0a0a", stroke: "#dc2626", label: "#fca5a5" },
    gstr_fail: { fill: "#2d1a0a", stroke: "#f97316", label: "#fdba74" },
    gstr_ok: { fill: "#0f2d1f", stroke: "#22c55e", label: "#86efac" },
    irn_fail: { fill: "#2d1a0a", stroke: "#f97316", label: "#fdba74" },
    irn_ok: { fill: "#0f2d1f", stroke: "#22c55e", label: "#86efac" },
    pay_fail: { fill: "#2d0a0a", stroke: "#dc2626", label: "#fca5a5" },
  };
  const nodes = [
    { id: "B1", label: "BUYER", sublabel: "27XYZAB", type: "buyer" },
    { id: "B2", label: "BUYER", sublabel: "33LMNOP", type: "buyer" },
    { id: "V1", label: "TechSupply", sublabel: "29ABCDE", type: "vendor_high" },
    { id: "V2", label: "MH Traders", sublabel: "27XYZAB", type: "vendor_low" },
    { id: "V3", label: "Haryana Agro", sublabel: "06UVWXY", type: "vendor_fraud" },
    { id: "G1", label: "GSTR-1", sublabel: "MISSING", type: "gstr_fail" },
    { id: "G2", label: "GSTR-1", sublabel: "FILED ✓", type: "gstr_ok" },
    { id: "G3", label: "GSTR-1", sublabel: "NOT FILED", type: "gstr_fail" },
    { id: "I1", label: "IRN", sublabel: "INVALID ✗", type: "irn_fail" },
    { id: "I2", label: "IRN", sublabel: "VALID ✓", type: "irn_ok" },
    { id: "P1", label: "TAX", sublabel: "UNPAID ✗", type: "pay_fail" },
  ];
  const edges = [
    { from: "B1", to: "V1", color: "#ef4444", dash: true },
    { from: "B1", to: "V2", color: "#22c55e", dash: false },
    { from: "B2", to: "V3", color: "#dc2626", dash: true },
    { from: "V1", to: "G1", color: "#ef4444", dash: true },
    { from: "V2", to: "G2", color: "#22c55e", dash: false },
    { from: "V3", to: "G3", color: "#dc2626", dash: true },
    { from: "G1", to: "I1", color: "#f97316", dash: true },
    { from: "G2", to: "I2", color: "#22c55e", dash: false },
    { from: "G3", to: "P1", color: "#dc2626", dash: true },
  ];

  return (
    <div style={{ background: "#060a0f", borderRadius: 12, border: "1px solid #1e2d3d", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e2d3d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ color: "#f1f5f9", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 15 }}>Supply Chain Knowledge Graph</div>
          <div style={{ color: "#475569", fontSize: 11, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>Multi-hop ITC traversal path visualization</div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
          {[["#22c55e", "Clean"], ["#f97316", "Mismatch"], ["#dc2626", "Fraud"]].map(([c, l]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, color: "#64748b" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />{l}
            </div>
          ))}
        </div>
      </div>
      <svg width="100%" viewBox="0 0 780 560" style={{ display: "block" }}>
        <defs>
          <marker id="arrow-green" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#22c55e" />
          </marker>
          <marker id="arrow-red" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#ef4444" />
          </marker>
          <marker id="arrow-orange" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#f97316" />
          </marker>
          <marker id="arrow-crimson" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#dc2626" />
          </marker>
        </defs>

        {/* Grid */}
        {[120, 270, 420].map(y => (
          <line key={y} x1="0" y1={y} x2="780" y2={y} stroke="#0d1117" strokeWidth="1" />
        ))}
        {/* Layer labels */}
        {[["BUYERS", 80], ["VENDORS", 280], ["GSTR-1", 480], ["IRN/TAX", 660]].map(([l, x]) => (
          <text key={l} x={x} y={30} fill="#1e3a5f" fontFamily="'DM Mono', monospace" fontSize="10" textAnchor="middle" letterSpacing="2">{l}</text>
        ))}

        {/* Edges */}
        {edges.map((e, i) => {
          const f = nodePositions[e.from], t = nodePositions[e.to];
          const mx = (f.x + t.x) / 2;
          const marker = e.color === "#22c55e" ? "arrow-green" : e.color === "#ef4444" ? "arrow-red" : e.color === "#f97316" ? "arrow-orange" : "arrow-crimson";
          return (
            <line key={i} x1={f.x + 55} y1={f.y} x2={t.x - 55} y2={t.y}
              stroke={e.color} strokeWidth={1.5} opacity={0.7}
              strokeDasharray={e.dash ? "5,4" : "none"}
              markerEnd={`url(#${marker})`} />
          );
        })}

        {/* Nodes */}
        {nodes.map(n => {
          const pos = nodePositions[n.id];
          const s = nodeStyles[n.type];
          return (
            <g key={n.id} transform={`translate(${pos.x}, ${pos.y})`}>
              <rect x="-52" y="-28" width="104" height="56" rx="8" fill={s.fill} stroke={s.stroke} strokeWidth="1.5" />
              <text y="-8" fill={s.label} fontFamily="'DM Mono', monospace" fontSize="10" textAnchor="middle" fontWeight="700" letterSpacing="0.5">{n.label}</text>
              <text y="10" fill={s.stroke} fontFamily="'DM Mono', monospace" fontSize="9" textAnchor="middle" opacity="0.8">{n.sublabel}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function MiniBarChart({ data, valueKey, color }) {
  const max = Math.max(...data.map(d => d[valueKey]));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ width: "100%", height: `${(d[valueKey] / max) * 48}px`, background: color, borderRadius: "3px 3px 0 0", opacity: 0.7 + i * 0.05 }} />
          <div style={{ color: "#475569", fontSize: 9, fontFamily: "'DM Mono', monospace" }}>{d.month}</div>
        </div>
      ))}
    </div>
  );
}

function ComplianceTimeline({ data }) {
  return (
    <div style={{ background: "#060a0f", borderRadius: 12, border: "1px solid #1e2d3d", padding: 20 }}>
      <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", marginBottom: 16, textTransform: "uppercase" }}>Filing Consistency — Oct 2023 to Mar 2024</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 11, minWidth: 28 }}>{d.month}</div>
            <div style={{ flex: 1, height: 20, background: "#0d1117", borderRadius: 4, overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${d.filed}%`, background: d.filed > 80 ? "#22c55e" : d.filed > 65 ? "#f59e0b" : "#ef4444", opacity: 0.7, transition: "width 1s ease" }} />
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${d.filed}%`, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8 }}>
                <span style={{ color: "#f1f5f9", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{d.filed}%</span>
              </div>
            </div>
            <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10, minWidth: 60, textAlign: "right" }}>
              {d.mismatch} <span style={{ color: "#ef4444" }}>mismatches</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditExplainer({ trail }) {
  return (
    <div style={{ background: "#060a0f", border: `1px solid ${trail.risk === "FRAUD" ? "#dc262633" : trail.risk === "HIGH" ? "#ef444433" : "#f59e0b33"}`, borderRadius: 12, padding: 20, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "#94a3b8", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{trail.id}</span>
            <RiskBadge status={trail.risk} />
          </div>
          <div style={{ color: "#f1f5f9", fontSize: 15, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, marginTop: 6 }}>{trail.invoiceIrn} · {trail.vendorName}</div>
          <div style={{ color: "#64748b", fontSize: 11, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>GSTIN: {trail.vendorGstin} · {trail.month}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#ef4444", fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 18 }}>{fmt(trail.exposure)}</div>
          <div style={{ color: "#475569", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>ITC EXPOSURE</div>
        </div>
      </div>

      {/* Traversal path */}
      <div style={{ background: "#0a0e15", borderRadius: 8, padding: "12px 16px", marginBottom: 14, overflowX: "auto" }}>
        <div style={{ color: "#475569", fontSize: 10, fontFamily: "'DM Mono', monospace", marginBottom: 8, letterSpacing: "0.1em" }}>GRAPH TRAVERSAL PATH</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
          {trail.path.map((step, i) => (
            <span key={i} style={{
              color: step.includes("✗") ? "#ef4444" : step.includes("✓") ? "#22c55e" : step.includes("→") ? "#475569" : "#93c5fd",
              fontFamily: "'DM Mono', monospace", fontSize: 12, whiteSpace: "nowrap"
            }}>{step}</span>
          ))}
        </div>
      </div>

      {/* Root cause */}
      <div style={{ background: "#0d1117", borderRadius: 8, padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ color: "#f59e0b", fontSize: 10, fontFamily: "'DM Mono', monospace", marginBottom: 6, letterSpacing: "0.1em" }}>ROOT CAUSE</div>
        <div style={{ color: "#94a3b8", fontSize: 13, fontFamily: "'DM Mono', monospace", lineHeight: 1.6 }}>{trail.rootCause}</div>
      </div>

      {/* Natural language explanation */}
      <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: "12px 16px" }}>
        <div style={{ color: "#3b82f6", fontSize: 10, fontFamily: "'DM Mono', monospace", marginBottom: 8, letterSpacing: "0.1em" }}>AI AUDIT EXPLANATION</div>
        <div style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.7, fontFamily: "Georgia, serif", fontStyle: "italic" }}>"{trail.explanation}"</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
        <div style={{ color: "#64748b", fontSize: 11, fontFamily: "'DM Mono', monospace" }}>Compliance Score:</div>
        <ScoreBar score={trail.complianceScore} />
      </div>
    </div>
  );
}

function DonutChart({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let cumulative = 0;
  const r = 70, cx = 90, cy = 90;
  const segments = data.map(d => {
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += d.value;
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return { ...d, path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z` };
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <svg width="180" height="180">
        {segments.map((s, i) => <path key={i} d={s.path} fill={s.color} opacity={0.85} stroke="#060a0f" strokeWidth="2" />)}
        <circle cx={cx} cy={cy} r="42" fill="#060a0f" />
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#f1f5f9" fontFamily="'Space Grotesk', sans-serif" fontSize="18" fontWeight="700">{total}</text>
        <text x={cx} y={cx + 12} textAnchor="middle" fill="#475569" fontFamily="'DM Mono', monospace" fontSize="9">INVOICES</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />
            <div style={{ color: "#94a3b8", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{d.label}</div>
            <div style={{ color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700 }}>{d.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CypherBlock() {
  const query = `// Multi-hop ITC Validation Traversal
MATCH path = (buyer:Taxpayer {gstin: $buyerGstin})
  -[:RECEIVED]->(inv:Invoice)
  -[:ISSUED_BY]->(vendor:Taxpayer)
  -[:FILED]->(gstr1:GSTR1)
  -[:DECLARED_IN]->(irn:IRN)
  -[:HAS_EWAY]->(eway:EWayBill)
  -[:PAID_TAX]->(payment:Payment)
  -[:REFLECTED_IN]->(gstr3b:GSTR3B)
WHERE buyer.period = $period
  AND inv.itcClaimed = true
RETURN path,
  CASE WHEN irn IS NULL THEN 'MISSING_IRN'
       WHEN gstr1 IS NULL THEN 'NOT_IN_GSTR1'
       WHEN gstr3b IS NULL THEN 'TAX_UNPAID'
       ELSE 'VALID' END AS validationStatus,
  inv.taxAmount AS itcExposure
ORDER BY itcExposure DESC`;
  return (
    <div style={{ background: "#060a0f", borderRadius: 12, border: "1px solid #1e2d3d", overflow: "hidden" }}>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid #1e2d3d", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} />
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
        <span style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 11, marginLeft: 8 }}>reconciliation.cypher — Neo4j Query Engine</span>
      </div>
      <pre style={{ margin: 0, padding: 20, color: "#cbd5e1", fontFamily: "'DM Mono', monospace", fontSize: 12, lineHeight: 1.7, overflowX: "auto", background: "transparent" }}>
        {query.split("\n").map((line, i) => {
          const c = line.trim().startsWith("//") ? "#475569" : line.match(/^(MATCH|WHERE|RETURN|ORDER|CASE|WHEN|END|AND)/) ? "#93c5fd" : line.includes("$") ? "#f59e0b" : line.includes("'") ? "#86efac" : "#cbd5e1";
          return <div key={i} style={{ color: c }}>{line}</div>;
        })}
      </pre>
    </div>
  );
}

function RiskMatrix() {
  const matrix = [
    { label: "Filing Rate < 50%", weight: "25%", signal: "HIGH", icon: "📊" },
    { label: "ITC Mismatch Count", weight: "30%", signal: "HIGH", icon: "⚠️" },
    { label: "Tax Payment Delay", weight: "20%", signal: "MOD", icon: "💳" },
    { label: "Graph Centrality Score", weight: "15%", signal: "MOD", icon: "🕸️" },
    { label: "Circular Trading Pattern", weight: "10%", signal: "FRAUD", icon: "🔄" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {matrix.map((m, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#0d1117", borderRadius: 8, padding: "10px 14px" }}>
          <span style={{ fontSize: 16 }}>{m.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#94a3b8", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{m.label}</div>
          </div>
          <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{m.weight}</div>
          <RiskBadge status={m.signal === "HIGH" ? "HIGH_RISK" : m.signal === "FRAUD" ? "FRAUD_SUSPICION" : "MODERATE"} />
        </div>
      ))}
      <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, padding: "12px 14px", marginTop: 4 }}>
        <div style={{ color: "#3b82f6", fontFamily: "'DM Mono', monospace", fontSize: 11, marginBottom: 6 }}>RISK FORMULA</div>
        <div style={{ color: "#93c5fd", fontFamily: "'DM Mono', monospace", fontSize: 12, lineHeight: 1.8 }}>
          Risk_Score = 0.25×(1 - FilingRate)<br/>
          + 0.30×(MismatchCount / MaxMismatch)<br/>
          + 0.20×(TaxDelay / 30days)<br/>
          + 0.15×(GraphCentrality)<br/>
          + 0.10×(CircularFlag)
        </div>
      </div>
    </div>
  );
}


// ─── GST AI ASSISTANT CHATBOT ────────────────────────────────────────────────
function GSTChatbot({ auditRegistry, nationalStats, statesData }) {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm your GST Intelligence Assistant. I can help you with:\n\n• Understanding invoice risk levels\n• Explaining audit traversal results\n• GST compliance questions\n• Analyzing state filing data\n\nWhat would you like to know?",
    },
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const buildSystemPrompt = () => {
    const regSummary = auditRegistry.slice(0, 5).map(r =>
      `${r.invoice_number} (${r.supplier_name}, risk: ${r.riskScore}%)`
    ).join(", ");
    const natStats = nationalStats
      ? `National avg filing rate: ${Math.round((nationalStats.avg_fill_pct || 0) * 100)}%, Total eligible: ${((nationalStats.total_eligible || 0)/1e6).toFixed(1)}M, Period: ${nationalStats.period?.slice(0,7)}`
      : "National stats not loaded";
    const stateCount = statesData.length;

    return `You are an expert GST (Goods and Services Tax) Intelligence Assistant embedded in a GST Reconciliation Engine dashboard built with React, FastAPI, and Neo4j.

DASHBOARD CONTEXT:
- ${auditRegistry.length} invoices in the Neo4j registry. Sample: ${regSummary}
- ${stateCount} Indian states/UTs loaded with real filing data (2017-2024)
- ${natStats}

RISK LEVEL SYSTEM:
- VERIFIED (90-100%): All checks pass, IRN valid, GSTR-2B reflected
- SECURE (75-89%): Minor issues, e-Way Bill missing but acceptable
- WATCHLIST (60-74%): GSTR-2B not reflected, period mismatch
- HIGH RISK (40-59%): No IRN, EWB expired, GSTR-1 not declared
- CRITICAL (0-39%): Supplier suspended, forged invoice, circular trading

STATE FILING COMPLIANCE TIERS (based on fill_pct):
- Excellent ≥97%, Good ≥93%, Watch ≥88%, At Risk ≥82%, Critical <82%

TECH STACK: React frontend → FastAPI (Python) → Neo4j graph DB
Graph relationships: (Supplier)-[:ISSUED]->(Invoice)-[:RECEIVED_BY]->(Buyer), (State)-[:HAS_FILING]->(FilingRecord)

KEY GST CONCEPTS YOU KNOW:
- ITC (Input Tax Credit): Tax credit claimed by buyers on purchases
- IRN (Invoice Reference Number): Unique ID from IRP e-Invoice portal
- GSTR-1: Outward supply return filed by supplier
- GSTR-2B: Auto-populated ITC statement for buyer
- GSTR-3B: Monthly summary return with tax payment
- e-Way Bill: Required for goods movement >₹50,000
- Circular trading: Fraudulent invoicing loop to claim false ITC

Be concise, helpful, and specific. Use bullet points for lists. Reference actual data from the dashboard when relevant. If asked about a specific invoice or state, mention what you know from the context above.`;
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: buildSystemPrompt(),
          messages: history,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "API error");
      }

      const data = await res.json();
      const reply = data.reply || "Sorry, I could not get a response.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      const msg = err.message?.includes("GEMINI_API_KEY")
        ? "API key not set.\n\nIn your terminal run:\n$env:GEMINI_API_KEY=\'your-key-here\'\n\nThen restart uvicorn."
        : "Connection error: " + err.message;
      setMessages(prev => [...prev, { role: "assistant", content: msg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const quickPrompts = [
    "What is ITC and how is it verified?",
    "Explain the risk levels",
    "Which states have low compliance?",
    "How does graph traversal work?",
  ];

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button onClick={() => setOpen(o => !o)} style={{
        position: "fixed", bottom: 28, right: 28, zIndex: 1000,
        width: 52, height: 52, borderRadius: "50%",
        background: open ? "#1e40af" : "linear-gradient(135deg, #1e40af, #7c3aed)",
        border: "none", cursor: "pointer", boxShadow: "0 4px 24px #1e40af66",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, transition: "all 0.2s",
        color: "#fff",
      }}>
        {open ? "×" : "⬡"}
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div style={{
          position: "fixed", bottom: 92, right: 28, zIndex: 999,
          width: 380, height: 560,
          background: "#0d1117", border: "1px solid #1e3a5f",
          borderRadius: 16, display: "flex", flexDirection: "column",
          boxShadow: "0 8px 48px #000c",
          animation: "slideUp 0.2s ease",
        }}>
          {/* Header */}
          <div style={{
            padding: "14px 18px", borderBottom: "1px solid #1e2d3d",
            display: "flex", alignItems: "center", gap: 10, borderRadius: "16px 16px 0 0",
            background: "linear-gradient(135deg, #0a1628, #0d1117)",
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: "linear-gradient(135deg, #1e40af, #7c3aed)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
            }}>⬡</div>
            <div>
              <div style={{ color: "#f1f5f9", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14 }}>GST Assistant</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
                <span style={{ color: "#22c55e", fontFamily: "'DM Mono', monospace", fontSize: 10 }}>AI · Neo4j · Live Data</span>
              </div>
            </div>
            <button onClick={() => setMessages([{ role: "assistant", content: "Chat cleared. How can I help?" }])}
              style={{ marginLeft: "auto", background: "none", border: "1px solid #1e2d3d", borderRadius: 6, padding: "4px 8px", color: "#475569", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 10 }}>
              Clear
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "85%", padding: "10px 13px", borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  background: m.role === "user" ? "#1e40af" : "#060a0f",
                  border: m.role === "user" ? "none" : "1px solid #1e2d3d",
                  color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontSize: 12, lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ background: "#060a0f", border: "1px solid #1e2d3d", borderRadius: "12px 12px 12px 2px", padding: "10px 14px", display: "flex", gap: 4 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", animation: `pulse ${0.6 + i*0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick prompts — show only when 1 message (welcome state) */}
          {messages.length === 1 && (
            <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {quickPrompts.map(p => (
                <button key={p} onClick={() => { setInput(p); }}
                  style={{ background: "#060a0f", border: "1px solid #1e3a5f", borderRadius: 20, padding: "5px 10px", color: "#93c5fd", fontFamily: "'DM Mono', monospace", fontSize: 10, cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => e.target.style.background = "#0a1628"}
                  onMouseLeave={e => e.target.style.background = "#060a0f"}>
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: "12px 14px", borderTop: "1px solid #1e2d3d", display: "flex", gap: 8 }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about GST, invoices, risk levels..."
              rows={1}
              style={{
                flex: 1, background: "#060a0f", border: "1px solid #1e3a5f", borderRadius: 8,
                padding: "9px 12px", color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontSize: 12,
                outline: "none", resize: "none", lineHeight: 1.5,
              }}
            />
            <button onClick={sendMessage} disabled={!input.trim() || loading}
              style={{
                background: input.trim() && !loading ? "#1e40af" : "#0a1628",
                border: "none", borderRadius: 8, padding: "0 14px",
                color: input.trim() && !loading ? "#fff" : "#334155",
                cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                fontFamily: "'DM Mono', monospace", fontSize: 16, transition: "all 0.2s",
              }}>
              ↑
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [filterRisk, setFilterRisk] = useState("ALL");
  // Extension: mutable registry (supports AddInvoiceModal inserts)
  const [auditRegistry, setAuditRegistry]   = useState(AUDIT_INVOICE_REGISTRY);
  const [showAddModal, setShowAddModal]       = useState(false);

  // ── Live data from Neo4j ──────────────────────────────────────────────────
  const [nationalStats, setNationalStats]     = useState(null);
  const [statesData, setStatesData]           = useState([]);
  const [stateFilings, setStateFilings]       = useState([]);   // monthly trend
  const [lowCompliance, setLowCompliance]     = useState([]);
  const [apiLoading, setApiLoading]           = useState(true);

  useEffect(() => {
    const API = "http://localhost:8000";
    Promise.all([
      fetch(`${API}/api/registry`).then(r => r.json()).catch(() => null),
      fetch(`${API}/api/stats/national`).then(r => r.json()).catch(() => null),
      fetch(`${API}/api/states`).then(r => r.json()).catch(() => null),
      fetch(`${API}/api/stats/low-compliance?threshold=0.93`).then(r => r.json()).catch(() => null),
      fetch(`${API}/api/states/36/filings?limit=12`).then(r => r.json()).catch(() => null),
    ]).then(([registry, national, states, lowComp, trend]) => {
      if (registry?.invoices?.length)  setAuditRegistry(registry.invoices);
      if (national?.period)            setNationalStats(national);
      if (states?.states?.length)      setStatesData(states.states);
      if (lowComp?.states?.length)     setLowCompliance(lowComp.states);
      if (trend?.filings?.length) {
        const monthly = [...trend.filings].reverse().map(f => ({
          month: new Date(f.date).toLocaleString("default", { month: "short" }),
          filed: Math.round((f.fill_pct || 0) * 100),
          itcClaimed: f.total_filed ? +(f.total_filed / 1e5).toFixed(1) : 0,
          mismatch: 100 - Math.round((f.fill_pct || 0) * 100),
          score: Math.round((f.fill_pct || 0) * 100),
        }));
        setStateFilings(monthly);
      }
    }).finally(() => setApiLoading(false));
  }, []);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  // ── Derived metrics — use live data when available, fallback to mock ───────
  const liveChartData   = stateFilings.length ? stateFilings : MONTHLY_DATA;
  const totalEligible   = nationalStats?.total_eligible  || 0;
  const totalFiled      = nationalStats?.total_filed     || 0;
  const avgFillPct      = nationalStats?.avg_fill_pct    ? Math.round(nationalStats.avg_fill_pct * 100) : null;
  const stateCount      = nationalStats?.state_count     || statesData.length || 0;
  const lowCompCount    = lowCompliance.length;

  // Keep existing mock-based metrics as fallback
  const totalExposure   = INVOICES.filter(i => i.status !== "MATCHED").reduce((s, i) => s + i.tax, 0);
  const fraudCount      = VENDORS.filter(v => v.status === "FRAUD_SUSPICION").length;
  const avgCompliance   = avgFillPct ?? Math.round(VENDORS.reduce((s, v) => s + v.filingRate, 0) / VENDORS.length);
  const matchedCount    = INVOICES.filter(i => i.status === "MATCHED").length;

  // State filing table — filter by search and risk
  const filteredStates  = statesData.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || s.name?.toLowerCase().includes(q) || s.code?.includes(q);
    const pct = s.fill_pct || 0;
    const status = pct >= 0.93 ? "LOW_RISK" : pct >= 0.82 ? "MODERATE" : "HIGH_RISK";
    const matchRisk = filterRisk === "ALL" || status === filterRisk;
    return matchSearch && matchRisk;
  });

  // Legacy vendor filter (used in ITC/Audit tabs)
  const filteredVendors = VENDORS.filter(v => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || v.gstin.toLowerCase().includes(q) || v.name.toLowerCase().includes(q) || v.sector.toLowerCase().includes(q);
    const matchRisk = filterRisk === "ALL" || v.status === filterRisk;
    return matchSearch && matchRisk;
  });

  const donutData = [
    { label: "Matched",  value: matchedCount,                                          color: "#22c55e" },
    { label: "Mismatch", value: INVOICES.filter(i => i.status === "MISMATCH").length,  color: "#ef4444" },
    { label: "Partial",  value: INVOICES.filter(i => i.status === "PARTIAL").length,   color: "#f59e0b" },
    { label: "Missing",  value: INVOICES.filter(i => i.status === "MISSING").length,   color: "#dc2626" },
  ];

  const tabs = [
    { id: "overview",   label: "Overview",         icon: "◈" },
    { id: "graph",      label: "Knowledge Graph",   icon: "⬡" },
    { id: "vendors",    label: "Vendor Risk",       icon: "◎" },
    { id: "invoices",   label: "ITC Analysis",      icon: "◉" },
    { id: "audit",      label: "Audit Trail",       icon: "◆" },
    { id: "traversal",  label: "Run Traversal",     icon: "↗" },
    { id: "engine",     label: "Query Engine",      icon: "⬟" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#020609", color: "#f1f5f9", fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #0d1f2d", padding: "0 32px", background: "#020609", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, background: "linear-gradient(135deg, #1e40af, #7c3aed)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⬡</div>
              <div>
                <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em" }}>GST Reconciliation Engine</div>
                <div style={{ color: "#1e40af", fontSize: 9, fontFamily: "'DM Mono', monospace", letterSpacing: "0.12em" }}>KNOWLEDGE GRAPH · ITC INTELLIGENCE · v2.4</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ background: "#0d1f0d", border: "1px solid #166534", borderRadius: 6, padding: "4px 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 2s infinite" }} />
              <span style={{ color: "#22c55e", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>LIVE · Mar 2024</span>
            </div>
            <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 11, background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 6, padding: "4px 12px" }}>
              JWT: ●●●●●●●●
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginTop: -1 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              background: "none", border: "none", borderBottom: activeTab === t.id ? "2px solid #3b82f6" : "2px solid transparent",
              color: activeTab === t.id ? "#93c5fd" : "#475569", padding: "10px 20px", cursor: "pointer",
              fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 6,
              transition: "all 0.2s"
            }}>
              <span style={{ fontSize: 14 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 32px" }}>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div>
            {/* KPI Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              <MetricCard title="Total Eligible Taxpayers" value={totalEligible ? (totalEligible/1e6).toFixed(2)+"M" : fmtL(totalExposure)} sub={totalEligible ? `As of ${nationalStats?.period?.slice(0,7) || "latest"}` : "Unreconciled tax claims"} color="#ef4444" icon="₹" />
              <MetricCard title="Low Compliance States" value={lowCompCount || fraudCount} sub={lowCompCount ? "States below 93% filing rate" : "Vendors under scrutiny"} color="#dc2626" icon="⚠" />
              <MetricCard title="Avg National Filing Rate" value={`${avgCompliance}%`} sub={stateCount ? `Across ${stateCount} states/UTs` : "Across all vendors"} color="#f59e0b" icon="%" />
              <MetricCard title="Total Returns Filed" value={totalFiled ? (totalFiled/1e6).toFixed(2)+"M" : `${matchedCount}/${INVOICES.length}`} sub={totalFiled ? "Latest period" : "Clean ITC chains"} color="#22c55e" icon="✓" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, marginBottom: 20 }}>
              {/* Graph */}
              <GraphVisualization />

              {/* Right column */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Donut */}
                <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 12, padding: 20 }}>
                  <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", marginBottom: 14, textTransform: "uppercase" }}>Invoice Status Breakdown</div>
                  <DonutChart data={donutData} />
                </div>

                {/* ITC Exposure bar */}
                <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 12, padding: 20 }}>
                  <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", marginBottom: 14, textTransform: "uppercase" }}>ITC Claimed (₹L) — Monthly</div>
                  <MiniBarChart data={liveChartData} valueKey="itcClaimed" color="#3b82f6" />
                </div>
              </div>
            </div>

            <ComplianceTimeline data={liveChartData} />
          </div>
        )}

        {/* ── GRAPH ── */}
        {activeTab === "graph" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <GraphVisualization />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 12, padding: 20 }}>
                <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", marginBottom: 16, textTransform: "uppercase" }}>Graph Schema — Node Types</div>
                {[["Taxpayer (GSTIN)", "#3b82f6", "GSTIN, name, state, sector, riskScore"],["Invoice", "#f59e0b", "IRN, amount, tax, date, status"],["GSTR-1", "#22c55e", "period, totalTax, filedOn, invoiceCount"],["GSTR-2B", "#8b5cf6", "period, autoPopulated, itcAvailable"],["GSTR-3B", "#06b6d4", "period, itcClaimed, taxPaid, liabilityNet"],["IRN", "#10b981", "irn, ewbNumber, generatedAt, valid"],["Payment", "#f97316", "challanNo, amount, date, bankRef"]].map(([n, c, a]) => (
                  <div key={n} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid #0d1117" }}>
                    <div style={{ width: 3, background: c, borderRadius: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600 }}>{n}</div>
                      <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 11, marginTop: 2 }}>{a}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 12, padding: 20 }}>
                <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", marginBottom: 16, textTransform: "uppercase" }}>Relationship Types</div>
                {[["FILED", "Taxpayer → GSTR", "1:N"], ["ISSUED", "Taxpayer → Invoice", "1:N"], ["RECEIVED", "Taxpayer → Invoice", "1:N"], ["DECLARED_IN", "Invoice → GSTR-1", "N:1"], ["CLAIMED_IN", "Invoice → GSTR-3B", "N:1"], ["MATCHES", "GSTR-1 ↔ GSTR-2B", "1:1"], ["HAS_IRN", "Invoice → IRN", "1:1"], ["PAID_TAX", "Taxpayer → Payment", "1:N"], ["CONNECTED_TO", "Taxpayer ↔ Taxpayer", "N:N"]].map(([r, d, c]) => (
                  <div key={r} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #060a0f" }}>
                    <div>
                      <div style={{ color: "#93c5fd", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{r}</div>
                      <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10 }}>{d}</div>
                    </div>
                    <div style={{ color: "#3b82f6", fontFamily: "'DM Mono', monospace", fontSize: 11, background: "#0a1628", padding: "2px 8px", borderRadius: 4 }}>{c}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── VENDOR RISK — now powered by real state filing data from Neo4j ── */}
        {activeTab === "vendors" && (
          <div>
            {/* Summary strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
              <MetricCard title="States / UTs" value={stateCount || "—"} sub="In Neo4j graph" color="#3b82f6" icon="⬡" />
              <MetricCard title="Avg Filing Rate" value={avgFillPct ? `${avgFillPct}%` : "—"} sub={nationalStats?.period?.slice(0,7) || "Latest period"} color="#22c55e" icon="%" />
              <MetricCard title="Below 93% Rate" value={lowCompCount || "—"} sub="Needs attention" color="#f59e0b" icon="⚠" />
              <MetricCard title="Total Eligible" value={totalEligible ? (totalEligible/1e6).toFixed(1)+"M" : "—"} sub="Registered taxpayers" color="#8b5cf6" icon="₹" />
            </div>

            {/* Search + filter */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by state name or code..."
                style={{ flex: 1, minWidth: 280, background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 8, padding: "10px 16px", color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontSize: 13, outline: "none" }} />
              {["ALL", "LOW_RISK", "MODERATE", "HIGH_RISK"].map(f => (
                <button key={f} onClick={() => setFilterRisk(f)} style={{
                  background: filterRisk === f ? "#1e2d3d" : "#0d1117", border: filterRisk === f ? "1px solid #3b82f6" : "1px solid #1e2d3d",
                  borderRadius: 8, padding: "10px 14px", color: filterRisk === f ? "#93c5fd" : "#475569",
                  cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: 11
                }}>{f.replace(/_/g, " ")}</button>
              ))}
            </div>

            {apiLoading && (
              <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 13, textAlign: "center", padding: 40 }}>
                ◌ Loading state data from Neo4j…
              </div>
            )}

            {!apiLoading && filteredStates.length === 0 && (
              <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 13, textAlign: "center", padding: 40 }}>
                No states found. Make sure you ran python seed_states.py and the backend is running.
              </div>
            )}

            <div style={{ display: "grid", gap: 10 }}>
              {filteredStates.map(s => {
                const pct    = s.fill_pct || 0;
                const pctNum = Math.round(pct * 100);
                // Calibrated to real India GST filing data (2017-2024 range: 74%-101%)
                const status = pct >= 0.97 ? "LOW_RISK"  :
                               pct >= 0.93 ? "LOW_RISK"  :
                               pct >= 0.88 ? "MODERATE"  :
                               pct >= 0.82 ? "MODERATE"  : "HIGH_RISK";
                const filed  = s.total_filed || 0;
                const elig   = s.eligible || 0;
                return (
                  <div key={s.code} onClick={() => setSelectedVendor(selectedVendor?.code === s.code ? null : s)}
                    style={{ background: "#0d1117", border: `1px solid ${selectedVendor?.code === s.code ? "#3b82f6" : "#1e2d3d"}`, borderRadius: 12, padding: "14px 20px", cursor: "pointer", transition: "all 0.2s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                          <span style={{ color: "#f1f5f9", fontWeight: 600, fontSize: 15 }}>{s.name}</span>
                          <RiskBadge status={status} />
                        </div>
                        <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>
                          State Code: {s.code} · Latest: {s.latest_date?.slice(0,7) || "—"}
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, flex: 2 }}>
                        <div>
                          <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10, marginBottom: 4 }}>FILING RATE</div>
                          {/* Invert score so high filing rate = green bar, low = red */}
                          <ScoreBar score={100 - pctNum} />
                          <div style={{ color: pct >= 0.93 ? "#22c55e" : pct >= 0.85 ? "#f59e0b" : "#ef4444", fontFamily: "'DM Mono', monospace", fontSize: 11, marginTop: 3, fontWeight: 700 }}>{pctNum}%</div>
                        </div>
                        <div>
                          <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10, marginBottom: 4 }}>ELIGIBLE</div>
                          <div style={{ color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600 }}>{elig ? (elig/1e5).toFixed(1)+"L" : "—"}</div>
                        </div>
                        <div>
                          <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10, marginBottom: 4 }}>RETURNS FILED</div>
                          <div style={{ color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600 }}>{filed ? (filed/1e5).toFixed(1)+"L" : "—"}</div>
                        </div>
                        <div>
                          <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10, marginBottom: 4 }}>COMPLIANCE</div>
                          <div style={{ color: pct >= 0.97 ? "#22d3ee" : pct >= 0.93 ? "#22c55e" : pct >= 0.88 ? "#f59e0b" : pct >= 0.82 ? "#f97316" : "#ef4444", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 700 }}>
                            {pct >= 0.97 ? "✦ Excellent" : pct >= 0.93 ? "✓ Good" : pct >= 0.88 ? "◐ Watch" : pct >= 0.82 ? "▲ At Risk" : "⚑ Critical"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedVendor?.code === s.code && (
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #1e2d3d", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div style={{ background: "#060a0f", borderRadius: 8, padding: 14 }}>
                          <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10, marginBottom: 8 }}>FILING TREND (Telangana — Live from Neo4j)</div>
                          <MiniBarChart data={liveChartData} valueKey="filed" color={pct < 0.93 ? "#ef4444" : "#22c55e"} />
                        </div>
                        <div style={{ background: "#060a0f", borderRadius: 8, padding: 14 }}>
                          <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10, marginBottom: 10 }}>STATE DETAILS</div>
                          {[
                            ["State Code",     s.code],
                            ["Eligible Taxpayers", elig ? elig.toLocaleString("en-IN") : "—"],
                            ["Total Filed",    filed ? filed.toLocaleString("en-IN") : "—"],
                            ["Filing Rate",    `${pctNum}%`],
                            ["Latest Period",  s.latest_date?.slice(0,7) || "—"],
                            ["Risk Status",    status.replace(/_/g," ")],
                          ].map(([k, v]) => (
                            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                              <span style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{k}</span>
                              <span style={{ color: "#94a3b8", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── INVOICES ── */}
        {activeTab === "invoices" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              <MetricCard title="Total ITC Claimed" value={fmtL(INVOICES.reduce((s, i) => s + i.tax, 0))} sub="Across all invoices" color="#3b82f6" icon="₹" />
              <MetricCard title="At-Risk ITC" value={fmtL(INVOICES.filter(i => i.risk !== "LOW").reduce((s, i) => s + i.tax, 0))} sub="Requires verification" color="#f59e0b" icon="⚠" />
              <MetricCard title="Fraud Exposure" value={fmtL(INVOICES.filter(i => i.risk === "FRAUD").reduce((s, i) => s + i.tax, 0))} sub="Immediate action needed" color="#dc2626" icon="⛔" />
              <MetricCard title="IRN Valid" value={`${INVOICES.filter(i => i.irnValid).length}/${INVOICES.length}`} sub="Verified invoice references" color="#22c55e" icon="✓" />
            </div>

            <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #1e2d3d", display: "grid", gridTemplateColumns: "120px 1fr 1fr 100px 80px 80px 80px 100px", gap: 16, color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                <span>IRN</span><span>Vendor GSTIN</span><span>Buyer GSTIN</span><span>Amount</span><span>GSTR-1</span><span>GSTR-2B</span><span>IRN</span><span>Status</span>
              </div>
              {INVOICES.map((inv, i) => (
                <div key={inv.irn} style={{ padding: "14px 20px", borderBottom: i < INVOICES.length - 1 ? "1px solid #060a0f" : "none", display: "grid", gridTemplateColumns: "120px 1fr 1fr 100px 80px 80px 80px 100px", gap: 16, alignItems: "center", background: i % 2 === 0 ? "transparent" : "#060a0f08" }}>
                  <span style={{ color: "#93c5fd", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600 }}>{inv.irn}</span>
                  <span style={{ color: "#94a3b8", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{inv.vendor}</span>
                  <span style={{ color: "#94a3b8", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{inv.buyer}</span>
                  <span style={{ color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{fmtL(inv.tax)}</span>
                  <span style={{ color: inv.gstr1 ? "#22c55e" : "#ef4444", fontFamily: "'DM Mono', monospace", fontSize: 14 }}>{inv.gstr1 ? "✓" : "✗"}</span>
                  <span style={{ color: inv.gstr2b ? "#22c55e" : "#ef4444", fontFamily: "'DM Mono', monospace", fontSize: 14 }}>{inv.gstr2b ? "✓" : "✗"}</span>
                  <span style={{ color: inv.irnValid ? "#22c55e" : "#ef4444", fontFamily: "'DM Mono', monospace", fontSize: 14 }}>{inv.irnValid ? "✓" : "✗"}</span>
                  <RiskBadge status={inv.status} />
                </div>
              ))}
            </div>

            {/* Heatmap */}
            <div style={{ marginTop: 20, background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 12, padding: 20 }}>
              <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", marginBottom: 16, textTransform: "uppercase" }}>ITC Exposure Heatmap — By Vendor & Risk</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {VENDORS.sort((a, b) => b.riskScore - a.riskScore).map(v => {
                  const intensity = v.riskScore / 100;
                  const r = Math.round(intensity * 220);
                  const g = Math.round((1 - intensity) * 150);
                  return (
                    <div key={v.gstin} style={{ background: `rgba(${r}, ${g}, 30, ${0.15 + intensity * 0.5})`, border: `1px solid rgba(${r}, ${g}, 30, 0.3)`, borderRadius: 8, padding: "14px 16px", cursor: "default" }}>
                      <div style={{ color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{v.name.split(" ").slice(0, 2).join(" ")}</div>
                      <div style={{ color: "#94a3b8", fontFamily: "'DM Mono', monospace", fontSize: 10 }}>{fmtL(v.txnValue)}</div>
                      <div style={{ color: `rgb(${r}, ${g}, 30)`, fontFamily: "'DM Mono', monospace", fontSize: 18, fontWeight: 700, marginTop: 6 }}>{v.riskScore}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── AUDIT ── */}
        {activeTab === "audit" && (
          <div>
            <div style={{ marginBottom: 20, color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
              {AUDIT_TRAILS.length} audit trails generated · {AUDIT_TRAILS.filter(a => a.risk === "FRAUD").length} fraud flags · Total exposure: {fmt(AUDIT_TRAILS.reduce((s, a) => s + a.exposure, 0))}
            </div>
            {AUDIT_TRAILS.map(trail => <AuditExplainer key={trail.id} trail={trail} />)}
          </div>
        )}

        {/* ── QUERY ENGINE ── */}
        {activeTab === "engine" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <CypherBlock />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 12, padding: 20 }}>
                <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", marginBottom: 16, textTransform: "uppercase" }}>Risk Scoring Model</div>
                <RiskMatrix />
              </div>
              <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 12, padding: 20 }}>
                <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", marginBottom: 16, textTransform: "uppercase" }}>Graph Anomaly Detection</div>
                {[
                  { algo: "PageRank", desc: "Identify hub vendors with disproportionate influence in supply chain network", status: "ACTIVE" },
                  { algo: "Community Detection (Louvain)", desc: "Cluster vendors into compliance groups; isolate suspicious clusters", status: "ACTIVE" },
                  { algo: "Betweenness Centrality", desc: "Find bridge vendors connecting otherwise disconnected networks", status: "ACTIVE" },
                  { algo: "Link Prediction (Node2Vec)", desc: "Predict likely future relationships between taxpayers", status: "BETA" },
                  { algo: "GNN — GraphSAGE", desc: "Node classification for fraud probability using neighborhood aggregation", status: "ROADMAP" },
                ].map((a, i) => (
                  <div key={i} style={{ padding: "12px 0", borderBottom: i < 4 ? "1px solid #060a0f" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ color: "#93c5fd", fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 600 }}>{a.algo}</div>
                      <span style={{ background: a.status === "ACTIVE" ? "#052e16" : a.status === "BETA" ? "#1c1108" : "#1e1e2e", color: a.status === "ACTIVE" ? "#22c55e" : a.status === "BETA" ? "#f59e0b" : "#8b5cf6", border: `1px solid ${a.status === "ACTIVE" ? "#16653433" : a.status === "BETA" ? "#92400e33" : "#4c1d9533"}`, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontFamily: "'DM Mono', monospace" }}>{a.status}</span>
                    </div>
                    <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>{a.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 12, padding: 20 }}>
              <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", marginBottom: 16, textTransform: "uppercase" }}>REST API Endpoints</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                  { method: "POST", path: "/api/v1/ingest", desc: "Batch GST data ingestion", color: "#22c55e" },
                  { method: "POST", path: "/api/v1/reconcile", desc: "Run reconciliation engine", color: "#3b82f6" },
                  { method: "GET", path: "/api/v1/risk-score/:gstin", desc: "Vendor risk profile", color: "#06b6d4" },
                  { method: "GET", path: "/api/v1/vendor-profile/:gstin", desc: "Full vendor analytics", color: "#8b5cf6" },
                  { method: "GET", path: "/api/v1/audit-explanation/:irn", desc: "NL audit trail", color: "#f59e0b" },
                  { method: "GET", path: "/api/v1/graph/traversal", desc: "Multi-hop path query", color: "#ef4444" },
                ].map((e, i) => (
                  <div key={i} style={{ background: "#060a0f", borderRadius: 8, padding: "12px 16px", border: `1px solid ${e.color}22` }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                      <span style={{ background: `${e.color}22`, color: e.color, fontFamily: "'DM Mono', monospace", fontSize: 10, padding: "2px 8px", borderRadius: 4 }}>{e.method}</span>
                    </div>
                    <div style={{ color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontSize: 12, marginBottom: 4 }}>{e.path}</div>
                    <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{e.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TRAVERSAL (Extension) ── */}
        {activeTab === "traversal" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Toolbar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: "#f1f5f9", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16 }}>Search & Run Audit Traversal</div>
                <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 11, marginTop: 4 }}>
                  {auditRegistry.length} invoices in registry · Multi-hop path validation · Real-time risk classification
                </div>
              </div>
              <button onClick={() => setShowAddModal(true)}
                style={{ background: "#1d4ed8", border: "none", borderRadius: 8, padding: "10px 18px", color: "#fff", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                + ADD INVOICE
              </button>
            </div>

            {/* Main search + results layout */}
            <SearchAuditExtension registry={auditRegistry} />

            {/* Risk Level Legend */}
            <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 12, padding: 20 }}>
              <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", marginBottom: 16, textTransform: "uppercase" }}>Risk Level Scale — All 5 Scenarios Available for Testing</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                {[95, 80, 65, 45, 18].map((score) => {
                  const lvl = mapRiskLevel(score);
                  const sample = auditRegistry.find((r) => {
                    const sl = mapRiskLevel(r.riskScore).label;
                    return sl === lvl.label;
                  });
                  return (
                    <div key={score} style={{ background: lvl.bgColor, border: `1px solid ${lvl.borderColor}`, borderRadius: 10, padding: "14px 16px", textAlign: "center" }}>
                      <div style={{ color: lvl.color, fontSize: 22, marginBottom: 6 }}>{lvl.icon}</div>
                      <div style={{ color: lvl.color, fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{lvl.label}</div>
                      <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10, marginBottom: 8 }}>Score {score >= 90 ? "90–100" : score >= 75 ? "75–89" : score >= 60 ? "60–74" : score >= 40 ? "40–59" : "0–39"}</div>
                      {sample && (
                        <div style={{ color: "#334155", fontFamily: "'DM Mono', monospace", fontSize: 10, lineHeight: 1.4 }}>
                          Try: {sample.invoice_number}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Registry table */}
            <div style={{ background: "#0d1117", border: "1px solid #1e2d3d", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #1e2d3d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#94a3b8", fontSize: 11, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>Invoice Registry — {auditRegistry.length} records</span>
                <span style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10 }}>GET /api/search</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <div style={{ padding: "10px 20px", borderBottom: "1px solid #060a0f", display: "grid", gridTemplateColumns: "160px 1fr 1fr 80px 100px", gap: 16, color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", minWidth: 700 }}>
                  <span>Invoice No.</span><span>Supplier</span><span>Buyer GSTIN</span><span>IRN</span><span>Risk Level</span>
                </div>
                {auditRegistry.map((rec, i) => {
                  const lvl = mapRiskLevel(rec.riskScore);
                  return (
                    <div key={rec.invoice_number} style={{ padding: "12px 20px", borderBottom: i < auditRegistry.length - 1 ? "1px solid #060a0f08" : "none", display: "grid", gridTemplateColumns: "160px 1fr 1fr 80px 100px", gap: 16, alignItems: "center", background: i % 2 === 0 ? "transparent" : "#06090f22", minWidth: 700 }}>
                      <span style={{ color: "#93c5fd", fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600 }}>{rec.invoice_number}</span>
                      <div>
                        <div style={{ color: "#f1f5f9", fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{rec.supplier_name || "—"}</div>
                        <div style={{ color: "#475569", fontFamily: "'DM Mono', monospace", fontSize: 10 }}>{rec.supplier_gstin}</div>
                      </div>
                      <span style={{ color: "#94a3b8", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{rec.buyer_gstin}</span>
                      <span style={{ color: rec.irn ? "#22c55e" : "#ef4444", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{rec.irn ? "✓" : "✗"}</span>
                      <span style={{ background: lvl.bgColor, color: lvl.color, border: `1px solid ${lvl.borderColor}`, borderRadius: 5, padding: "2px 8px", fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700 }}>{lvl.icon} {lvl.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── AddInvoiceModal (Extension) ── */}
      {showAddModal && (
        <AddInvoiceModal
          onClose={() => setShowAddModal(false)}
          registry={auditRegistry}
          setRegistry={setAuditRegistry}
        />
      )}

      {/* ── GST AI Assistant Chatbot ── */}
      <GSTChatbot
        auditRegistry={auditRegistry}
        nationalStats={nationalStats}
        statesData={statesData}
      />

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes spin   { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        input::placeholder { color: #1e3a5f; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #0d1117; }
        ::-webkit-scrollbar-thumb { background: #1e2d3d; border-radius: 3px; }
      `}</style>
    </div>
  );
}