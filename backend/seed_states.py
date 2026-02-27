"""
seed_states.py — Imports state-wise GST filing data from CSV into Neo4j.
Run after seed.py:  python seed_states.py

Graph nodes created:
  (:State  { name, code })
  (:FilingRecord { date, eligible, filed_on_time, filed_late, total_filed, fill_pct, month, year })

Relationships:
  (:State)-[:HAS_FILING]->(:FilingRecord)
"""

import csv
import os
from neo4j import GraphDatabase

NEO4J_URI      = os.getenv("NEO4J_URI",      "bolt://localhost:7687")
NEO4J_USER     = os.getenv("NEO4J_USER",     "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

CSV_PATH = "data_set_for_hackathon.csv"  # place CSV in same folder as this script

# ─── Cypher ──────────────────────────────────────────────────────────────────
MERGE_STATE = """
MERGE (s:State {code: $code})
  ON CREATE SET s.name = $name
"""

CREATE_FILING = """
MATCH (s:State {code: $code})
CREATE (f:FilingRecord {
    record_id:      $record_id,
    date:           $date,
    month:          $month,
    year:           $year,
    eligible:       $eligible,
    filed_on_time:  $filed_on_time,
    filed_late:     $filed_late,
    total_filed:    $total_filed,
    fill_pct:       $fill_pct
})
CREATE (s)-[:HAS_FILING]->(f)
"""

def safe_float(val):
    try:
        return float(val) if val.strip() != "" else None
    except:
        return None

def seed_states():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"📂 Loaded {len(rows)} rows from CSV.")

    with driver.session() as session:
        # Remove existing state filing data only (keep invoices intact)
        session.run("MATCH (f:FilingRecord) DETACH DELETE f")
        session.run("MATCH (s:State) DETACH DELETE s")
        print("🗑  Cleared existing State and FilingRecord nodes.")

        states_created = set()
        filing_count   = 0
        skipped        = 0

        for row in rows:
            state_name  = row["state_name"].strip()
            state_code  = row["state_code"].strip().zfill(2)  # pad e.g. "1" → "01"
            date_str    = row["date"].strip()
            eligible    = safe_float(row["eligible_tax_payer"])
            filed_early = safe_float(row["filled_by_due_date"])
            filed_late  = safe_float(row["filled_after_due_date"])
            total_filed = safe_float(row["total_return_filled"])
            fill_pct    = safe_float(row["filling_percentage"])

            # Skip rows with no useful data
            if eligible is None and total_filed in (None, 0.0):
                skipped += 1
                continue

            # Parse year/month from date string "2017-07-01"
            try:
                year  = int(date_str[:4])
                month = int(date_str[5:7])
            except:
                skipped += 1
                continue

            # Create State node once per state
            if state_code not in states_created:
                session.run(MERGE_STATE, code=state_code, name=state_name)
                states_created.add(state_code)

            record_id = f"{state_code}_{date_str}"
            session.run(CREATE_FILING,
                code        = state_code,
                record_id   = record_id,
                date        = date_str,
                month       = month,
                year        = year,
                eligible    = eligible,
                filed_on_time = filed_early,
                filed_late  = filed_late,
                total_filed = total_filed,
                fill_pct    = fill_pct,
            )
            filing_count += 1

        print(f"✅ Created {len(states_created)} State nodes.")
        print(f"✅ Created {filing_count} FilingRecord nodes.")
        print(f"⚠  Skipped {skipped} incomplete rows.")
        print(f"\n   Graph shape: (:State)-[:HAS_FILING]->(:FilingRecord)")
        print(f"   Date range: 2017-07 → 2024-04")

    driver.close()

if __name__ == "__main__":
    seed_states()
