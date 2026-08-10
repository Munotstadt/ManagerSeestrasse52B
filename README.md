# ManagerSeestrasse52B

Statische GitHub-Pages-App zur Erfassung von Messwerten/Parametern für Seestrasse 52B.
Turso DB: `munostadtadtseetstrasse52bdb` (Bearer-Token, clientseitig via `/v2/pipeline` — gleiches Muster wie `securitydashboard`).

## Setup

1. Repo `ManagerSeestrasse52B` erstellen, alle Dateien pushen, GitHub Pages aktivieren.
2. Schema in der Turso-DB anlegen: `schema.sql` (z.B. via Turso CLI, Drizzle Studio Codespace, oder `run-sql.yml`-Workflow).
3. Seite öffnen → `config.html` → Turso HTTP URL + Auth Token eintragen (wird nur in `localStorage` gespeichert, unter dem app-spezifischen Key `munotstadt_seestrasse52b_turso_cfg` — nicht generisch, da alle Munotstadt-Tools unter `munotstadt.github.io` dieselbe Origin teilen).

## Seiten

| Datei | Zweck |
|---|---|
| `config.html` | Turso-Verbindung konfigurieren/testen |
| `index.html` | Übersicht: aktive Parameter + letzter Wert |
| `log.html` | Log: neue Einträge erfassen, suchen, bearbeiten, löschen |
| `admin.html` | Parameter definieren (Name, Einheit, Aktiv/Inaktiv) |
| `parameter.html?id=X` | Chart (SVG, touch-fähig) + Log für einen Parameter |

## Datenmodell

- `seestrasse_parameter` (ParameterID, Name, Einheit, Active)
- `seestrasse_log` (LogID, Datum, ParameterID → FK, Value, Comment, Source, CreatedAt)

Datum wird in der DB als ISO 8601 (`YYYY-MM-DDTHH:MM:SS`, sortierbar) gespeichert und überall als
`DD.MM.YYYY HH:MM:SS` angezeigt.

## Offene Punkte / mögliche Erweiterungen

- CSV-Export im Log
- Datumsbereich-Filter im Log (aktuell nur Text-/Parameter-Filter, letzte 500 Einträge)
- GitHub Actions Cron für automatisierte Collector-Läufe, falls Werte extern erfasst werden sollen
