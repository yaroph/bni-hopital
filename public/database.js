/* DATABASE — Admin page logic (File System Access + exports)
 Note: Pas de sécurité (page perso). */

const $ = (sel) => document.querySelector(sel);

const state = {
 comptes: [],
 patients: [],
 store: { extra:{}, customPatients:[], updatedAt:null },
 selectedAccountIndex: null,
 selectedPatientIndex: null,
 patientJsonOriginal: "",
 patientEditMode: false,
 patientView: "data", // data | interventions
 rootHandle: null,
 dataHandle: null,
 patientFormOriginalObj: null,
 patientExtraOriginalObj: null,
};

// --- Autosave (serveur) ---
// Avant : l'admin devait cliquer sur “Écrire”.
// Maintenant : toute création/modification/suppression tente de persister via l'API.
// Si le serveur n'est pas joignable, on reste en mode export.

let _savingComptes = false;
let _dirtyComptes = false;
let _saveComptesTimer = null;

let _savingPatients = false;
let _dirtyPatients = false;
let _savePatientsTimer = null;

async function flushComptesSave(){
 if(_savingComptes){
 _dirtyComptes = true;
 return;
 }
 _savingComptes = true;
 try{
 await writeComptes();
 setFsConnected(true, "Sauvegarde serveur OK");
 }catch(e){
 console.warn(e);
 setFsConnected(false, "Serveur non joignable (mode export)");
 toast("⚠️ Sauvegarde impossible. Lancez le serveur ou exportez.");
 }finally{
 _savingComptes = false;
 if(_dirtyComptes){
 _dirtyComptes = false;
 flushComptesSave();
 }
 }
}

function scheduleComptesSave(){
 try{ clearTimeout(_saveComptesTimer); }catch(_){/* ignore */}
 _saveComptesTimer = setTimeout(() => { flushComptesSave(); }, 250);
}

async function flushPatientsSave(){
 if(_savingPatients){
 _dirtyPatients = true;
 return;
 }
 _savingPatients = true;
 try{
 // Source de vérité : store.json (serveur)
 state.store = state.store || { extra:{}, customPatients:[], updatedAt:null };
 state.store.customPatients = Array.isArray(state.patients) ? state.patients : [];
 await writeStore();

 // resynchronise après sanitation serveur
 state.store.extra = (state.store.extra && typeof state.store.extra === "object" && !Array.isArray(state.store.extra)) ? state.store.extra : {};
 state.store.customPatients = normalizePatients(state.store.customPatients);
 state.patients = state.store.customPatients;

 setFsConnected(true, "Sauvegarde serveur OK");
 }catch(e){
 console.warn(e);
 setFsConnected(false, "Serveur non joignable (mode export)");
 toast("⚠️ Sauvegarde impossible. Lancez le serveur ou exportez.");
 }finally{
 _savingPatients = false;
 if(_dirtyPatients){
 _dirtyPatients = false;
 flushPatientsSave();
 }
 }
}

function schedulePatientsSave(){
 try{ clearTimeout(_savePatientsTimer); }catch(_){/* ignore */}
 _savePatientsTimer = setTimeout(() => { flushPatientsSave(); }, 300);
}

// Photo de profil (stockée dans /DATA/store.json -> extra[patientId].profilePhoto)
const PROFILE_PHOTO_KEY = "profilePhoto";

function photoUrlFromFilename(filename){
 if(!filename) return "";
 return `/photo/${encodeURIComponent(String(filename))}?t=${Date.now()}`;
}

function displayNameForPatientId(pid){
 const ex = state.store?.extra?.[pid] || {};
 const dn = (ex.displayName && String(ex.displayName).trim()) ? String(ex.displayName).trim() : "";
 if(dn) return dn;
 const p = state.patients.find(x => String(x?.id || "") === String(pid));
 return p?.name ? String(p.name) : String(pid || "");
}

function getPatientPhotoFilename(pid){
 const v = state.store?.extra?.[pid]?.[PROFILE_PHOTO_KEY];
 if(!v) return "";
 const s = String(v).trim();
 if(!s) return "";
 if(s.toUpperCase() === "N/A") return "";
 return s;
}

function renderPatientPhotoBox(pid){
 const box = $("#patientPhotoBox");
 if(!box) return;
 box.innerHTML = "";

 if(!pid){
 box.style.display = "none";
 return;
 }
 box.style.display = "";

 const name = displayNameForPatientId(pid);
 const filename = getPatientPhotoFilename(pid);

 const meta = document.createElement("div");
 meta.className = "patientPhotoMeta";

 const title = document.createElement("div");
 title.className = "patientPhotoTitle";
 title.textContent = "PHOTO DE PROFIL";

 const sub = document.createElement("div");
 sub.className = "patientPhotoSub";
 sub.textContent = filename ? `${name} — ${filename}` : `${name} — (aucune photo)`;

 meta.appendChild(title);
 meta.appendChild(sub);

 // Actions : ajouter/changer une photo depuis le PC (upload vers le serveur)
 const actions = document.createElement("div");
 actions.className = "patientPhotoActions";

 const uploadBtn = document.createElement("button");
 uploadBtn.className = "btn mini";
 uploadBtn.textContent = filename ? "Changer" : "Ajouter";

 const fileInput = document.createElement("input");
 fileInput.type = "file";
 fileInput.accept = "image/*";
 fileInput.className = "patientPhotoInput";
 fileInput.style.display = "none";

 uploadBtn.addEventListener("click", () => {
  // Demande le fichier directement sur le PC de l'utilisateur
  fileInput.value = "";
  fileInput.click();
 });

 fileInput.addEventListener("change", async () => {
  const file = fileInput.files && fileInput.files[0];
  if(!file) return;

  // garde-fou : le serveur refuse > ~6MB
  if(file.size > 6 * 1024 * 1024){
   toast("⚠️ Image trop lourde (max ~6MB).");
   return;
  }

  try{
   const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read_failed"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
   });

   if(!dataUrl || !String(dataUrl).startsWith("data:image/")){
    toast("⚠️ Fichier invalide (image attendue).");
    return;
   }

   const res = await fetch(`/api/patient/${encodeURIComponent(String(pid))}/photo`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl })
   });
   if(!res.ok){
    let msg = "⚠️ Impossible d'envoyer la photo.";
    try{
     const j = await res.json();
     if(j && j.error) msg += ` (${j.error})`;
    }catch(_){/* ignore */}
    throw new Error(msg);
   }
   const out = await res.json();
   const newFilename = String(out?.filename || "").trim();
   if(!newFilename) throw new Error("missing_filename");

   // Mémorise dans store.extra[patientId].profilePhoto, puis persiste store.json
   state.store = state.store || { extra:{}, customPatients:[], updatedAt:null };
   state.store.extra = (state.store.extra && typeof state.store.extra === "object" && !Array.isArray(state.store.extra)) ? state.store.extra : {};
   state.store.extra[String(pid)] = (state.store.extra[String(pid)] && typeof state.store.extra[String(pid)] === "object" && !Array.isArray(state.store.extra[String(pid)])) ? state.store.extra[String(pid)] : {};
   state.store.extra[String(pid)][PROFILE_PHOTO_KEY] = newFilename;

   renderPatientPhotoBox(String(pid));
   toast("Photo enregistrée.");
   schedulePatientsSave();
  }catch(e){
   console.warn(e);
   toast(typeof e?.message === "string" ? e.message : "⚠️ Impossible d'envoyer la photo (serveur non joignable)." );
  }
 });

 actions.appendChild(uploadBtn);
 actions.appendChild(fileInput);
 meta.appendChild(actions);

 const thumbWrap = document.createElement("div");
 if(filename){
 const img = document.createElement("img");
 img.className = "patientPhotoThumb";
 img.alt = "Photo de profil";
 img.src = photoUrlFromFilename(filename);
 img.title = "Cliquer pour zoomer";
 img.addEventListener("click", () => openImageZoom(photoUrlFromFilename(filename), name));
 thumbWrap.appendChild(img);
 }else{
 const ph = document.createElement("div");
 ph.className = "patientPhotoPlaceholder";
 ph.textContent = "N/A";
 thumbWrap.appendChild(ph);
 }

 box.appendChild(meta);
 box.appendChild(thumbWrap);
}

function openImageZoom(src, titleText){
 const overlay = document.createElement("div");
 overlay.className = "portfolioOverlay";
 overlay.tabIndex = -1;

 const modal = document.createElement("div");
 modal.className = "portfolioModal";
 modal.style.maxWidth = "780px";

 const head = document.createElement("div");
 head.className = "portfolioHead";

 const t = document.createElement("div");
 t.className = "portfolioTitle";
 t.textContent = titleText || "Photo";

 const close = document.createElement("button");
 close.className = "btn mini";
 close.textContent = "Fermer";
 close.addEventListener("click", () => overlay.remove());

 head.appendChild(t);
 head.appendChild(close);

 const body = document.createElement("div");
 body.style.padding = "14px";
 body.style.overflow = "auto";

 const img = document.createElement("img");
 img.src = src;
 img.alt = titleText || "Photo";
 img.style.width = "100%";
 img.style.maxHeight = "70vh";
 img.style.objectFit = "contain";
 img.style.borderRadius = "18px";
 img.style.border = "1px solid rgba(255,255,255,0.12)";
 body.appendChild(img);

 modal.appendChild(head);
 modal.appendChild(body);
 overlay.appendChild(modal);
 document.body.appendChild(overlay);

 overlay.addEventListener("click", (e) => {
 if(e.target === overlay) overlay.remove();
 });
}

function openPortfolioModal(){
 // compile list from store.extra (only those with a photo)
 const items = [];
 const extra = state.store?.extra || {};
 for(const [pid, ex] of Object.entries(extra)){
 const filename = (ex && typeof ex === "object") ? String(ex[PROFILE_PHOTO_KEY] || "") : "";
 if(!filename) continue;
 if(String(filename).trim().toUpperCase() === "N/A") continue;
 const name = displayNameForPatientId(pid);
 items.push({ pid, name, filename: String(filename).trim() });
 }
 items.sort((a,b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));

 const overlay = document.createElement("div");
 overlay.className = "portfolioOverlay";
 overlay.tabIndex = -1;

 const modal = document.createElement("div");
 modal.className = "portfolioModal";

 const head = document.createElement("div");
 head.className = "portfolioHead";
 const title = document.createElement("div");
 title.className = "portfolioTitle";
 title.textContent = `PORTFOLIO — ${items.length} photo(s)`;

 const close = document.createElement("button");
 close.className = "btn mini";
 close.textContent = "Fermer";
 close.addEventListener("click", () => overlay.remove());

 head.appendChild(title);
 head.appendChild(close);

 const grid = document.createElement("div");
 grid.className = "portfolioGrid";

 if(items.length === 0){
 const empty = document.createElement("div");
 empty.style.color = "rgba(255,255,255,0.72)";
 empty.style.fontSize = "13px";
 empty.textContent = "Aucune photo enregistrée.";
 grid.appendChild(empty);
 }else{
 for(const it of items){
 const card = document.createElement("div");
 card.className = "portfolioCard";

 const img = document.createElement("img");
 img.className = "portfolioImg";
 img.alt = it.name;
 img.src = photoUrlFromFilename(it.filename);
 img.addEventListener("click", () => openImageZoom(photoUrlFromFilename(it.filename), it.name));

 const name = document.createElement("div");
 name.className = "portfolioName";
 name.textContent = it.name;

 card.appendChild(img);
 card.appendChild(name);
 grid.appendChild(card);
 }
 }

 modal.appendChild(head);
 modal.appendChild(grid);
 overlay.appendChild(modal);
 document.body.appendChild(overlay);

 overlay.addEventListener("click", (e) => {
 if(e.target === overlay) overlay.remove();
 });
}

// Bot presets (pour réutiliser les choix/labels du chatbot)
const BOT = window.BOT_PRESETS || null;
const QUESTION_BANK = BOT?.QUESTION_BANK || {};
const FIELD_LABELS = BOT?.FIELD_LABELS || {};
const EXTRA_FIELDS = Array.isArray(BOT?.EXTRA_FIELDS) ? BOT.EXTRA_FIELDS.slice() : [];

// Problèmes de santé (mêmes choix que le chatbot)
const HEALTH_PROBLEMS_CHOICES = [
 "NON",
 "Cancer",
 "Handicap moteur",
 "Immunodépressive",
 "Greffe",
 "Handicap mental",
 "Maladie Sexuel",
 "Maladie genetique non transmissible",
 "Maladie genetique héréditaire",
 "Signe de vieillesse (Ostéo / Cataracte ...)",
 "Autre",
 "N/A"
];

function normalizeHealthProblemsKey(raw){
 const s0 = String(raw ?? "").trim();
 if(!s0) return "";
 const s = s0.toLowerCase();
 if(s === "n/a" || s === "na" || s === "n-a") return "N/A";
 if(s.includes("non") || s.includes("aucun")) return "NON";
 if(s.includes("cancer")) return "Cancer";
 if(s.includes("immun")) return "Immunodépressive";
 if(s.includes("greff")) return "Greffe";
 if(s.includes("handicap") && s.includes("mote")) return "Handicap moteur";
 if(s.includes("handicap") && s.includes("mental")) return "Handicap mental";
 if(s.includes("sex")) return "Maladie Sexuel";
 if(s.includes("genet") && (s.includes("hered") || s.includes("héré"))) return "Maladie genetique héréditaire";
 if(s.includes("genet")) return "Maladie genetique non transmissible";
 if(s.includes("vieill") || s.includes("viell") || s.includes("osteo") || s.includes("ostéo") || s.includes("catar")) return "Signe de vieillesse (Ostéo / Cataracte ...)";
 if(s.includes("autre")) return "Autre";
 const found = HEALTH_PROBLEMS_CHOICES.find(v => String(v).toLowerCase() === s);
 return found || "Autre";
}

function alcoholFreqToScore(v){
 const s = String(v || "").toLowerCase();
 if(!s) return null;
 if(s.includes("jamais")) return 0.0;
 if(s.includes("1 fois")) return 0.25;
 if(s.includes("2") && (s.includes("4") || s.includes("à") || s.includes("a"))) return 0.45;
 if(s.includes("2") && s.includes("3") && s.includes("jour")) return 0.75;
 if(s.includes("au moins") || (s.includes("4") && s.includes("jour"))) return 1.0;
 return 0.35;
}

function drugsToScore(v){
 const s = String(v || "").toLowerCase();
 if(!s) return null;
 if(s.includes("non")) return 0.0;
 if(s.includes("soir")) return 0.4;
 if(s.includes("rég") || s.includes("reg")) return 0.8;
 return 0.5;
}

function derivePatient(patient){
 const a = (patient && patient.answers) ? patient.answers : {};
 const happinessN = Number(String(a.happiness ?? "").replace(/[^0-9]/g, ""));
 const happiness = Number.isFinite(happinessN) ? happinessN : null;

 const socialN = Number(String(a.socialScoreRaw ?? "").replace(/[^0-9]/g, ""));
 const socialScore = Number.isFinite(socialN) ? socialN : null;

 const alcoholFreqScore = alcoholFreqToScore(a.alcoholFreq);
 const drugsScore = drugsToScore(a.drugs);

 patient.derived = {
 ...(patient.derived || {}),
 ...(happiness != null ? { happiness } : {}),
 ...(socialScore != null ? { socialScore } : {}),
 ...(alcoholFreqScore != null ? { alcoholFreqScore } : {}),
 ...(drugsScore != null ? { drugsScore } : {})
 };
 return patient;
}


// --- Valeur effective d'un champ (même logique que le chatbot) ---
// 1) Si l'admin a renseigné une valeur dans store.extra[patientId][field], on l'affiche en priorité.
// 2) Sinon on retombe sur les valeurs du patient (answers/derived).
function getEffectiveFieldValue(patient, extra, field){
 const e = extra ? extra[field] : null;
 if(e != null && String(e).trim() !== "") return e;

 const a = (patient && patient.answers) ? patient.answers : {};
 const d = (patient && patient.derived) ? patient.derived : {};

 switch(field){
  case "alcoholFreq": return (a.alcoholFreq ?? null);
  case "drugs": return (a.drugs ?? null);
  case "socialScore": return (d.socialScore ?? (a.socialScoreRaw ?? null));
  case "happiness": return (d.happiness ?? (a.happiness ?? null));
  case "healthProblems": return (a.healthProblems ?? null);
  case "operation": return (a.operation ?? null);
  default: return null;
 }
}

function toast(msg){
 // Simple, visible: use title + status
 const el = $("#fsStatus");
 if(!el) return;
 el.textContent = msg;
}

function setFsConnected(ok, label){
 const dot = $("#fsDot");
 const st = $("#fsStatus");
 if(dot) dot.classList.toggle("ok", !!ok);
 if(st) st.textContent = label || (ok ? "Connecté" : "Non connecté (mode export)");
 $("#writeComptesBtn").disabled = !ok;
 $("#writePatientsBtn").disabled = !ok;
}

function normalizeComptes(arr){
 const list = Array.isArray(arr) ? arr : [];
 return list
 .filter(x => x && x.name && x.password)
 .map(x => ({
 name: String(x.name),
 password: String(x.password),
 blocked: !!x.blocked,
 }));
}

function normalizePatients(arr){
 return Array.isArray(arr) ? arr : [];
}

function buildComptesJson(comptes){
 return JSON.stringify(normalizeComptes(comptes), null, 2) + "\n";
}

function buildUsersJs(patients, pretty){
 const json = JSON.stringify(patients, null, pretty ? 2 : 0);
 return "window.PATIENTS=" + json + ";\n";
}

function deepClone(obj){
 return obj ? JSON.parse(JSON.stringify(obj)) : obj;
}

function isRawMode(){
 // Checkbox renommée "Format Brute" (même id conservé)
 return !!($("#prettyUsers") && $("#prettyUsers").checked);
}

function syncPatientModeUI(){
 const tab = $("#tab-patients");
 if(tab) tab.classList.toggle("raw-mode", isRawMode());
}

function syncPatientViewUI(){
 const tab = $("#tab-patients");
 if(!tab) return;
 tab.classList.toggle("show-interventions", state.patientView === "interventions");
 const btn = $("#toggleInterventionsBtn");
 if(btn){
 btn.textContent = (state.patientView === "interventions") ? "Afficher les data" : "Afficher les interventions";
 }
}

function setFormEnabled(enabled){
 const wrap = $("#patientForm");
 if(!wrap) return;
 wrap.querySelectorAll("input,textarea,select").forEach(el => {
 if(el.dataset.readonly === "1"){
 el.disabled = true;
 }else{
 el.disabled = !enabled;
 }
 });
}

function buildSelect(options, value){
 const sel = document.createElement("select");
 sel.className = "input";
 for(const opt of options){
 const o = document.createElement("option");
 o.value = opt.value;
 o.textContent = opt.label;
 sel.appendChild(o);
 }
 sel.value = value != null ? String(value) : "";
 return sel;
}

function buildControlFromQuestionBank(field, current){
 const meta = QUESTION_BANK?.[field] || {};
 const type = meta.type || "select";

 if(field === "healthProblems"){
 const key = normalizeHealthProblemsKey(current);
 const opts = HEALTH_PROBLEMS_CHOICES.map(x => ({ label: x, value: x }));
 const sel = buildSelect([{label:"", value:""}, ...opts], key || "");
 return { el: sel, hint: (current && String(current) !== String(key)) ? `Valeur ancienne: ${String(current)}` : "" };
 }

 if(type === "select"){
 const bank = Array.isArray(meta.choices) ? meta.choices : [];
 const baseOpts = [{ label: "", value: "" }, ...bank.map(ch => ({ label: ch.label, value: ch.value }))];
 // Si une ancienne valeur ne correspond pas exactement à un choix, on l'affiche quand même
 // pour éviter une perte silencieuse.
 const cur = (current == null ? "" : String(current));
 const values = new Set(baseOpts.map(o => String(o.value)));
 const opts = (cur && !values.has(cur))
 ? [{ label: `(ancienne) ${cur}`, value: cur }, ...baseOpts]
 : baseOpts;
 const sel = buildSelect(opts, current == null ? "" : String(current));
 return { el: sel, hint: "" };
 }

 if(type === "date"){
 const inp = document.createElement("input");
 inp.type = "date";
 inp.className = "input";
 inp.value = current == null ? "" : String(current);
 if(meta.placeholder) inp.placeholder = meta.placeholder;
 return { el: inp, hint: "" };
 }

 if(type === "number"){
 const inp = document.createElement("input");
 inp.type = "number";
 inp.step = "1";
 inp.className = "input";
 inp.value = current == null ? "" : String(current);
 if(meta.placeholder) inp.placeholder = meta.placeholder;
 return { el: inp, hint: "" };
 }

 // text
 const ta = document.createElement("textarea");
 ta.className = "textarea";
 ta.rows = 2;
 ta.value = current == null ? "" : String(current);
 if(meta.placeholder) ta.placeholder = meta.placeholder;
 return { el: ta, hint: "" };
}

function makeFieldRow(labelText, control, hint){
 const wrap = document.createElement("div");
 const lab = document.createElement("label");
 lab.textContent = labelText;
 wrap.appendChild(lab);
 wrap.appendChild(control);
 if(hint){
 const h = document.createElement("div");
 h.className = "hint";
 h.textContent = hint;
 wrap.appendChild(h);
 }
 return wrap;
}

function renderPatientForm(p){
 const formEl = $("#patientForm");
 if(!formEl) return;
 formEl.innerHTML = "";

 // Toujours recalculer les dérivés pour afficher les mêmes valeurs que le chatbot
 try{ derivePatient(p); }catch(_){/* ignore */}

 const pid = String(p?.id ?? "");
 const extra = (pid && state.store?.extra && typeof state.store.extra === "object" && !Array.isArray(state.store.extra))
  ? (state.store.extra[pid] || {})
  : {};

 // Champs racine
 const idInput = document.createElement("input");
 idInput.className = "input";
 idInput.value = String(p?.id ?? "");
 idInput.dataset.path = "id";
 idInput.dataset.scope = "root";
 idInput.dataset.readonly = "1";
 idInput.disabled = true;
 formEl.appendChild(makeFieldRow("ID", idInput));

 const nameInput = document.createElement("input");
 nameInput.className = "input";
 nameInput.value = String(p?.name ?? "");
 nameInput.dataset.path = "name";
 nameInput.dataset.scope = "root";
 formEl.appendChild(makeFieldRow("Nom", nameInput));

 // Champs "dossier" identiques au chatbot (BOT.EXTRA_FIELDS)
 for(const field of EXTRA_FIELDS){
 const currentVal = getEffectiveFieldValue(p, extra, field);
 const label = FIELD_LABELS[field] || field;

 const { el, hint } = buildControlFromQuestionBank(field, currentVal);
 el.dataset.path = field;
 el.dataset.scope = "extra";

 // Harmonise les contrôles "textarea" en mode form
 if(el.tagName === "TEXTAREA") el.classList.add("input");

 formEl.appendChild(makeFieldRow(label, el, hint));
 }
}

function readPatientFormInto(p){
 const formEl = $("#patientForm");
 if(!formEl || !p) return p;

 const pid = String(p?.id ?? "");
 const ex = pid ? ensureExtraFor(pid) : null;

 const els = formEl.querySelectorAll("input,textarea,select");
 for(const el of els){
 const scope = el.dataset.scope;
 const path = el.dataset.path;
 if(!scope || !path) continue;

 if(scope === "root"){
 if(path === "name") p.name = String(el.value || "").trim();
 continue;
 }

 // scope === "extra" : on écrit dans store.extra[patientId]
 if(scope === "extra" && ex){
 let raw = (el.value == null ? "" : String(el.value)).trim();

 // vide -> null (comme dans le chatbot)
 if(raw === "") raw = "";

 if(path === "healthProblems"){
 // Canonique, comme dans le chatbot
 ex[path] = raw ? normalizeHealthProblemsKey(raw) : null;
 }else{
 ex[path] = raw ? raw : null;
 }
 }
 }

 // Garder les dérivés cohérents si le patient a été édité en JSON ailleurs
 try{ derivePatient(p); }catch(_){/* ignore */}
 return p;
}

function downloadText(filename, content, mime="text/plain;charset=utf-8"){
 const blob = new Blob([content], { type: mime });
 const a = document.createElement("a");
 a.href = URL.createObjectURL(blob);
 a.download = filename;
 document.body.appendChild(a);
 a.click();
 setTimeout(() => {
 URL.revokeObjectURL(a.href);
 a.remove();
 }, 200);
}

async function connectToSiteFolder(){
 // Sur serveur: on "connecte" en pingant l'API
 try{
 const r = await fetch("/api/health", { cache: "no-store" });
 if(!r.ok) throw new Error("health not ok");
 setFsConnected(true, "Serveur connecté (écriture activée)");
 }catch(err){
 console.warn(err);
 setFsConnected(false, "Serveur non joignable (mode export)");
 }
}

async function writeIntoData(){
 // Ancien mode (File System Access) supprimé: tout passe par l'API serveur.
 throw new Error("writeIntoData disabled; use server API");
}

function setupTabs(){
 document.querySelectorAll(".tab").forEach(btn => {
 btn.addEventListener("click", () => {
 document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
 document.querySelectorAll(".pane").forEach(p => p.classList.remove("active"));
 btn.classList.add("active");
 $("#tab-" + btn.dataset.tab).classList.add("active");
 });
 });
}

/* -------- Comptes -------- */

function renderAccountList(){
 const q = ($("#accountSearch").value || "").trim().toLowerCase();
 const listEl = $("#accountList");
 listEl.innerHTML = "";

 const comptes = state.comptes
 .map((c, i) => ({ c, i }))
 .filter(({c}) => !q || c.name.toLowerCase().includes(q));

 if(comptes.length === 0){
 const empty = document.createElement("div");
 empty.className = "item";
 empty.style.cursor = "default";
 empty.innerHTML = `<div><div class="itemTitle">Aucun compte</div><div class="itemSub">Créez-en un avec “Nouveau”.</div></div>`;
 listEl.appendChild(empty);
 return;
 }

 for(const {c, i} of comptes){
 const item = document.createElement("div");
 item.className = "item" + (state.selectedAccountIndex === i ? " active" : "");
 item.innerHTML = `
 <div>
 <div class="itemTitle">${escapeHtml(c.name)}</div>
 <div class="itemSub">${c.blocked ? "Bloqué" : "Actif"}</div>
 </div>
 <div class="badges">
 <span class="badge ${c.blocked ? "blocked" : "ok"}">${c.blocked ? "BLOCK" : "OK"}</span>
 </div>
 `;
 item.addEventListener("click", () => selectAccount(i));
 listEl.appendChild(item);
 }
}

function selectAccount(index){
 state.selectedAccountIndex = index;
 const acc = state.comptes[index];
 $("#accountName").value = acc ? acc.name : "";
 $("#accountPass").value = acc ? acc.password : "";
 $("#accountBlocked").checked = !!(acc && acc.blocked);
 renderAccountList();
}

function newAccount(){
 const base = { name: "Nouveau compte", password: "changeme", blocked: false };
 state.comptes.push(base);
 selectAccount(state.comptes.length - 1);
 // Persiste la création (évite la perte au refresh)
 scheduleComptesSave();
}

function saveAccount(){
 const i = state.selectedAccountIndex;
 if(i === null) return;

 const name = ($("#accountName").value || "").trim();
 const pass = String($("#accountPass").value || "");
 const blocked = !!$("#accountBlocked").checked;

 if(!name){
 toast("Nom de compte requis.");
 return;
 }

 // unique name (except itself)
 const duplicate = state.comptes.some((c, idx) => idx !== i && c.name === name);
 if(duplicate){
 toast("Nom déjà utilisé.");
 return;
 }

 state.comptes[i] = { name, password: pass, blocked };
 renderAccountList();
 toast("Compte enregistré. Sauvegarde…");
 scheduleComptesSave();
}

function deleteAccount(){
 const i = state.selectedAccountIndex;
 if(i === null) return;
 const acc = state.comptes[i];
 if(!acc) return;

 // delete
 state.comptes.splice(i, 1);
 state.selectedAccountIndex = null;
 $("#accountName").value = "";
 $("#accountPass").value = "";
 $("#accountBlocked").checked = false;
 renderAccountList();
 toast("Compte supprimé. Sauvegarde…");
 scheduleComptesSave();
}

/* -------- Patients -------- */

function renderPatientList(){
 const q = ($("#patientSearch").value || "").trim().toLowerCase();
 const listEl = $("#patientList");
 listEl.innerHTML = "";

 let filtered = state.patients
 .map((p, i) => ({ p, i }))
 .filter(({p}) => {
 if(!q) return true;
 const id = String(p?.id ?? "").toLowerCase();
 const name = String(p?.name ?? "").toLowerCase();
 return id.includes(q) || name.includes(q);
 });

 $("#patientCount").textContent = String(filtered.length);

 // Avoid rendering thousands at once
 const MAX = 400;
 if(filtered.length > MAX){
 filtered = filtered.slice(0, MAX);
 const hint = document.createElement("div");
 hint.className = "item";
 hint.style.cursor = "default";
 hint.innerHTML = `<div><div class="itemTitle">Résultats limités à ${MAX}</div><div class="itemSub">Affinez la recherche pour voir plus.</div></div>`;
 listEl.appendChild(hint);
 }

 if(filtered.length === 0){
 const empty = document.createElement("div");
 empty.className = "item";
 empty.style.cursor = "default";
 empty.innerHTML = `<div><div class="itemTitle">Aucun patient</div><div class="itemSub">Essayez une autre recherche.</div></div>`;
 listEl.appendChild(empty);
 return;
 }

 for(const {p, i} of filtered){
 const title = String(p?.id ?? p?.name ?? `#${i}`);
 const sub = String(p?.name ?? "");
 const item = document.createElement("div");
 item.className = "item" + (state.selectedPatientIndex === i ? " active" : "");
 item.innerHTML = `
 <div>
 <div class="itemTitle">${escapeHtml(title)}</div>
 <div class="itemSub">${escapeHtml(sub)}</div>
 </div>
 <div class="badges">
 <span class="badge">${Object.keys(p||{}).length} champs</span>
 </div>
 `;
 item.addEventListener("click", () => selectPatient(i));
 listEl.appendChild(item);
 }
}

function newPatient(){
 // ID stable & unique
 const base = "patient_" + Date.now().toString(36);
 let id = base;
 const exists = new Set(state.patients.map(p => String(p?.id ?? "").toLowerCase()).filter(Boolean));
 let k = 1;
 while(exists.has(String(id).toLowerCase())){
 id = base + "_" + (k++);
 }

 const p = { id, name: "Nouveau patient", answers: {}, derived: {} };
 state.patients.push(p);

 // Reset search so the new patient is visible
 const s = $("#patientSearch");
 if(s) s.value = "";

 renderPatientList();
 selectPatient(state.patients.length - 1);

 // Enter edit mode automatically
 if(!state.patientEditMode) toggleEditPatient();

 // Focus name in form mode
 if(!isRawMode()){
 const nameEl = document.querySelector('#patientForm [data-scope="root"][data-path="name"]');
 if(nameEl){
 nameEl.focus();
 if(nameEl.select) nameEl.select();
 }
 }

 toast("Nouveau patient créé.");
 // Persiste immédiatement (évite disparition au refresh)
 schedulePatientsSave();
}



function selectPatient(index){
 state.selectedPatientIndex = index;
 state.patientEditMode = false;
 state.patientView = "data";
 syncPatientModeUI();
 syncPatientViewUI();
 $("#toggleEditPatientBtn").textContent = "Modifier";
 $("#savePatientBtn").disabled = true;
 $("#revertPatientBtn").disabled = true;

 const p = state.patients[index] || {};

 // Photo (depuis store.json)
 renderPatientPhotoBox(String(p.id || ""));

 // Snapshot pour annuler (formulaire + JSON)
 state.patientFormOriginalObj = deepClone(p);
 const txt = JSON.stringify(p, null, 2);
 state.patientJsonOriginal = txt;

 // Rendu UI
 renderPatientForm(p);
 setFormEnabled(false);

 const ta = $("#patientJson");
 ta.value = txt;
 ta.readOnly = true;

 renderPatientList();
}

function toggleEditPatient(){
 if(state.selectedPatientIndex === null) return;
 state.patientEditMode = !state.patientEditMode;

 $("#toggleEditPatientBtn").textContent = state.patientEditMode ? "Lecture seule" : "Modifier";
 $("#savePatientBtn").disabled = !state.patientEditMode;
 $("#revertPatientBtn").disabled = !state.patientEditMode;

 if(isRawMode()){
 $("#patientJson").readOnly = !state.patientEditMode;
 if(state.patientEditMode) $("#patientJson").focus();
 }else{
 setFormEnabled(state.patientEditMode);
 }
}

function revertPatient(){
 if(state.selectedPatientIndex === null) return;
 const i = state.selectedPatientIndex;
 if(i === null) return;

 // Restore object
 if(state.patientFormOriginalObj){
 state.patients[i] = deepClone(state.patientFormOriginalObj);
 }

 const p = state.patients[i] || {};
 state.patientJsonOriginal = JSON.stringify(p, null, 2);
 $("#patientJson").value = state.patientJsonOriginal;
 renderPatientForm(p);
 setFormEnabled(false);

 // Quit edit mode
 state.patientEditMode = false;
 $("#toggleEditPatientBtn").textContent = "Modifier";
 $("#savePatientBtn").disabled = true;
 $("#revertPatientBtn").disabled = true;
 toast("Modifs annulées.");
}

function savePatient(){
 const i = state.selectedPatientIndex;
 if(i === null) return;

 if(isRawMode()){
 const txt = $("#patientJson").value || "";
 try{
 const obj = JSON.parse(txt);
 derivePatient(obj);
 state.patients[i] = obj;
 state.patientFormOriginalObj = deepClone(obj);
 state.patientJsonOriginal = JSON.stringify(obj, null, 2);
 $("#patientJson").value = state.patientJsonOriginal;
  toast("Patient enregistré. Sauvegarde…");
  schedulePatientsSave();
 renderPatientList();
 }catch(err){
 toast("JSON invalide : impossible d'enregistrer.");
 }
 return;
 }

 // Form mode
 const p = state.patients[i] || {};
 try{
 readPatientFormInto(p);
 state.patients[i] = p;
 state.patientFormOriginalObj = deepClone(p);
 state.patientJsonOriginal = JSON.stringify(p, null, 2);
 $("#patientJson").value = state.patientJsonOriginal;

 // Quit edit mode
 state.patientEditMode = false;
 setFormEnabled(false);
 $("#toggleEditPatientBtn").textContent = "Modifier";
 $("#savePatientBtn").disabled = true;
 $("#revertPatientBtn").disabled = true;

  toast("Patient enregistré. Sauvegarde…");
  schedulePatientsSave();
 renderPatientList();
 }catch(err){
 console.warn(err);
 toast("Impossible d'enregistrer les champs.");
 }
}

/* -------- Interventions (store.json) -------- */

function nowISO(){ return new Date().toISOString(); }
function fmtTS(ts){
 try{ return new Date(ts).toLocaleString("fr-FR"); }catch(e){ return String(ts || ""); }
}

function selectedPatientId(){
 const i = state.selectedPatientIndex;
 const p = (i == null) ? null : state.patients[i];
 return p ? String(p.id || "") : "";
}

function ensureExtraFor(pid){
 if(!pid) return null;
 state.store = state.store || { extra:{}, customPatients:[], updatedAt:null };
 state.store.extra = (state.store.extra && typeof state.store.extra === "object") ? state.store.extra : {};
 state.store.extra[pid] = (state.store.extra[pid] && typeof state.store.extra[pid] === "object") ? state.store.extra[pid] : {};
 return state.store.extra[pid];
}

function getInterventions(pid){
 const ex = state.store?.extra?.[pid];
 const itv = ex?.interventions;
 return Array.isArray(itv) ? itv : [];
}

async function writeStore(){
 const r = await fetch("/api/store", {
 method: "PUT",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(state.store || { extra:{}, customPatients:[] })
 });
 if(!r.ok) throw new Error("write store failed");
 state.store = await r.json();
}

function renderInterventionsPanel(pid){
 const listEl = $("#interventionsList");
 if(!listEl) return;
 listEl.innerHTML = "";

 const src = getInterventions(pid);
 const items = src.slice().reverse(); // newest first

 if(!items.length){
 const empty = document.createElement("div");
 empty.className = "itvEmpty";
 empty.textContent = "Aucune intervention enregistrée.";
 listEl.appendChild(empty);
 return;
 }

 for(let i=0;i<items.length;i++){
 const it = items[i];
 const originalIndex = (src.length - 1) - i;

 const row = document.createElement("div");
 row.className = "itvRow";

 const meta = document.createElement("div");
 meta.className = "itvMeta";
 const ts = (typeof it === "string") ? "" : fmtTS(it?.ts);
 const acc = (typeof it === "string") ? "" : (it?.account ? ` — ${it.account}` : "");
 meta.textContent = ts + acc;

 const text = document.createElement("textarea");
 text.className = "itvText";
 text.value = (typeof it === "string") ? it : String(it?.text ?? "");
 text.disabled = true;

 const actions = document.createElement("div");
 actions.className = "itvActions";

 const editBtn = document.createElement("button");
 editBtn.className = "btn mini";
 editBtn.type = "button";
 editBtn.textContent = "Modifier";

 const saveBtn = document.createElement("button");
 saveBtn.className = "btn primary mini";
 saveBtn.type = "button";
 saveBtn.textContent = "Enregistrer";
 saveBtn.style.display = "none";

 const cancelBtn = document.createElement("button");
 cancelBtn.className = "btn mini";
 cancelBtn.type = "button";
 cancelBtn.textContent = "Annuler";
 cancelBtn.style.display = "none";

 const delBtn = document.createElement("button");
 delBtn.className = "btn danger mini";
 delBtn.type = "button";
 delBtn.textContent = "Supprimer";

 let snapshot = text.value;

 const setEditing = (on) => {
 text.disabled = !on;
 editBtn.style.display = on ? "none" : "";
 delBtn.style.display = on ? "none" : "";
 saveBtn.style.display = on ? "" : "none";
 cancelBtn.style.display = on ? "" : "none";
 if(on){
 snapshot = text.value;
 text.focus();
 }else{
 text.value = snapshot;
 }
 };

 editBtn.addEventListener("click", () => setEditing(true));
 cancelBtn.addEventListener("click", () => setEditing(false));
 saveBtn.addEventListener("click", async () => {
 const v = String(text.value || "").trim();
 if(!v){ toast("Texte vide : impossible d'enregistrer."); return; }
 try{
 const ex = ensureExtraFor(pid);
 const list = Array.isArray(ex.interventions) ? ex.interventions : [];
 if(list[originalIndex] && typeof list[originalIndex] === "object"){
 list[originalIndex].text = v;
 }else{
 // rétro-compat: string
 list[originalIndex] = { ts: nowISO(), text: v, account: null };
 }
 ex.interventions = list;
 await writeStore();
 toast("Intervention enregistrée.");
 renderInterventionsPanel(pid);
 }catch(e){
 console.warn(e);
 toast("Écriture impossible.");
 }
 });

 delBtn.addEventListener("click", async () => {
 const ok = confirm("Supprimer cette intervention ?");
 if(!ok) return;
 try{
 const ex = ensureExtraFor(pid);
 const list = Array.isArray(ex.interventions) ? ex.interventions : [];
 if(originalIndex >= 0 && originalIndex < list.length){
 list.splice(originalIndex, 1);
 ex.interventions = list;
 await writeStore();
 toast("Intervention supprimée.");
 renderInterventionsPanel(pid);
 }
 }catch(e){
 console.warn(e);
 toast("Écriture impossible.");
 }
 });

 actions.appendChild(editBtn);
 actions.appendChild(saveBtn);
 actions.appendChild(cancelBtn);
 actions.appendChild(delBtn);

 row.appendChild(meta);
 row.appendChild(text);
 row.appendChild(actions);
 listEl.appendChild(row);
 }
}

async function addIntervention(){
 const pid = selectedPatientId();
 if(!pid){ toast("Sélectionnez un patient."); return; }
 const ta = $("#newInterventionText");
 const text = String(ta?.value || "").trim();
 if(!text){ toast("Texte vide."); return; }
 try{
 const ex = ensureExtraFor(pid);
 const list = Array.isArray(ex.interventions) ? ex.interventions : [];
 list.push({ ts: nowISO(), text, account: null });
 ex.interventions = list;
 await writeStore();
 if(ta) ta.value = "";
 toast("Intervention ajoutée.");
 renderInterventionsPanel(pid);
 }catch(e){
 console.warn(e);
 toast("Écriture impossible.");
 }
}

function toggleInterventionsView(){
 if(state.selectedPatientIndex == null) return;
 state.patientView = (state.patientView === "interventions") ? "data" : "interventions";
 // On force la lecture seule quand on change de vue
 if(state.patientView === "interventions"){
 state.patientEditMode = false;
 $("#toggleEditPatientBtn").textContent = "Modifier";
 $("#savePatientBtn").disabled = true;
 $("#revertPatientBtn").disabled = true;
 setFormEnabled(false);
 $("#patientJson").readOnly = true;
 const pid = selectedPatientId();
 renderInterventionsPanel(pid);
 }
 syncPatientViewUI();
}

/* -------- Export / Write -------- */

async function exportComptes(){
 const content = JSON.stringify(state.comptes, null, 2);
 downloadText("comptes.json", content, "application/json;charset=utf-8");
 toast("comptes.json exporté.");
}

async function exportPatients(){
 const content = JSON.stringify(state.store || { extra:{}, customPatients:[] }, null, 2);
 downloadText("store.json", content, "application/json;charset=utf-8");
 toast("store.json exporté.");
}

async function writeComptes(){
 const r = await fetch("/api/data/comptes", {
 method: "PUT",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ comptes: state.comptes })
 });
 if(!r.ok) throw new Error("write comptes failed");
 toast("Écrit: /DATA/comptes.json (serveur)");
}

async function writePatients(){
 // Patients stockés uniquement dans DATA/store.json
 state.store = state.store || { extra:{}, customPatients:[] };
 state.store.customPatients = Array.isArray(state.patients) ? state.patients : [];
 await writeStore();
 toast("Écrit: /DATA/store.json (serveur)");
}

async function migrateUsersToStore(){
 // Nouveau comportement : demander le fichier users.json directement sur le PC de l'utilisateur,
 // puis convertir et MERGE dans les données patients (store.customPatients) + sauvegarde serveur si possible.
 const pickJsonFileText = () => new Promise((resolve, reject) => {
 const input = document.createElement("input");
 input.type = "file";
 input.accept = ".json,application/json";
 input.style.display = "none";

 const cleanup = () => {
 try{ input.value = ""; }catch(e){}
 if(input.parentNode) input.parentNode.removeChild(input);
 };

 input.addEventListener("change", () => {
 const file = input.files && input.files[0];
 if(!file){ cleanup(); return reject(new Error("no_file")); }
 const reader = new FileReader();
 reader.onerror = () => { cleanup(); reject(new Error("read_error")); };
 reader.onload = () => { cleanup(); resolve(String(reader.result || "")); };
 reader.readAsText(file);
 });

 document.body.appendChild(input);
 input.click();
 });

 const extractPatientsArray = (payload) => {
 // On accepte plusieurs formats possibles pour limiter les surprises
 if(Array.isArray(payload)) return payload;
 if(payload && typeof payload === "object"){
 if(Array.isArray(payload.patients)) return payload.patients;
 if(Array.isArray(payload.users)) return payload.users;
 if(Array.isArray(payload.data)) return payload.data;
 }
 return [];
 };

 const toPatient = (raw) => {
 if(!raw || typeof raw !== "object") return null;
 const id = String(raw.id ?? raw.patientId ?? raw.patient_id ?? raw.identifier ?? "").trim();
 const name = String(raw.name ?? raw.nom ?? raw.fullName ?? raw.full_name ?? "").trim();
 if(!id || !name) return null;
 const answers = (raw.answers && typeof raw.answers === "object" && !Array.isArray(raw.answers)) ? raw.answers
 : (raw.reponses && typeof raw.reponses === "object" && !Array.isArray(raw.reponses)) ? raw.reponses
 : {};
 const derived = (raw.derived && typeof raw.derived === "object" && !Array.isArray(raw.derived)) ? raw.derived : {};
 return { id, name, answers, derived };
 };

 try{
 const text = await pickJsonFileText();
 let payload;
 try{ payload = JSON.parse(text); }
 catch(e){ toast("Fichier JSON invalide."); return; }

 const arr = extractPatientsArray(payload);
 const incoming = arr.map(toPatient).filter(Boolean);

 if(!incoming.length){
 toast("Aucun patient valide trouvé dans ce fichier.");
 return;
 }

 // Merge (sans écraser les IDs existants)
 state.store = state.store || { extra:{}, customPatients:[], updatedAt:null };
 state.store.extra = (state.store.extra && typeof state.store.extra === "object" && !Array.isArray(state.store.extra)) ? state.store.extra : {};
 state.store.customPatients = normalizePatients(state.store.customPatients);
 state.patients = Array.isArray(state.patients) ? normalizePatients(state.patients) : state.store.customPatients;

 const seen = new Set(state.patients.map(p => String(p?.id || "")));
 let added = 0;
 let skipped = 0;
 for(const p of incoming){
 const pid = String(p.id || "");
 if(!pid || seen.has(pid)) { skipped++; continue; }
 state.patients.push(p);
 seen.add(pid);
 added++;
 }

 // Appliquer au store
 state.store.customPatients = normalizePatients(state.patients);

 // UI
 renderPatientList();
 renderPatientPhotoBox(selectedPatientId());

 // Sauvegarde côté serveur (si disponible)
 try{
 await writeStore();
 toast(`Import terminé: ${added} ajouté(s), ${skipped} ignoré(s). Sauvegardé sur le serveur.`);
 }catch(e){
 toast(`Import terminé: ${added} ajouté(s), ${skipped} ignoré(s). Serveur indisponible → utilisez “Exporter store.json”.`);
 }
 }catch(err){
 // Annulation = pas un vrai "bug"
 if(String(err?.message || "") === "no_file") return;
 console.warn(err);
 toast("Import impossible (fichier users.json)." );
 }
}

/* -------- Utils -------- */

function escapeHtml(s){
 return String(s)
 .replaceAll("&","&amp;")
 .replaceAll("<","&lt;")
 .replaceAll(">","&gt;")
 .replaceAll('"',"&quot;")
 .replaceAll("'","&#039;");
}

/* -------- Boot -------- */

async function loadFromServer(){
 // Source unique des patients: /api/store -> DATA/store.json
 try{
 const [cRes, sRes] = await Promise.all([
 fetch("/api/data/comptes", { cache: "no-store" }),
 fetch("/api/store", { cache: "no-store" })
 ]);

 if(cRes.ok){
 const c = await cRes.json();
 state.comptes = normalizeComptes(c?.comptes);
 }else{
 state.comptes = normalizeComptes(window.COMPTES);
 }

 if(sRes.ok){
 const st = await sRes.json();
 state.store = (st && typeof st === "object") ? st : state.store;
 }else{
 state.store = state.store || { extra:{}, customPatients:[], updatedAt:null };
 }

 // Normalise store
 state.store.extra = (state.store.extra && typeof state.store.extra === "object" && !Array.isArray(state.store.extra)) ? state.store.extra : {};
 state.store.customPatients = normalizePatients(state.store.customPatients);
 state.patients = state.store.customPatients;

 return true;
 }catch(err){
 console.warn(err);
 state.comptes = normalizeComptes(window.COMPTES);
 state.store = state.store || { extra:{}, customPatients:[], updatedAt:null };
 state.store.extra = (state.store.extra && typeof state.store.extra === "object" && !Array.isArray(state.store.extra)) ? state.store.extra : {};
 state.store.customPatients = normalizePatients(state.store.customPatients);
 state.patients = state.store.customPatients;
 return false;
 }
}



async function boot(){
 setupTabs();
 // Load data
 const ok = await loadFromServer();
 await connectToSiteFolder();

 // Ensure photo box hidden when no patient selected
 renderPatientPhotoBox("");

 // Comptes
 $("#accountSearch").addEventListener("input", renderAccountList);
 $("#newAccountBtn").addEventListener("click", newAccount);
 $("#saveAccountBtn").addEventListener("click", saveAccount);
 $("#deleteAccountBtn").addEventListener("click", deleteAccount);
 $("#exportComptesBtn").addEventListener("click", exportComptes);
 $("#writeComptesBtn").addEventListener("click", async () => {
 try{ await writeComptes(); }catch(e){ toast("Écriture impossible (utilisez Exporter)."); }
 });

 // Patients
 $("#patientSearch").addEventListener("input", renderPatientList);
 const mig = $("#migrateUsersToStoreBtn");
 if(mig) mig.addEventListener("click", migrateUsersToStore);
 const np = $("#newPatientBtn"); if(np) np.addEventListener("click", newPatient);
 $("#toggleEditPatientBtn").addEventListener("click", toggleEditPatient);
 $("#toggleInterventionsBtn").addEventListener("click", toggleInterventionsView);
 $("#savePatientBtn").addEventListener("click", savePatient);
 $("#revertPatientBtn").addEventListener("click", revertPatient);
 $("#addInterventionBtn").addEventListener("click", addIntervention);
 $("#exportPatientsBtn").addEventListener("click", exportPatients);
 $("#prettyUsers").addEventListener("change", () => {
 // Bascule formulaire <-> JSON
 syncPatientModeUI();
 if(state.patientView === "interventions"){
 // la vue interventions ne dépend pas du mode JSON
 return;
 }
 if(state.selectedPatientIndex != null){
 // On réaffiche le patient sélectionné en quittant l'édition (évite pertes/états incohérents)
 selectPatient(state.selectedPatientIndex);
 }
 });
 $("#writePatientsBtn").addEventListener("click", async () => {
 try{ await writePatients(); }catch(e){ toast("Écriture impossible (utilisez Exporter)."); }
 });

 // FS
 $("#connectBtn").addEventListener("click", openPortfolioModal);

 // initial render
 renderAccountList();
 if(state.comptes.length) selectAccount(0);

 renderPatientList();

 // Mode initial (formulaire)
 syncPatientModeUI();
 syncPatientViewUI();
}

boot();
