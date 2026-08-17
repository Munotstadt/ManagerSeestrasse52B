import os
import requests

TURSO_URL = os.environ["TURSO_URL"]
TURSO_TOKEN = os.environ["TURSO_TOKEN"]

# TURSO_URL is given as libsql://... ; the HTTP pipeline API uses https://...
http_url = TURSO_URL.replace("libsql://", "https://") + "/v2/pipeline"

SQL_FILE = os.path.join(os.path.dirname(__file__), "seestrasse_log_insert.sql")

with open(SQL_FILE, "r", encoding="utf-8") as f:
    raw = f.read()

# Strip comment lines (-- ...) and split into individual statements
cleaned_lines = [line for line in raw.splitlines() if not line.strip().startswith("--")]
cleaned = "\n".join(cleaned_lines)

statements = [s.strip() for s in cleaned.split(";") if s.strip()]

print(f"Found {len(statements)} statement(s) to execute.")

requests_payload = [{"type": "execute", "stmt": {"sql": stmt}} for stmt in statements]
requests_payload.append({"type": "close"})

resp = requests.post(
    http_url,
    headers={
        "Authorization": f"Bearer {TURSO_TOKEN}",
        "Content-Type": "application/json",
    },
    json={"requests": requests_payload},
    timeout=60,
)

resp.raise_for_status()
data = resp.json()

# Check for per-statement errors
errors = []
for i, result in enumerate(data.get("results", [])):
    if result.get("type") == "error":
        errors.append((i, result.get("error")))

if errors:
    print("Errors encountered:")
    for idx, err in errors:
        print(f"  Statement {idx}: {err}")
    raise SystemExit(1)

print("Import completed successfully.")

# Verification query
verify_resp = requests.post(
    http_url,
    headers={
        "Authorization": f"Bearer {TURSO_TOKEN}",
        "Content-Type": "application/json",
    },
    json={
        "requests": [
            {
                "type": "execute",
                "stmt": {"sql": "SELECT COUNT(*) as cnt FROM seestrasse_log WHERE Source = 'Google Import'"},
            },
            {"type": "close"},
        ]
    },
    timeout=30,
)
verify_resp.raise_for_status()
vdata = verify_resp.json()
try:
    cnt = vdata["results"][0]["response"]["result"]["rows"][0][0]["value"]
    print(f"Rows now in seestrasse_log with Source=Google Import: {cnt}")
except (KeyError, IndexError, TypeError):
    print("Verification query result:", vdata)
