/* Seestrasse 52B – Turso HTTP Client + Helpers
   Muster: gleiche Turso-HTTP-Pipeline-Anbindung wie securitydashboard.
   Config liegt clientseitig in localStorage unter einem app-spezifischen Key (siehe CFG_KEY), damit sich mehrere Munotstadt-Tools unter derselben github.io-Domain nicht gegenseitig überschreiben. */

const CFG_KEY = 'munotstadt_seestrasse52b_turso_cfg';

function getCfg(){
  try{
    const raw = localStorage.getItem(CFG_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}

function setCfg(url, token){
  localStorage.setItem(CFG_KEY, JSON.stringify({ url, token }));
}

function requireCfg(){
  const cfg = getCfg();
  if(!cfg || !cfg.url || !cfg.token){
    window.location.href = 'admin.html';
    throw new Error('Turso nicht konfiguriert');
  }
  return cfg;
}

class TursoClient{
  constructor(url, token){
    this.url = url.replace(/\/$/, '');
    this.token = token;
  }

  _arg(v){
    if(v === null || v === undefined) return { type:'null' };
    if(typeof v === 'number') return Number.isInteger(v) ? { type:'integer', value:String(v) } : { type:'float', value:v };
    if(typeof v === 'boolean') return { type:'integer', value: v ? '1' : '0' };
    return { type:'text', value:String(v) };
  }

  async execute(sql, args = []){
    const body = {
      requests: [
        { type:'execute', stmt:{ sql, args: args.map(a => this._arg(a)) } },
        { type:'close' }
      ]
    };
    const res = await fetch(`${this.url}/v2/pipeline`, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':`Bearer ${this.token}`
      },
      body: JSON.stringify(body)
    });
    if(!res.ok){
      throw new Error(`Turso HTTP ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    const result = data.results?.[0];
    if(result?.type === 'error'){
      throw new Error(result.error?.message || 'Turso-Fehler');
    }
    return result?.response?.result;
  }

  static rowsToObjects(result){
    if(!result || !result.rows) return [];
    const cols = result.cols.map(c => c.name);
    return result.rows.map(row => {
      const obj = {};
      row.forEach((cell, i) => { obj[cols[i]] = cell.value === undefined ? null : cell.value; });
      return obj;
    });
  }
}

function getClient(){
  const cfg = requireCfg();
  return new TursoClient(cfg.url, cfg.token);
}

/* ---- Read-Cache (sessionStorage, 60-Min TTL, Write-Invalidation) ----
   Schont die Turso-Row-Read-Quote: identische Leseabfragen innerhalb
   einer Tab-Session werden nicht erneut gegen die DB ausgeführt.
   Prefix ist app-spezifisch, damit sich mehrere Munotstadt-Tools unter
   derselben github.io-Domain nicht gegenseitig überschreiben. */

const CACHE_PREFIX = 'munotstadt_seestrasse52b_cache_';
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 Minuten

function cacheGet(key){
  try{
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    if(Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.data;
  }catch(e){ return null; }
}

function cacheSet(key, data){
  try{
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
  }catch(e){ /* z.B. Storage voll – Cache ist best-effort, kein Fehlerabbruch */ }
}

// Löscht alle Cache-Einträge, deren Key mit dem gegebenen Präfix beginnt.
// Nach jedem INSERT/UPDATE/DELETE für die betroffene(n) Tabelle(n) aufrufen.
function cacheInvalidate(keyPrefix){
  try{
    const toRemove = [];
    for(let i = 0; i < sessionStorage.length; i++){
      const k = sessionStorage.key(i);
      if(k && k.startsWith(CACHE_PREFIX + keyPrefix)) toRemove.push(k);
    }
    toRemove.forEach(k => sessionStorage.removeItem(k));
  }catch(e){ /* best effort */ }
}

// Cached SELECT: liefert Objekte (nicht das rohe Turso-Result).
// cacheKey sollte die Query eindeutig identifizieren, z.B. 'seestrasse_parameter:generic'.
async function queryCached(client, cacheKey, sql, args = []){
  const cached = cacheGet(cacheKey);
  if(cached !== null) return cached;
  const result = await client.execute(sql, args);
  const rows = TursoClient.rowsToObjects(result);
  cacheSet(cacheKey, rows);
  return rows;
}

/* ---- Datum/Zeit Helpers ----
   Speicherung in DB: ISO 8601 "YYYY-MM-DDTHH:MM:SS" (sortierbar).
   Anzeige: immer DD.MM.YYYY HH:MM:SS bzw. DD.MM.YYYY. */

function fmtDateTime(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(isNaN(d)) return iso;
  const p = n => String(n).padStart(2,'0');
  return `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function fmtDate(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(isNaN(d)) return iso;
  const p = n => String(n).padStart(2,'0');
  return `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()}`;
}

function nowISO(){
  const d = new Date();
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// datetime-local Input <-> ISO (Sekunden ergänzen/entfernen)
function localInputToISO(val){
  if(!val) return null;
  return val.length === 16 ? `${val}:00` : val;
}
function isoToLocalInput(iso){
  if(!iso) return '';
  return iso.slice(0,16);
}

function escapeHtml(s){
  if(s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function showMsg(el, text, type){
  el.textContent = text;
  el.className = 'msg ' + (type === 'ok' ? 'ok' : 'err');
  el.style.display = 'block';
}
