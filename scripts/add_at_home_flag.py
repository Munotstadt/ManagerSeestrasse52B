"""
Seestrasse 52B – täglicher Heartbeat-Log
Trägt für ParameterID=2 einen Eintrag mit Value=1 für den aktuellen Tag ein
(einmal pro Tag, idempotent – bei erneutem Lauf am selben Tag wird nichts doppelt eingetragen).

Benötigte Umgebungsvariablen (GitHub Secrets):
  TURSO_URL   – https://<db>-<org>.<region>.turso.io
  TURSO_TOKEN – Turso Auth Token mit Schreibrecht auf die DB
"""

import os
from datetime import datetime, timezone

import requests

TURSO_URL = os.environ["TURSO_URL"].rstrip("/")
TURSO_TOKEN = os.environ["TURSO_TOKEN"]

PARAMETER_ID = 2
VALUE = 1
SOURCE = "GitHub Actions Heartbeat"
COMMENT = "Automatischer Heartbeat"


def _to_arg(v):
    if v is None:
        return {"type": "null"}
    if isinstance(v, bool):
        return {"type": "integer", "value": "1" if v else "0"}
    if isinstance(v, int):
        return {"type": "integer", "value": str(v)}
    if isinstance(v, float):
        return {"type": "float", "value": v}
    return {"type": "text", "value": str(v)}


def execute(sql, args=None):
    args = args or []
    body = {
        "requests": [
            {"type": "execute", "stmt": {"sql": sql, "args": [_to_arg(a) for a in args]}},
            {"type": "close"},
        ]
    }
    resp = requests.post(
        f"{TURSO_URL}/v2/pipeline",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TURSO_TOKEN}",
        },
        json=body,
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()
    result = data["results"][0]
    if result.get("type") == "error":
        raise RuntimeError(result.get("error", {}).get("message", "Turso-Fehler"))
    return result.get("response", {}).get("result", {})


def rows_to_dicts(result):
    cols = [c["name"] for c in result.get("cols", [])]
    rows = result.get("rows", [])
    out = []
    for row in rows:
        out.append({cols[i]: (row[i].get("value") if row[i] else None) for i in range(len(cols))})
    return out


def main():
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")      # Datum: nur Tag, keine Zeit
    created_at = now.strftime("%Y-%m-%dT%H:%M:%S")

    existing = rows_to_dicts(
        execute(
            "SELECT LogID FROM seestrasse_log WHERE ParameterID = ? AND date(Datum) = ?",
            [PARAMETER_ID, today_str],
        )
    )
    if existing:
        print(f"Eintrag für {today_str} existiert bereits (LogID {existing[0]['LogID']}) – übersprungen, keine Duplizierung.")
        return

    execute(
        "INSERT OR IGNORE INTO seestrasse_log (Datum, ParameterID, Value, Comment, Source, CreatedAt) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        [today_str, PARAMETER_ID, VALUE, COMMENT, SOURCE, created_at],
    )
    print(f"Eintrag für {today_str} eingetragen (Datum={today_str}, CreatedAt={created_at}).")


if __name__ == "__main__":
    main()
