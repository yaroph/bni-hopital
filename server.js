/*
 Docteur GENIUSTER IA — server
 - Serves static files from /public
 - Serves data JS files from /DATA under the URL path /data
 - Persists "store" (custom patients + extra meta + interventions) into /DATA/store.json

 Run:
 npm install
 npm start
*/

const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const express = require('express');

const app = express();

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'DATA');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const PHOTO_DIR = path.join(DATA_DIR, 'photo');

app.disable('x-powered-by');
// JSON plus large car les photos peuvent être envoyées en base64 (data URL)
app.use(express.json({ limit: '12mb' }));

// --- Helpers ---
async function ensureDataDir() {
 await fsp.mkdir(DATA_DIR, { recursive: true });
}

async function ensurePhotoDir() {
 await ensureDataDir();
 await fsp.mkdir(PHOTO_DIR, { recursive: true });
}

function safePhotoBase(id) {
 // évite les caractères spéciaux (ex: "custom:...") et toute traversée de chemin
 return String(id || 'patient')
 .replace(/[^a-zA-Z0-9_-]/g, '_')
 .slice(0, 120) || 'patient';
}

function extFromMime(mime) {
 const m = String(mime || '').toLowerCase();
 if (m === 'image/png') return '.png';
 if (m === 'image/jpeg' || m === 'image/jpg') return '.jpg';
 if (m === 'image/webp') return '.webp';
 return null;
}

async function deleteExistingPhotos(base) {
 const exts = ['.png', '.jpg', '.jpeg', '.webp'];
 for (const ext of exts) {
 const p = path.join(PHOTO_DIR, base + ext);
 try { await fsp.unlink(p); } catch (_) { /* ignore */ }
 }
}

async function readJsonFile(filepath, fallback) {
 try {
 const raw = await fsp.readFile(filepath, 'utf8');
 return JSON.parse(raw);
 } catch (e) {
 return fallback;
 }
}

async function backupFile(filepath){
 try{
 await fsp.access(filepath);
 }catch(_){
 return;
 }
 const dir = path.join(path.dirname(filepath), 'backups');
 try{ await fsp.mkdir(dir, { recursive: true }); }catch(_){}
 const base = path.basename(filepath);
 const stamp = new Date().toISOString().replace(/[:.]/g, '-');
 const dest = path.join(dir, `${base}.${stamp}.bak`);
 try{ await fsp.copyFile(filepath, dest); }catch(_){}
 // Keep only the most recent backups per file
 try{
 const files = await fsp.readdir(dir);
 const mine = files
 .filter(f => f.startsWith(base + ".") && f.endsWith(".bak"))
 .sort(); // ISO-ish stamp => lexicographic order
 const MAX = 20;
 if(mine.length > MAX){
 const del = mine.slice(0, mine.length - MAX);
 await Promise.all(del.map(f => fsp.unlink(path.join(dir, f)).catch(() => {})));
 }
 }catch(_){}
}

async function writeJsonAtomic(filepath, obj) {
 await backupFile(filepath);
 const tmp = filepath + '.' + process.pid + '.' + Date.now() + '.tmp';
 const content = JSON.stringify(obj, null, 2);
 await fsp.writeFile(tmp, content, 'utf8');
 await fsp.rename(tmp, filepath);
}

function sanitizeStore(input) {
 const store = (input && typeof input === 'object') ? input : {};
 const extra = (store.extra && typeof store.extra === 'object' && !Array.isArray(store.extra)) ? store.extra : {};
 const customPatients = Array.isArray(store.customPatients)
 ? store.customPatients.filter(p => p && typeof p === 'object' && p.id && p.name)
 : [];

 // keep only known safe fields for custom patients
 const safeCustom = customPatients.map(p => ({
 id: String(p.id),
 name: String(p.name),
 answers: (p.answers && typeof p.answers === 'object') ? p.answers : {},
 derived: (p.derived && typeof p.derived === 'object') ? p.derived : {}
 }));

 // extra: per patient id object
 const safeExtra = {};
 for (const [pid, val] of Object.entries(extra)) {
 if (!pid) continue;
 if (!val || typeof val !== 'object') continue;
 const o = { ...val };

 // interventions should be an array of {ts,text,account}
 if (Array.isArray(o.interventions)) {
 o.interventions = o.interventions
 .filter(x => x && typeof x === 'object' && x.text)
 .map(x => ({
 ts: String(x.ts || ''),
 text: String(x.text || ''),
 account: x.account == null ? null : String(x.account)
 }));
 }

 // common fields used in app.js
 if (o.displayName != null) o.displayName = String(o.displayName);
 if (o.phone != null) o.phone = String(o.phone);

 safeExtra[String(pid)] = o;
 }

 return {
 extra: safeExtra,
 customPatients: safeCustom,
 updatedAt: new Date().toISOString()
 };
}


function sanitizeComptes(input){
 const arr = Array.isArray(input) ? input : [];
 return arr
 .map(c => ({
 name: c && c.name != null ? String(c.name) : "",
 password: c && c.password != null ? String(c.password) : "",
 blocked: !!(c && c.blocked)
 }))
 .filter(c => c.name && c.password);
}

function sanitizePatients(input){
 const arr = Array.isArray(input) ? input : [];
 // Keep the shape but normalize the minimal identifiers to strings when present
 return arr.map(p => {
 const o = (p && typeof p === "object") ? { ...p } : {};
 if(o.id != null) o.id = String(o.id);
 if(o.name != null) o.name = String(o.name);
 return o;
 });
}

async function readStore() {
 await ensureDataDir();
 const def = { extra: {}, customPatients: [], updatedAt: new Date().toISOString() };
 const store = await readJsonFile(STORE_PATH, def);
 return sanitizeStore(store);
}

async function writeStore(store) {
 await ensureDataDir();
 await writeJsonAtomic(STORE_PATH, sanitizeStore(store));
}

// Parses a file like "window.COMPTES = [ ... ];" and returns the JSON array.
async function parseWindowArrayFromJs(filePath, varName) {
 const raw = await fsp.readFile(filePath, 'utf8');
 const re = new RegExp(`window\\.${varName}\\s*=\\s*([\\s\\S]*?);\\s*$`, 'm');
 const m = raw.match(re);
 if (!m) throw new Error(`Unable to find window.${varName} in ${path.basename(filePath)}`);
 const rhs = m[1].trim();
 // rhs should be JSON-ish (arrays/objects). We only accept JSON by trying JSON.parse.
 // Many of the files are valid JSON syntax already.
 return JSON.parse(rhs);
}

async function writeWindowArrayToJs(filePath, varName, arr, headerComment = '') {
 const body = `window.${varName} = ${JSON.stringify(arr, null, 2)};\n`;
 const out = (headerComment ? headerComment + "\n" : '') + body;
 await fsp.writeFile(filePath, out, 'utf8');
}

// --- Static ---
app.use('/data', express.static(DATA_DIR, { extensions: ['js', 'json'] }));
// Photos de profil patients (DATA/photo)
app.use('/photo', express.static(PHOTO_DIR, {
 fallthrough: true,
 maxAge: 0,
 etag: true,
}));
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// --- API ---
app.get('/api/health', (req, res) => {
 res.json({ ok: true, time: new Date().toISOString() });
});

app.get('/api/store', async (req, res) => {
 try {
 const store = await readStore();
 res.json(store);
 } catch (e) {
 res.status(500).json({ error: 'failed_to_read_store' });
 }
});

app.put('/api/store', async (req, res) => {
 try {
 await writeStore(req.body);
 const store = await readStore();
 res.json(store);
 } catch (e) {
 res.status(400).json({ error: 'failed_to_write_store' });
 }
});

// --- Photo patient ---
// Attendu: { dataUrl: "data:image/png;base64,..." }
app.put('/api/patient/:id/photo', async (req, res) => {
 try {
 const patientId = String(req.params.id || '').trim();
 if (!patientId) return res.status(400).json({ error: 'missing_patient_id' });

 const dataUrl = String(req.body?.dataUrl || '');
 const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
 if (!m) return res.status(400).json({ error: 'invalid_data_url' });

 const mime = m[1];
 const b64 = m[2];
 const ext = extFromMime(mime);
 if (!ext) return res.status(400).json({ error: 'unsupported_image_type' });

 const buf = Buffer.from(b64, 'base64');
 // garde-fou (≈ 6MB)
 if (buf.length > 6 * 1024 * 1024) return res.status(413).json({ error: 'image_too_large' });

 await ensurePhotoDir();
 const base = safePhotoBase(patientId);
 await deleteExistingPhotos(base);

 const filename = base + ext;
 const outPath = path.join(PHOTO_DIR, filename);
 await fsp.writeFile(outPath, buf);

 res.json({ ok: true, filename, url: `/photo/${filename}` });
 } catch (e) {
 res.status(500).json({ error: 'failed_to_save_photo' });
 }
});

// Admin APIs for database.html
const USERS_JSON = path.join(DATA_DIR, 'users.json');
const COMPTES_JSON = path.join(DATA_DIR, 'comptes.json');


// --- Migration (users.json -> store.json) ---
// users.json contient uniquement les valeurs par défaut. Le site ne doit plus le lire comme source de vérité.
// Cette route copie/merge les patients de users.json dans store.json (STORE.customPatients).
app.post('/api/migrate/users-to-store', async (req, res) => {
 try {
 const arr = sanitizePatients(await readJsonFile(USERS_JSON, []));
 const incoming = Array.isArray(arr) ? arr : [];

 const store = await readStore();
 const before = Array.isArray(store.customPatients) ? store.customPatients : [];
 const seen = new Set(before.map(p => String(p?.id || '')));

 let imported = 0;
 let skipped = 0;

 for (const p of incoming) {
 if (!p || typeof p !== 'object') { skipped++; continue; }
 const id = String(p.id || '').trim();
 const name = String(p.name || '').trim();
 if (!id || !name) { skipped++; continue; }
 if (seen.has(id)) { skipped++; continue; }

 store.customPatients.push({
 id,
 name,
 answers: (p.answers && typeof p.answers === 'object') ? p.answers : {},
 derived: (p.derived && typeof p.derived === 'object') ? p.derived : {}
 });
 seen.add(id);
 imported++;
 }

 await writeStore(store);
 const out = await readStore();
 res.json({
 ok: true,
 imported,
 skipped,
 totalBefore: before.length,
 totalAfter: out.customPatients.length,
 store: out
 });
 } catch (e) {
 res.status(500).json({ error: 'failed_to_migrate_users_to_store' });
 }
});

app.get('/api/data/users', async (req, res) => {
 try {
 const arr = sanitizePatients(await readJsonFile(USERS_JSON, []));
 res.json({ patients: Array.isArray(arr) ? arr : [] });
 } catch (e) {
 res.status(500).json({ error: 'failed_to_read_users' });
 }
});

app.put('/api/data/users', async (req, res) => {
 try {
 const patients = Array.isArray(req.body?.patients) ? req.body.patients : [];
 const clean = sanitizePatients(patients);
 await writeJsonAtomic(USERS_JSON, clean);
 res.json({ ok: true, patients: clean });
 } catch (e) {
 res.status(400).json({ error: 'failed_to_write_users' });
 }
});

app.get('/api/data/comptes', async (req, res) => {
 try {
 const arr = sanitizeComptes(await readJsonFile(COMPTES_JSON, []));
 res.json({ comptes: Array.isArray(arr) ? arr : [] });
 } catch (e) {
 res.status(500).json({ error: 'failed_to_read_comptes' });
 }
});

app.put('/api/data/comptes', async (req, res) => {
 try {
 const comptes = Array.isArray(req.body?.comptes) ? req.body.comptes : [];
 const clean = sanitizeComptes(comptes);
 await writeJsonAtomic(COMPTES_JSON, clean);
 res.json({ ok: true, comptes: clean });
 } catch (e) {
 res.status(400).json({ error: 'failed_to_write_comptes' });
 }
});

// SPA-ish fallback (so refreshing /database.html still works because static handles it)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
 console.log(`Server running on http://localhost:${PORT}`);
});
