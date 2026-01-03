/* Docteur GENIUSTER IA — site */

const $ = (sel) => document.querySelector(sel);
const chatEl = $("#chat");
const inputEl = $("#userInput");
const sendBtn = $("#sendBtn");
const patientListEl = null;
const patientSearchEl = null;
const diseaseListEl = null;
const diseaseSearchEl = null;
const currentPatientPill = $("#currentPatientPill");
const resetLocalBtn = null;

// Données persistées côté serveur (voir STORE_API)

// --- Auth (connexion) ---
// NOTE: authentification 100% côté navigateur. Ne pas utiliser pour du vrai.
const LS_AUTH_KEY = "GENIUSTER_AUTH_v1";
let AUTH_ACCOUNT = null;

let ACCOUNTS = [];

async function loadAccounts(){
 // 1) API (admin-friendly)
 try{
 const r = await fetch("/api/data/comptes", { cache: "no-store" });
 if(r.ok){
 const data = await r.json();
 const arr = data && typeof data === "object" ? data.comptes : null;
 ACCOUNTS = Array.isArray(arr) ? arr : [];
 return;
 }
 }catch(_){/* ignore */}

 // 2) Fallback: direct file read
 try{
 const r2 = await fetch("/data/comptes.json", { cache: "no-store" });
 if(r2.ok){
 const arr2 = await r2.json();
 ACCOUNTS = Array.isArray(arr2) ? arr2 : [];
 }
 }catch(_){/* ignore */}
}

function getAuth(){
 try{ return JSON.parse(localStorage.getItem(LS_AUTH_KEY) || "null"); }
 catch(_){ return null; }
}

function setAuth(accountName){
 AUTH_ACCOUNT = accountName || null;
 try{
 if(AUTH_ACCOUNT){
 localStorage.setItem(LS_AUTH_KEY, JSON.stringify({ account: AUTH_ACCOUNT, at: new Date().toISOString() }));
 }else{
 localStorage.removeItem(LS_AUTH_KEY);
 }
 }catch(_){/* ignore */}
}

function listAccountsRaw(){
 const arr = Array.isArray(ACCOUNTS) && ACCOUNTS.length
 ? ACCOUNTS
 : (Array.isArray(window.COMPTES) ? window.COMPTES : []); // compat ancien format
 return arr.filter(x => x && x.name && x.password);
}

// Alias conservé (utilisé dans le code existant)
function listAccounts(){
 return listAccountsRaw();
}

function getAccount(name){
 const n = String(name || "");
 return listAccountsRaw().find(c => String(c.name) === n) || null;
}

function isValidAccountName(name){
 return !!getAccount(name);
}

function isAccountBlocked(name){
 const acc = getAccount(name);
 return !!(acc && acc.blocked);
}

function verifyPassword(name, pwd){
 const found = getAccount(name);
 return !!(found && String(found.password) === String(pwd));
}

function setSubscriptionBlocked(blocked){
 const box = document.querySelector(".chatbox");
 if(!box) return;

 // blur/disable via CSS class
 box.classList.toggle("is-subscription-blocked", !!blocked);

 let ov = document.getElementById("subscriptionOverlay");
 if(!ov){
 ov = document.createElement("div");
 ov.id = "subscriptionOverlay";
 ov.className = "subscription-overlay hidden";
 ov.innerHTML = `
 <div class="subscription-card glass">
 <div class="subscription-title">⛔ Accès suspendu</div>
 <div class="subscription-text">L'abonnement est en attente de renouvellement.</div>
 <div class="subscription-hint">Contactez l'admin pour réactiver ce compte.</div>
 </div>
 `;
 box.appendChild(ov);
 }
 ov.classList.toggle("hidden", !blocked);
}

// --- Modales internes (dans le chatbot) ---
// Interdit: window.prompt / window.confirm / window.alert
function getModalEls(){
 return {
 overlay: document.getElementById("modalOverlay"),
 title: document.getElementById("modalTitle"),
 body: document.getElementById("modalBody"),
 ok: document.getElementById("modalOk"),
 cancel: document.getElementById("modalCancel"),
 };
}

function openChatModal({
 title = "",
 bodyNode = null,
 okText = "Valider",
 cancelText = "Annuler",
 showCancel = true,
 okClass = "primary",
 closeOnBackdrop = true,
 focusEl = null,
} = {}){
 const els = getModalEls();
 if(!els.overlay || !els.title || !els.body || !els.ok || !els.cancel){
 // fallback (au pire) : ne rien faire plutôt qu'ouvrir une fenêtre navigateur
 return Promise.resolve({ ok:false });
 }

 return new Promise((resolve) => {
 els.title.textContent = String(title || "");
 els.body.innerHTML = "";
 if(bodyNode) els.body.appendChild(bodyNode);

 els.ok.textContent = okText;
 els.cancel.textContent = cancelText;
 els.cancel.style.display = showCancel ? "" : "none";

 // classes
 els.ok.classList.remove("primary","danger");
 if(okClass) els.ok.classList.add(okClass);

 const close = (result) => {
 els.overlay.classList.add("hidden");
 // cleanup
 els.ok.removeEventListener("click", onOk);
 els.cancel.removeEventListener("click", onCancel);
 els.overlay.removeEventListener("click", onBackdrop);
 document.removeEventListener("keydown", onKey);
 resolve(result);
 };

 const onOk = (e) => { e?.preventDefault?.(); close({ ok:true }); };
 const onCancel = (e) => { e?.preventDefault?.(); close({ ok:false }); };
 const onBackdrop = (e) => {
 if(!closeOnBackdrop) return;
 if(e.target === els.overlay) close({ ok:false });
 };
 const onKey = (e) => {
 if(e.key === "Escape") close({ ok:false });
 if(e.key === "Enter"){
 const tag = (document.activeElement?.tagName || "").toLowerCase();
 // Enter valide sauf dans textarea
 if(tag !== "textarea") close({ ok:true });
 }
 };

 els.ok.addEventListener("click", onOk);
 els.cancel.addEventListener("click", onCancel);
 els.overlay.addEventListener("click", onBackdrop);
 document.addEventListener("keydown", onKey);

 els.overlay.classList.remove("hidden");
 setTimeout(() => {
 try{ (focusEl || els.ok)?.focus?.(); }catch(_){/* ignore */}
 }, 30);
 });
}

async function modalPrompt({
 title = "",
 label = "",
 value = "",
 placeholder = "",
 multiline = false,
 okText = "Valider",
} = {}){
 const wrap = document.createElement("div");
 if(label){
 const lab = document.createElement("label");
 lab.className = "modal-label";
 lab.textContent = label;
 wrap.appendChild(lab);
 }
 const input = multiline ? document.createElement("textarea") : document.createElement("input");
 input.className = multiline ? "modal-textarea" : "modal-input";
 if(!multiline) input.type = "text";
 input.placeholder = placeholder || "";
 input.value = String(value ?? "");
 wrap.appendChild(input);

 const res = await openChatModal({ title, bodyNode: wrap, okText, focusEl: input });
 if(!res.ok) return null;
 return String(input.value ?? "");
}

async function modalConfirm({
 title = "Confirmation",
 message = "",
 okText = "Oui",
 cancelText = "Non",
 danger = false,
} = {}){
 const wrap = document.createElement("div");
 wrap.textContent = String(message || "");
 const res = await openChatModal({
 title,
 bodyNode: wrap,
 okText,
 cancelText,
 okClass: danger ? "danger" : "primary",
 });
 return !!res.ok;
}

// --- Store serveur (persistance fichiers dans /DATA) ---
// Le serveur expose /api/store (stocke: customPatients + extra + interventions) dans DATA/store.json
const STORE_API = "/api/store";
let STORE = { extra: {}, customPatients: [] };
let STORE_READY = false;
let _storeSaveTimer = null;
let _storeSaving = false;
let _storeDirty = false;

async function initStore(){
 try{
 const r = await fetch(STORE_API, { cache: "no-store" });
 if(r.ok){
 const data = await r.json();
 if(data && typeof data === "object"){
 STORE = { ...STORE, ...data };
 }
 }
 }catch(err){
 console.warn("Store init failed", err);
 }finally{
 STORE.extra = (STORE.extra && typeof STORE.extra === "object" && !Array.isArray(STORE.extra)) ? STORE.extra : {};
 STORE.customPatients = Array.isArray(STORE.customPatients) ? STORE.customPatients : [];
 STORE_READY = true;
 }
}

async function flushStore(){
 if(_storeSaving){
 _storeDirty = true;
 return;
 }
 _storeSaving = true;
 try{
 const payload = { extra: STORE.extra, customPatients: STORE.customPatients };
 const r = await fetch(STORE_API, {
 method: "PUT",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(payload)
 });
 if(r.ok){
 const data = await r.json();
 if(data && typeof data === "object"){
 STORE = { ...STORE, ...data };
 }
 }
 }catch(err){
 console.warn("Store save failed", err);
 }finally{
 _storeSaving = false;
 if(_storeDirty){
 _storeDirty = false;
 flushStore();
 }
 }
}

function scheduleStoreSave(){
 try{ clearTimeout(_storeSaveTimer); }catch(_){}
 _storeSaveTimer = setTimeout(() => { flushStore(); }, 400);
}

// --- Custom patients (persistés serveur) ---
let CUSTOM_PATIENTS = [];

function loadCustomPatients(){
 return Array.isArray(STORE?.customPatients) ? STORE.customPatients : [];
}

function saveCustomPatients(list){
 STORE.customPatients = Array.isArray(list) ? list : [];
 scheduleStoreSave();
}

function refreshCustomPatients(){
 CUSTOM_PATIENTS = loadCustomPatients();
}


function allPatients(){
 // Applique les overrides (ex: nom/téléphone) stockés côté serveur
 const extraAll = loadExtra();
 const apply = (p) => {
 const ex = extraAll?.[p?.id] || {};
 const name = (ex.displayName && String(ex.displayName).trim()) ? String(ex.displayName).trim() : (p?.name || "");
 return { ...p, name: name || p?.name };
 };
 // Source unique: STORE.customPatients (persisté dans DATA/store.json)
 return (CUSTOM_PATIENTS || []).map(apply);
}

function getPatientByIdAny(id){
 return allPatients().find(p => p.id === id) || null;
}

function normKey(name){
 return normalize(name).replace(/\s+/g," ").trim();
}

function ensureCustomPatient(name){
 const key = normKey(name);
 // if exists in base/custom, return it
 const existing = allPatients().find(p => normKey(p.name) === key);
 if(existing) return existing;

 const id = "custom:" + hash32(key).toString(16);
 const p = { id, name: titleCase(name), answers:{}, derived:{} };
 CUSTOM_PATIENTS.push(p);
 saveCustomPatients(CUSTOM_PATIENTS);
 return p;
}

const BOT = window.BOT_PRESETS;
const EXTRA_FIELDS = BOT.EXTRA_FIELDS;
const FIELD_LABELS = BOT.FIELD_LABELS;
const QUESTION_BANK = BOT.QUESTION_BANK;

// Bibliothèque d'interventions / conseils (détection "que faire", scénarios, symptômes)
const INTERVENTION_LIB = window.INTERVENTION_LIBRARY || null;

function loadExtra() {
 // plus de LocalStorage: tout est dans STORE (serveur)
 const ex = STORE?.extra;
 return (ex && typeof ex === "object" && !Array.isArray(ex)) ? ex : {};
}
function saveExtra(obj) {
 STORE.extra = (obj && typeof obj === "object" && !Array.isArray(obj)) ? obj : {};
 scheduleStoreSave();
}

function savePatientMeta(patientId, key, value){
 const extra = loadExtra();
 extra[patientId] = extra[patientId] || {};
 if(value == null || String(value).trim() === ""){
 delete extra[patientId][key];
 }else{
 extra[patientId][key] = value;
 }
 saveExtra(extra);
}

function getPatientMeta(patientId, key, fallback=null){
 const extra = loadExtra();
 const ex = extra?.[patientId] || {};
 const v = ex?.[key];
 return (v == null || String(v).trim() === "") ? fallback : v;
}

// --- Photo de profil patient (persistée côté serveur) ---
const PROFILE_PHOTO_KEY = "profilePhoto"; // string: filename (ex: custom_abc.png) ou "N/A"

function getPatientProfilePhoto(patientId){
 return getPatientMeta(patientId, PROFILE_PHOTO_KEY, null);
}

function hasPatientProfilePhoto(patientId){
 const v = getPatientProfilePhoto(patientId);
 if(!v) return false;
 return String(v).trim().toUpperCase() !== "N/A";
}

function needsProfilePhotoQuestion(patientId){
 // On considère qu'il manque une photo tant qu'on n'a pas un vrai fichier (et pas N/A).
 return !hasPatientProfilePhoto(patientId);
}

function photoUrlFromFilename(filename){
 if(!filename) return "";
 // cache-bust simple
 return `/photo/${encodeURIComponent(String(filename))}?t=${Date.now()}`;
}

// --- Téléphone patient (persisté côté serveur) ---
const DEFAULT_PHONE_PLACEHOLDER = "555-0000";

function getPatientPhone(patientId){
 const v = getPatientMeta(patientId, "phone", null);
 const t = (v == null) ? "" : String(v).trim();
 return t || DEFAULT_PHONE_PLACEHOLDER;
}

function needsPhoneQuestion(patientId){
 // Prioritaire si le dossier a encore le numéro par défaut (placeholder)
 const ph = getPatientPhone(patientId);
 return String(ph).trim() === DEFAULT_PHONE_PLACEHOLDER;
}

let pendingPhone = null; // { patientId, patientName, after }

async function askPhoneQuestion(patientId, patientName, after){
 pendingPhone = { patientId, patientName, after: after || { type: "existing", missingFields: [] } };
 const bubble = await aiSay(
 `🧾 Données manquantes: ${underline("Téléphone")} = ${DEFAULT_PHONE_PLACEHOLDER}.
` +
 `Question: Quel est le numéro de téléphone du patient ?`
 );

 const inputWrap = document.createElement("div");
 inputWrap.className = "field-input-wrap";
 const el = document.createElement("input");
 el.type = "tel";
 el.className = "field-input";
 el.placeholder = "Ex: 06 12 34 56 78";
 inputWrap.appendChild(el);
 bubble.appendChild(inputWrap);

 const submit = async (value) => {
 const v = String(value || "").trim();
 addMessage("user", v ? v : "N/A");
 // Si vide => on supprime, donc on retombe sur placeholder et la question restera prioritaire la prochaine fois.
 savePatientMeta(patientId, "phone", v ? v : null);
 const ctx = pendingPhone;
 pendingPhone = null;
 await resumeAfterPhone(ctx);
 };

 // Entrée = Valider
 el.addEventListener("keydown", (e) => {
 if(e.key === "Enter"){
 e.preventDefault();
 submit(el.value);
 }
 });

 addButtons(bubble, [
 { label: "Valider", klass: "good", onClick: () => submit(el.value) },
 { label: "N/A (plus tard)", onClick: () => submit("") }
 ]);

 setTimeout(() => el.focus(), 50);
}

async function resumeAfterPhone(ctx){
 if(!ctx) return;
 const pid = ctx.patientId;
 await continueAfterPriorities(pid, ctx.patientName, ctx.after);
}

async function uploadProfilePhoto(patientId, dataUrl){
 const r = await fetch(`/api/patient/${encodeURIComponent(String(patientId))}/photo`, {
 method: "PUT",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ dataUrl })
 });
 if(!r.ok){
 const err = await r.json().catch(()=> ({}));
 const code = err?.error ? String(err.error) : "upload_failed";
 throw new Error(code);
 }
 return await r.json();
}



// --- Interventions (persistées côté serveur) ---
function nowISO(){ return new Date().toISOString(); }
function fmtTS(ts){
 try{ return new Date(ts).toLocaleString(); }catch(e){ return String(ts || ""); }
}
function getInterventions(patientId){
 const all = loadExtra();
 const itv = all?.[patientId]?.interventions;
 return Array.isArray(itv) ? itv : [];
}
function addInterventionTo(patientId, text){
 const t = (text || "").trim();
 if(!t) return false;
 const all = loadExtra();
 all[patientId] = all[patientId] || {};
 const itv = Array.isArray(all[patientId].interventions) ? all[patientId].interventions : [];
 itv.push({ ts: nowISO(), text: t, account: (AUTH_ACCOUNT || null) });
 all[patientId].interventions = itv;
 saveExtra(all);
 return true;
}

function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }

function tpl(str, vars={}){
 return (str||"").replace(/\{(\w+)\}/g, (_,k)=> (vars[k] ?? ""));
}
function pick(arr, seedStr){
 if(!arr || !arr.length) return "";
 const n = Math.abs(hash32(seedStr || "seed"));
 return arr[n % arr.length];
}

function normalize(s){
 return (s || "")
 .toLowerCase()
 .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
 .replace(/[^a-z0-9\s\-']/g, "")
 .replace(/\s+/g, " ")
 .trim();
}

// --- Interventions / conseils ---
function isAdviceIntent(rawText){
 if(!INTERVENTION_LIB) return false;
 const t = String(rawText || "");
 // commandes -> non
 if(/^\s*\//.test(t)) return false;
 // heuristiques: déclencheurs + marqueurs de question/urgence
 const triggers = Array.isArray(INTERVENTION_LIB.adviceTriggers) ? INTERVENTION_LIB.adviceTriggers : [];
 const hit = triggers.some(re => {
 try{ return re.test(t); }catch(_){ return false; }
 });
 if(hit) return true;
 // fallback: questions directes
 const n = normalize(t);
 return /\b(que|quoi)\s+faire\b|\bcomment\b|\bconseil\b|\bprotocole\b|\burgence\b|\bprise\s+en\s+charge\b|\bconduite\s+a\s+tenir\b|\?/.test(n);
}

function rankDiseasesBySymptoms(symptoms){
 const list = Array.isArray(window.DISEASES) ? window.DISEASES : [];
 const sArr = Array.isArray(symptoms) ? symptoms : [];
 if(!list.length || !sArr.length) return [];

 const scored = list.map(d => {
 const hay = normalize(`${d?.symptoms || ''} ${(Array.isArray(d?.keywords) ? d.keywords.join(' ') : '')}`);
 let score = 0;
 for(const s of sArr){
 const kws = Array.isArray(s?.keywords) ? s.keywords : [String(s?.id||'')];
 const ok = kws.some(k => k && hay.includes(normalize(k)));
 if(ok) score += 1;
 }
 return { d, score };
 }).filter(x => x.score > 0);

 scored.sort((a,b)=> b.score - a.score);
 const top = scored.slice(0, 3);
 if(!top.length) return [];

 // probabilités simples (normalisation sur les scores)
 const denom = top.reduce((acc,x)=> acc + Math.max(1, x.score), 0);
 let remaining = 100;
 const withP = top.map((x, idx) => {
 const raw = Math.max(1, x.score) / denom;
 const p = (idx === top.length-1)
 ? remaining
 : clamp(Math.round(raw * 100), 5, 90);
 remaining -= p;
 return { ...x, p: clamp(p, 1, 98) };
 });
 // Ajuste si dépassement (cas arrondi)
 const sum = withP.reduce((a,x)=>a+x.p,0);
 if(sum !== 100 && withP.length){
 withP[withP.length-1].p = clamp(withP[withP.length-1].p + (100 - sum), 1, 98);
 }
 return withP;
}


async function tryHandleInterventionAdvice(rawText){
  if(!INTERVENTION_LIB) return false;

  const t = String(rawText || '').trim();
  if(!t) return false;
  // commandes -> on laisse la logique existante
  if(/^\s*\//.test(t)) return false;

  // On tente de repérer un cas clinique même si la phrase n'est pas formulée comme une question.
  const scenarios = INTERVENTION_LIB.matchScenario(t) || [];
  const symptoms = INTERVENTION_LIB.extractSymptoms(t) || [];

  // Intent “conseil / intervention” : déclencheurs OU scénario/symptômes détectés.
  const intent = isAdviceIntent(t) || scenarios.length || symptoms.length;
  if(!intent) return false;

  function cleanBotText(s){
    return String(s||'')
      .replace(/\*\*/g,'')
      .replace(/\*/g,'')
      .replace(/_{1,}/g,'')
      .replace(/\s+\n/g,'\n')
      .trim();
  }
  function cleanDiseaseName(n){
    return String(n||'')
      .replace(/\([^)]*\)/g,'')
      .replace(/\bBPCO\b/gi,'maladie pulmonaire chronique')
      .replace(/\s+/g,' ')
      .trim();
  }

  // Si on sent que tu veux un protocole mais qu'on ne reconnaît rien
  if(!scenarios.length && !symptoms.length){
    const msg = randPick([
      "Oups… là je vois l'urgence dans ta phrase, mais je ne comprends pas le scénario. Donne-moi un détail de plus (trauma ? saignement ? respiration ?).",
      "Je t'avoue que là, je ne sais pas trop quoi te proposer. Et je préfère être honnête plutôt que d'inventer : précise le problème principal.",
      "Hum… ça sent la situation à stress, mais je ne reconnais rien de clair. Tu devrais réviser tes cours… et surtout me dire ce qui se passe exactement 😄",
      "Je sèche un peu. Dis-moi ce que tu vois : ça saigne ? il respire ? il répond ? douleur où ?",
      "Là, mon cerveau IA fait une pause café. Redonne la scène en 1 phrase : ce qui menace la vie en premier.",
      "Je ne trouve pas de protocole qui colle. Si tu peux : décris la scène + 2-3 signes (respiration, saignement, conscience)."
    ]);
    await aiSay(cleanBotText(msg));
    return true;
  }

  // --- Scénario détecté : on répond avec UN protocole choisi au hasard ---
  if(scenarios.length){
    const primary = scenarios[0];
    const pack = INTERVENTION_LIB.buildScenarioResponsePack(primary);
    const pool = [...(pack?.serieuse||[]), ...(pack?.absurde||[])].filter(Boolean);
    const chosen = pool.length
      ? randPick(pool)
      : "Ok, je vois la situation. Sécurise la zone, vérifie respiration et saignement, traite ce qui menace la vie d'abord, puis évacue et réévalue.";
    await aiSay(cleanBotText(chosen));
    return true;
  }

  // --- Symptômes détectés : mini analyse ---
  if(symptoms.length){
    const symTxt = symptoms.map(s => s.label).join(', ');

    const blocks = [];
    blocks.push(randPick([
      "OK, je note ce que tu décris.",
      "D'accord, je relève ça.",
      "Je t'écoute : je prends les symptômes un par un."
    ]));
    blocks.push(`Ce que je vois comme symptômes : ${symTxt}.`);

    const ranked = rankDiseasesBySymptoms(symptoms);

    if(ranked.length){
      blocks.push("Je compare tout ça avec ma base de données et je te propose les pistes les plus probables :");
      for(const r of ranked){
        const nm = cleanDiseaseName(r?.d?.name || 'Maladie');
        blocks.push(`- ${r.p}% : ${nm}`);
      }

      const steps = [];
      steps.push("D'abord, je m'assure que le patient respire correctement et que rien n'est en train de se dégrader vite.");
      steps.push("Je cherche un problème immédiat : gros saignement, douleur thoracique, gêne respiratoire, regard dans le vague, confusion.");
      steps.push("Ensuite je fais un examen simple orienté sur les symptômes, et je note ce qui aggrave / ce qui soulage.");
      steps.push("Si tu as un doute de gravité (malaise, douleur forte, confusion, respiration difficile), tu déclenches un avis/une évacuation sans attendre.");
      blocks.push("Démarche que je te propose :\n- " + steps.join("\n- "));
    }else{
      blocks.push(randPick([
        "Là, je n'arrive pas à faire ressortir une maladie clairement avec ce que tu me donnes.",
        "Avec ces symptômes, ma base ne sort rien de net (ou c'est trop général).",
        "Je n'ai pas assez d'éléments pour sortir une piste fiable : il manque un symptôme clé ou un contexte."
      ]));
      blocks.push("Dans le doute : examen rapide, recherche de signes de gravité, et si ça se dégrade → avis/évacuation.");
    }

    await aiSay(cleanBotText(blocks.join("\n")));
    return true;
  }

  return false;
}


// --- Petits utilitaires UX ---
function delay(ms){
 return new Promise((resolve) => setTimeout(resolve, ms));
}

function underline(label){
 // Soulignement "réel" en texte: caractère combinant U+0332
 const s = String(label ?? "");
 return s.split("").map(ch => (ch === " " ? " " : ch + "\u0332")).join("");
}

// Variations “je suis une IA qui cherche” (50+)
const THINKING_VARIATIONS = [
 "Je feuillette le dossier…\nJe fais tourner les corrélations…\nBip bop calibration du stéthoscope numérique…",
 "Scan des antécédents…\nTriangulation des symptômes…\nBzzzt mise à jour des neurones de service…",
 "J'ouvre la chemise cartonnée…\nJe mouline les statistiques…\nBip bop j'aligne les pixels médicaux…",
 "Indexation des indices…\nCroisement des facteurs de risque…\nClac activation du mode “docteur quantique”…",
 "Lecture du dossier en cours…\nJe compare avec la base BNI…\nBip stéthoscope numérique en chauffe…",
 "Analyse express…\nJ'empile les probabilités…\nBoup recalibrage du radar à symptômes…",
 "Je cherche des patterns…\nJe fais un tour dans les corrélations…\nBip ventilateur de serveur à fond…",
 "Je lance un diagnostic…\nJe brasse les données patient…\nBip bop auto-contrôle des capteurs…",
 "Ouverture du dossier…\nJe consulte l'encyclo-bidule…\nBip les algorithmes mettent leur blouse…",
 "Je déroule les observations…\nJe calcule les convergences…\nBip bop stétho v2.0 synchronisé…",
 "Compilation des symptômes…\nNormalisation des signaux…\nBzzt débuggage de l'hypothèse principale…",
 "Je fais parler les chiffres…\nJe compare aux profils types…\nBip la machine fait “hm-hm”…",
 "Dossier localisé…\nJe pèse les risques…\nCling activation de la loupe algorithmique…",
 "Je remonte la piste des indices…\nJe teste plusieurs scénarios…\nBip bop calibration terminée (à peu près)…",
 "Exploration du dossier…\nJe connecte les points…\nBip mode “savant fou mais gentil” activé…",
 "Je fais un tri par pertinence…\nJe recoupe les signaux faibles…\nBzz la CPU demande un café…",
 "Je scanne la timeline…\nJe calcule les risques relatifs…\nBip bop capteurs émotionnels alignés…",
 "Je vérifie les entrées…\nJ'évalue la cohérence…\nBip bop protocole “médecin IA” en marche…",
 "Je consulte la base…\nJe vérifie 2–3 trucs…\nBip bop ça sent la science…",
 "Je recolle les morceaux…\nJe vérifie la plausibilité…\nBip bop nettoyage des données…",
 "Je fais une synthèse…\nJe recoupe…\nBip bop diagnostic presque prêt…",
 "Je passe en mode “corrélation turbo”…\nJe calcule…\nBip boup… bip…"
];

function pickThinkingPhrase(){
 return randPick(THINKING_VARIATIONS);
}

// Levenshtein (simple)
function levenshtein(a,b){
 a = normalize(a); b = normalize(b);
 const m=a.length, n=b.length;
 if(!m) return n; if(!n) return m;
 const dp = Array.from({length:m+1}, ()=> new Array(n+1).fill(0));
 for(let i=0;i<=m;i++) dp[i][0]=i;
 for(let j=0;j<=n;j++) dp[0][j]=j;
 for(let i=1;i<=m;i++){
 for(let j=1;j<=n;j++){
 const cost = a[i-1]===b[j-1] ? 0 : 1;
 dp[i][j] = Math.min(
 dp[i-1][j] + 1,
 dp[i][j-1] + 1,
 dp[i-1][j-1] + cost
 );
 }
 }
 return dp[m][n];
}

function damerauLevenshtein(a,b){
 a = normalize(a); b = normalize(b);
 const m=a.length, n=b.length;
 if(!m) return n; if(!n) return m;
 const dp = Array.from({length:m+1}, ()=> new Array(n+1).fill(0));
 for(let i=0;i<=m;i++) dp[i][0]=i;
 for(let j=0;j<=n;j++) dp[0][j]=j;
 for(let i=1;i<=m;i++){
 for(let j=1;j<=n;j++){
 const cost = a[i-1]===b[j-1] ? 0 : 1;
 dp[i][j] = Math.min(
 dp[i-1][j] + 1,
 dp[i][j-1] + 1,
 dp[i-1][j-1] + cost
 );
 // transposition (inversion de deux lettres)
 if(i>1 && j>1 && a[i-1]===b[j-2] && a[i-2]===b[j-1]){
 dp[i][j] = Math.min(dp[i][j], dp[i-2][j-2] + cost);
 }
 }
 }
 return dp[m][n];
}

function similarity(a,b){
 const A=normalize(a), B=normalize(b);
 const maxLen = Math.max(A.length, B.length) || 1;
 const dist = damerauLevenshtein(A,B);
 return 1 - (dist / maxLen);
}


function hash32(str){
 // tiny deterministic hash
 let h = 2166136261;
 for(let i=0;i<str.length;i++){
 h ^= str.charCodeAt(i);
 h = Math.imul(h, 16777619);
 }
 return h >>> 0;
}

function sigmoid(x){ return 1/(1+Math.exp(-x)); }

function titleCase(name){
 return (name||"").split(" ").map(w => w ? w[0].toUpperCase()+w.slice(1) : w).join(" ");
}

// --- Date de référence & âge (on se place 9 ans plus tard, même jour) ---
function refDatePlus9Years(){
 const d = new Date();
 d.setFullYear(d.getFullYear() + 9);
 return d;
}

function parseDateYYYYMMDD(s){
 const t = String(s || "").trim();
 if(!t) return null;
 // HTML date input returns YYYY-MM-DD
 const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
 if(!m) return null;
 const y = Number(m[1]), mo = Number(m[2]) - 1, da = Number(m[3]);
 const d = new Date(Date.UTC(y, mo, da));
 if(Number.isNaN(d.getTime())) return null;
 // validate components
 if(d.getUTCFullYear() !== y || d.getUTCMonth() !== mo || d.getUTCDate() !== da) return null;
 return d;
}

function computeAgeFromBirthDate(birthDateStr){
 const bd = parseDateYYYYMMDD(birthDateStr);
 if(!bd) return null;
 const ref = refDatePlus9Years();
 // compare in UTC to avoid TZ edge cases
 const ry = ref.getUTCFullYear();
 const rm = ref.getUTCMonth();
 const rd = ref.getUTCDate();
 let age = ry - bd.getUTCFullYear();
 const hadBirthday = (rm > bd.getUTCMonth()) || (rm === bd.getUTCMonth() && rd >= bd.getUTCDate());
 if(!hadBirthday) age -= 1;
 if(age < 0 || age > 130) return null;
 return age;
}

function ageGroupFromAge(age){
 if(age == null) return null;
 if(age < 18) return "<18";
 if(age <= 30) return "18-30";
 if(age <= 45) return "31-45";
 if(age <= 60) return "46-60";
 return "60+";
}

function displayNameWithAge(name, age){
 const n = titleCase(name || "");
 return (age == null) ? n : `${n} (${age} ans)`;
}

// Chat UI
function addMessage(role, text){
 const msg = document.createElement("div");
 msg.className = `msg ${role}`;
 const avatar = document.createElement("div");
 avatar.className = "avatar";
 avatar.textContent = role === "user" ? "🙂" : "🤖";
 const bubble = document.createElement("div");
 bubble.className = "bubble";
 bubble.textContent = text || "";
 msg.appendChild(avatar);
 msg.appendChild(bubble);
 chatEl.appendChild(msg);
 chatEl.scrollTop = chatEl.scrollHeight;
 return { msg, bubble };
}

function addButtons(bubbleEl, choices){
 const wrap = document.createElement("div");
 wrap.className = "buttons";
 for(const ch of choices){
 const btn = document.createElement("button");
 btn.className = `choice ${ch.klass || ""}`.trim();
 btn.textContent = ch.label;
 btn.addEventListener("click", () => ch.onClick?.());
 wrap.appendChild(btn);
 }
 bubbleEl.appendChild(wrap);
 chatEl.scrollTop = chatEl.scrollHeight;
}

// --- Dossier patient (édition + interventions) ---
function extractArgAfterCommand(text, cmdRegex){
 let t = (text || "").trim().replace(cmdRegex, "").trim();
 if(!t) return "";
 // remove leading punctuation
 t = t.replace(/^[:\-]+\s*/, "");
 const q = t.match(/^["“”']([^"“”']+)["“”']/) || t.match(/"([^"]+)"/) || t.match(/'([^']+)'/);
 return (q ? q[1] : t).trim();
}

function buildControl(field, current){
 const meta = QUESTION_BANK?.[field] || {};
 const type = meta.type || "select";

 // select
 if(type === "select"){
 const sel = document.createElement("select");
 sel.className = "field-input";
 const optNA = document.createElement("option");
 optNA.value = "";
 optNA.textContent = "N/A";
 sel.appendChild(optNA);

 const bank = meta.choices || [];
 for(const ch of bank){
 const opt = document.createElement("option");
 opt.value = ch.value;
 opt.textContent = ch.label;
 sel.appendChild(opt);
 }
 sel.value = current == null ? "" : String(current);
 return sel;
 }

 // date
 if(type === "date"){
 const inp = document.createElement("input");
 inp.type = "date";
 inp.className = "field-input";
 inp.placeholder = meta.placeholder || "";
 inp.value = current == null ? "" : String(current);
 return inp;
 }

 // number
 if(type === "number"){
 const inp = document.createElement("input");
 inp.type = "number";
 inp.step = "1";
 inp.className = "field-input";
 inp.placeholder = meta.placeholder || "";
 inp.value = current == null ? "" : String(current);
 return inp;
 }

 // text (multiline)
 const ta = document.createElement("textarea");
 ta.className = "field-input";
 ta.rows = 2;
 ta.placeholder = meta.placeholder || "";
 ta.value = current == null ? "" : String(current);
 return ta;
}

function renderInterventions(listEl, interventions, patientId){
 listEl.innerHTML = "";
 const src = Array.isArray(interventions) ? interventions : [];
 const items = src.slice().reverse(); // newest first
 if(!items.length){
 const empty = document.createElement("div");
 empty.className = "itv-empty";
 empty.textContent = "Aucune intervention enregistrée.";
 listEl.appendChild(empty);
 return;
 }

 for(let i=0;i<items.length;i++){
 const it = items[i];
 const originalIndex = (src.length - 1) - i;

 const row = document.createElement("div");
 row.className = "itv-row";

 const metaRow = document.createElement("div");
 metaRow.className = "itv-meta-row";

 const meta = document.createElement("div");
 meta.className = "itv-meta";

 const actions = document.createElement("div");
 actions.className = "itv-actions";

 const txt = document.createElement("div");
 txt.className = "itv-text";

 // rétro-compat: anciennes entrées pouvaient être des strings
 if(typeof it === "string"){
 meta.textContent = "";
 txt.textContent = it;
 }else{
 let metaTxt = fmtTS(it?.ts);
 if(it?.account) metaTxt += ` — ${it.account}`;
 meta.textContent = metaTxt;
 txt.textContent = it?.text ?? "";

 const canEdit = !!(patientId && AUTH_ACCOUNT && it?.account && String(it.account) === String(AUTH_ACCOUNT));
 if(canEdit){
 const editBtn = document.createElement("button");
 editBtn.className = "itv-action-btn";
 editBtn.type = "button";
 editBtn.textContent = "Modifier";
 editBtn.addEventListener("click", async () => {
 const current = String(src?.[originalIndex]?.text ?? "");
 const next = await modalPrompt({
 title: "Modifier l'intervention",
 label: "Texte de l'intervention",
 value: current,
 multiline: true,
 okText: "Enregistrer",
 });
 if(next == null) return;
 const v = String(next).trim();
 if(!v) return;
 const all = loadExtra();
 const list = Array.isArray(all?.[patientId]?.interventions) ? all[patientId].interventions : [];
 if(list[originalIndex] && typeof list[originalIndex] === "object"){
 list[originalIndex].text = v;
 all[patientId] = all[patientId] || {};
 all[patientId].interventions = list;
 saveExtra(all);
 renderInterventions(listEl, getInterventions(patientId), patientId);
 }
 });

 const delBtn = document.createElement("button");
 delBtn.className = "itv-action-btn danger";
 delBtn.type = "button";
 delBtn.textContent = "Supprimer";
 delBtn.addEventListener("click", async () => {
 const ok = await modalConfirm({
 title: "Supprimer l'intervention",
 message: "Supprimer cette intervention ?",
 okText: "Supprimer",
 cancelText: "Annuler",
 danger: true,
 });
 if(!ok) return;
 const all = loadExtra();
 const list = Array.isArray(all?.[patientId]?.interventions) ? all[patientId].interventions : [];
 if(originalIndex >= 0 && originalIndex < list.length){
 list.splice(originalIndex, 1);
 all[patientId] = all[patientId] || {};
 all[patientId].interventions = list;
 saveExtra(all);
 renderInterventions(listEl, getInterventions(patientId), patientId);
 }
 });

 actions.appendChild(editBtn);
 actions.appendChild(delBtn);
 }
 }

 metaRow.appendChild(meta);
 if(actions.childElementCount) metaRow.appendChild(actions);

 row.appendChild(metaRow);
 row.appendChild(txt);
 listEl.appendChild(row);
 }
}

async function showDossier(patient){
 const pid = patient.id;
 currentPatientId = pid;

 // merge extra (and ensure keys exist)
 const all = loadExtra();
 const extra = { ...(all[pid] || {}) };
 for(const f of EXTRA_FIELDS){ if(extra[f] == null) extra[f] = null; }

 const ageNum = computePatientAge(patient, extra);
 {
 const nm = (extra.displayName && String(extra.displayName).trim()) ? String(extra.displayName).trim() : (patient.name || pid);
 currentPatientPill.textContent = displayNameWithAge(nm, ageNum);
}

 // header message (typewriter)
 {
 const nm = (extra.displayName && String(extra.displayName).trim()) ? String(extra.displayName).trim() : (patient.name || pid);
 await aiSay(`📁 Ouverture du dossier de "${displayNameWithAge(nm, ageNum)}"…`);
}

 // panel message (rich)
 const { bubble } = addMessage("ai", "");
 bubble.classList.add("dossier");

 const top = document.createElement("div");
 top.className = "dossier-top";
 const titleRow = document.createElement("div");
 titleRow.className = "dossier-title-row";

 const title = document.createElement("div");
 title.className = "dossier-title clickable";

 const phone = document.createElement("div");
 phone.className = "dossier-phone clickable";

 // Nom + téléphone persistés côté serveur
 const baseName = (extra.displayName && String(extra.displayName).trim()) ? String(extra.displayName).trim() : (patient.name || pid);
 const basePhone = (extra.phone && String(extra.phone).trim()) ? String(extra.phone).trim() : "555-0000";

 const refreshTitle = () => {
 const allNow = loadExtra();
 const exNow = allNow?.[pid] || {};
 const nm = (exNow.displayName && String(exNow.displayName).trim()) ? String(exNow.displayName).trim() : (patient.name || pid);
 const ph = (exNow.phone && String(exNow.phone).trim()) ? String(exNow.phone).trim() : "555-0000";
 title.textContent = `Dossier : ${displayNameWithAge(nm, ageNum)}`;
 phone.textContent = ph;
 currentPatientPill.textContent = displayNameWithAge(nm, ageNum);
 };

 // initial
 title.textContent = `Dossier : ${displayNameWithAge(baseName, ageNum)}`;
 phone.textContent = basePhone;

 title.addEventListener("click", async () => {
 const allNow = loadExtra();
 const exNow = allNow?.[pid] || {};
 const currentName = (exNow.displayName && String(exNow.displayName).trim()) ? String(exNow.displayName).trim() : (patient.name || pid);
 const next = await modalPrompt({
 title: "Modifier le nom du patient",
 label: "Nom du patient",
 value: currentName,
 placeholder: "Nom du patient",
 multiline: false,
 okText: "Enregistrer",
 });
 if(next == null) return;
 const v = String(next).trim();
 if(!v) return;
 savePatientMeta(pid, "displayName", v);
 refreshTitle();
 });

 phone.addEventListener("click", async () => {
 const allNow = loadExtra();
 const exNow = allNow?.[pid] || {};
 const currentPhone = (exNow.phone && String(exNow.phone).trim()) ? String(exNow.phone).trim() : "555-0000";
 const next = await modalPrompt({
 title: "Modifier le numéro de téléphone",
 label: "Téléphone",
 value: currentPhone,
 placeholder: "555-0000",
 multiline: false,
 okText: "Enregistrer",
 });
 if(next == null) return;
 const v = String(next).trim();
 // vide -> retour valeur par défaut
 savePatientMeta(pid, "phone", v ? v : null);
 refreshTitle();
 });

 titleRow.appendChild(title);
 titleRow.appendChild(phone);

 const mini = document.createElement("div");
 mini.className = "dossier-mini";
 mini.textContent = "Vous pouvez modifier les infos ci-dessous. C'est sauvegardé localement dans votre navigateur.";

 top.appendChild(titleRow);
 top.appendChild(mini);

 const info = document.createElement("div");
 info.className = "dossier-info";
 const risks = computeRisks(patient, extra);

 try{
 const summary = summarizePatient(patient, extra, risks);
 info.textContent = capFirst(summary.text);
 }catch(e){
 info.textContent = "Résumé indisponible.";
 }

 // Photo de profil (à côté de la box dossier-info)
 const photoCard = document.createElement("div");
 photoCard.className = "dossier-photo-card";

 const photoTitle = document.createElement("div");
 photoTitle.className = "dossier-photo-title";
 photoTitle.textContent = "Photo";

 const photoBody = document.createElement("div");
 photoBody.className = "dossier-photo-body";

 const renderPhoto = () => {
 photoBody.innerHTML = "";
 const val = getPatientProfilePhoto(pid);
 if(val && String(val).trim().toUpperCase() !== "N/A"){
 const img = document.createElement("img");
 img.className = "dossier-photo-img";
 img.alt = "Photo de profil";
 img.src = photoUrlFromFilename(String(val));
 img.title = "Cliquer pour zoomer";
 img.addEventListener("click", async () => {
 const wrap = document.createElement("div");
 wrap.className = "photo-zoom-wrap";
 const big = document.createElement("img");
 big.className = "photo-zoom-img";
 big.alt = "Photo de profil";
 big.src = photoUrlFromFilename(String(val));
 wrap.appendChild(big);
 const res = await openChatModal({
 title: "Photo de profil",
 bodyNode: wrap,
 okText: "Modifier la photo",
 cancelText: "Fermer",
 okClass: "primary",
 showCancel: true,
 });
 if(res.ok){
 await askVisualDataQuestion(pid, baseName, { type: "noop", onDone: renderPhoto });
 }
 });
 photoBody.appendChild(img);
 }else{
 const isNA = !!(val && String(val).trim().toUpperCase() === "N/A");
 const wrap = document.createElement("div");
 wrap.className = "dossier-photo-empty";

 const ph = document.createElement("div");
 ph.className = "dossier-photo-placeholder";
 ph.textContent = isNA ? "N/A" : "Aucune";
 wrap.appendChild(ph);

 // Même si la photo est marquée "N/A", on permet d'en uploader une.
 const up = document.createElement("button");
 up.className = "dossier-photo-upload-btn";
 up.type = "button";
 up.textContent = "Upload";
 up.addEventListener("click", async () => {
 await askVisualDataQuestion(pid, baseName, { type: "noop", onDone: renderPhoto });
 });
 wrap.appendChild(up);

 photoBody.appendChild(wrap);
}
 };

 renderPhoto();

 photoCard.appendChild(photoTitle);
 photoCard.appendChild(photoBody);

 const infoRow = document.createElement("div");
 infoRow.className = "dossier-row";
 infoRow.appendChild(info);
 infoRow.appendChild(photoCard);

 const fields = document.createElement("div");
 fields.className = "dossier-fields";

 const controls = {};
 for(const f of EXTRA_FIELDS){
 const row = document.createElement("div");
 row.className = "field-row";
 const lab = document.createElement("div");
 lab.className = "field-label";
 lab.textContent = FIELD_LABELS[f] || f;
 const currentVal = getEffectiveFieldValue(patient, extra, f);
 const input = buildControl(f, currentVal);
 controls[f] = input;
 row.appendChild(lab);
 row.appendChild(input);
 fields.appendChild(row);
 }

 const actions = document.createElement("div");
 actions.className = "dossier-actions";

 const saveBtn = document.createElement("button");
 saveBtn.className = "choice good";
 saveBtn.textContent = "Enregistrer les modifications";
 saveBtn.addEventListener("click", async () => {
 for(const f of EXTRA_FIELDS){
 const v = (controls[f].value || "").trim();
 saveField(pid, f, v ? v : null);
 }
 await aiSay("✅ Dossier mis à jour.");
 });

 const diagBtn = document.createElement("button");
 diagBtn.className = "choice";
 diagBtn.textContent = "Calculer un diagnostic";
 diagBtn.addEventListener("click", async () => {
 {
 const exNow = loadExtra()?.[pid] || {};
 const nm = (exNow.displayName && String(exNow.displayName).trim()) ? String(exNow.displayName).trim() : (patient.name || pid);
 await runDiagnosis(pid, nm);
 }
 });

 actions.appendChild(saveBtn);
 actions.appendChild(diagBtn);

 const itvBlock = document.createElement("div");
 itvBlock.className = "itv-block";

 const itvHead = document.createElement("div");
 itvHead.className = "itv-head";
 itvHead.textContent = "Interventions";

 const itvList = document.createElement("div");
 itvList.className = "itv-list";

 const itvForm = document.createElement("div");
 itvForm.className = "itv-form";

 const itvInput = document.createElement("textarea");
 itvInput.className = "itv-input";
 itvInput.placeholder = "Ajouter une intervention (ex: pansement, ordonnance, note du médecin…)";

 const itvBtn = document.createElement("button");
 itvBtn.className = "choice";
 itvBtn.textContent = "Ajouter";
 itvBtn.addEventListener("click", () => {
 const t = (itvInput.value || "").trim();
 if(!t) return;
 addInterventionTo(pid, t);
 itvInput.value = "";
 renderInterventions(itvList, getInterventions(pid), pid);
 });

 itvForm.appendChild(itvInput);
 itvForm.appendChild(itvBtn);

 itvBlock.appendChild(itvHead);
 itvBlock.appendChild(itvList);
 itvBlock.appendChild(itvForm);

 bubble.appendChild(top);
 bubble.appendChild(infoRow);
 bubble.appendChild(fields);
 bubble.appendChild(actions);
 bubble.appendChild(itvBlock);

 renderInterventions(itvList, getInterventions(pid), pid);

 chatEl.scrollTop = chatEl.scrollHeight;
}

async function openDossierByQuery(query){
 const raw = (query || "").trim();
 if(!raw){
 const pid = currentPatientId || pending?.patientId || pendingVisual?.patientId;
 if(!pid){
 await aiSay("Aucun patient actif. Donnez un nom complet, ou cherchez un patient d'abord.");
 return;
 }
 const p = getPatientById(pid) || { id: pid, name: currentPatientPill?.textContent || pid, answers:{}, derived:{} };
 await showDossier(p);
 return;
 }

 const norm = normalize(raw);
 const tokens = norm.split(/\s+/).filter(Boolean);

 // nom incomplet (1 token) -> liste
 if(tokens.length === 1){
 const matches = findPartialNameMatches(tokens[0]);
 if(matches.length){
 const head = tpl(pick(BOT.INCOMPLETE_NAME_HEAD, tokens[0]), {token: titleCase(raw)});
 const tail = pick(BOT.INCOMPLETE_NAME_TAIL, tokens[0]);
 const intro = pick(BOT.INCOMPLETE_SUGGEST, tokens[0]);
 const shown = matches.slice(0, 10);
 const list = shown.map(p=>`• ${titleCase(p.name)}`).join("\n");
 const bubble = await aiSay(`${head}\n${tail}\n\n${intro}\n${list}`);
 addButtons(bubble, shown.map(p => ({
 label: titleCase(p.name),
 onClick: () => showDossier(p)
 })));
 addCreateProfileButton(bubble, raw);
 return;
 }
 }

 const cands = suggestCandidates(raw, 8);
 if(cands.length){
 const best = cands[0];
 if(best.score >= 0.62){
 await showDossier(best.p);
 return;
 }
 const head = pick(BOT.DID_YOU_MEAN_HEAD, raw);
 const shown = cands.slice(0, 8);
 const list = shown.map(x=>`• ${titleCase(x.p.name)}`).join("\n");
 const bubble = await aiSay(`${head}\n${list}`);
 addButtons(bubble, shown.map(x => ({
 label: titleCase(x.p.name),
 onClick: () => showDossier(x.p)
 })));
 addCreateProfileButton(bubble, raw);
 return;
 }

 await aiSay(tpl(BOT.MATCH_NOT_FOUND, {name: titleCase(raw)}));
}


// --- Actions rapides & commandes "naturelles" ---

function isLikelyFullName(name){
 const tokens = normalize(String(name || "")).split(/\s+/).filter(Boolean);
 return tokens.length >= 2;
}

async function requestFullNameForCreation(rawName=""){
 const nm = (rawName || "").trim();
 const prefix = nm ? `Tu m'as donné "${titleCase(nm)}". ` : "";
 await aiSay(prefix + `Pour créer un dossier, j'ai besoin du nom complet (Prénom + Nom).\nExemple : /créer "Michel Muck"`);
}

async function createProfileFromRawName(rawName){
 const nm = (rawName || "").trim();
 if(!nm){
 await requestFullNameForCreation("");
 return;
 }
 if(!isLikelyFullName(nm)){
 lastUnknownName = nm;
 await requestFullNameForCreation(nm);
 return;
 }
 await startCreateFlow(nm);
}

function addCreateProfileButton(bubbleEl, rawName){
 if(!bubbleEl) return;
 const nm = (rawName || "").trim();
 const labelName = nm ? titleCase(nm) : "ce patient";
 addButtons(bubbleEl, [{
 label: `Créer le profil de ${labelName}`,
 klass: "good",
 onClick: () => createProfileFromRawName(nm)
 }]);
}

async function setActivePatient(patient){
 const pid = patient?.id;
 if(!pid) return null;
 const extra = loadExtra()?.[pid] || {};
 const nm = (extra.displayName && String(extra.displayName).trim()) ? String(extra.displayName).trim() : (patient.name || pid);
 const ageNum = computePatientAge(patient, extra);
 currentPatientId = pid;
 currentPatientPill.textContent = displayNameWithAge(nm, ageNum);
 return { pid, name: nm, ageNum };
}

async function startInterventionCaptureFor(patientId){
 const pid = patientId || currentPatientId || pending?.patientId || pendingVisual?.patientId;
 if(!pid){
 await aiSay("Aucun patient actif. Ouvrez un dossier (/dossier) ou recherchez un patient d'abord.");
 return;
 }
 const patient = getPatientById(pid) || { id: pid, name: String(currentPatientPill?.textContent || pid), answers:{}, derived:{} };
 const meta = await setActivePatient(patient);
 pendingIntervention = { patientId: pid };
 await aiSay(`🩺 Je vous écoute docteur : énoncez l'intervention à ajouter au dossier de "${displayNameWithAge(titleCase(meta?.name || patient.name), meta?.ageNum)}".`);
}

// Résout un patient à partir d'une saisie (avec suggestions), puis exécute action(patient)
async function resolvePatientAnd(raw, action){
 const q = (raw || "").trim();

 // sans saisie: patient courant (ou "en cours" via questions)
 if(!q){
 const pid = currentPatientId || pending?.patientId || pendingVisual?.patientId;
 if(!pid){
 await aiSay("Aucun patient actif. Donnez un nom complet, ou cherchez un patient d'abord.");
 return;
 }
 const p = getPatientById(pid) || { id: pid, name: String(currentPatientPill?.textContent || pid), answers:{}, derived:{} };
 await action(p);
 return;
 }

 const norm = normalize(q);
 const tokens = norm.split(/\s+/).filter(Boolean);

 if(tokens.length === 1){
 const matches = findPartialNameMatches(tokens[0]);
 if(matches.length){
 const head = tpl(pick(BOT.INCOMPLETE_NAME_HEAD, tokens[0]), {token: titleCase(q)});
 const tail = pick(BOT.INCOMPLETE_NAME_TAIL, tokens[0]);
 const intro = pick(BOT.INCOMPLETE_SUGGEST, tokens[0]);
 const shown = matches.slice(0, 10);
 const list = shown.map(p=>`• ${titleCase(p.name)}`).join("\n");
 const bubble = await aiSay(`${head}\n${tail}\n\n${intro}\n${list}`);
 addButtons(bubble, shown.map(p => ({
 label: titleCase(p.name),
 onClick: () => action(p)
 })));
 addCreateProfileButton(bubble, q);
 return;
 }
 }

 const cands = suggestCandidates(q, 8);
 if(cands.length){
 const best = cands[0];
 if(best.score >= 0.62){
 await action(best.p);
 return;
 }
 const head = pick(BOT.DID_YOU_MEAN_HEAD, q);
 const shown = cands.slice(0, 8);
 const list = shown.map(x=>`• ${titleCase(x.p.name)}`).join("\n");
 const bubble = await aiSay(`${head}\n${list}`);
 addButtons(bubble, shown.map(x => ({
 label: titleCase(x.p.name),
 onClick: () => action(x.p)
 })));
 addCreateProfileButton(bubble, q);
 return;
 }

 lastUnknownName = q;
 await aiSay(tpl(BOT.MATCH_NOT_FOUND, {name: titleCase(q)}));
 // Conseil commandes
 await aiSay('Astuce: utilisez /dossier, /intervention ou /créer si vous voulez être sûr de l\'action.');
}

async function openInterventionByQuery(query){
 await resolvePatientAnd(query, async (patient) => {
 await setActivePatient(patient);
 await startInterventionCaptureFor(patient.id);
 });
}

// --- Parsing "langage naturel" -> commandes (sans slash) ---

// Mots/expressions qui ressemblent aux commandes
const NATURAL = {
 create: {
 verbs: [
 "creer","cree","creation","création","ajouter","ajoute","ajout","nouveau","nouvelle",
 "enregistrer","enregistre","inscrire","inscris","ouvrir","ouvre"
 ],
 nouns: ["dossier","patient","profil","fiche"],
 phrases: ["nouveau patient","ajoute un patient","ajouter un patient","cree un patient","creer un patient","cree un dossier","creer un dossier","cree un dossier patient","creer un dossier patient"]
 },
 dossier: {
 verbs: ["ouvre","ouvrir","affiche","afficher","montre","montrer","voir","consulte","consulter","accede","accéder"],
 nouns: ["dossier","profil","fiche","patient"],
 phrases: ["dossier de","dossier du","fiche de","profil de","montre moi","affiche moi","ouvre le dossier"]
 },
 intervention: {
 verbs: ["redige","rediger","ecris","ecrire","dicte","dicter","ajoute","ajouter","note","noter","enregistre","enregistrer"],
 nouns: ["intervention","compte rendu","compterendu","cr","rapport","operatoire","opératoire"],
 phrases: ["redige une intervention","rédige une intervention","j'ai pratique","jai pratique","j'ai opéré","jai opere","j'ai opere","j'ai pratiqué","jai pratiqué","j ai pratique","j ai opéré","j ai opere"]
 }
};

// Termes qui pourraient indiquer qu'un nom arrive ensuite
const NAME_HINTS = [
 "pour le patient","pour la patiente","sur le patient","sur la patiente",
 "dossier de","dossier du","dossier des","fiche de","profil de",
 "au sujet de","a propos de","à propos de","concernant","chez","pour","sur","de","du","des","d'"
];

const NAME_STOPWORDS = new Set([
 "aujourdhui","aujourd'hui","hier","demain","ce","cette","cet","matin","soir","apres","avant",
 "svp","stp","merci","et","avec","sans","par","dans","en","au","aux","la","le","les","un","une",
 "patient","patiente","dossier","profil","fiche","intervention","compte","rendu","rapport"
]);

function _cleanRawForParse(raw){
 return String(raw || "").trim().replace(/[’`]/g, "'");
}

function _looksLikeNameTokens(tokens){
 if(!tokens || !tokens.length) return false;
 if(tokens.length > 6) return false;
 return tokens.every(t => /^[a-zà-ÿ'-]+$/i.test(t) && !/[0-9]/.test(t));
}

function _cleanupNameCandidate(rawTail){
 let t = String(rawTail || "").trim();
 if(!t) return "";

 // retire ponctuation / espaces fin
 t = t.replace(/[\s,.;:!?]+$/g, "");

 // retire préfixes fréquents
 t = t.replace(/^\s*(?:le|la|les|du|des|de la|de l'|d')\s+/i, "");
 t = t.replace(/^\s*(?:patient|patiente|monsieur|madame|mme|mr|m\.|dr)\s+/i, "");

 const rawWords = t.split(/\s+/).filter(Boolean);
 const normWords = normalize(t).split(/\s+/).filter(Boolean);
 const kept = [];
 for(let i=0;i<rawWords.length;i++){
 const nw = normWords[i] || "";
 if(!nw) continue;
 if(NAME_STOPWORDS.has(nw)) break;
 if(/\d/.test(rawWords[i])) break;
 // ne garder que des mots "nom" plausibles
 if(!/^[a-zà-ÿ'-]+$/i.test(rawWords[i])) break;
 kept.push(rawWords[i]);
 // on s'arrête à 4 mots max pour un nom
 if(kept.length >= 4) break;
 }
 const out = kept.join(" ").trim();
 // si un seul token très court, on évite de sur-interpréter
 const toks = normalize(out).split(/\s+/).filter(Boolean);
 if(toks.length === 1 && toks[0].length < 2) return "";
 return out;
}

function extractQuotedOrTail(text, {intent=null} = {}){
 const raw = _cleanRawForParse(text);
 if(!raw) return { name:"", rest:"" };

 // 1) Nom entre guillemets
 const q = raw.match(/^[^"“”']*["“”']([^"“”']+)["“”']/) || raw.match(/"([^"]+)"/) || raw.match(/'([^']+)'/);
 if(q){
 const name = String(q[1] || "").trim();
 const rest = raw.replace(q[0], "").trim();
 return { name, rest };
 }

 const low = raw.toLowerCase();
 // 2) Après un indice de nom (pour/sur/de/chez/...)
 let best = { idx: -1, phrase: "" };
 for(const phrase of NAME_HINTS){
 const p = phrase.toLowerCase();
 const idx = low.lastIndexOf(p);
 if(idx < 0) continue;
 // frontière de mot approximative
 const before = idx === 0 ? " " : low[idx-1];
 const after = low[idx + p.length] || " ";
 const okBefore = /\s|[\(\[\{"'“”.,;:!?-]/.test(before);
 const okAfter = /\s/.test(after);
 if(okBefore && okAfter && idx >= best.idx){
 best = { idx, phrase: p };
 }
 }
 if(best.idx >= 0){
 const tail = raw.slice(best.idx + best.phrase.length).trim();
 const cleaned = _cleanupNameCandidate(tail);
 // "reste" = ce qu'il y a après le nom (utile pour : "j'ai pratiqué sur X une suture...")
 if(cleaned){
 const tailNorm = normalize(tail).split(/\s+/).filter(Boolean);
 const nameNorm = normalize(cleaned).split(/\s+/).filter(Boolean);
 let rest = "";
 if(tailNorm.length > nameNorm.length && tailNorm.slice(0, nameNorm.length).join(" ") === nameNorm.join(" ")){
 const rawTailWords = tail.split(/\s+/).filter(Boolean);
 rest = rawTailWords.slice(nameNorm.length).join(" ").trim();
 }
 return { name: cleaned, rest };
 }
 }

 // 3) Fallback: après des mots-clés (dossier/patient/intervention)
 const mAfterKeyword = raw.match(/\b(?:dossier|patient|patiente|profil|fiche)\b\s+(.+)$/i);
 if(mAfterKeyword){
 const cleaned = _cleanupNameCandidate(mAfterKeyword[1]);
 if(cleaned) return { name: cleaned, rest: "" };
 }

 // 4) Fallback: prendre la fin si elle ressemble à un nom
 const words = raw.replace(/[\s,.;:!?]+$/g, "").split(/\s+/).filter(Boolean);
 for(let k=4;k>=2;k--){
 if(words.length < k) continue;
 const cand = words.slice(-k).join(" ");
 const toks = normalize(cand).split(/\s+/).filter(Boolean);
 if(_looksLikeNameTokens(toks)) return { name: cand, rest: "" };
 }

 // 5) Pas de nom détecté
 return { name:"", rest:"" };
}

function _containsAny(normText, items){
 for(const it of items){
 const n = normalize(String(it));
 if(!n) continue;
 if(new RegExp(`\\b${n.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i").test(normText)) return true;
 }
 return false;
}

function detectNaturalIntent(raw){
 const cleaned = _cleanRawForParse(raw);
 const normText = normalize(cleaned);
 const low = cleaned.toLowerCase();

 const score = { create: 0, dossier: 0, intervention: 0 };

 // create
 if(_containsAny(normText, NATURAL.create.verbs)) score.create += 1;
 if(_containsAny(normText, NATURAL.create.nouns)) score.create += 1;
 if(NATURAL.create.phrases.some(p => low.includes(p))) score.create += 2;

 // dossier
 if(_containsAny(normText, NATURAL.dossier.verbs)) score.dossier += 1;
 if(_containsAny(normText, NATURAL.dossier.nouns)) score.dossier += 1;
 if(NATURAL.dossier.phrases.some(p => low.includes(p))) score.dossier += 1;
 if(/^\s*dossier\b/i.test(cleaned)) score.dossier += 2;

 // intervention
 if(_containsAny(normText, NATURAL.intervention.verbs)) score.intervention += 1;
 if(_containsAny(normText, NATURAL.intervention.nouns)) score.intervention += 2;
 if(NATURAL.intervention.phrases.some(p => low.includes(p))) score.intervention += 3;

 // pick best
 const entries = Object.entries(score).sort((a,b)=>b[1]-a[1]);
 const [bestType, bestScore] = entries[0];
 const secondScore = entries[1]?.[1] ?? 0;

 return {
 score,
 bestType,
 bestScore,
 ambiguous: bestScore >= 2 && (bestScore - secondScore) < 1
 };
}

async function tryHandleNaturalCommand(text){
 const raw = _cleanRawForParse(text);
 if(!raw || raw.startsWith("/")) return false;

 const intent = detectNaturalIntent(raw);
 // Ne rien faire si aucune intention claire
 if(intent.bestScore < 2) return false;

 // Ambigu -> conseiller les commandes
 if(intent.ambiguous){
 await aiSay(
 "Je ne suis pas sûr de l'action demandée. "+
 "Pour être certain, utilisez une commande :\n"+
 "- /créer \"Nom Prénom\" (crée un dossier / nouveau patient / ajoute un patient…)\n"+
 "- /dossier [Nom] (affiche/montre/ouvre le dossier…)\n"+
 "- /intervention [Nom] (rédige/ajoute une intervention / j'ai pratiqué sur…)"
 );
 return true;
 }

 const {name, rest} = extractQuotedOrTail(raw, {intent: intent.bestType});

 if(intent.bestType === "create"){
 if(name){
 await createProfileFromRawName(name);
 } else {
 await requestFullNameForCreation("");
 }
 return true;
 }

 if(intent.bestType === "dossier"){
 await openDossierByQuery(name);
 return true;
 }

 if(intent.bestType === "intervention"){
 // Si la phrase contient déjà un texte d'intervention après le nom, on l'ajoute directement.
 const itvText = (rest || "").trim();
 if(name && itvText && itvText.length >= 8){
 await resolvePatientAnd(name, async (patient) => {
 await setActivePatient(patient);
 addInterventionTo(patient.id, itvText);
 const ex = loadExtra()?.[patient.id] || {};
 const nm = (ex.displayName && String(ex.displayName).trim()) ? String(ex.displayName).trim() : patient.name;
 await aiSay(`🗒️ Intervention ajoutée au dossier de "${titleCase(nm)}".`);
 });
 return true;
 }
 // Sinon: mode dictée (sur patient ciblé ou actif)
 if(name){
 await openInterventionByQuery(name);
 return true;
 }
 await startInterventionCaptureFor(currentPatientId || pending?.patientId || pendingVisual?.patientId);
 return true;
 }

 return false;
}



async function typeInto(bubbleEl, text, speed=12){
 bubbleEl.textContent = "";
 const chunk = () => 2; // chars per tick
 return new Promise((resolve) => {
 let i=0;
 const tick = () => {
 i += chunk();
 bubbleEl.textContent = text.slice(0, i);
 chatEl.scrollTop = chatEl.scrollHeight;
 if(i < text.length){
 setTimeout(tick, speed);
 } else resolve();
 };
 tick();
 });
}

async function aiSay(text, {typewriter=true} = {}){
 const {bubble} = addMessage("ai", "");
 if(typewriter) await typeInto(bubble, text);
 else bubble.textContent = text;
 return bubble;
}

// Sidebar rendering
function renderPatientList(){ /* UI simplifiée: fonction non utilisée */ }


function renderDiseaseList(){ /* UI simplifiée: fonction non utilisée */ }


function switchTab(){ /* UI simplifiée: fonction non utilisée */ }


// Diagnosis engine
function getPatientById(id){
 return getPatientByIdAny(id);
}

// Name matching (tolérant aux fautes)
function scoreNameQuery(query, patientName){
 const q = normalize(query);
 const n = normalize(patientName);
 if(!q || !n) return 0;
 if(q === n) return 1;

 const fullSim = similarity(q, n);

 const qTokens = q.split(/\s+/).filter(Boolean);
 const nTokens = n.split(/\s+/).filter(Boolean);

 let tokenAvg = 0;
 if(qTokens.length){
 let sum = 0;
 for(const qt of qTokens){
 let best = 0;
 for(const nt of nTokens){
 let s = similarity(qt, nt);
 if(nt.includes(qt) || qt.includes(nt)) s = Math.max(s, 0.92);
 best = Math.max(best, s);
 }
 sum += best;
 }
 tokenAvg = sum / qTokens.length;
 }

 let score = (qTokens.length === 1)
 ? (0.75 * tokenAvg + 0.25 * fullSim)
 : (0.65 * tokenAvg + 0.35 * fullSim);

 if(n.includes(q) || q.includes(n)) score = Math.min(1, score + 0.10);
 if(q[0] && n[0] && q[0] === n[0]) score = Math.min(1, score + 0.03);
 return score;
}

function suggestCandidates(query, limit=8){
 const scored = [];
 for(const p of allPatients()){
 const s = scoreNameQuery(query, p.name);
 if(s > 0.35) scored.push({ p, score: s });
 }
 scored.sort((a,b)=> (b.score - a.score) || a.p.name.localeCompare(b.p.name));
 return scored.slice(0, limit);
}

function findBestMatch(name){
 const top = suggestCandidates(name, 1);
 return top[0] || { p: null, score: 0 };
}

function tokenCandidates(token, limit=12){
 const t = normalize(token);
 if(!t) return [];
 const scored = [];
 for(const p of allPatients()){
 const parts = normalize(p.name).split(/\s+/).filter(Boolean);
 let best = 0;
 for(const part of parts){
 let s = similarity(t, part);
 if(part.includes(t) || t.includes(part)) s = Math.max(s, 0.92);
 best = Math.max(best, s);
 }
 if(best >= 0.50) scored.push({ p, score: best });
 }
 scored.sort((a,b)=> (b.score - a.score) || a.p.name.localeCompare(b.p.name));
 return scored.slice(0, limit);
}

function findPartialNameMatches(token){
 return tokenCandidates(token, 12).map(x => x.p);
}

// --- Champs : valeur effective (extra si renseigné, sinon base patient) ---
function getEffectiveFieldValue(patient, extra, field){
 const e = (extra || {})[field];
 if(e != null && String(e).trim() !== "") return e;

 const a = patient?.answers || {};
 const d = patient?.derived || {};

 switch(field){
 case "alcoholFreq": return a.alcoholFreq ?? null;
 case "drugs": return a.drugs ?? null;
 case "socialScore": return d.socialScore ?? (a.socialScoreRaw ?? null);
 case "happiness": return d.happiness ?? (a.happiness ?? null);
 case "healthProblems": return a.healthProblems ?? null;
 case "operation": return a.operation ?? null;
 default: return null;
 }
}

function computePatientAge(patient, extra){
 const bd = getEffectiveFieldValue(patient, extra, "birthDate") ?? extra?.birthDate;
 return computeAgeFromBirthDate(bd);
}





function fieldScore(field, value){
 if(value == null) return null;
 switch(field){
 case "cigarette":
 // Tabac / Vapotage
 return ({
 "non": 0.0,
 "un peu cigarette": 0.45,
 "un peu Vap": 0.35,
 "beaucoup cigarette": 0.90,
 "beaucoup Vap": 0.75
 // legacy
 ,"Non": 0.0,
 "Occasionnel": 0.45,
 "1 paquet/jour": 0.90,
 "Chaîne": 1.0
 })[value] ?? 0.45;
 case "corpulence":
 return ({ "Maigre":0.20, "Normal":0.35, "Enrobé":0.65, "Obèse":0.90 })[value] ?? 0.35;
 case "age":
 return ({ "<18":0.10, "18-30":0.25, "31-45":0.45, "46-60":0.65, "60+":0.85 })[value] ?? 0.25;
 case "sport":
 // returns sedentarite risk (inverse sport)
 return ({ "Jamais":1.0, "1-2/sem":0.60, "3-5/sem":0.30, "Tous les jours":0.10 })[value] ?? 0.45;
 default:
 return 0.4;
 }
}

function tobaccoBreakdown(v){
 const s = String(v || "");
 // Split cigarette vs vape to better match respiratory vs metabolique
 // Scores are 0..1
 switch(s){
 case "non":
 case "Non":
 return { smoke: 0.0, vape: 0.0 };
 case "un peu cigarette":
 case "Occasionnel":
 return { smoke: 0.55, vape: 0.10 };
 case "beaucoup cigarette":
 case "1 paquet/jour":
 return { smoke: 0.95, vape: 0.12 };
 case "Chaîne":
 return { smoke: 1.00, vape: 0.15 };
 case "un peu Vap":
 return { smoke: 0.10, vape: 0.60 };
 case "beaucoup Vap":
 return { smoke: 0.12, vape: 0.95 };
 default:
 // unknown -> faible (évite de sur-estimer quand le dossier est vide)
 return { smoke: 0.12, vape: 0.10 };
 }
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

function dietToRisk(v){
 const s = String(v || "");
 if(!s) return null;
 return ({
 "ne mange jamais (coma régulié)": 1.0,
 "ultra-tranformé (ltd)": 0.85,
 "fast food": 0.70,
 "restaurant (bonne qualité)": 0.45,
 "a la maison (meilleur qualité)": 0.30
 })[s] ?? 0.55;
}

// --- Problèmes de santé (choix prédéfinis) ---
// On normalise aussi les anciennes variantes/typos (ex: "Signe de vielliesse...").
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
 if(!s0) return "__default";
 const s = s0.toLowerCase();

 // N/A / inconnu
 if(s === "n/a" || s === "na" || s === "n-a") return "N/A";

 // Aucun
 if(s.includes("non") || s.includes("aucun")) return "NON";

 if(s.includes("cancer")) return "Cancer";
 if(s.includes("immun") || s.includes("immuno")) return "Immunodépressive";
 if(s.includes("greff")) return "Greffe";
 if(s.includes("handicap") && s.includes("mote")) return "Handicap moteur";
 if(s.includes("handicap") && s.includes("mental")) return "Handicap mental";
 if(s.includes("sex")) return "Maladie Sexuel";
 if(s.includes("genet") && (s.includes("hered") || s.includes("héré") || s.includes("héré"))) return "Maladie genetique héréditaire";
 if(s.includes("genet")) return "Maladie genetique non transmissible";
 if(s.includes("vieill") || s.includes("viell") || s.includes("osteo") || s.includes("ostéo") || s.includes("catar")){
 return "Signe de vieillesse (Ostéo / Cataracte ...)";
 }
 if(s.includes("autre")) return "Autre";

 // Déjà une valeur connue ?
 for(const v of HEALTH_PROBLEMS_CHOICES){
 if(String(v).toLowerCase() === s) return v;
 }
 return "Autre";
}

function clampBoost(x){
 // Le boost est appliqué directement au score (logit). On autorise un petit négatif (profil "très sain").
 return clamp(x, -0.25, 0.85);
}

function applyHealthProblemsEffects(risks, hpKey){
 const r = { ...risks };

 const add = (k, d) => {
 if(typeof r[k] !== "number") return;
 r[k] = clamp(r[k] + d, 0, 1);
 };
 const addBoost = (d) => { r.globalBoost = clampBoost((r.globalBoost || 0) + d); };

 switch(hpKey){
 case "NON":
 addBoost(-0.10);
 add("stress", -0.05);
 add("mental", -0.06);
 add("immunite", -0.08);
 add("infectieux", -0.05);
 break;

 case "Cancer":
 addBoost(+0.40);
 add("immunite", +0.35);
 add("infectieux", +0.20);
 add("stress", +0.15);
 add("mental", +0.12);
 break;

 case "Immunodépressive":
 addBoost(+0.30);
 add("immunite", +0.45);
 add("infectieux", +0.30);
 break;

 case "Greffe":
 addBoost(+0.35);
 add("immunite", +0.50);
 add("infectieux", +0.35);
 add("stress", +0.08);
 break;

 case "Handicap moteur":
 addBoost(+0.18);
 add("sedentarite", +0.25);
 add("surpoids", +0.10);
 add("metabolic", +0.08);
 add("stress", +0.08);
 add("mental", +0.05);
 break;

 case "Handicap mental":
 addBoost(+0.20);
 add("mental", +0.40);
 add("stress", +0.20);
 add("drogue", +0.10);
 break;

 case "Maladie Sexuel":
 addBoost(+0.22);
 add("infectieux", +0.40);
 break;

 case "Maladie genetique non transmissible":
 addBoost(+0.24);
 add("genetique", +0.45);
 add("immunite", +0.10);
 break;

 case "Maladie genetique héréditaire":
 addBoost(+0.28);
 add("genetique", +0.60);
 add("immunite", +0.12);
 break;

 case "Signe de vieillesse (Ostéo / Cataracte ...)":
 addBoost(+0.22);
 add("age", +0.35);
 add("metabolic", +0.10);
 add("surpoids", +0.08);
 add("stress", +0.05);
 break;

 case "Autre":
 addBoost(+0.18);
 add("stress", +0.08);
 add("immunite", +0.08);
 break;

 case "N/A":
 case "__default":
 default:
 break;
 }

 return r;
}

function computeRisks(patient, extraFields){
 const d = patient?.derived || {};

 const hasVal = (v) => v != null && String(v).trim() !== "";

 // sources: extra (prioritaire) sinon base patient
 const alcoholVal = getEffectiveFieldValue(patient, extraFields, "alcoholFreq");
 const drugsVal = getEffectiveFieldValue(patient, extraFields, "drugs");
 const socialVal = getEffectiveFieldValue(patient, extraFields, "socialScore");
 const happyVal = getEffectiveFieldValue(patient, extraFields, "happiness");

 const alcoolKnown = hasVal(alcoholVal) || (d.alcoholFreqScore != null);
 const drogueKnown = hasVal(drugsVal) || (d.drugsScore != null);

 const alcool = alcoolKnown
 ? (alcoholFreqToScore(alcoholVal) ?? (d.alcoholFreqScore != null ? d.alcoholFreqScore : 0.25))
 : 0.12;
 const drogue = drogueKnown
 ? (drugsToScore(drugsVal) ?? (d.drugsScore != null ? d.drugsScore : 0.20))
 : 0.10;

 const tob = tobaccoBreakdown(extraFields.cigarette);
 const smoke = tob.smoke;
 const vape = tob.vape;
 const tabac = clamp(Math.max(smoke, vape*0.85), 0, 1);

 const dietRisk = dietToRisk(extraFields.alimentation);
 const surpoidsBase = fieldScore("corpulence", extraFields.corpulence);
 const surpoids = clamp((surpoidsBase ?? 0.35) * 0.70 + (dietRisk ?? 0.35) * 0.30, 0, 1);

 const diet = (dietRisk != null ? dietRisk : 0.35);
 // metabolic risk: weight + diet + (user choice) vape -> stronger metabolic / diabetes signal
 const metabolic = clamp(0.55*surpoids + 0.25*diet + 0.20*vape, 0, 1);

 const ageNum = computePatientAge(patient, extraFields);
 const ageGroup = ageGroupFromAge(ageNum);
 const age = fieldScore("age", ageGroup);

 const sedentarite = fieldScore("sport", extraFields.sport);

 // social: 0..15000 (approx)
 const socialN = (typeof socialVal === "number") ? socialVal : Number(String(socialVal || "").replace(/[^0-9]/g, ""));
 const socialScore = Number.isFinite(socialN) ? socialN : d.socialScore;
 const social = socialScore != null && Number.isFinite(socialScore) ? clamp(1 - (socialScore/15000), 0, 1) : 0.35;

 const happyN = Number(String(happyVal ?? "").replace(/[^0-9]/g, ""));
 const happy = Number.isFinite(happyN) ? happyN : d.happiness;
 const happinessRisk = happy != null && Number.isFinite(happy) ? clamp(1 - (happy/5), 0, 1) : 0.35;

 const confessionRaw = String(extraFields.confession || "");
 const spiritualBuffer = (confessionRaw && !confessionRaw.toLowerCase().includes("aucune") && !confessionRaw.toLowerCase().includes("ath")) ? 0.05 : 0;
 const stress = clamp(0.65*happinessRisk + 0.35*social - spiritualBuffer, 0, 1);

 // effets "" / dossier
 const criminalYes = String(extraFields.criminal || "").toLowerCase().includes("oui");
 const transhumanYes = String(extraFields.transhuman || "").toLowerCase().includes("oui");
 const operationYes = String(getEffectiveFieldValue(patient, extraFields, "operation") || "").toLowerCase().includes("oui");

 const danger = criminalYes ? 1.0 : 0.0;
 const mental = clamp(0.45*stress + 0.25*drogue + 0.20*social + 0.10*age, 0, 1);
 const cyber = transhumanYes ? clamp(0.55 + 0.25*stress + 0.20*drogue + 0.10*age + (operationYes ? 0.10 : 0), 0, 1)
 : clamp(0.10 + 0.10*stress, 0, 1);

 const immunite = clamp(0.35 + 0.35*stress + 0.15*drogue + 0.15*age + (operationYes ? 0.05 : 0) + (dietRisk != null ? 0.05*dietRisk : 0), 0, 1);
 const infectieux = clamp(0.35 + 0.20*social, 0, 1);

 const genetique = 0.35;
 const sportInjury = clamp(1 - sedentarite, 0, 1);
 const dehydratation = clamp(0.35 + 0.25*alcool, 0, 1);

 let globalBoost = 0;
 const hpKey = normalizeHealthProblemsKey(getEffectiveFieldValue(patient, extraFields, "healthProblems"));
 if(hpKey && hpKey !== "NON" && hpKey !== "N/A" && hpKey !== "__default") globalBoost += 0.18;
 if(criminalYes) globalBoost += 0.12;
 if(transhumanYes) globalBoost += 0.05;

 // Application des effets "Problèmes de santé" (logique métier)
 const baseRisks = {
 alcool, drogue,
 smoke, vape, tabac,
 diet, surpoids, metabolic,
 age, sedentarite, stress, social,
 mental, cyber, danger,
 immunite, infectieux, genetique, sport: sportInjury, dehydratation,
 globalBoost: clampBoost(globalBoost)
 };

 return applyHealthProblemsEffects(baseRisks, hpKey);
}


// --- Focus aléatoire sur 1–2 catégories (anti-répétition, + variation) ---
const FIELD_TO_RISKS = {
 birthDate: ["age"],
 sex: ["sex"],
 alimentation: ["diet","metabolic","surpoids"],
 corpulence: ["surpoids","metabolic"],
 sport: ["sedentarite","sport"],
 cigarette: ["smoke","vape","tabac"],
 alcoholFreq: ["alcool","dehydratation"],
 drugs: ["drogue","mental"],
 socialScore: ["social","stress","mental","infectieux"],
 happiness: ["stress","mental"],
 // "Problèmes de santé" influence plusieurs axes (immunité / infectieux / génétique / mental / âge)
 healthProblems: ["globalBoost","immunite","infectieux","genetique","mental","age"],
 operation: ["infectieux","immunite"],
 criminal: ["danger","stress","mental"],
 transhuman: ["cyber","stress"],
 confession: ["stress"]
};

function isFilledValue(v){
 if(v == null) return false;
 const s = String(v).trim();
 if(!s) return false;
 const sl = s.toLowerCase();
 if(sl === "n/a" || sl === "na" || sl === "n-a") return false;
 return true;
}

// Un champ est "déviant" si sa valeur s'écarte clairement d'un profil neutre.
function devianceScoreForField(field, patient, extra){
 const raw = getEffectiveFieldValue(patient, extra, field) ?? extra?.[field];
 if(!isFilledValue(raw)) return 0;

 switch(field){
 case "cigarette":
 return clamp(fieldScore("cigarette", String(raw)), 0, 1);

 case "alcoholFreq": {
 const s = alcoholFreqToScore(raw);
 return (s == null ? 0 : clamp(s, 0, 1));
 }

 case "drugs": {
 const s = drugsToScore(raw);
 return (s == null ? 0 : clamp(s, 0, 1));
 }

 case "corpulence":
 return clamp(fieldScore("corpulence", String(raw)), 0, 1);

 case "sport":
 // sédentarité (inverse du sport)
 return clamp(fieldScore("sport", String(raw)), 0, 1);

 case "alimentation": {
 const s = dietToRisk(String(raw));
 return (s == null ? 0 : clamp(s, 0, 1));
 }

 case "socialScore": {
 const n = (typeof raw === "number") ? raw : Number(String(raw).replace(/[^0-9]/g, ""));
 if(!Number.isFinite(n)) return 0;
 return clamp(1 - (n/15000), 0, 1);
 }

 case "happiness": {
 const n = (typeof raw === "number") ? raw : Number(String(raw).replace(/[^0-9]/g, ""));
 if(!Number.isFinite(n)) return 0;
 return clamp(1 - (n/5), 0, 1);
 }

 case "healthProblems": {
 const key = normalizeHealthProblemsKey(raw);
 if(!key || key === "__default" || key === "N/A") return 0;
 if(key === "NON") return 0;
 // Déviance graduée: certaines catégories influencent fortement l'analyse.
 const w = ({
 "Cancer": 0.95,
 "Immunodépressive": 0.92,
 "Greffe": 0.95,
 "Maladie Sexuel": 0.85,
 "Maladie genetique non transmissible": 0.82,
 "Maladie genetique héréditaire": 0.88,
 "Handicap moteur": 0.78,
 "Handicap mental": 0.82,
 "Signe de vieillesse (Ostéo / Cataracte ...)": 0.75,
 "Autre": 0.70
 })[key];
 return (typeof w === "number") ? w : 0.70;
 }

 case "operation": {
 const s = String(raw || "").toLowerCase();
 return s.includes("oui") ? 0.65 : 0;
 }

 case "criminal": {
 const s = String(raw || "").toLowerCase();
 return s.includes("oui") ? 0.95 : 0;
 }

 case "transhuman": {
 const s = String(raw || "").toLowerCase();
 return s.includes("oui") ? 0.60 : 0;
 }

 case "birthDate": {
 const ageNum = computePatientAge(patient, extra);
 const ag = ageGroupFromAge(ageNum);
 const s = fieldScore("age", ag);
 return clamp(s, 0, 1);
 }

 // rarement une "déviance" au sens clinique, mais peut influencer des scores
 case "confession":
 case "sex":
 default:
 return 0;
 }
}

// Si le dossier indique explicitement un profil sain, on ne focus jamais dessus.
function explicitHealthyNoFocus(field, raw){
 const s = String(raw || "").toLowerCase().trim();
 if(!s) return false;

 if(field === "drugs" && s.includes("non")) return true;
 if(field === "alcoholFreq" && s.includes("jamais")) return true;
 if(field === "cigarette" && (s === "non" || s.includes("non"))) return true;
 if(field === "operation" && s.includes("non")) return true;
 if(field === "criminal" && s.includes("non")) return true;
 if(field === "transhuman" && s.includes("non")) return true;
 if(field === "healthProblems"){
 const key = normalizeHealthProblemsKey(s);
 if(key === "NON" || key === "N/A" || key === "__default") return true;
 }

 return false;
}

function weightedPickUnique(items, n, weightFn){
 const remaining = (items || []).slice();
 const out = [];
 const used = new Set();
 const wfn = (typeof weightFn === "function") ? weightFn : (() => 1);

 while(out.length < n && remaining.length){
 const weights = remaining.map(x => Math.max(0.0001, wfn(x)));
 const sum = weights.reduce((a,b)=>a+b,0) || 1;

 let r = Math.random() * sum;
 let idx = 0;
 for(let i=0;i<remaining.length;i++){
 r -= weights[i];
 if(r <= 0){ idx = i; break; }
 }

 const pick = remaining.splice(idx, 1)[0];
 if(!pick) break;
 if(used.has(pick.f)) continue;
 used.add(pick.f);
 out.push(pick.f);
 }
 return out;
}

// Focus : tiré aléatoirement UNIQUEMENT parmi les catégories réellement déviantes du dossier.
function pickFocusFields(patient, extra){
 const filled = EXTRA_FIELDS
 .map(f => ({ f, v: (getEffectiveFieldValue(patient, extra, f) ?? extra?.[f]) }))
 .filter(it => isFilledValue(it.v));

 if(!filled.length) return [];

 const scored = filled
 .filter(it => !explicitHealthyNoFocus(it.f, it.v))
 .map(it => ({ ...it, dev: devianceScoreForField(it.f, patient, extra) || 0 }))
 .filter(it => it.dev >= 0.55);

 // Aucune déviance claire => pas de focus affiché / pas de masque.
 if(!scored.length) return [];

 // 1 ou 2 champs (avec légère préférence pour 2 si plusieurs déviances existent)
 const completeness = computeCompletenessForPatient(patient, extra);
 const want2 = (scored.length >= 2) && (Math.random() < (0.35 + 0.35*clamp(completeness,0,1)));
 const n = want2 ? 2 : 1;

 return weightedPickUnique(scored, n, (it) => 0.20 + 1.10*clamp(it.dev, 0, 1));
}

function sexAffinityBoost(disease, sexValue){
 const sex = String(sexValue || "").toLowerCase();
 if(!sex) return 0;
 const name = String(disease?.name || "").toLowerCase();

 const male = /prostat|testicul|erect|androp|orchite|varicocele/.test(name);
 const female = /endom|ovair|uter|gross|menorr|vagin|cervic|mastite/.test(name);

 if(sex.includes("homme")){
 if(male) return 0.28;
 if(female) return -0.10;
 }
 if(sex.includes("femme")){
 if(female) return 0.28;
 if(male) return -0.10;
 }
 return 0;
}

function applyFocusMask(risks, focusFields, patient, extra){
 if(!risks) return risks;
 const focus = new Set(focusFields || []);
 const keep = new Set();
 for(const f of focus){
 for(const k of (FIELD_TO_RISKS[f] || [])) keep.add(k);
 }
 // si focus vide => pas de masque
 if(keep.size === 0) return { ...risks, __focusFields: focusFields || [], __focusNarrow: 0 };

 const masked = { ...risks };
 const narrow = (focusFields || []).length <= 1 ? 1 : 0.6;
 masked.__focusFields = focusFields || [];
 masked.__focusNarrow = narrow;

 // dimensions numériques (0..1) : on ramène doucement vers 0.5 si hors focus
 const alphaOff = 0.28; // conserve un peu de cohérence globale
 const alphaOn = 1.00;

 for(const k of Object.keys(masked)){
 if(k.startsWith("__")) continue;
 if(typeof masked[k] !== "number") continue;
 const a = keep.has(k) ? alphaOn : alphaOff;
 masked[k] = clamp(0.5 + (masked[k]-0.5)*a, 0, 1);
 }

 // Champ sex (0..1) dérivé du dossier
 const sexV = getEffectiveFieldValue(patient, extra, "sex") ?? extra?.sex;
 if(sexV){
 masked.sex = String(sexV).toLowerCase().includes("homme") ? 1 : (String(sexV).toLowerCase().includes("femme") ? 0 : 0.5);
 } else {
 masked.sex = 0.5;
 }

 return masked;
}
const TAG_WEIGHTS = {
 alcool: 1.35,
 tabac: 1.45,
 smoke: 1.55,
 vape: 1.35,
 drogue: 1.25,
 age: 1.05,
 surpoids: 1.15,
 sedentarite: 1.00,
 stress: 1.10,
 social: 0.95,
 immunite: 0.95,
 infectieux: 0.85,
 genetique: 0.65,
 sport: 0.85,
 diabe: 0.80,
 diabete: 0.90,
 dehydratation: 0.70,
 neuro: 0.25,
 metabolique: 0.25,
 diet: 0.95,
 metabolic: 1.05,
 mental: 0.85,
 cyber: 1.15,
 danger: 0.90
};

function riskForTag(risks, tag){
 if(tag in risks) return risks[tag];
 if(tag === "diabete") return risks.metabolic ?? risks.surpoids;
 if(tag === "diabe") return risks.metabolic ?? risks.surpoids;
 if(tag === "metabolique") return (risks.metabolic != null ? risks.metabolic : clamp(0.3 + 0.3*risks.surpoids, 0, 1));
 if(tag === "neuro") return clamp(0.25 + 0.15*risks.stress, 0, 1);
 if(tag === "immunite") return risks.immunite;
 if(tag === "infectieux") return risks.infectieux;
 if(tag === "genetique") return risks.genetique;
 return 0.25;
}

function profileContribution(risk, rule){
 if(!rule) return 0;
 const w = (typeof rule.weight === "number") ? rule.weight : 0.6;

 // Want the risk to be HIGH
 if(rule.min != null){
 const min = clamp(rule.min, 0, 0.999);
 const val = clamp((risk - min) / (1 - min), 0, 1);
 return w * val;
 }

 // Want the risk to be LOW (rare: used if you ever add such profiles)
 if(rule.max != null){
 const max = clamp(rule.max, 0.001, 1);
 const val = clamp((max - risk) / max, 0, 1);
 return w * val;
 }

 // Want the risk near a TARGET
 if(rule.target != null){
 const tol = clamp((rule.tol != null ? rule.tol : 0.35), 0.05, 1);
 const val = 1 - clamp(Math.abs(risk - rule.target) / tol, 0, 1);
 return w * val;
 }

 return 0;
}

function scoreFromProfile(profile, risks){
 if(!profile) return 0;
 let s = 0;
 for(const k of Object.keys(profile)){
 const r = (risks[k] != null) ? risks[k] : 0.5;
 s += profileContribution(r, profile[k]);
 }
 return s;
}

function scoreDisease(disease, risks, seedStr, healthScore){
 let s = disease.base || -3.4;
 for(const tag of (disease.tags || [])){
 const w = TAG_WEIGHTS[tag] ?? 0.55;
 s += w * riskForTag(risks, tag);
 }
 s += scoreFromProfile(disease.profile, risks);

 const hs = (typeof healthScore === "number") ? healthScore : computeHealthScore(risks);
 const healthShift = clamp((hs - 50) / 50, -1, 1);
 // Healthy profile => smaller chances across the board
 s += (-0.95) * healthShift;

 s += risks.globalBoost;

 // deterministic noise per patient+disease
 const h = hash32(seedStr + "||" + disease.name);
 const noise = ((h % 1000) / 1000 - 0.5) * 0.35; // [-0.175, +0.175]
 s += noise;

 // Random noise (par exécution) : évite que les mêmes maladies ressortent en boucle.
 // L'amplitude est plus faible quand le dossier est complet (cohérence),
 // et un peu plus permissive quand il manque des infos (exploration).
 const c = (risks && typeof risks.__completeness === "number") ? risks.__completeness : 0.55;
 const uncertainty = clamp(1 - c, 0, 1);
 const focusN = (risks && typeof risks.__focusNarrow === "number") ? risks.__focusNarrow : 0;
 const amp = 0.08 + 0.14 * uncertainty + 0.07 * focusN;
 const runNoise = (Math.random() * 2 - 1) * amp;
 s += runNoise;
 return s;
}

function computeHealthScore(r){
 let hs = 85;
 hs -= 25*r.alcool;
 hs -= 25*r.tabac;
 hs -= 18*r.drogue;
 hs -= 16*r.surpoids;
 hs -= 12*r.diet;
 hs -= 8*r.vape;
 hs -= 12*r.sedentarite;
 hs -= 15*r.stress;
 hs -= 10*r.age;
 hs -= 8*r.social;
 hs -= 6*r.danger;
 hs -= 4*r.cyber;
 hs -= 10*r.globalBoost;
 return clamp(hs, 0, 100);
}



// --- Sélection des maladies: dossier + interventions + aléatoire ---

function normalizeForMatch(s){
 return (s || "")
 .toLowerCase()
 .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
 .replace(/[^a-z0-9\s\-']/g, " ")
 .replace(/\s+/g, " ")
 .trim();
}

function interventionBoost(disease, interventions){
 const kws = Array.isArray(disease?.keywords) ? disease.keywords : [];
 if(!kws.length) return 0;

 const corpus = normalizeForMatch((interventions || []).join(" | "));
 if(!corpus) return 0;

 let hits = 0;
 for(const k of kws){
 const kk = normalizeForMatch(String(k));
 if(!kk) continue;
 // match phrase OR individual tokens
 if(corpus.includes(kk)) hits += 2;
 for(const tok of kk.split(" ")){
 if(tok.length >= 4 && corpus.includes(tok)) hits += 1;
 }
 }

 // Boost plafonné: fait clairement pencher vers des maladies liées aux mots clés
 const raw = hits * 0.09;
 const extra = Math.log1p(hits) * 0.06;
 return clamp(raw + extra, 0, 2.6);
}

function pickOnePrescription(disease){
 const t = disease?.treatments;

 // Nouveau format: { joke: [...], serieuse: [...] } (50/50)
 const jokes = (t && Array.isArray(t.joke)) ? t.joke : null;
 const serious = (t && Array.isArray(t.serieuse)) ? t.serieuse : null;

 if(jokes && serious){
 const wantFunny = Math.random() < 0.5; // 50/50 strict
 const pool = wantFunny ? jokes : serious;
 // fallback: si un pool est vide, on prend l'autre
 return randPick(pool) || randPick(wantFunny ? serious : jokes) || "se reposer et réévaluer plus tard";
 }

 // Ancien format: tableau (compat)
 const arr = Array.isArray(t) ? t : [];
 if(arr.length >= 14){
 const funny = arr.slice(0, 10);
 const ser = arr.slice(-4);
 const wantFunny = Math.random() < 0.5;
 const pool = wantFunny ? funny : ser;
 return randPick(pool) || randPick(arr) || "se reposer et réévaluer plus tard";
 }

 return randPick(arr) || "se reposer et réévaluer plus tard";
}
// --- Raison simple (ex: Bonheur / humeur : bas) ---
function effectiveAny(patient, extra, field){
 const v = getEffectiveFieldValue(patient, extra, field);
 if(v != null && String(v).trim() !== "") return v;
 const e = extra?.[field];
 if(e != null && String(e).trim() !== "") return e;
 return null;
}

function moodLabelFromExtra(patient, extra){
 const v = effectiveAny(patient, extra, "happiness");
 const n = Number(String(v ?? "").replace(/[^0-9]/g,""));
 if(Number.isFinite(n)){
 if(n <= 1) return "bas";
 if(n === 2) return "moyen-bas";
 if(n === 3) return "moyen";
 if(n === 4) return "bon";
 if(n >= 5) return "excellent";
 }
 const s = String(v || "").toLowerCase();
 if(!s) return "";
 if(s.includes("bas")) return "bas";
 if(s.includes("haut") || s.includes("bon")) return "bon";
 return "moyen";
}

function socialLabelFromExtra(patient, extra){
 const v = effectiveAny(patient, extra, "socialScore");
 const n = Number(String(v ?? "").replace(/[^0-9]/g,""));
 if(!Number.isFinite(n)) return "";
 if(n < 4000) return "faible";
 if(n < 9000) return "moyen";
 return "élevé";
}

function shortVal(s){
 const t = String(s ?? "").trim();
 return t ? t : "";
}

function reasonFromRiskKey(key, extra, patient, risks){
 switch(key){
 case "stress":
 {
 const mood = moodLabelFromExtra(patient, extra);
 if(!mood) return "";
 return `Bonheur / humeur : ${mood}`;
 }
 case "social":
 {
 const sl = socialLabelFromExtra(patient, extra);
 if(!sl) return "";
 return `Social : ${sl}`;
 }
 case "tabac":
 case "smoke":
 case "vape":
 {
 const v = shortVal(extra?.cigarette);
 return v ? `Tabac / Vapotage : ${v}` : "";
 }
 case "alcool":
 {
 const v = shortVal(effectiveAny(patient, extra, "alcoholFreq"));
 return v ? `Fréquence alcool : ${v}` : "";
 }
 case "drogue":
 {
 const v = shortVal(effectiveAny(patient, extra, "drugs"));
 return v ? `Drogues : ${v}` : "";
 }
 case "surpoids":
 case "metabolic":
 {
 // Metabolic peut venir de la corpulence, de l'alimentation, ou de la vape.
 const opts = [];
 const corp = shortVal(extra?.corpulence);
 const alim = shortVal(extra?.alimentation);
 const cig = shortVal(extra?.cigarette);
 if(corp) opts.push({ s: (risks?.surpoids ?? 0), txt: `Corpulence : ${corp}` });
 if(alim) opts.push({ s: (risks?.diet ?? 0), txt: `Alimentation : ${alim}` });
 if(cig) opts.push({ s: (risks?.vape ?? 0), txt: `Tabac / Vapotage : ${cig}` });
 opts.sort((a,b)=> (b.s||0)-(a.s||0));
 return opts[0]?.txt || "";
 }
 case "diet":
 {
 const v = shortVal(extra?.alimentation);
 return v ? `Alimentation : ${v}` : "";
 }
 case "sedentarite":
 case "sport":
 {
 const v = shortVal(extra?.sport);
 return v ? `Sport : ${v}` : "";
 }
 case "age": {
 const ageNum = computePatientAge(patient, extra);
 const grp = ageGroupFromAge(ageNum);
 return grp ? `Âge : ${grp}` : "";
 }
 case "danger":
 {
 const v = shortVal(extra?.criminal);
 return v ? `Criminal (vie dangereuse) : ${v}` : "";
 }
 case "cyber":
 {
 const v = shortVal(extra?.transhuman);
 return v ? `Transhumain : ${v}` : "";
 }
 case "immunite":
 case "infectieux":
 {
 const v = shortVal(effectiveAny(patient, extra, "healthProblems"));
 return v ? `Problèmes de santé : ${v}` : "";
 }
 default:
 return "";
 }
}

function bestReasonForDisease(disease, risks, extra, patient, maxReasons=2){
 if(disease?._linkedReason) return disease._linkedReason;

 const contribs = [];

 for(const tag of (disease.tags || [])){
 const w = TAG_WEIGHTS[tag] ?? 0.55;
 const r = riskForTag(risks, tag);
 const c = w * r;
 const txt = reasonFromRiskKey(tag, extra, patient, risks);
 if(txt) contribs.push({ key: tag, group: reasonGroupFromKey(tag), c, txt });
 }

 if(disease.profile){
 for(const k of Object.keys(disease.profile)){
 const r = (risks[k] != null) ? risks[k] : 0.35;
 const c = profileContribution(r, disease.profile[k]);
 const txt = reasonFromRiskKey(k, extra, patient, risks);
 if(txt) contribs.push({ key: k, group: reasonGroupFromKey(k), c, txt });
 }
 }

 contribs.sort((a,b)=>(b.c||0)-(a.c||0));
 const out = [];
 const used = new Set();
 for(const it of contribs){
 if(used.has(it.group)) continue;
 out.push(it.txt);
 used.add(it.group);
 if(out.length >= maxReasons) break;
 }
 return out.join(" ; ");
}


function bestReasonKeyForDisease(disease, risks){
 if(disease?._linkedField) return disease._linkedField;
 let bestKey = null;
 let bestScore = -1e9;

 for(const tag of (disease.tags || [])){
 const w = TAG_WEIGHTS[tag] ?? 0.55;
 const r = riskForTag(risks, tag);
 const c = w * r;
 if(c > bestScore){ bestScore = c; bestKey = tag; }
 }

 if(disease.profile){
 for(const k of Object.keys(disease.profile)){
 const r = (risks[k] != null) ? risks[k] : 0.5;
 const c = profileContribution(r, disease.profile[k]);
 if(c > bestScore){ bestScore = c; bestKey = k; }
 }
 }

 return bestKey;
}

function reasonGroupFromKey(key){
 switch(key){
 case "stress": return "happiness";
 case "social": return "socialScore";
 case "tabac":
 case "smoke":
 case "vape": return "cigarette";
 case "alcool": return "alcoholFreq";
 case "drogue": return "drugs";
 case "surpoids":
 case "metabolic": return "corpulence";
 case "diet": return "alimentation";
 case "sedentarite":
 case "sport": return "sport";
 case "age": return "birthDate";
 case "danger": return "criminal";
 case "cyber": return "transhuman";
 case "immunite":
 case "infectieux": return "healthProblems";
 default: return key || "other";
 }
}

// --- Maladies liées au statut du dossier (plus probables si peu d'infos) ---
const LINKED_BY_VALUE = {
 "birthDate": {
 "jeune": [
 "Mononucléose infectieuse",
 "Asthme d'effort",
 "Acné inflammatoire",
 "Syndrome du TikTok tachycarde",
 "Déficit aigu de patience scolaire"
 ],
 "adulte": [
 "Hypertension artérielle",
 "Reflux gastro-œsophagien",
 "Lombalgie commune",
 "Syndrome du café stratégique",
 "Inflammation du calendrier surchargé"
 ],
 "vieux": [
 "Ostéoporose",
 "Insuffisance cardiaque",
 "Dégénérescence maculaire liée à l’âge (DMLA)",
 "Syndrome de la télécommande introuvable",
 "Arthrose du fauteuil dominateur"
 ],
 "__default": [
 "Fatigue multifactorielle",
 "Carence en vitamine D",
 "Trouble du sommeil",
 "Syndrome du dossier incomplet",
 "Allergie à la paperasse"
 ]
 },
 "sex": {
 "Homme": [
 "Hyperplasie bénigne de la prostate",
 "Calcul rénal",
 "Apnée du sommeil",
 "Syndrome de la barbe hypersensible",
 "Crise aiguë de virilité administrative"
 ],
 "Femme": [
 "Endométriose",
 "Anémie ferriprive",
 "Cystite aiguë",
 "Syndrome du sac à main trop optimiste",
 "Inflammation des notifications menstruelles"
 ],
 "Autre": [
 "Trouble anxieux",
 "Migraine",
 "Syndrome de l’intestin irritable",
 "Syndrome du formulaire qui ne propose pas la bonne case",
 "Allergie à la case « Autre »"
 ],
 "__default": ["Trouble anxieux généralisé","Migraine","Insomnie chronique","Syndrome de la case manquante","Allergie au formulaire binaire"]

 },
 "alimentation": {
 "ne mange jamais (coma régulié)": [
 "Dénutrition",
 "Hypoglycémie",
 "Carence en thiamine (vitamine B1)",
 "Syndrome du frigo fantôme",
 "Anorexie de la réalité (coma edition)"
 ],
 "ultra-tranformé (ltd)": [
 "Stéatose hépatique non alcoolique",
 "Reflux gastro-œsophagien",
 "Syndrome métabolique",
 "Syndrome du craquant industriel",
 "Carence sévère en légumes imaginaires"
 ],
 "fast food": [
 "Gastrite",
 "Hypercholestérolémie",
 "Hypertension artérielle",
 "Syndrome du ketchup thérapeutique",
 "Intoxication aiguë au combo XXL"
 ],
 "restaurant (bonne qualité)": [
 "Reflux gastro-œsophagien",
 "Allergie alimentaire",
 "Intolérance au lactose",
 "Syndrome du critique gastronomique compulsif",
 "Indigestion par storytelling de chef"
 ],
 "a la maison (meilleur qualité)": [
 "Carence en fer",
 "Syndrome de l’intestin irritable",
 "Constipation fonctionnelle",
 "Syndrome du batch-cooking autoritaire",
 "Allergie aux Tupperware révolutionnaires"
 ],
 "__default": ["Gastrite","Syndrome de l’intestin irritable","Carence en vitamine D","Syndrome du frigo silencieux","Intolérance à la salade (imaginaire)"]

 },
 "corpulence": {
 "Maigre": [
 "Hyperthyroïdie",
 "Anémie",
 "Dénutrition",
 "Syndrome du courant d’air dramatique",
 "Carence chronique en poches de pantalon"
 ],
 "Normal": [
 "Syndrome de l’intestin irritable",
 "Migraine",
 "Hypothyroïdie",
 "Syndrome du poids parfait mais du moral pas d’accord",
 "Allergie à l’équilibre (trop stable)"
 ],
 "Enrobé": [
 "Hypertension artérielle",
 "Apnée du sommeil",
 "Stéatose hépatique non alcoolique",
 "Syndrome du bouton de jean en négociation",
 "Inflammation passive de la chaise de bureau"
 ],
 "Obèse": [
 "Diabète de type 2",
 "Syndrome métabolique",
 "Arthrose du genou",
 "Syndrome du buffet qui te reconnaît",
 "Tachycardie d’ascenseur (étage 2)"
 ],
 "__default": ["Hypothyroïdie","Anémie","Hypertension artérielle","Syndrome du jean diplomate","Inflammation de la balance susceptible"]

 },
 "sport": {
 "Jamais": [
 "Sarcopénie",
 "Lombalgie commune",
 "Hypertension artérielle",
 "Syndrome du canapé fusionnel",
 "Carence aiguë en sueur volontaire"
 ],
 "1-2/sem": [
 "Tendinite",
 "Courbatures",
 "Entorse de cheville",
 "Syndrome du sportif du dimanche certifié",
 "Inflammation du selfie de footing"
 ],
 "3-5/sem": [
 "Tendinopathie d’Achille",
 "Fracture de stress",
 "Rhabdomyolyse d’effort",
 "Syndrome du legging qui grince fièrement",
 "Allergie à la journée OFF"
 ],
 "Tous les jours": [
 "Surentraînement",
 "Anémie du sportif",
 "Bradycardie du sportif",
 "Syndrome de la montre connectée tyrannique",
 "Inflammation du calendrier « rest day = blasphème »"
 ],
 "__default": ["Lombalgie commune","Tendinite","Surentraînement","Syndrome du cardio d’apparat","Allergie au ‘repos’"]

 },
 "cigarette": {
 "non": [
 "Rhino-pharyngite",
 "Allergie saisonnière",
 "Reflux gastro-œsophagien",
 "Syndrome du poumon trop fier",
 "Carence en pauses « clope » (version café)"
 ],
 "un peu cigarette": [
 "Bronchite",
 "Toux chronique",
 "Gingivite",
 "Syndrome du « juste une » éternel",
 "Halitose diplomatique de proximité"
 ],
 "un peu Vap": [
 "Irritation bronchique",
 "Toux",
 "Laryngite",
 "Syndrome du nuage perfide",
 "Crise aiguë de « goût barbe-à-papa » pulmonaire"
 ],
 "beaucoup cigarette": [
 "BPCO (bronchopneumopathie chronique obstructive)",
 "Cancer du poumon",
 "Hypertension artérielle",
 "Syndrome du cendrier intérieur",
 "Toux de dragon non homologué"
 ],
 "beaucoup Vap": [
 "Bronchite chimique",
 "Pneumopathie",
 "Irritation ORL chronique",
 "Syndrome du brumisateur enragé",
 "Poumons parfum « mangue nucléaire »"
 ],
 "__default": ["Bronchite","Toux chronique","Irritation ORL chronique","Syndrome du poumon vexé","Nuage de vapeur à ego"]

 },
 "alcoholFreq": {
 "Jamais": [
 "Intolérance à l’alcool (déficit ALDH2)",
 "Gastrite",
 "Trouble anxieux social",
 "Syndrome du mojito refusé (héroïque)",
 "Déficit de toasts improvisés"
 ],
 "1 fois / semaine": [
 "Reflux gastro-œsophagien",
 "Céphalées",
 "Sommeil fragmenté",
 "Syndrome du « verre social » obligatoire",
 "Migraine de brunch stratégique"
 ],
 "2 à 4 / semaine": [
 "Gastrite",
 "Déshydratation",
 "Hypertension artérielle",
 "Syndrome du foie qui soupire poliment",
 "Inflammation du lendemain « mais ça va »"
 ],
 "2 à 3 / jour": [
 "Hépatite alcoolique",
 "Pancréatite",
 "Trouble de l’usage de l’alcool",
 "Syndrome du bar-tabouret résident",
 "Foie en grève partielle (avec préavis)"
 ],
 "Au moins 4 fois / jour": [
 "Cirrhose",
 "Délirium tremens",
 "Cardiomyopathie alcoolique",
 "Syndrome du shaker existentiel",
 "Tremblement cérémonial du barman intérieur"
 ],
 "__default": ["Gastrite","Déshydratation","Hypertension artérielle","Syndrome du toast trop inspiré","Foie en mode drama discret"]

 },
 "drugs": {
 "Non": [
 "Insomnie",
 "Anxiété",
 "Troubles de l’attention",
 "Syndrome de la tisane ambitieuse",
 "Overdose de responsabilités sobres"
 ],
 "Oui, en soirée": [
 "Anxiété",
 "Troubles du sommeil",
 "Palpitations",
 "Syndrome du lendemain « j’ai tout dit »",
 "Amnésie sélective des stories"
 ],
 "Oui, régulièrement": [
 "Trouble de l’usage de substances",
 "Psychose induite",
 "Perte de mémoire",
 "Syndrome du snack infini certifié",
 "Paranoïa de la sonnette (c’était le vent)"
 ],
 "__default": ["Troubles du sommeil","Anxiété de santé (hypocondrie)","Troubles de l’attention","Syndrome du lendemain poétique","Mémoire en mode story"]

 },
 "happiness": {
 "0": [
 "Épisode dépressif majeur",
 "Trouble anxieux généralisé",
 "Insomnie",
 "Syndrome du sourire en PLS",
 "Déficit aigu en dopamine de courtoisie"
 ],
 "1": [
 "Trouble dépressif",
 "Somatisation",
 "Anxiété",
 "Syndrome du « ça va » légalement",
 "Inflammation du soupir automatique"
 ],
 "2": [
 "Fatigue chronique",
 "Trouble du sommeil",
 "Anxiété",
 "Syndrome du moral en mode économie",
 "Carence en memes thérapeutiques"
 ],
 "3": [
 "Stress",
 "Migraine",
 "Trouble digestif fonctionnel",
 "Syndrome du zen fragile (secoué)",
 "Éruption de notifications irritantes"
 ],
 "4": [
 "Céphalées de tension",
 "Allergie saisonnière",
 "Reflux gastro-œsophagien",
 "Syndrome du bonheur discret mais suspect",
 "Éclat de rire contrôlé (normé)"
 ],
 "5": [
 "Insomnie d’excitation",
 "Tachycardie",
 "Dermatite de contact",
 "Syndrome du trop-plein de good vibes",
 "Hyperactivité sociale non prescrite"
 ],
 "__default": ["Insomnie chronique","Anxiété de santé (hypocondrie)","Déficit de sommeil 'patch notes'","Syndrome du sourire réglementaire","Inflammation du soupir automatique"]

 },
 "operation": {
 "Non": [
 "Lombalgie",
 "Migraine",
 "Reflux gastro-œsophagien",
 "Syndrome du pansement imaginaire",
 "Allergie aux salles d’attente (préventif)"
 ],
 "Oui": [
 "Infection de site opératoire",
 "Douleur neuropathique",
 "Thrombose veineuse profonde",
 "Syndrome du pansement nostalgique",
 "Cicatrice qui réclame une standing ovation"
 ],
 "__default": ["Douleur neuropathique","Infection de site opératoire","Thrombose veineuse profonde","Syndrome du pansement nostalgique","Cicatrice qui réclame un applaudimètre"]

 },
 "criminal": {
 "Non": [
 "Stress",
 "Insomnie",
 "Hypertension artérielle",
 "Syndrome de la vie trop rangée (ça gratte)",
 "Carence en adrénaline réglementaire"
 ],
 "Oui": [
 "Stress post-traumatique",
 "Hypervigilance",
 "Plaies/infections cutanées",
 "Syndrome du héros de ruelle",
 "Tachycardie au bruit de sac plastique"
 ],
 "__default": ["Stress post-traumatique","Plaies/infections cutanées","Insomnie chronique","Syndrome du héros de ruelle","Tachycardie au bruit de sac plastique"]

 },
 "transhuman": {
 "Non": [
 "Migraine",
 "Stress",
 "Trouble du sommeil",
 "Syndrome du Wi‑Fi émotionnel instable",
 "Allergie aux mises à jour (humaines)"
 ],
 "Oui": [
 "Rejet d’implant",
 "Infection sur matériel",
 "Neuropathie",
 "Syndrome de mise à jour en boucle",
 "Tinnitus numérique (bip-bip intérieur)"
 ],
 "__default": ["Neuropathie","Infection sur matériel","Rejet d’implant","Syndrome de mise à jour en boucle","Tinnitus numérique (bip-bip intérieur)"]

 },
 "confession": {
 "Aucune / Athée": [
 "Trouble anxieux",
 "Insomnie",
 "Céphalées de tension",
 "Syndrome du vide cosmique productif",
 "Allergie aux sermons (même imaginaires)"
 ],
 "Chrétien": [
 "Stress",
 "Insomnie",
 "Reflux gastro-œsophagien",
 "Syndrome du chapelet antistress",
 "Tendinite de la main des bénédictions"
 ],
 "Musulman": [
 "Stress",
 "Insomnie",
 "Hypoglycémie (jeûne possible)",
 "Syndrome du calendrier lunaire qui surprend",
 "Déshydratation de prière trop concentrée"
 ],
 "Juif": [
 "Stress",
 "Insomnie",
 "Trouble digestif fonctionnel",
 "Syndrome du débat talmudique interminable",
 "Inflammation du « encore une question »"
 ],
 "Bouddhiste": [
 "Bruxisme",
 "Insomnie",
 "Céphalées de tension",
 "Syndrome du lotus trop confiant",
 "Allergie à la colère (refoulée)"
 ],
 "Hindou": [
 "Stress",
 "Troubles du sommeil",
 "Reflux gastro-œsophagien",
 "Syndrome du karma comptable",
 "Tachycardie quand Mercure rétrograde"
 ],
 "Sikh": [
 "Stress",
 "Insomnie",
 "Dermatite de contact",
 "Syndrome du turban trop majestueux (égo)",
 "Allergie aux compliments (trop polis)"
 ],
 "Autre / Non précisé": [
 "Stress",
 "Insomnie",
 "Migraine",
 "Syndrome du mystère spirituel certifié",
 "Surcharge de karma (vague, mais réelle)"
 ],
 "__default": ["Céphalées de tension","Bruxisme","Insomnie chronique","Syndrome de l’âme en mode avion","Karma en surcharge (vague, mais têtu)"]

 },
 "socialScore": {
 "bas": [
 "Trouble anxieux social",
 "Dépression",
 "Insomnie",
 "Syndrome de l’ombre numérique",
 "Carence en likes (avec démangeaisons)"
 ],
 "moyen": [
 "Stress",
 "Migraine",
 "Trouble du sommeil",
 "Syndrome du feed instable",
 "Inflammation des DM non lus"
 ],
 "haut": [
 "Insomnie",
 "Céphalées de tension",
 "Dermatite (écran)",
 "Syndrome du statut VIP anxieux",
 "Hyperexposition aux compliments (urticaire)"
 ],
 "__default": [
 "Stress",
 "Trouble du sommeil",
 "Migraine",
 "Syndrome du score social inconnu",
 "Bug de réputation"
 ]
 },
 "healthProblems": {
 "NON": [
 "Syndrome du dossier trop propre",
 "Migraine",
 "Allergie saisonnière",
 "Reflux gastro-œsophagien",
 "Fatigue passagère"
 ],
 "Cancer": [
 "Fatigue chronique",
 "Perte de poids inexpliquée",
 "Anémie",
 "Immunodépression",
 "Syndrome du suivi oncologique"
 ],
 "Handicap moteur": [
 "Douleurs articulaires",
 "Sarcopénie",
 "Troubles de la mobilité",
 "Syndrome de désadaptation à l’effort",
 "Risque de complications de sédentarité"
 ],
 "Immunodépressive": [
 "Infections opportunistes",
 "Inflammation chronique",
 "Syndrome fébrile récurrent",
 "Trouble auto-immun",
 "Fatigue immunitaire"
 ],
 "Greffe": [
 "Infection opportuniste",
 "Complications post-greffe",
 "Rejet (surveillance)",
 "Immunosuppression",
 "Syndrome du traitement à vie"
 ],
 "Handicap mental": [
 "Troubles anxieux",
 "Troubles du sommeil",
 "Dépression",
 "Syndrome de surcharge cognitive",
 "Comorbidité neuro-psy"
 ],
 "Maladie Sexuel": [
 "Infection sexuellement transmissible",
 "Inflammation urogénitale",
 "Syndrome douloureux pelvien",
 "Complications infectieuses",
 "Syndrome du test oublié"
 ],
 "Maladie genetique non transmissible": [
 "Trouble génétique non transmissible",
 "Maladie rare",
 "Syndrome métabolique héréditaire",
 "Fragilité tissulaire",
 "Fatigue constitutionnelle"
 ],
 "Maladie genetique héréditaire": [
 "Maladie héréditaire",
 "Antécédents familiaux",
 "Syndrome génétique",
 "Fragilité constitutionnelle",
 "Risque de transmission familiale"
 ],
 "Signe de vieillesse (Ostéo / Cataracte ...)": [
 "Ostéoporose",
 "Cataracte",
 "Arthrose",
 "Sarcopénie",
 "Syndrome gériatrique débutant"
 ],
 "Autre": [
 "Comorbidité",
 "Inflammation chronique",
 "Fatigue multifactorielle",
 "Douleur diffuse",
 "Syndrome du diagnostic en chantier"
 ],
 "N/A": [
 "Syndrome du dossier incomplet",
 "Diagnostic flou",
 "Fatigue multifactorielle",
 "Trouble du sommeil",
 "Comorbidité en brouillard"
 ],
 "__default": [
 "Fatigue multifactorielle",
 "Douleur diffuse",
 "Trouble du sommeil",
 "Syndrome du texte flou",
 "Comorbidité en brouillard"
 ]
 }
};

// Catégorisation des valeurs (pour les champs libres / dates / nombres)
function linkedKey(field, value, patient, extra){
 const v = String(value ?? "").trim();
 if(field === "birthDate"){
 const ageNum = computePatientAge(patient, extra);
 if(ageNum != null && Number.isFinite(ageNum)){
 if(ageNum < 25) return "jeune";
 if(ageNum >= 65) return "vieux";
 return "adulte";
 }
 return "__default";
 }
 if(field === "socialScore"){
 const n = safeNum(v);
 if(n == null) return "__default";
 if(n < 4000) return "bas";
 if(n < 9000) return "moyen";
 return "haut";
 }
 if(field === "healthProblems"){
 const k = normalizeHealthProblemsKey(v);
 return (k && k !== "__default") ? k : "__default";
 }
 // champs à choix: on garde la valeur telle quelle
 return v || "__default";
}

function buildLinkedNameList(field, value, patient, extra){
 const by = LINKED_BY_VALUE[field];
 if(!by){
 return ["Syndrome du dossier incomplet"];
 }
 const k = linkedKey(field, value, patient, extra);
 const list = by[k] || by["__default"] || ["Syndrome du dossier incomplet"];
 // 5 entrées (3 réelles, 2 humoristiques)
 return Array.isArray(list) && list.length ? list.slice(0,5) : ["Syndrome du dossier incomplet"];
}


function uniqueSlice(arr, max=9){
 const out = [];
 const seen = new Set();
 for(const x of (arr || [])){
 const k = String(x);
 if(seen.has(k)) continue;
 seen.add(k);
 out.push(x);
 if(out.length >= max) break;
 }
 return out;
}


function computeCompletenessForPatient(patient, extra){
 const fields = EXTRA_FIELDS.slice();
 let filled = 0;
 for(const f of fields){
 const v = getEffectiveFieldValue(patient, extra, f) ?? extra?.[f];
 if(isFilledValue(v)) filled++;
 }
 return fields.length ? (filled / fields.length) : 0.0;
}

function makeLinkedDisease(name, field, value){
 const label = FIELD_LABELS[field] || field;
 const v = String(value ?? "").trim();
 const vv = v || "non précisé";

 // Traitements "dossier" : , mais formulés pour le praticien.
 const joke = [
 `Faire porter au patient une blouse ${label.toLowerCase()}-thème (ex: badge « ${label}: ${vv} ») pendant la consultation, pour matérialiser le facteur dossier.`,
 `Demander au patient de poster une story « ${name} » avec en arrière-plan une capture floutée de « ${label}: ${vv} » (objectif : rendre le dossier mémorable sans le rendre lisible).`,
 `Exiger une phrase‑code à dire à chaque ouverture de porte : « ${label} = ${vv}, je coopère. » (utile pour repérer les rechutes de bonne foi).`,
 `Prescrire un “défi” : coller 5 post‑its « ${name} » sur des objets liés à ${label.toLowerCase()}, puis faire un inventaire oral en salle d’attente.`,
 `Faire dessiner au patient un schéma ridicule mais fidèle du lien « ${label} → ${name} » et le faire signer comme un consentement esthétique.`,
 `Demander un micro‑exposé de 30 secondes : « Pourquoi ${label} = ${vv} peut influencer ${name} » (niveau 1ère année, mais en public).`,
 `Mettre en place un tableau de suivi “${name}” où le patient note ${label.toLowerCase()} (valeur: ${vv}) avec des autocollants — puis le ramener fièrement.`,
 `Prescrire un accessoire exact : chaussettes hautes à motifs de dossiers + phrase « je suis un dossier complet » quand ${label.toLowerCase()} est discuté.`,
 `Rituel discret : à chaque symptôme évoqué, le patient doit sortir un carnet et écrire « ${label}: ${vv} → ${name} » comme s’il annotait un cours.`,
 `Proposer un pacte : le patient fait valider ${label.toLowerCase()} par un témoin (“oui docteur, il/elle a bien dit ${vv}”), pour réduire la tentation du “N/A”.`
 ];

 const serieuse = [
 `Recontextualiser ${name} : vérifier la fiabilité de ${label.toLowerCase()} (clarifier ${vv}, dater, préciser intensité/fréquence).`,
 `Compléter l’anamnèse ciblée autour de ${label.toLowerCase()} (facteurs associés, retentissement, chronologie) et documenter dans le dossier.`,
 `Mettre en face les symptômes actuels et les facteurs de risque : décider si ${name} reste hypothèse ou nécessite une exploration standard.`,
 `Planifier un suivi : si ${label.toLowerCase()} change (ou si nouveaux symptômes), réévaluer le classement des hypothèses et adapter les examens.`
 ];

 return {
 name,
 category: "Spéculatif (dossier)",
 symptoms: `Indice dossier: ${label} = ${vv}. ( — utile quand certaines données manquent ou sont imprécises)`,
 treatments: { joke, serieuse },
 keywords: [label, vv, "dossier", "indice", ""],
 tags: [],
 base: -3.2,
 profile: null,
 _linkedReason: `${label} : ${vv}`,
 _linkedField: field
 };
}

function generateLinkedCandidates(patient, extra){
 const completeness = computeCompletenessForPatient(patient, extra);
 const missingRate = clamp(1 - completeness, 0, 1);
 const boost = clamp((missingRate - 0.35) / 0.65, 0, 1);
 if(boost <= 0.05) return [];

 const fields = EXTRA_FIELDS.slice();
 const out = [];

 for(const field of fields){
 let v = getEffectiveFieldValue(patient, extra, field) ?? extra?.[field];
 if(v == null) continue;
 if(field === "healthProblems"){ /* key handled in linkedKey() */ }
 const name = randPick(buildLinkedNameList(field, v, patient, extra));
 const d = makeLinkedDisease(name, field, v);
 // Score en unités "logit" (plus naturel pour la sigmoid ensuite)
 const s = (-3.1) + (boost * 1.35) + (Math.random()*0.35*boost);
 out.push({ d, s });
 }

 // Dossier très incomplet: on ajoute un candidat "dossier incomplet" même si aucun champ exploitable n'est présent.
 if(out.length === 0){
 const d = {
 name: "Syndrome du dossier incomplet",
 category: "Spéculatif (dossier)",
 symptoms: "Indice dossier: informations insuffisantes pour une analyse fiable. ( — plus probable quand le dossier est incomplet)",
 treatments: [
 "compléter le dossier patient (âge, tabac, alcool, sport, etc.)",
 "recueillir un historique médical et des facteurs de risque",
 "si symptômes inquiétants, demander un avis médical",
 "revenir avec plus de données pour une analyse plus précise"
 ],
 keywords: ["dossier incomplet","informations insuffisantes",""],
 tags: [],
 base: -3.15,
 profile: null,
 _linkedReason: "Dossier : informations insuffisantes",
 _linkedField: "dossier"
 };
 const s = (-3.1) + (boost * 1.15) + (Math.random()*0.25*boost);
 out.push({ d, s });
 }

 return out;
}

// --- Choix Top 3 avec degrés d'aléatoire (1 peu, 2 moyen, 3 plus) ---
function weightedPick(items, temp, opts={}){
 const arr = items || [];
 if(!arr.length) return null;

 const t = Math.max(0.35, temp || 1);
 const jitter = (typeof opts.jitter === "number") ? Math.max(0, opts.jitter) : 0;
 const floor = (typeof opts.floor === "number") ? Math.max(0, opts.floor) : 0;

 // Softmax stable + petit jitter (par tirage) :
 // - stable numériquement
 // - donne une chance aux maladies moins hautes sans casser la cohérence
 const logits = arr.map(it => {
 const base = (it && typeof it.s === "number") ? it.s : 0;
 const j = jitter ? ((Math.random() * 2 - 1) * jitter) : 0;
 return (base + j) / t;
 });
 const maxLog = Math.max(...logits);
 const weights = logits.map(x => Math.exp(x - maxLog) + floor);
 const sum = weights.reduce((a,b)=>a+b,0) || 1;
 let r = Math.random() * sum;
 for(let i=0;i<arr.length;i++){
 r -= weights[i];
 if(r <= 0) return arr[i];
 }
 return arr[arr.length-1];
}

function pickTop3(scored, risks, completeness=0.55){
 const sorted = [...scored].sort((a,b)=>(b.s||0)-(a.s||0));
 const chosen = [];
 const usedGroups = new Set();
 const usedSigs = new Set();
 const usedCats = new Set();

 // Signature des "raisons" (2 groupes max) pour éviter les doublons du type "Social ; Bonheur"
 const reasonSig = (item) => {
 const d = item && item.d;
 if(!d) return "other";
 const contribs = [];

 for(const tag of (d.tags || [])){
 const w = TAG_WEIGHTS[tag] ?? 0.55;
 const r = riskForTag(risks, tag);
 const c = w * r;
 contribs.push({ group: reasonGroupFromKey(tag), c });
 }

 if(d.profile){
 for(const k of Object.keys(d.profile)){
 const r = (risks[k] != null) ? risks[k] : 0.35;
 const c = profileContribution(r, d.profile[k]);
 contribs.push({ group: reasonGroupFromKey(k), c });
 }
 }

 contribs.sort((a,b)=>(b.c||0)-(a.c||0));
 const groups = [];
 const used = new Set();
 for(const it of contribs){
 if(!it.group || used.has(it.group)) continue;
 groups.push(it.group);
 used.add(it.group);
 if(groups.length >= 2) break;
 }
 return groups.sort().join("|") || "other";
 };

 const catKey = (item) => String((item && item.d && item.d.category) || "other");

 const c = (typeof completeness === "number")
 ? completeness
 : (risks && typeof risks.__completeness === "number" ? risks.__completeness : 0.55);
 const uncertainty = clamp(1 - c, 0, 1);

 // Paramètres d'exploration :
 // - jitter: micro-variation dans le tirage (pour éviter la répétition)
 // - exploreChance: petite proba de piocher plus loin que le top (montre plus de maladies possibles)
 const focusJ = (risks && typeof risks.__focusNarrow === "number") ? risks.__focusNarrow : 0;
 const pickJitter = 0.10 + 0.18 * uncertainty + 0.06*focusJ; // 0.10 (dossier complet) -> 0.28 (dossier vide)
 const weightFloor = 0.012; // garantit une chance non nulle
 const focusN = (risks && typeof risks.__focusNarrow === "number") ? risks.__focusNarrow : 0;
 const exploreChanceBase = 0.10 + 0.22 * uncertainty + 0.08*focusN; // ~10% -> ~32% (+focus)
 const exploreChanceThird = 0.18 + 0.28 * uncertainty + 0.10*focusN; // ~18% -> ~46% (+focus) // ~12% -> ~34%

 const getGroup = (item) => {
 const k = bestReasonKeyForDisease(item.d, risks);
 return reasonGroupFromKey(k);
 };

 const pickStage = (poolSize, baseTemp, preferDiversity, exploreChance) => {
 const remaining = sorted.filter(x => !chosen.includes(x));
 if(!remaining.length) return null;

 const maxPool = Math.min(22, remaining.length);
 const doExplore = Math.random() < (typeof exploreChance === "number" ? exploreChance : exploreChanceBase);
 const tempBase = baseTemp + (uncertainty * 0.75);

 const pickFromPool = (pool, temp, wantDiversity) => {
 if(!pool || !pool.length) return null;

 if(wantDiversity){
 // 1) on essaie de changer AU MOINS une des raisons (signature) + ne pas répéter le groupe principal
 const diverseRS = pool.filter(it => !usedGroups.has(getGroup(it)) && !usedSigs.has(reasonSig(it)));
 if(diverseRS.length){
 // bonus: varier aussi le type de maladie (catégorie) quand possible
 const diverseRSC = diverseRS.filter(it => !usedCats.has(catKey(it)));
 if(diverseRSC.length) return weightedPick(diverseRSC, temp, { jitter: pickJitter, floor: weightFloor }) || diverseRSC[0];
 return weightedPick(diverseRS, temp, { jitter: pickJitter, floor: weightFloor }) || diverseRS[0];
 }

 // 2) sinon, au moins changer le groupe principal
 const diverseG = pool.filter(it => !usedGroups.has(getGroup(it)));
 if(diverseG.length){
 const diverseGC = diverseG.filter(it => !usedCats.has(catKey(it)));
 if(diverseGC.length) return weightedPick(diverseGC, temp, { jitter: pickJitter, floor: weightFloor }) || diverseGC[0];
 return weightedPick(diverseG, temp, { jitter: pickJitter, floor: weightFloor }) || diverseG[0];
 }

 // 3) sinon, au moins éviter exactement la même paire de raisons
 const diverseS = pool.filter(it => !usedSigs.has(reasonSig(it)));
 if(diverseS.length) return weightedPick(diverseS, temp, { jitter: pickJitter, floor: weightFloor }) || diverseS[0];
 }

 return weightedPick(pool, temp, { jitter: pickJitter, floor: weightFloor }) || pool[0];
 };

 // Exploration: on regarde plus loin que le top (sans casser la cohérence)
 if(doExplore){
 const exploreMax = remaining.length;
 const pool = remaining.slice(0, exploreMax);
 const temp = tempBase + 0.85; // distribution plus "plate" => plus de variété
 return pickFromPool(pool, temp, preferDiversity);
 }

 for(let size = Math.min(poolSize, maxPool); size <= maxPool; size = Math.min(maxPool, size + 3)){
 const pool = remaining.slice(0, size);

 const p = pickFromPool(pool, tempBase, preferDiversity);
 if(p) return p;
 }
 return remaining[0];
 };

 // 1) 1ère maladie: plutôt logique, mais légèrement moins "toujours la même" quand le dossier est incomplet
 let first = sorted[0] || null;
 if(sorted.length > 1){
 const margin = (sorted[0].s - sorted[1].s);
 const needSoft = (margin < (0.22 + 0.18*uncertainty)) || (uncertainty > 0.55);
 const exploreFirst = Math.random() < (0.10 + 0.18*uncertainty);
 if(needSoft || exploreFirst){
 const poolSize = Math.min(sorted.length, exploreFirst ? 18 : (uncertainty > 0.55 ? 6 : 4));
 const pool = sorted.slice(0, poolSize);
 const temp1 = 0.55 + (uncertainty * 0.95) + (exploreFirst ? 0.45 : 0);
 first = weightedPick(pool, temp1, { jitter: pickJitter, floor: weightFloor }) || pool[0];
 }
 }
 if(first){
 chosen.push(first);
 usedGroups.add(getGroup(first));
 usedSigs.add(reasonSig(first));
 usedCats.add(catKey(first));
 }

 // 2) un peu d'aléatoire, on privilégie une autre “raison”
 const second = pickStage(6, 0.85, true, exploreChanceBase);
 if(second){
 chosen.push(second);
 usedGroups.add(getGroup(second));
 usedSigs.add(reasonSig(second));
 usedCats.add(catKey(second));
 }

 // 3) plus d'aléatoire, on essaye encore de varier (surtout si dossier incomplet)
 const third = pickStage(12, 1.35, true, exploreChanceThird);
 if(third){
 chosen.push(third);
 usedSigs.add(reasonSig(third));
 usedCats.add(catKey(third));
 }

 return chosen.filter(Boolean);
}

// --- Résumé narratif (4 catégories les plus marquantes) ---
function randPick(arr){
 if(!arr || !arr.length) return "";
 return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleInPlace(arr){
 if(!Array.isArray(arr)) return arr;
 for(let i=arr.length-1;i>0;i--){
 const j = Math.floor(Math.random()*(i+1));
 [arr[i], arr[j]] = [arr[j], arr[i]];
 }
 return arr;
}
function capFirst(s){
 const t = String(s || "").trim();
 if(!t) return "";
 return t[0].toUpperCase() + t.slice(1);
}
function ensurePeriod(s){
 const t = String(s || "").trim();
 if(!t) return "";
 return /[.!?]$/.test(t) ? t : (t + ".");
}
function safeNum(x){
 const n = (typeof x === "number") ? x : Number(String(x || "").replace(/[^0-9.\-]/g, ""));
 return Number.isFinite(n) ? n : null;
}

const NARRATIVE_TEMPLATES = {
 cigarette: {
 "non": { tone:"good", base:0.55, phrases:[
 "ne fume pas et ne vapote pas",
 "reste loin de la cigarette comme de la vape",
 "évite complètement tabac et vapotage",
 "n'a pas de consommation de nicotine notable"
 ]},
 "un peu cigarette": { tone:"neutral", base:0.18, phrases:[
 "fume à l'occasion",
 "a quelques cigarettes de temps en temps",
 "fume légèrement",
 "touche un peu à la cigarette"
 ]},
 "un peu Vap": { tone:"neutral", base:0.22, phrases:[
 "vapote de temps en temps",
 "a une petite consommation de vape",
 "utilise la vape occasionnellement",
 "vapote légèrement"
 ]},
 "beaucoup cigarette": { tone:"bad", base:1.00, phrases:[
 "fume beaucoup",
 "enchaîne les cigarettes",
 "a une consommation de tabac très élevée",
 "semble accro à la cigarette"
 ]},
 "beaucoup Vap": { tone:"bad", base:0.85, phrases:[
 "vapote beaucoup",
 "a une grosse consommation de vape",
 "utilise la vape de façon très soutenue",
 "semble accro au vapotage"
 ]}
 },

 alimentation: {
 "ne mange jamais (coma régulié)": { tone:"bad", base:1.00, phrases:[
 "a une alimentation quasi inexistante",
 "mange très rarement (profil très préoccupant)",
 "semble ne presque jamais s'alimenter",
 "a un rythme alimentaire alarmant"
 ]},
 "ultra-tranformé (ltd)": { tone:"bad", base:0.80, phrases:[
 "mange surtout de l'ultra‑transformé",
 "carbure aux produits industriels",
 "vit sur une alimentation très transformée",
 "a une alimentation clairement déséquilibrée"
 ]},
 "fast food": { tone:"neutral", base:0.50, phrases:[
 "mange souvent du fast‑food",
 "a une alimentation plutôt “rapide”",
 "fait pas mal de fast‑food",
 "mange régulièrement sur le pouce"
 ]},
 "restaurant (bonne qualité)": { tone:"good", base:0.45, phrases:[
 "privilégie des repas plutôt qualitatifs",
 "mange souvent au restaurant de bonne qualité",
 "a une alimentation assez correcte",
 "semble faire attention à ce qu'il mange"
 ]},
 "a la maison (meilleur qualité)": { tone:"good", base:0.65, phrases:[
 "mange surtout maison et plutôt sain",
 "privilégie une cuisine maison de bonne qualité",
 "a une alimentation globalement saine",
 "s'alimente assez proprement au quotidien"
 ]}
 },

 sport: {
 "Jamais": { tone:"bad", base:0.75, phrases:[
 "bouge très peu",
 "est plutôt sédentaire",
 "ne fait pratiquement pas de sport",
 "a une activité physique quasi nulle"
 ]},
 "1-2/sem": { tone:"neutral", base:0.35, phrases:[
 "fait un peu de sport",
 "bouge 1 à 2 fois par semaine",
 "s'entretient de temps en temps",
 "a une activité physique légère"
 ]},
 "3-5/sem": { tone:"good", base:0.55, phrases:[
 "fait du sport régulièrement",
 "a une routine sportive solide",
 "s'entretient plusieurs fois par semaine",
 "reste actif physiquement"
 ]},
 "Tous les jours": { tone:"good", base:0.70, phrases:[
 "fait du sport tous les jours",
 "s'entretient quotidiennement",
 "a une hygiène sportive très régulière",
 "semble très actif au quotidien"
 ]}
 },

 corpulence: {
 "Maigre": { tone:"neutral", base:0.30, phrases:[
 "a une corpulence plutôt mince",
 "a un gabarit fin",
 "semble assez maigre",
 "présente une silhouette fine"
 ]},
 "Normal": { tone:"good", base:0.35, phrases:[
 "a une corpulence dans la moyenne",
 "semble dans un gabarit normal",
 "présente une corpulence standard",
 "a un poids globalement équilibré"
 ]},
 "Enrobé": { tone:"neutral", base:0.55, phrases:[
 "est un peu enrobé",
 "a pris un peu de volume",
 "a une corpulence plutôt ronde",
 "a un léger surpoids"
 ]},
 "Obèse": { tone:"bad", base:0.85, phrases:[
 "semble en situation d'obésité",
 "a une corpulence très élevée",
 "présente un surpoids important",
 "a un gabarit vraiment lourd"
 ]}
 },

 alcoholFreq: {
 "Jamais": { tone:"good", base:0.50, phrases:[
 "évite l'alcool",
 "ne boit quasiment pas d'alcool",
 "reste sobre la plupart du temps",
 "n'a pas de consommation d'alcool notable"
 ]},
 "1 fois / semaine": { tone:"neutral", base:0.25, phrases:[
 "boit plutôt rarement",
 "prend un verre de temps en temps",
 "consomme de l'alcool à petite dose",
 "boit surtout à l'occasion"
 ]},
 "2 à 4 / semaine": { tone:"neutral", base:0.45, phrases:[
 "boit plusieurs fois par semaine",
 "a une consommation d'alcool assez régulière",
 "prend souvent quelques verres dans la semaine",
 "boit assez fréquemment"
 ]},
 "2 à 3 / jour": { tone:"bad", base:0.80, phrases:[
 "boit tous les jours",
 "a une consommation d'alcool quotidienne",
 "enchaîne les verres au quotidien",
 "semble avoir l'alcool très présent"
 ]},
 "Au moins 4 fois / jour": { tone:"bad", base:1.00, phrases:[
 "boit énormément d'alcool chaque jour",
 "a une consommation d'alcool très inquiétante",
 "est sur une consommation massive au quotidien",
 "semble être dans l'excès d'alcool"
 ]}
 },

 drugs: {
 "Non": { tone:"good", base:0.55, phrases:[
 "ne consomme pas de drogues",
 "reste à distance des substances",
 "évite les drogues",
 "n'a pas de consommation de substances signalée"
 ]},
 "Oui, en soirée": { tone:"neutral", base:0.45, phrases:[
 "touche aux substances en soirée",
 "consomme parfois en contexte festif",
 "admet quelques usages occasionnels",
 "a une consommation de drogues ponctuelle"
 ]},
 "Oui, régulièrement": { tone:"bad", base:0.90, phrases:[
 "consomme des drogues régulièrement",
 "a une consommation de substances installée",
 "semble dépendant aux substances",
 "a des usages fréquents de drogues"
 ]}
 }
};

function ageBin(age){
 if(age == null) return null;
 if(age >= 75) return "very_old";
 if(age >= 60) return "old";
 if(age >= 45) return "mid";
 if(age >= 25) return "adult";
 if(age >= 18) return "young_adult";
 return "teen";
}
const AGE_PHRASES = {
 teen: { tone:"neutral", base:0.35, phrases:[
 "est très jeune",
 "a un profil très jeune",
 "est encore dans une tranche d'âge très basse",
 "présente un âge très bas"
 ]},
 young_adult: { tone:"neutral", base:0.25, phrases:[
 "est plutôt jeune",
 "a un profil jeune adulte",
 "est dans une tranche d'âge jeune",
 "est encore assez jeune"
 ]},
 adult: { tone:"neutral", base:0.20, phrases:[
 "est dans un âge “actif” classique",
 "a un âge adulte standard",
 "est dans une tranche d'âge adulte",
 "présente un âge courant"
 ]},
 mid: { tone:"neutral", base:0.35, phrases:[
 "approche un âge où les risques commencent à monter",
 "est dans une tranche d'âge où il faut surveiller les bilans",
 "est dans une tranche d'âge où les signaux se paient plus vite",
 "commence à entrer dans une tranche d'âge plus sensible"
 ]},
 old: { tone:"bad", base:0.65, phrases:[
 "est plutôt âgé",
 "a un âge avancé",
 "est dans une tranche d'âge à risque plus élevé",
 "présente un âge qui augmente nettement les risques"
 ]},
 very_old: { tone:"bad", base:0.85, phrases:[
 "est très âgé",
 "a un âge très avancé",
 "est dans une tranche d'âge très à risque",
 "présente un âge qui pèse fortement dans le dossier"
 ]}
};

function happinessBin(v){
 const n = safeNum(v);
 if(n == null) return null;
 if(n <= 1) return "low";
 if(n === 2) return "mid_low";
 if(n === 3) return "mid";
 return "high";
}
const HAPPINESS_PHRASES = {
 low: { tone:"bad", base:0.70, phrases:[
 "a un moral très bas",
 "semble franchement à bout moralement",
 "décrit une humeur plutôt sombre",
 "a un niveau de bonheur très faible"
 ]},
 mid_low: { tone:"neutral", base:0.35, phrases:[
 "a un moral un peu fragile",
 "tient le coup sans être au top",
 "a une humeur moyenne‑basse",
 "décrit un moral mitigé"
 ]},
 mid: { tone:"neutral", base:0.25, phrases:[
 "a un moral correct sans plus",
 "semble tenir sur la durée",
 "décrit une humeur plutôt stable",
 "a un moral globalement moyen"
 ]},
 high: { tone:"good", base:0.45, phrases:[
 "a un moral plutôt bon",
 "semble assez en forme mentalement",
 "décrit une humeur positive",
 "a un niveau de bonheur élevé"
 ]}
};

function socialBin(score){
 const n = safeNum(score);
 if(n == null) return null;
 if(n < 2000) return "very_low";
 if(n < 5000) return "low";
 if(n < 9000) return "mid";
 if(n < 12000) return "high";
 return "very_high";
}
const SOCIAL_PHRASES = {
 very_low: { tone:"bad", base:0.85, phrases:[
 "a un score social très bas",
 "est très bas dans le score social",
 "a un score social catastrophique",
 "présente un score social extrêmement faible"
 ]},
 low: { tone:"bad", base:0.55, phrases:[
 "a un score social bas",
 "est plutôt bas dans le score social",
 "reste en dessous de la moyenne au score social",
 "a un score social qui complique la vie"
 ]},
 mid: { tone:"neutral", base:0.25, phrases:[
 "a un score social moyen",
 "se situe dans la moyenne au score social",
 "a un score social correct",
 "n'a pas un score social particulièrement extrême"
 ]},
 high: { tone:"good", base:0.35, phrases:[
 "a un bon score social",
 "se situe plutôt haut dans le score social",
 "a un score social confortable",
 "bénéficie d'un score social favorable"
 ]},
 very_high: { tone:"good", base:0.55, phrases:[
 "a un score social très élevé",
 "est très haut dans le score social",
 "bénéficie d'un score social exceptionnel",
 "a un score social extrêmement favorable"
 ]}
};


// Phrases “identité” / “contexte” (ne pas afficher si N/A)
const SEX_PHRASES = {
 "Homme": { tone:"neutral", base:0.18, phrases:[
 "est un homme",
 "a un profil masculin",
 "est de sexe masculin",
 "se présente comme un homme",
 "a un sexe renseigné : homme"
 ]},
 "Femme": { tone:"neutral", base:0.18, phrases:[
 "est une femme",
 "a un profil féminin",
 "est de sexe féminin",
 "se présente comme une femme",
 "a un sexe renseigné : femme"
 ]},
 "Autre": { tone:"neutral", base:0.15, phrases:[
 "a un sexe renseigné “autre”",
 "ne se range pas dans homme/femme dans le dossier",
 "a un profil sexe non standard",
 "a une information de sexe non binaire / autre",
 "a un sexe noté : autre"
 ]}
};

const CONFESSION_PHRASES = {
 "Aucune / Athée": { tone:"neutral", base:0.14, phrases:[
 "ne déclare pas de confession particulière",
 "se dit sans religion / athée",
 "n'indique aucune confession",
 "ne rattache pas le dossier à une religion",
 "ne se revendique d'aucune confession"
 ]},
 "Chrétien": { tone:"neutral", base:0.14, phrases:[
 "se dit chrétien",
 "a une confession chrétienne",
 "mentionne une foi chrétienne",
 "indique être chrétien dans le dossier",
 "se rattache au christianisme"
 ]},
 "Musulman": { tone:"neutral", base:0.14, phrases:[
 "se dit musulman",
 "a une confession musulmane",
 "mentionne une foi musulmane",
 "indique être musulman dans le dossier",
 "se rattache à l'islam"
 ]},
 "Juif": { tone:"neutral", base:0.14, phrases:[
 "se dit juif",
 "a une confession juive",
 "mentionne une foi juive",
 "indique être juif dans le dossier",
 "se rattache au judaïsme"
 ]},
 "Bouddhiste": { tone:"neutral", base:0.14, phrases:[
 "se dit bouddhiste",
 "a une confession bouddhiste",
 "mentionne une spiritualité bouddhiste",
 "indique être bouddhiste dans le dossier",
 "se rattache au bouddhisme"
 ]},
 "Hindou": { tone:"neutral", base:0.14, phrases:[
 "se dit hindou",
 "a une confession hindoue",
 "mentionne une foi hindoue",
 "indique être hindou dans le dossier",
 "se rattache à l'hindouisme"
 ]},
 "Sikh": { tone:"neutral", base:0.14, phrases:[
 "se dit sikh",
 "a une confession sikh",
 "mentionne une foi sikh",
 "indique être sikh dans le dossier",
 "se rattache au sikhisme"
 ]},
 "Autre / Non précisé": { tone:"neutral", base:0.12, phrases:[
 "mentionne une confession “autre / non précisée”",
 "a une confession non détaillée",
 "indique une religion non précisée",
 "reste vague sur la confession",
 "a une information de confession non précisée"
 ]}
};

const OPERATION_PHRASES = {
 "Non": { tone:"good", base:0.18, phrases:[
 "ne signale pas d'antécédent opératoire",
 "n'a pas d'opération déclarée",
 "ne mentionne pas de chirurgie passée",
 "n'a pas d'historique d'intervention indiqué",
 "ne rapporte pas d'opération"
 ]},
 "Oui": { tone:"neutral", base:0.35, phrases:[
 "a déjà subi une opération",
 "a un antécédent opératoire",
 "a été opéré par le passé",
 "mentionne une intervention chirurgicale",
 "a un historique de chirurgie"
 ]}
};

const CRIMINAL_PHRASES = {
 "Non": { tone:"good", base:0.12, phrases:[
 "ne signale pas de vie dangereuse",
 "n'a pas de profil “criminel” déclaré",
 "ne mentionne pas d'activité à risque majeur",
 "n'indique pas de contexte criminel",
 "n'a pas de mode de vie dangereux déclaré"
 ]},
 "Oui": { tone:"bad", base:0.75, phrases:[
 "mène une vie clairement dangereuse",
 "évolue dans un environnement à risques",
 "traîne dans des histoires pas nettes",
 "a un mode de vie franchement risqué",
 "a un contexte criminel préoccupant"
 ]}
};

const TRANSHUMAN_PHRASES = {
 "Non": { tone:"good", base:0.10, phrases:[
 "ne présente pas d'augmentations transhumaines déclarées",
 "n'indique pas de cybernétique particulière",
 "reste sur un profil biologique classique",
 "ne mentionne aucune augmentation",
 "ne signale pas d'implant/augmentation"
 ]},
 "Oui": { tone:"neutral", base:0.45, phrases:[
 "a un profil transhumain",
 "présente des augmentations/cybernétique dans le dossier",
 "n'est pas totalement “full biologique”",
 "a des éléments cybernétiques qui compliquent le tableau",
 "mentionne des implants/augmentations"
 ]}
};

// Dossier-info : phrases si le dossier est vide / presque vide
const DOSSIERINFO_NO_DATA = [
 "a un dossier quasiment vide : je n'ai pas assez d'éléments pour résumer le profil",
 "a un dossier non renseigné : toutes les catégories sont encore en N/A",
 "n'a pour l'instant aucune information exploitable dans le dossier",
 "a un profil trop peu documenté : impossible de tirer un résumé fiable",
 "a un dossier vide ou incomplet : rien de concret à signaler",
 "n'a pas de données utiles enregistrées (tout est N/A pour le moment)",
 "a un dossier sans détails : je ne peux pas contextualiser le profil",
 "a un dossier qui ne contient presque rien, donc l'analyse reste très vague",
 "n'a pas d'informations saisies : il faudra compléter le dossier pour résumer",
 "a un dossier trop flou : aucune catégorie renseignée pour l'instant"
];

const DOSSIERINFO_LOW_DATA_TAIL = [
 "À part ça, le dossier reste très incomplet : beaucoup de catégories sont encore en N/A.",
 "À part ça, il manque encore pas mal d'informations pour un résumé vraiment fiable.",
 "À part ça, le dossier est partiel : complétez quelques champs pour affiner l'analyse.",
 "À part ça, on a très peu d'éléments, donc le contexte médical reste à confirmer.",
 "À part ça, plusieurs infos clés sont absentes : le profil est encore difficile à cerner.",
 "À part ça, les données disponibles sont limitées : prudence sur l'interprétation.",
 "À part ça, on est sur un dossier léger : quelques champs supplémentaires aideraient beaucoup.",
 "À part ça, on manque de détails : le résumé pourrait changer dès que le dossier se remplit."
];

function connectorBetween(t1, t2){
 if((t1 === "bad" && t2 === "good") || (t1 === "good" && t2 === "bad")){
 return randPick([", mais", ", cependant", ", en revanche"]);
 }
 if(t1 === "neutral" || t2 === "neutral"){
 return randPick([", et", ", et puis", ", par ailleurs"]);
 }
 if(t1 === "good" && t2 === "good"){
 return randPick([", et", ", et en plus", ", ce qui aide pas mal"]);
 }
 if(t1 === "bad" && t2 === "bad"){
 return randPick([", et", ", avec en prime", ", ce qui n'arrange rien"]);
 }
 return randPick([", et"]);
}

function sentenceStarterForTone(t){
 if(t === "bad") return randPick(["Cela dit,", "À noter aussi,", "En plus,"]);
 if(t === "good") return randPick(["Heureusement,", "À côté de ça,", "En compensation,"]);
 return randPick(["Par ailleurs,", "À noter,", "Enfin,"]);
}

function metricImportance(metric){
 const m = clamp(metric != null ? metric : 0.5, 0, 1);
 return 0.40 + 1.20 * Math.abs(m - 0.5);
}

function buildNarrativeItems(patient, extra, risks){
 const items = [];
 let hpKeyForMerge = null;
 let opKeyForMerge = null;
 const eff = (k) => (getEffectiveFieldValue(patient, extra, k) ?? (extra || {})[k] ?? null);

 
const addTpl = (field, value, metricFallback) => {
 if(!isFilledValue(value)) return;

 const klass = getChoiceKlass(field, value);
 const auto = autoCategoryPhrases(field, value);
 const extraPhrases = (BOT?.CATEGORY_PHRASES?.[field]?.[value] || []);
 const t = NARRATIVE_TEMPLATES[field]?.[value];

 let tone = "neutral";
 let base = 0.20;
 let pool = [];

 if(t){
 tone = t.tone || tone;
 base = t.base != null ? t.base : base;
 pool = uniqueSlice([...(t.phrases || []), ...(Array.isArray(extraPhrases) ? extraPhrases : [])], 32);
 if(!pool.length) pool = uniqueSlice([...auto], 24);
 }else{
 // fallback: au moins une phrase contextuelle pour chaque choix prédéfini
 tone = toneFromKlass(klass);
 base = (tone === "bad" ? 0.55 : (tone === "good" ? 0.40 : 0.22));
 pool = uniqueSlice([...(Array.isArray(extraPhrases) ? extraPhrases : []), ...auto], 24);
 if(!pool.length){
 pool = uniqueSlice([`${(FIELD_LABELS?.[field] || field)} : ${String(value)}`], 1);
 }
 }

 const metric = (metricFallback != null) ? metricFallback : 0.5;
 const imp = base * metricImportance(metric);
 items.push({ key: field, tone, importance: imp, phrases: pool });
 };

 
const addMap = (field, value, map, metricFallback=0.5) => {
 if(!isFilledValue(value)) return;
 const t = map?.[value];
 if(!t){
 // fallback neutre
 const klass = getChoiceKlass(field, value);
 const tone = toneFromKlass(klass);
 const pool = uniqueSlice([
 ...(BOT?.CATEGORY_PHRASES?.[field]?.[value] || []),
 ...autoCategoryPhrases(field, value)
 ], 24);
 items.push({ key: field, tone, importance: 0.22 * metricImportance(metricFallback), phrases: pool });
 return;
 }

 const metric = (metricFallback != null) ? metricFallback : 0.5;
 const imp = (t.base || 0.20) * metricImportance(metric);
 const pool = uniqueSlice([
 ...(t.phrases || []),
 ...(BOT?.CATEGORY_PHRASES?.[field]?.[value] || []),
 ...autoCategoryPhrases(field, value)
 ], 28);
 items.push({ key: field, tone: t.tone || "neutral", importance: imp, phrases: pool });
 };

 // Lifestyle / habitudes
const cigV = eff("cigarette");
const alcV = eff("alcoholFreq");
const drugV = eff("drugs");
const cigNo = isFilledValue(cigV) && String(cigV).trim().toLowerCase() === "non";
const alcNo = isFilledValue(alcV) && String(alcV).trim().toLowerCase() === "jamais";
const drugNo = isFilledValue(drugV) && String(drugV).trim().toLowerCase() === "non";

let skipCig = false, skipAlc = false, skipDrug = false;

// Regroupement substances + alcool (+ tabac si dispo) pour un résumé plus naturel
if(drugNo && alcNo){
 const phrases = cigNo ? [
 "ne consomme ni tabac, ni alcool, ni substances",
 "pas de tabac, pas d'alcool, pas de substances",
 "reste à l'écart du tabac, de l'alcool et des substances"
 ] : [
 "ne consomme pas de substances et ne boit pas d'alcool",
 "pas de prise de substances et d'alcool",
 "évite substances et alcool"
 ];
 const metric = Math.max((risks?.tabac ?? 0.45), (risks?.alcool ?? 0.45), (risks?.drogue ?? 0.45));
 items.push({ key:"substancesAlcohol", tone:"good", importance:0.60 * metricImportance(metric), phrases: uniqueSlice(phrases, 16) });
 skipAlc = true;
 skipDrug = true;
 if(cigNo) skipCig = true;
}

if(!skipCig) addTpl("cigarette", cigV, risks?.tabac);
addTpl("alimentation", eff("alimentation"), risks?.diet);
addTpl("sport", eff("sport"), risks?.sedentarite);
addTpl("corpulence", eff("corpulence"), risks?.surpoids);
if(!skipAlc) addTpl("alcoholFreq", alcV, risks?.alcool);
if(!skipDrug) addTpl("drugs", drugV, risks?.drogue);

// Âge (dérivé de la date de naissance)
 {
 const ageNum = computePatientAge(patient, extra);
 const ab = ageBin(ageNum);
 if(ab && AGE_PHRASES[ab]){
 const t = AGE_PHRASES[ab];
 items.push({ key:"age", tone:t.tone, importance:(t.base||0.3)*metricImportance(risks?.age), phrases: uniqueSlice([...(t.phrases||[]), ...(ageNum!=null ? [`a environ ${ageNum} ans`,`âge estimé : ${ageNum} ans`,`a autour de ${ageNum} ans`] : [])], 24) });
 }
 }

 // Score social + humeur
 {
 const sb = socialBin(eff("socialScore"));
 const hb = happinessBin(eff("happiness"));

 const hasSocial = !!(sb && SOCIAL_PHRASES[sb]);
 const hasHappy = !!(hb && HAPPINESS_PHRASES[hb]);

 const socialNeg = hasSocial && (sb === "very_low" || sb === "low");
 const happyNeg = hasHappy && (hb === "low" || hb === "mid_low");

 // Regroupe quand les deux sont bas (ça évite une liste de micro-infos)
 if(socialNeg && happyNeg){
 const phrases = [
 "n'est pas très heureux et reste plutôt bas en score social",
 "moral fragile, avec un score social en dessous de la moyenne",
 "moral bas et score social faible",
 "bonheur limité, et score social plutôt bas"
 ];
 const hn = safeNum(eff("happiness"));
 const hr = (hn != null) ? clamp(1 - (hn/5), 0, 1) : 0.5;
 const metric = Math.max(hr, 0.55);
 items.push({ key:"psychoSocialLow", tone:"bad", importance:0.78 * metricImportance(metric), phrases: uniqueSlice(phrases, 18) });
 }else{
 if(hasSocial){
 const t = SOCIAL_PHRASES[sb];
 const metric = (risks?.social ?? 0.50);
 items.push({ key:"socialScore", tone:t.tone, importance:(t.base || 0.25) * metricImportance(metric), phrases: uniqueSlice([...(t.phrases||[])], 18) });
 }
 if(hasHappy){
 const t = HAPPINESS_PHRASES[hb];
 const hn = safeNum(eff("happiness"));
 const hr = (hn != null) ? clamp(1 - (hn/5), 0, 1) : 0.5;
 items.push({ key:"happiness", tone:t.tone, importance:(t.base || 0.25) * metricImportance(hr), phrases: uniqueSlice([...(t.phrases||[])], 18) });
 }
 }
 }

 // Identité / contexte
 addMap("sex", String(eff("sex") || "").trim(), SEX_PHRASES, 0.35);
 addMap("confession", String(eff("confession") || "").trim(), CONFESSION_PHRASES, 0.25);

 // Oui/Non (opération / criminalité / transhumanisme)
 {
 const raw = String(eff("operation") || "").trim();
 if(isFilledValue(raw)){
 const key = raw.toLowerCase().includes("oui") ? "Oui" : (raw.toLowerCase().includes("non") ? "Non" : raw);
 opKeyForMerge = key;
 }
 }

{
 const raw = String(eff("criminal") || "").trim();
 if(isFilledValue(raw)){
 const key = raw.toLowerCase().includes("oui") ? "Oui" : (raw.toLowerCase().includes("non") ? "Non" : raw);
 addMap("criminal", key, CRIMINAL_PHRASES, risks?.danger ?? 0.55);
 }
 }
 {
 const raw = String(eff("transhuman") || "").trim();
 if(isFilledValue(raw)){
 const key = raw.toLowerCase().includes("oui") ? "Oui" : (raw.toLowerCase().includes("non") ? "Non" : raw);
 addMap("transhuman", key, TRANSHUMAN_PHRASES, risks?.cyber ?? 0.50);
 }
 }

 // Problèmes de santé (catégorie unique)
 {
 const hpRaw = String(eff("healthProblems") || "").trim();
 if(isFilledValue(hpRaw)){
 const key = normalizeHealthProblemsKey(hpRaw);
 if(key === "NON"){
 hpKeyForMerge = "NON";
 }else if(key && key !== "N/A" && key !== "__default"){
 const phr = ({
 "Cancer": [
 "a un antécédent de cancer",
 "présente une fragilité oncologique",
 "a un historique médical lourd (cancer)",
 "mentionne un suivi oncologique",
 "a un passé oncologique déclaré"
 ],
 "Immunodépressive": [
 "a un terrain immunodéprimé",
 "présente une fragilité immunitaire",
 "a un risque infectieux augmenté",
 "mentionne une immunodépression",
 "a une immunité affaiblie dans le dossier"
 ],
 "Greffe": [
 "a un antécédent de greffe",
 "est sous un contexte post-greffe",
 "a un terrain à surveillance rapprochée (greffe)",
 "présente un risque infectieux post-greffe",
 "mentionne une greffe dans l'historique"
 ],
 "Maladie Sexuel": [
 "mentionne une pathologie sexuelle",
 "a un contexte compatible avec IST",
 "présente un risque infectieux urogénital",
 "signale des problèmes de santé sexuelle",
 "a un point santé sexuelle à surveiller"
 ],
 "Maladie genetique non transmissible": [
 "a un terrain génétique particulier",
 "mentionne une maladie génétique non transmissible",
 "présente une fragilité constitutionnelle",
 "a un historique de maladie rare/génétique",
 "a un facteur génétique isolé dans le dossier"
 ],
 "Maladie genetique héréditaire": [
 "a un terrain génétique héréditaire",
 "présente des antécédents familiaux marqués",
 "mentionne une maladie héréditaire",
 "a une fragilité constitutionnelle familiale",
 "a un contexte familial génétique important"
 ],
 "Handicap moteur": [
 "présente un handicap moteur",
 "a une limitation fonctionnelle",
 "a un risque lié à la sédentarité",
 "a un contexte de mobilité réduite",
 "a des contraintes motrices déclarées"
 ],
 "Handicap mental": [
 "présente un handicap mental",
 "a un contexte neuro-psy important",
 "a une fragilité psychique",
 "a un terrain de troubles mentaux déclarés",
 "a des difficultés cognitives/psychiques signalées"
 ],
 "Signe de vieillesse (Ostéo / Cataracte ...)": [
 "présente des signes de vieillissement",
 "a des troubles liés à l'âge (ostéo/cataracte…)",
 "a un terrain gériatrique débutant",
 "mentionne des atteintes dégénératives",
 "a des signes ostéo/visuels liés à l'âge"
 ],
 "Autre": [
 "signale déjà des problèmes de santé",
 "a un historique médical non négligeable",
 "mentionne des soucis de santé existants",
 "présente déjà des problèmes médicaux déclarés",
 "a un point médical “autre” noté dans le dossier"
 ]
 })[key] || [
 "signale déjà des problèmes de santé",
 "a un historique médical non négligeable",
 "mentionne des soucis de santé existants",
 "présente déjà des problèmes médicaux déclarés"
 ];

 items.push({ key:"healthProblems", tone:"bad", importance:0.95, phrases: phr });
 }
 }
 }

 // Fusion santé (dossier calme) + opération (oui/non) pour un résumé plus lisible
 if(opKeyForMerge){
 if(hpKeyForMerge === "NON" && opKeyForMerge === "Non"){
 const phrases = [
 "a un dossier médical plutôt calme et pas d'opération déclarée",
 "profil médical plutôt serein, sans chirurgie indiquée",
 "ne rapporte pas de souci de santé majeur, ni d'opération passée",
 "dossier médical calme, sans antécédent opératoire"
 ];
 const metric = Math.max(0.50, risks?.sante ?? 0.50);
 items.push({ key:"healthNoOp", tone:"good", importance:0.62 * metricImportance(metric), phrases: uniqueSlice(phrases, 18) });
 }else{
 if(hpKeyForMerge === "NON"){
 items.push({ key:"healthProblems", tone:"good", importance:0.55, phrases:[
 "ne signale aucun problème de santé connu",
 "a un dossier médical plutôt calme",
 "n'a pas d'antécédent majeur déclaré",
 "présente un profil sans comorbidité signalée",
 "n'a pas de pathologie notable renseignée"
 ] });
 }
 addMap("operation", opKeyForMerge, OPERATION_PHRASES, 0.40);
 }
 }else{
 if(hpKeyForMerge === "NON"){
 items.push({ key:"healthProblems", tone:"good", importance:0.55, phrases:[
 "ne signale aucun problème de santé connu",
 "a un dossier médical plutôt calme",
 "n'a pas d'antécédent majeur déclaré",
 "présente un profil sans comorbidité signalée",
 "n'a pas de pathologie notable renseignée"
 ] });
 }
 }
 hpKeyForMerge = null;
 opKeyForMerge = null;



 return items;
}



// --- Dossier-info : génération de phrases variées (toutes catégories / choix) ---
function toneFromKlass(klass){
 const k = String(klass || "").toLowerCase();
 if(k === "bad") return "bad";
 if(k === "good") return "good";
 return "neutral";
}

function getChoiceKlass(field, value){
 const qb = QUESTION_BANK?.[field];
 const choices = Array.isArray(qb?.choices) ? qb.choices : null;
 if(!choices) return null;
 const v = String(value ?? "");
 const found = choices.find(c => String(c?.value ?? "") === v);
 return found?.klass || null;
}

function autoCategoryPhrases(field, value){
 const label = FIELD_LABELS?.[field] || field;
 const v = String(value ?? "").trim();
 if(!v) return [];
 // micro-variations très courtes (pour s'assembler facilement)
 const base = [
 `${label.toLowerCase()} : ${v}`,
 `côté ${label.toLowerCase()}, ${v}`,
 `au niveau ${label.toLowerCase()}, ${v}`,
 `dossier: ${label.toLowerCase()} = ${v}`,
 `a renseigné ${label.toLowerCase()} : ${v}`,
 `le dossier indique ${label.toLowerCase()} : ${v}`,
 `sur ${label.toLowerCase()}, c'est ${v}`,
 `pour ${label.toLowerCase()}, il est sur “${v}”`,
 ];

 // Ajustements contextuels par catégorie (si besoin)
 if(field === "alcoholFreq"){
 base.push(`consommation d'alcool: ${v}`);
 base.push(`côté alcool, ${v}`);
 }
 if(field === "drugs"){
 base.push(`côté substances, ${v}`);
 }
 if(field === "sport"){
 base.push(`activité physique: ${v}`);
 }
 if(field === "cigarette"){
 base.push(`nicotine: ${v}`);
 }
 if(field === "happiness"){
 base.push(`humeur notée ${v}/5`);
 base.push(`bonheur estimé à ${v} sur 5`);
 }
 return uniqueSlice(base, 18);
}

function chooseTopHighlights(items, n){
 const list = (items || []).slice();
 // tri principal
 list.sort((a,b) => (b.importance||0) - (a.importance||0));
 // petite randomisation sur les ex-aequo pour varier
 for(let i=0;i<list.length-1;i++){
 if(Math.abs((list[i].importance||0) - (list[i+1].importance||0)) < 0.05 && Math.random() < 0.35){
 const tmp = list[i]; list[i]=list[i+1]; list[i+1]=tmp;
 }
 }
 return list.slice(0, Math.max(1, n||1));
}

function composeHighlightText(highlights){
 const hs = (highlights || []).filter(Boolean);
 if(!hs.length) return "";

 const lead = randPick([
 "D'après le dossier,",
 "Sur ce que j'ai ici,",
 "Au vu des infos du dossier,",
 "D'après les éléments saisis,"
 ]);

 // pick one phrase per highlight (on garde le ton pour gérer les contradictions)
 const picked = hs
 .map(h => ({ key: h.key || "", tone: h.tone || "neutral", text: randPick(h.phrases || []) }))
 .filter(x => x.text);

 if(!picked.length) return "";

 const joinFR = (arr) => {
 const a = (arr || []).filter(Boolean);
 if(!a.length) return "";
 if(a.length === 1) return a[0];
 if(a.length === 2) return `${a[0]} et ${a[1]}`;
 return `${a.slice(0, -1).join(", ")} et ${a[a.length - 1]}`;
 };

 // On regroupe par tonalité pour éviter "en revanche / cependant / on note aussi" en cascade
 const goods = picked.filter(p => p.tone === "good").map(p => p.text);
 const bads = picked.filter(p => p.tone === "bad").map(p => p.text);
 const neutrals = picked.filter(p => p.tone !== "good" && p.tone !== "bad").map(p => p.text);

 let main = "";
 if(goods.length){
 main = joinFR(goods);
 if(bads.length){
 main += " mais " + joinFR(bads);
 }
 }else if(bads.length){
 main = joinFR(bads);
 }else{
 main = joinFR(neutrals);
 }

 if(!main) main = joinFR(neutrals) || joinFR(goods) || joinFR(bads) || "";

 let out = ensurePeriod(`${lead} ${main}`);

 // On met le neutre en deuxième phrase (si on a déjà du "contenu fort")
 if(neutrals.length && (goods.length || bads.length)){
 const starter2 = randPick(["Par ailleurs,", "En complément,", "À noter aussi,", "Côté profil,"]);
 out += " " + ensurePeriod(`${starter2} ${joinFR(neutrals)}`);
 }

 return out;
}


function summarizePatient(patient, extra, risks){
 const r = risks || computeRisks(patient, extra);
 const items = buildNarrativeItems(patient, extra, r);

 // Compte uniquement les champs réellement remplis (N/A = vide)
 let filled = 0;
 for(const f of EXTRA_FIELDS){
 const v = getEffectiveFieldValue(patient, extra, f) ?? extra?.[f];
 if(isFilledValue(v)) filled++;
 }
 const total = EXTRA_FIELDS.length || 1;
 const ratio = filled / total;

 // Dossier vide
 if(filled <= 0 || !items.length){
 return { text: randPick(DOSSIERINFO_NO_DATA), highlights: [] };
 }

 // 1) phrase principale (4–5 points)
 const top = chooseTopHighlights(items, Math.min(5, items.length));
 let text = composeHighlightText(top);

 // 2) phrase “complément” pour faire apparaître plus de catégories (si possible)
 {
 const used = new Set(top.map(x => x.key));
 const rest = items.filter(it => !used.has(it.key));

 if(rest.length && Math.random() < 0.92){
 const prefer = new Set(["sex","confession","operation","transhuman","criminal"]);
 const ranked = rest.slice().sort((a,b) => {
 const wa = (prefer.has(a.key) ? 1.0 : 0.0) + (a.importance || 0);
 const wb = (prefer.has(b.key) ? 1.0 : 0.0) + (b.importance || 0);
 return wb - wa;
 });

 const extraPick = ranked.slice(0, 3).map(it => ({ tone: it.tone, text: randPick(it.phrases || []) })).filter(x => x.text);

 if(extraPick.length){
 const starters = [
 "À côté de ça,",
 "En complément,",
 "Côté dossier,",
 "On note aussi :",
 "Dans le reste du profil,",
 "En toile de fond,"
 ];
 const starter = randPick(starters);
 let s2 = starter + " " + extraPick[0].text;
 for(let i=1;i<extraPick.length;i++){
 const prev = extraPick[i-1];
 const cur = extraPick[i];
 const conn = connectorBetween(prev.tone, cur.tone);
 s2 += conn + " " + cur.text;
 }
 s2 = ensurePeriod(s2);
 text = ensurePeriod(text) + " " + s2;
 }
 }
 }

 // 3) cas “très peu d'infos”
 if(ratio <= 0.25 || filled <= 2){
 text = ensurePeriod(text) + " " + randPick(DOSSIERINFO_LOW_DATA_TAIL);
 }

 return { text: text.trim(), highlights: top };
}

function joinNatural(parts){
 const clean = (parts || []).filter(Boolean);
 if(clean.length <= 1) return clean[0] || "";
 if(clean.length === 2) return `${clean[0]} et ${clean[1]}`;
 return clean.slice(0,-1).join(", ") + " et " + clean[clean.length-1];
}

// Flow state
let pending = null; // { patientId, patientName, mode, stepsLeft, fieldsQueue }
let pendingVisual = null; // { patientId, patientName, after: { type: "new"|"existing", missingFields?:[], displayName?:string } }
let currentPatientId = null;
let lastUnknownName = "";
let pendingIntervention = null; // { patientId } => le prochain message devient une intervention

// --- Question obligatoire : Analyse de donnée visuel (photo de profil) ---
async function askVisualDataQuestion(patientId, patientName, after){
 pendingVisual = { patientId, patientName, after: after || { type: "existing", missingFields: [] } };

 const bubble = await aiSay(
 `🧾 Données manquantes: ${underline("Analyse de donnée visuel")} = N/A.\n` +
 `Question: Ajoutez la photo de profil du patient.`
 );

 let menuEl = null;
 const clearMenu = () => {
 if(menuEl && menuEl.parentNode) menuEl.parentNode.removeChild(menuEl);
 menuEl = null;
 };

 const finishNA = async () => {
 clearMenu();
 addMessage("user", "N/A");
 savePatientMeta(patientId, PROFILE_PHOTO_KEY, "N/A");
 await resumeAfterVisual();
 };

 const openCropMenu = (dataUrl) => {
 clearMenu();
 menuEl = document.createElement("div");
 menuEl.className = "mini-menu crop-menu";

 // UI crop (ratio 300x500)
 const ASPECT = 300 / 500; // width / height
 const TARGET_W = 300;
 const TARGET_H = 500;

 const stage = document.createElement("div");
 stage.className = "cropper-stage";

 const preview = document.createElement("img");
 preview.className = "cropper-img";
 preview.alt = "Aperçu photo";
 preview.src = String(dataUrl || "");

 const rect = document.createElement("div");
 rect.className = "cropper-rect";
 const handle = document.createElement("div");
 handle.className = "cropper-handle br";
 rect.appendChild(handle);

 stage.appendChild(preview);
 stage.appendChild(rect);

 const hint = document.createElement("div");
 hint.className = "mini-menu-text";
 hint.textContent = "Recadrez la photo : cadre vertical 300×500. Vous pouvez le déplacer et le redimensionner.";

 // Option: fixer la luminosité (+300%)
 let fixBrightness = false;
 const brightRow = document.createElement("label");
 brightRow.className = "crop-option";
 const brightCb = document.createElement("input");
 brightCb.type = "checkbox";
 brightCb.className = "crop-option-checkbox";
 const brightTxt = document.createElement("span");
 brightTxt.textContent = "Fix la luminosité (+300%)";
 brightRow.appendChild(brightCb);
 brightRow.appendChild(brightTxt);
 brightCb.addEventListener("change", () => {
  fixBrightness = !!brightCb.checked;
  // Prévisualisation
  preview.style.filter = fixBrightness ? "brightness(5)" : "";
 });

 const actions = document.createElement("div");
 actions.className = "buttons";

 const btn = document.createElement("button");
 btn.className = "choice good";
 btn.textContent = "Valider";

 actions.appendChild(btn);

 menuEl.appendChild(stage);
 menuEl.appendChild(hint);
 menuEl.appendChild(brightRow);
 menuEl.appendChild(actions);
 bubble.appendChild(menuEl);
 chatEl.scrollTop = chatEl.scrollHeight;

 // --- Crop logic ---
 const crop = { x: 0, y: 0, w: 0, h: 0 };
 const minH = 90;

 const stageSize = () => ({ w: stage.clientWidth || 1, h: stage.clientHeight || 1 });

 const applyRect = () => {
 rect.style.left = crop.x + "px";
 rect.style.top = crop.y + "px";
 rect.style.width = crop.w + "px";
 rect.style.height = crop.h + "px";
 };

 const clampRect = () => {
 const { w: W, h: H } = stageSize();
 crop.h = clamp(crop.h, minH, H);
 crop.w = crop.h * ASPECT;
 if(crop.w > W){
 crop.w = W;
 crop.h = crop.w / ASPECT;
 }
 crop.x = clamp(crop.x, 0, Math.max(0, W - crop.w));
 crop.y = clamp(crop.y, 0, Math.max(0, H - crop.h));
 };

 const initRect = () => {
 const { w: W, h: H } = stageSize();
 // Taille initiale (≈80% de la hauteur, en restant dans l'image)
 let h0 = Math.min(H * 0.80, (W / ASPECT) * 0.80);
 h0 = Math.max(minH, h0);
 const w0 = h0 * ASPECT;
 crop.w = w0;
 crop.h = h0;
 crop.x = (W - w0) / 2;
 crop.y = (H - h0) / 2;
 clampRect();
 applyRect();
 };

 const afterImageReady = () => {
 // Attendre le layout (pour que stage.clientHeight soit OK)
 requestAnimationFrame(() => requestAnimationFrame(initRect));
 };

 if(preview.complete) afterImageReady();
 else preview.addEventListener("load", afterImageReady, { once: true });

 let dragging = null; // {mode, sx, sy, x, y, w, h}

 const toLocal = (clientX, clientY) => {
 const r = stage.getBoundingClientRect();
 return { x: clientX - r.left, y: clientY - r.top, W: r.width || 1, H: r.height || 1 };
 };

 const onDown = (e, mode) => {
 e.preventDefault();
 e.stopPropagation();
 const p = toLocal(e.clientX, e.clientY);
 dragging = { mode, sx: p.x, sy: p.y, x: crop.x, y: crop.y, w: crop.w, h: crop.h };
 window.addEventListener("pointermove", onMove);
 window.addEventListener("pointerup", onUp, { once: true });
 };

 const onMove = (e) => {
 if(!dragging) return;
 const p = toLocal(e.clientX, e.clientY);
 const dx = p.x - dragging.sx;
 const dy = p.y - dragging.sy;

 if(dragging.mode === "move"){
 crop.x = dragging.x + dx;
 crop.y = dragging.y + dy;
 clampRect();
 applyRect();
 return;
 }

 // resize from bottom-right, top-left stays fixed
 const { w: W, h: H } = stageSize();
 const x0 = dragging.x;
 const y0 = dragging.y;

 // scale based on the biggest delta (dx affects width, dy affects height)
 const dhFromDx = dx / ASPECT;
 // prend le delta dominant (marche aussi pour rétrécir)
 const dh = (Math.abs(dy) >= Math.abs(dhFromDx)) ? dy : dhFromDx;
 let newH = dragging.h + dh;
 newH = Math.max(minH, newH);

 // max allowed so it stays inside stage
 const maxH = Math.min(H - y0, (W - x0) / ASPECT);
 newH = Math.min(newH, maxH);

 crop.x = x0;
 crop.y = y0;
 crop.h = newH;
 crop.w = newH * ASPECT;
 clampRect();
 applyRect();
 };

 const onUp = () => {
 dragging = null;
 window.removeEventListener("pointermove", onMove);
 };

 rect.addEventListener("pointerdown", (e) => {
 if(e.target === handle) return;
 onDown(e, "move");
 });
 handle.addEventListener("pointerdown", (e) => onDown(e, "resize"));

 async function makeCroppedDataUrl(){
 // Mapping correct: la prévisualisation utilise un object-fit (contain). On convertit donc le rectangle
 // (coords stage) vers les coords réelles de l'image (naturalWidth/naturalHeight).
 const img = new Image();
 img.src = String(dataUrl || "");
 await new Promise((resolve, reject) => {
  img.onload = resolve;
  img.onerror = reject;
 });

 const stageW = stage.clientWidth || 1;
 const stageH = stage.clientHeight || 1;
 const natW = img.naturalWidth || 1;
 const natH = img.naturalHeight || 1;

 const imgAspect = natW / natH;
 const stageAspect = stageW / stageH;

 let dispW, dispH, offX, offY;
 if(imgAspect > stageAspect){
  // image plus "large": on fit la largeur
  dispW = stageW;
  dispH = stageW / imgAspect;
  offX = 0;
  offY = (stageH - dispH) / 2;
 }else{
  // image plus "haute": on fit la hauteur
  dispH = stageH;
  dispW = stageH * imgAspect;
  offX = (stageW - dispW) / 2;
  offY = 0;
 }

 // Rectangle (stage) -> intersection avec l'image affichée (dispW/dispH + offsets)
 const x1 = clamp(crop.x - offX, 0, dispW);
 const y1 = clamp(crop.y - offY, 0, dispH);
 const x2 = clamp(crop.x + crop.w - offX, 0, dispW);
 const y2 = clamp(crop.y + crop.h - offY, 0, dispH);

 const iW = Math.max(1, x2 - x1);
 const iH = Math.max(1, y2 - y1);

 const sx = (x1 / dispW) * natW;
 const sy = (y1 / dispH) * natH;
 const sw = (iW / dispW) * natW;
 const sh = (iH / dispH) * natH;

 // Output: max 500px de large, proportions conservées
 const outW = Math.max(1, Math.min(500, Math.round(sw)));
 const outH = Math.max(1, Math.round(sh * outW / sw));

 const canvas = document.createElement("canvas");
 canvas.width = outW;
 canvas.height = outH;
 const ctx = canvas.getContext("2d");
 // fond blanc (évite fond noir si source a de la transparence)
 ctx.fillStyle = "#fff";
 ctx.fillRect(0, 0, outW, outH);
 ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

 // Luminosité x3 (300%) si l'option est cochée
 if(fixBrightness){
  try{
   const imageData = ctx.getImageData(0, 0, outW, outH);
   const d = imageData.data;
   for(let i = 0; i < d.length; i += 4){
    d[i] = Math.min(255, d[i] * 5);
    d[i + 1] = Math.min(255, d[i + 1] * 5);
    d[i + 2] = Math.min(255, d[i + 2] * 5);
    // alpha (d[i+3]) inchangé
   }
   ctx.putImageData(imageData, 0, 0);
  }catch(_){
   // Fallback: si getImageData est bloqué (CORS), on ne casse pas l'upload.
  }
 }

 // JPEG léger
 return canvas.toDataURL("image/jpeg", 0.88);
}

btn.addEventListener("click", async () => {
 btn.disabled = true;
 try{
 const cropped = await makeCroppedDataUrl();
 const resp = await uploadProfilePhoto(patientId, cropped);
 const filename = resp?.filename ? String(resp.filename) : "";
 if(!filename) throw new Error("upload_failed");
 addMessage("user", "📷 Photo enregistrée");
 savePatientMeta(patientId, PROFILE_PHOTO_KEY, filename);
 clearMenu();
 await resumeAfterVisual();
 }catch(err){
 console.warn(err);
 btn.disabled = false;
 await aiSay("❌ Impossible d'enregistrer la photo recadrée. Réessayez (png/jpg/webp). ");
 }
 });
 };

 const openUploadMenu = () => {
 clearMenu();
 menuEl = document.createElement("div");
 menuEl.className = "mini-menu";

 const msg = document.createElement("div");
 msg.className = "mini-menu-text";
 msg.textContent = "Demandez au patient de se placer à droite de la vision du médecin.\n" +
 "Puis prenez un screen (outil externe).";
 menuEl.appendChild(msg);

 // zone de collage (Ctrl+V)
 const pasteZone = document.createElement("div");
 pasteZone.className = "paste-zone";
 pasteZone.tabIndex = 0;
 pasteZone.textContent = "Collez une image ici (Ctrl+V)";
 pasteZone.addEventListener("paste", (e) => {
 try{
 const items = e.clipboardData?.items || [];
 for(const it of items){
 if(it && it.type && it.type.startsWith("image/")){
 const file = it.getAsFile();
 if(!file) continue;
 const reader = new FileReader();
 reader.onload = () => {
 const dataUrl = String(reader.result || "");
 if(dataUrl.startsWith("data:image/")) openCropMenu(dataUrl);
 };
 reader.readAsDataURL(file);
 e.preventDefault();
 return;
 }
 }
 }catch(_){/* ignore */}
 });

 const buttons = document.createElement("div");
 buttons.className = "buttons";

 const btnPaste = document.createElement("button");
 btnPaste.className = "choice";
 btnPaste.textContent = "Coller la photo";
 btnPaste.addEventListener("click", () => {
 pasteZone.textContent = "Collez maintenant (Ctrl+V)";
 setTimeout(() => pasteZone.focus(), 20);
 });

 const btnUpload = document.createElement("button");
 btnUpload.className = "choice good";
 btnUpload.textContent = "Upload depuis l'ordinateur";
 const fileInput = document.createElement("input");
 fileInput.type = "file";
 fileInput.accept = "image/*";
 fileInput.style.display = "none";
 fileInput.addEventListener("change", () => {
 const file = fileInput.files?.[0];
 if(!file) return;
 const reader = new FileReader();
 reader.onload = () => {
 const dataUrl = String(reader.result || "");
 if(dataUrl.startsWith("data:image/")) openCropMenu(dataUrl);
 };
 reader.readAsDataURL(file);
 fileInput.value = "";
 });
 btnUpload.addEventListener("click", () => fileInput.click());

 const btnCancel = document.createElement("button");
 btnCancel.className = "choice bad";
 btnCancel.textContent = "Annuler";
 btnCancel.addEventListener("click", () => finishNA());

 buttons.appendChild(btnPaste);
 buttons.appendChild(btnUpload);
 buttons.appendChild(btnCancel);

 menuEl.appendChild(pasteZone);
 menuEl.appendChild(fileInput);
 menuEl.appendChild(buttons);

 bubble.appendChild(menuEl);
 chatEl.scrollTop = chatEl.scrollHeight;
 };

 addButtons(bubble, [
 { label: "Upload le fichier", klass: "good", onClick: openUploadMenu },
 { label: "N/A", onClick: finishNA }
 ]);
}

async function resumeAfterVisual(){
 const ctx = pendingVisual;
 pendingVisual = null;
 if(!ctx) return;

 try{ if(typeof ctx.after?.onDone === "function") ctx.after.onDone(); }catch(_){/* ignore */}
 if(ctx.after?.type === "noop"){
  return;
 }

 const pid = ctx.patientId;

 // Priorité après la photo: si le téléphone est encore le placeholder, on le demande avant toute autre question.
 if(needsPhoneQuestion(pid)){
  await askPhoneQuestion(pid, ctx.patientName, ctx.after);
  return;
 }

 await continueAfterPriorities(pid, ctx.patientName, ctx.after);
}

async function continueAfterPriorities(patientId, patientName, after){
 if(after?.type === "noop") return;

 // Création: on continue la file de questions
 if(after?.type === "new"){
  if(pending && pending.patientId === patientId && pending.stepsLeft > 0){
   await askFieldQuestion(pending.fieldsQueue[0], patientName);
   return;
  }
  // fallback
  await runDiagnosis(patientId, patientName);
  return;
 }

 // Patient existant
 const missingFields = Array.isArray(after?.missingFields) ? after.missingFields : [];
 if(missingFields.length > 0){
  const queue = shuffleInPlace(missingFields.slice());
  pending = {
   patientId: patientId,
   patientName: patientName,
   mode: "existing",
   stepsLeft: Math.min(1, missingFields.length),
   fieldsQueue: queue
  };
  await askFieldQuestion(queue[0], patientName);
  return;
 }

 // Rien de manquant => diagnostic
 const p = getPatientById(patientId) || { id: patientId, name: patientName, answers:{}, derived:{} };
 const exNow = loadExtra()?.[patientId] || {};
 const nm = (exNow.displayName && String(exNow.displayName).trim()) ? String(exNow.displayName).trim() : (p.name || patientId);
 await runDiagnosis(patientId, nm);
}

async function askFieldQuestion(field, patientName){
 const q = QUESTION_BANK[field] || {};
 const type = q.type || "select";
 const bubble = await aiSay(`🧾 Données manquantes: ${FIELD_LABELS[field]} = N/A.\nQuestion: ${q.question}`);

 // Champs à saisie (date / number / text)
 if(type !== "select"){
 const inputWrap = document.createElement("div");
 inputWrap.className = "field-input-wrap";

 let el;
 if(type === "date"){
 el = document.createElement("input");
 el.type = "date";
 }else if(type === "number"){
 el = document.createElement("input");
 el.type = "number";
 el.step = "1";
 }else{
 el = document.createElement("textarea");
 el.rows = 2;
 }
 el.className = "field-input";
 if(q.placeholder) el.placeholder = q.placeholder;
 inputWrap.appendChild(el);
 bubble.appendChild(inputWrap);

 addButtons(bubble, [
 { label: "Valider", klass: "good", onClick: () => answerQuestion(field, (el.value || "").trim()) },
 { label: "N/A (plus tard)", onClick: () => answerQuestion(field, "") }
 ]);
 return;
 }

 // Champs à choix
 const btns = (q.choices || []).map(ch => ({
 label: ch.label,
 klass: ch.klass,
 onClick: () => answerQuestion(field, ch.value)
 }));
 btns.push({ label: "N/A (plus tard)", onClick: () => answerQuestion(field, "") });
 addButtons(bubble, btns);
}

function saveField(patientId, field, value){
 const extra = loadExtra();
 extra[patientId] = extra[patientId] || {};
 extra[patientId][field] = value;
 saveExtra(extra);
 }

async function answerQuestion(field, value){
 if(!pending) return;

 // user bubble showing choice
 addMessage("user", (value && String(value).trim() !== "") ? value : "N/A");

 // save
 saveField(pending.patientId, field, value);

 // update queue
 pending.fieldsQueue = pending.fieldsQueue.filter(f => f !== field);
 pending.stepsLeft = Math.max(0, pending.stepsLeft - 1);

 // Continue
 if(pending.stepsLeft > 0){
 // Choix aléatoire parmi les champs encore N/A (évite toujours le même ordre)
 const nextField = pending.fieldsQueue.length
 ? pending.fieldsQueue[Math.floor(Math.random()*pending.fieldsQueue.length)]
 : null;
 if(nextField) await askFieldQuestion(nextField, pending.patientName);
 return;
 }

 await runDiagnosis(pending.patientId, pending.patientName);
 pending = null;
}

async function runDiagnosis(patientId, displayName){
 const patient = getPatientById(patientId) || { id: patientId, name: displayName, answers:{}, derived:{} };
 currentPatientId = patientId;
 chatEl.scrollTop = chatEl.scrollHeight;

 const extraAll = loadExtra();
 const extra = { ...(extraAll[patientId] || {}) };

 // Fill missing with null explicitly (for N/A display)
 for(const f of EXTRA_FIELDS){ if(extra[f] == null) extra[f] = null; }

 const ageNum = computePatientAge(patient, extra);
 currentPatientPill.textContent = displayNameWithAge(displayName, ageNum);

 const risks = computeRisks(patient, extra);
 const focusFields = pickFocusFields(patient, extra);
 const risksForDiag = applyFocusMask(risks, focusFields, patient, extra);

 const completeness = computeCompletenessForPatient(patient, extra);
 // Pénalité d'incertitude: plus le dossier est vide, plus on baisse les % (on évite les faux "gros" diagnostics)
 const uncertaintyPenalty = (1 - completeness) * 1.15;
 risks.__completeness = completeness;
 risksForDiag.__completeness = completeness;
 const healthScore = computeHealthScore(risks);
 const healthyChance = clamp(Math.round(healthScore - 5 + (hash32(patientId)%11)), 0, 95);

 const summary = summarizePatient(patient, extra, risks);

 await aiSay(pickThinkingPhrase());
 await delay(500 + Math.floor(Math.random()*250));

 // score diseases
 // Corpus interventions: accepte objets {ts,text,...} et anciennes entrées string
 const interventions = getInterventions(patientId)
 .map(x => (typeof x === "string" ? x : String(x?.text ?? "")))
 .filter(Boolean);
 // On injecte aussi certains champs libres du dossier dans le corpus de mots-clés
 const hp = String((getEffectiveFieldValue(patient, extra, "healthProblems") ?? extra?.healthProblems ?? "")).trim();
 if(hp) interventions.push(hp);
 const op = String((getEffectiveFieldValue(patient, extra, "operation") ?? extra?.operation ?? "")).trim();
 if(op) interventions.push(`operation:${op}`);

 const scored = window.DISEASES.map(d => {
 const baseS = scoreDisease(d, risksForDiag, patientId, healthScore);
 const kwBoost = interventionBoost(d, interventions);
 const sexBoost = sexAffinityBoost(d, getEffectiveFieldValue(patient, extra, "sex") ?? extra?.sex);
 const sRaw = baseS + kwBoost + sexBoost;
 const s = sRaw - uncertaintyPenalty;
 const p = clamp(Math.round(sigmoid(s*1.25)*100), 0, 96);
 return { d, s, p, sRaw };
 });

 // Maladies liées aux statuts (plus présentes si le dossier est incomplet)
 const linked = generateLinkedCandidates(patient, extra).map(x => {
 const kwBoost = interventionBoost(x.d, interventions) * 0.35;
 // Les maladies "dossier" dépendent déjà du manque d'infos: on pénalise un peu moins.
 const sRaw = (x.s || -3.2) + kwBoost;
 const s = sRaw - (uncertaintyPenalty * 0.55);
 const p = clamp(Math.round(sigmoid(s*1.25)*100), 0, 88);
 return { d: x.d, s, p, sRaw };
 });

 const merged = [...scored, ...linked];

 const top = pickTop3(merged, risksForDiag, completeness);

 const lines = [];
 lines.push(`Le patient "${titleCase(displayName)}" ${summary.text}`);
 lines.push(`Probabilité d'être globalement en bonne santé: ${healthyChance}%`);
 lines.push("");
 if(focusFields && focusFields.length){
 const labels = focusFields.map(f => FIELD_LABELS[f] || f).join(" + ");
 lines.push(`Focus du calcul (déviances): ${labels}`);
 lines.push("");
 }

 const seps = ["──────────────","──────────────","──────────────"];
 top.forEach((item, idx) => {
 const reason = bestReasonForDisease(item.d, risksForDiag, extra, patient, 2);
 const reasonTxt = reason ? ` (${reason})` : "";
 lines.push(`${item.p}% de chance d'avoir ${item.d.name}${reasonTxt}`);
 lines.push(`${item.d.symptoms}`);

 const rx = pickOnePrescription(item.d);
 lines.push(underline("Prescription :"));
 lines.push(`- ${rx}`);

 lines.push(seps[idx] || "──────────────");
 });

 // Message d'incertitude selon la quantité de données réellement disponibles
 const confidenceNote = (() => {
 const c = completeness;
 if(c < 0.20){
 return randPick([
 "⚠️ Dossier très incomplet : beaucoup de champs sont N/A. Les probabilités affichées restent très approximatives.",
 "⚠️ Il manque énormément d'informations (dossier presque vide). À ce stade, je ne peux pas être sûr de l'analyse.",
 "⚠️ Données insuffisantes : les % sont surtout indicatifs tant que le dossier n'est pas complété."
 ]);
 }
 if(c < 0.45){
 return randPick([
 "ℹ️ Dossier partiel : certaines infos clés manquent. Les probabilités sont à prendre avec prudence.",
 "ℹ️ Il manque encore plusieurs données importantes. L'analyse est plausible, mais pas certaine.",
 "ℹ️ Données incomplètes : les % peuvent changer sensiblement si vous complétez le dossier."
 ]);
 }
 if(c < 0.70){
 return randPick([
 "ℹ️ Dossier moyen : j'ai une base correcte, mais quelques informations manquent encore pour confirmer.",
 "ℹ️ Dossier assez rempli, mais pas complet : les probabilités restent à confirmer avec les champs manquants.",
 "ℹ️ Analyse relativement cohérente, cependant des données manquantes peuvent encore influencer le classement."
 ]);
 }
 return "";
 })();
 if(confidenceNote) lines.push(confidenceNote);

 // Add little extra if they answered the cathedral question as "Oui"
 const cathedral = (patient.answers?.cathedral || "").toLowerCase();
 if(cathedral.includes("oui")){
 lines.push("⚠️ Note : le patient mentionne la “maladie Cathédrale” (écho auditif). Surveillez les couloirs, les voûtes, et les réverbérations.");
 }

 const bubble = await aiSay(lines.join("\n"));
 // Actions rapides après analyse
 addButtons(bubble, [
 { label: "Créer une intervention", klass: "good", onClick: () => startInterventionCaptureFor(patientId) },
 { label: "Ouvrir le dossier patient", onClick: () => showDossier(patient) }
 ]);
}



function extractCreateName(text){
 let t = (text || "").trim();
 t = t.replace(/^\/cr(?:e|é)er\b/i, "").trim();
 if(!t) return "";
 const m = t.match(/^["“”']([^"“”']+)["“”']/) || t.match(/"([^"]+)"/) || t.match(/'([^']+)'/);
 return (m ? m[1] : t).trim();
}

async function startCreateFlow(nameRaw){
 const name = (nameRaw || "").trim();
 if(!name){
 await aiSay('Aucun nom fourni. Exemple : /créer "Kai Moreau"');
 return;
 }
 // Exige un nom complet (Prénom + Nom)
 if(!isLikelyFullName(name)){
 lastUnknownName = name;
 await requestFullNameForCreation(name);
 return;
 }

 // Si le dossier existe déjà, on le rouvre
 const key = normKey(name);
 const existing = allPatients().find(p => normKey(p.name) === key);
 if(existing){
 await aiSay(tpl(pick(BOT.CREATE_ALREADY_EXISTS, existing.id), {name: titleCase(existing.name)}));
 await handlePatientName(existing.name);
 return;
 }

 const p = ensureCustomPatient(name);
 const pid = p.id;
 currentPatientPill.textContent = titleCase(p.name);

 const extraAll = loadExtra();
 extraAll[pid] = extraAll[pid] || {};
 saveExtra(extraAll);

 pending = {
 patientId: pid,
 patientName: p.name,
 mode: "new",
 stepsLeft: Math.min(3, EXTRA_FIELDS.length),
 fieldsQueue: shuffleInPlace(EXTRA_FIELDS.slice())
 };

 await aiSay(tpl(pick(BOT.CREATE_START, pid), {name: titleCase(p.name)}));
 // Première question IMPÉRATIVE: photo de profil
 await askVisualDataQuestion(pid, p.name, { type: "new" });
}

async function runQuery(raw, {fromSidebar=false} = {}){
 const text = (raw || "").trim();
 if(!text) return;

 

 // Priorité téléphone: si une question téléphone est en attente, le prochain message (hors commande) devient le numéro.
 if(pendingPhone && !/^\//.test(text)){
  if(!fromSidebar) addMessage("user", text);
  const ctx = pendingPhone;
  pendingPhone = null;
  const v = String(text || "").trim();
  // Si vide => on supprime, donc placeholder = 555-0000 et la question restera prioritaire.
  savePatientMeta(ctx.patientId, "phone", v ? v : null);
  await resumeAfterPhone(ctx);
  return;
 }


 if(!fromSidebar) addMessage("user", text);

// Mode "intervention": le prochain message devient une intervention
 if(pendingIntervention && !/^\//.test(text)){
 const pid = pendingIntervention.patientId;
 pendingIntervention = null;
 addInterventionTo(pid, text);
 const p = getPatientById(pid) || { id: pid, name: currentPatientPill?.textContent || pid, answers:{}, derived:{} };
 const ex = loadExtra()?.[pid] || {};
 const nm = (ex.displayName && String(ex.displayName).trim()) ? String(ex.displayName).trim() : (p.name || pid);
 await aiSay(`🗒️ Intervention ajoutée au dossier de "${titleCase(nm)}".`);
 return;
 }

 // Questions de conseil / interventions
 if(await tryHandleInterventionAdvice(text)){
 return;
 }

 // Commandes dites "naturellement" (sans slash)
 if(await tryHandleNaturalCommand(text)){
 return;
 }

 // commands
 if(text === "/help"){
 await aiSay(BOT.CMD_HELP);
 return;
 }
 if(text === "/base"){
 await aiSay(BOT.CMD_BASE);
 return;
 }
 if(text === "/random"){
 const list = allPatients();
 const p = list[Math.floor(Math.random()*list.length)];
 await aiSay(`Sélection aléatoire: ${titleCase(p.name)}.`);
 await handlePatientName(p.name);
 return;
 }


if(/^\/dossier\b/i.test(text)){
 const nm = extractArgAfterCommand(text, /^\/dossier\b/i);
 await openDossierByQuery(nm);
 return;
}

if(/^\/intervention\b/i.test(text)){
 const arg = extractArgAfterCommand(text, /^\/intervention\b/i);

 // Sans argument => mode dictée (le prochain message devient l'intervention)
 if(!arg){
 await startInterventionCaptureFor(currentPatientId || pending?.patientId || pendingVisual?.patientId);
 return;
 }

 // Heuristique: si l'argument ressemble à un nom (2-4 mots) => on cible un patient puis on passe en dictée
 const tokens = normalize(arg).split(/\s+/).filter(Boolean);
 const looksLikeName = tokens.length >= 2 && tokens.length <= 4 &&
 tokens.every(t => /^[a-zà-ÿ'-]+$/i.test(t)) &&
 !/[0-9]/.test(arg);

 if(looksLikeName){
 await openInterventionByQuery(arg);
 return;
 }

 // Sinon: ajout direct au patient actif (ou celui des questions en cours)
 const pid = currentPatientId || pending?.patientId || pendingVisual?.patientId;
 if(!pid){
 await aiSay("Aucun patient actif. Ouvrez un dossier (/dossier) ou cherchez un patient d'abord.");
 return;
 }
 addInterventionTo(pid, arg);
 const p = getPatientById(pid) || { id: pid, name: currentPatientPill?.textContent || pid, answers:{}, derived:{} };
 const ex = loadExtra()?.[pid] || {};
 const nm = (ex.displayName && String(ex.displayName).trim()) ? String(ex.displayName).trim() : (p.name || pid);
 await aiSay(`🗒️ Intervention ajoutée au dossier de "${titleCase(nm)}".`);
 return;
}



if(/^\/cr(?:e|é)er\b/i.test(text)){
 const nm = extractCreateName(text) || lastUnknownName;
 await startCreateFlow(nm);
 return;
}


 await handlePatientName(text);
}

async function openPatientRecord(patient){
 const pid = patient.id;
 const disp = titleCase(((loadExtra()?.[pid]||{}).displayName) || patient.name);
 const extra = loadExtra()[pid] || {};
 const ageNum = computePatientAge(patient, extra);
 currentPatientPill.textContent = displayNameWithAge(disp, ageNum);

 await aiSay(tpl(pick(BOT.MATCH_FOUND, pid), {name: disp}));

 // extra already loaded above
 const missingFields = EXTRA_FIELDS.filter(f => {
 const v = getEffectiveFieldValue(patient, extra, f);
 return v == null || String(v).trim() === "";
 });

 // 1) Question IMPÉRATIVE si pas de photo de profil enregistrée
 if(needsProfilePhotoQuestion(pid)){
  await askVisualDataQuestion(pid, disp, { type: "existing", missingFields });
  return;
 }

 // 2) Question prioritaire si le téléphone est encore le placeholder (555-0000)
 if(needsPhoneQuestion(pid)){
  await askPhoneQuestion(pid, disp, { type: "existing", missingFields });
  return;
 }

 if(missingFields.length > 0){
 // ask only ONE missing field (per opening) before analysis
 const queue = shuffleInPlace(missingFields.slice());
 pending = {
 patientId: pid,
 patientName: patient.name,
 mode: "existing",
 stepsLeft: Math.min(1, missingFields.length),
 fieldsQueue: queue
 };
 await askFieldQuestion(queue[0], patient.name);
 return;
 }

 {
 const exNow = loadExtra()?.[pid] || {};
 const nm = (exNow.displayName && String(exNow.displayName).trim()) ? String(exNow.displayName).trim() : patient.name;
 await runDiagnosis(pid, nm);
}
}

async function handlePatientName(name){
 const rawName = (name || "").trim();
 if(!rawName){
 await aiSay("Donne-moi un nom (prénom + nom) pour ouvrir un dossier.");
 return;
 }

 const normName = normalize(rawName);
 const tokens = normName.split(/\s+/).filter(Boolean);

 // Nom incomplet (un seul mot) -> proposer les dossiers correspondants (prénom OU nom)
 if(tokens.length === 1){
 const token = tokens[0];
 const matches = findPartialNameMatches(token);
 if(matches.length > 0){
 currentPatientPill.textContent = "Aucun patient";
 const head = tpl(pick(BOT.INCOMPLETE_NAME_HEAD, token), {token: titleCase(rawName)});
 const tail = pick(BOT.INCOMPLETE_NAME_TAIL, token);
 const intro = pick(BOT.INCOMPLETE_SUGGEST, token);
 const shown = matches.slice(0, 10);
 const list = shown.map(p=>`• ${titleCase(p.name)}`).join("\n");
 const bubble = await aiSay(`${head}\n${tail}\n\n${intro}\n${list}`);
 addButtons(bubble, shown.map(p => ({
 label: titleCase(p.name),
 onClick: () => openPatientRecord(p)
 })));
 addCreateProfileButton(bubble, rawName);
 return;
 }

 // faute sur un seul mot : proposer les dossiers les plus proches quand même
 const cands = suggestCandidates(rawName, 6);
 if(cands.length){
 const head = pick(BOT.DID_YOU_MEAN_HEAD, rawName);
 const shown = cands.slice(0, 6);
 const list = shown.map(x=>`• ${titleCase(x.p.name)}`).join("\n");
 const bubble = await aiSay(`${head}\n${list}`);
 addButtons(bubble, shown.map(x => ({
 label: titleCase(x.p.name),
 onClick: () => openPatientRecord(x.p)
 })));
 addCreateProfileButton(bubble, rawName);
 return;
 }

 // Aucun patient : ne pas créer automatiquement
 lastUnknownName = rawName;
 currentPatientPill.textContent = "Aucun patient";
 await aiSay(tpl(BOT.MATCH_NOT_FOUND, {name: titleCase(rawName)}));
 return;
 }

 // Nom complet (ou plusieurs mots) : fuzzy match + ouverture auto si assez proche
 const cands = suggestCandidates(rawName, 8);
 if(cands.length){
 const best = cands[0];
 if(best.score >= 0.62){
 await openPatientRecord(best.p);
 return;
 }
 const head = pick(BOT.DID_YOU_MEAN_HEAD, rawName);
 const shown = cands.slice(0, 8);
 const list = shown.map(x=>`• ${titleCase(x.p.name)}`).join("\n");
 const bubble = await aiSay(`${head}\n${list}`);
 addButtons(bubble, shown.map(x => ({
 label: titleCase(x.p.name),
 onClick: () => openPatientRecord(x.p)
 })));
 addCreateProfileButton(bubble, rawName);
 return;
 }

 lastUnknownName = rawName;
 currentPatientPill.textContent = "Aucun patient";
 await aiSay(tpl(BOT.MATCH_NOT_FOUND, {name: titleCase(rawName)}));
}


// init

function initAuthGate({onAuthed} = {}){
 const overlay = document.getElementById("authOverlay");
 const sel = document.getElementById("authAccount");
 const pwd = document.getElementById("authPassword");
 const btn = document.getElementById("authSubmit");
 const err = document.getElementById("authError");

 const lockUI = (locked) => {
 try{
 if(inputEl) inputEl.disabled = !!locked;
 if(sendBtn) sendBtn.disabled = !!locked;
 document.body.classList.toggle("auth-locked", !!locked);
 }catch(_){/* ignore */}
 };

 // Remplir la liste déroulante
 if(sel && !sel.dataset.filled){
 const comptes = listAccounts();
 sel.innerHTML = "";
 for(const c of comptes){
 const opt = document.createElement("option");
 opt.value = c.name;
 opt.textContent = c.name;
 sel.appendChild(opt);
 }
 sel.dataset.filled = "1";
 }

 // Si déjà connecté (souvenir navigateur)
 const saved = getAuth();
 if(saved && isValidAccountName(saved.account)){
 setAuth(saved.account);
 overlay?.classList.add("hidden");

 if(isAccountBlocked(saved.account)){
 setSubscriptionBlocked(true);
 lockUI(true);
 return;
 }

 setSubscriptionBlocked(false);
 lockUI(false);
 if(typeof onAuthed === "function") onAuthed();
 setTimeout(() => inputEl?.focus(), 60);
 return;
 }

 // Connexion requise
 setAuth(null);
 lockUI(true);
 overlay?.classList.remove("hidden");

 const attempt = () => {
 const name = (sel?.value || "").trim();
 const pass = String(pwd?.value || "");
 if(!name){
 if(err) err.textContent = "Choisissez un compte.";
 return;
 }
 if(verifyPassword(name, pass)){
 setAuth(name);
 if(err) err.textContent = "";
 if(pwd) pwd.value = "";
 overlay?.classList.add("hidden");

 if(isAccountBlocked(name)){
 setSubscriptionBlocked(true);
 lockUI(true);
 return;
 }

 setSubscriptionBlocked(false);
 lockUI(false);
 if(typeof onAuthed === "function") onAuthed();
 setTimeout(() => inputEl?.focus(), 60);
 }else{
 if(err) err.textContent = "Mot de passe incorrect.";
 if(pwd) pwd.value = "";
 setTimeout(() => pwd?.focus(), 30);
 }
 };

 btn?.addEventListener("click", attempt);
 pwd?.addEventListener("keydown", (e) => {
 if(e.key === "Enter") attempt();
 });
 sel?.addEventListener("keydown", (e) => {
 if(e.key === "Enter") attempt();
 });

 setTimeout(() => pwd?.focus(), 80);
}

async function boot(){
 await initStore();
 await loadAccounts();
 refreshCustomPatients();

 let started = false;
 const startChat = () => {
 if(started) return;
 started = true;
 (async () => {
 await aiSay(BOT.INTRO);
 })();
 };

 const send = () => {
 if(!AUTH_ACCOUNT) return;
 const v = (inputEl?.value || "").trim();
 if(!v) return;
 inputEl.value = "";
 runQuery(v);
 };

 sendBtn?.addEventListener("click", send);
 inputEl?.addEventListener("keydown", (e) => {
 if(e.key === "Enter") send();
 });


 // Auth gate bloque l'UI tant qu'on n'est pas connecté
 initAuthGate({ onAuthed: startChat });
}


boot();
