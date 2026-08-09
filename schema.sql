-- Seestrasse 52B – Datenmodell
-- Turso DB: munostadtadtseetstrasse52bdb

CREATE TABLE IF NOT EXISTS seestrasse_parameter (
  ParameterID INTEGER PRIMARY KEY AUTOINCREMENT,
  Name        TEXT NOT NULL UNIQUE,
  Einheit     TEXT,
  Active      INTEGER NOT NULL DEFAULT 1  -- 1 = aktiv, 0 = inaktiv
);

CREATE TABLE IF NOT EXISTS seestrasse_log (
  LogID       INTEGER PRIMARY KEY AUTOINCREMENT,
  Datum       TEXT NOT NULL,              -- ISO 8601 "YYYY-MM-DDTHH:MM:SS" (Anzeige immer DD.MM.YYYY HH:MM:SS)
  ParameterID INTEGER NOT NULL REFERENCES seestrasse_parameter(ParameterID),
  Value       REAL,
  Comment     TEXT,
  Source      TEXT,
  CreatedAt   TEXT NOT NULL               -- ISO 8601, beim Insert client-seitig gesetzt
);

CREATE INDEX IF NOT EXISTS idx_seestrasse_log_param_datum ON seestrasse_log(ParameterID, Datum);
CREATE INDEX IF NOT EXISTS idx_seestrasse_log_datum ON seestrasse_log(Datum);
