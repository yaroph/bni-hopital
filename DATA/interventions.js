// Docteur GENIUSTER IA — bibliothèque d'interventions / conseils
// Objectif : détecter les questions de conseil ("que faire", "aide", "urgence"…),
// reconnaître des scénarios, et répondre avec une démarche pré‑enregistrée.
// (Fichier côté navigateur, exposé via window.INTERVENTION_LIBRARY)

(function(){
  // Normalisation simple
  const norm = (s)=>String(s||"")
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/['’]/g,' ')
    .replace(/[^\w\s]/g,' ')
    .replace(/\s+/g,' ')
    .trim();

  // 1) Détection "question de conseil" (intent)
  // Beaucoup de variantes courantes de démarrage de phrase
  const ADVICE_TRIGGERS = [
    /\bque\s+faire\b/i,
    /\bquoi\s+faire\b/i,
    /\bcomment\s+faire\b/i,
    /\bcomment\s+gerer\b/i,
    /\bcomment\s+reagir\b/i,
    /\bquels?\s+gestes\b/i,
    /\bconduite\s+a\s+tenir\b/i,
    /\bmarche\s+a\s+suivre\b/i,
    /\bprotocole\b/i,
    /\bprocedure\b/i,
    /\bprise\s+en\s+charge\b/i,
    /\bprise\s+en\s+charge\s+rapide\b/i,
    /\burgence\b/i,
    /\bcest\s+urgent\b/i,
    /\baide\s+moi\b/i,
    /\bpeux\s*tu\s+m'aider\b/i,
    /\bje\s+dois\s+faire\s+quoi\b/i,
    /\bje\s+fais\s+quoi\b/i,
    /\btu\s+ferais\s+quoi\b/i,
    /\bdes\s+conseils\b/i,
    /\bje\s+sais\s+pas\s+quoi\s+faire\b/i,
    /\bmon\s+patient\b/i,
    /\bla\s+personne\b/i,
    /\bil\s+y\s+a\b/i,
    /\bil\s+est\s+entrain\s+de\b/i,
    /\bil\s+est\s+en\s+train\s+de\b/i,
    /\bil\s+vient\s+de\b/i,
    /\belle\s+vient\s+de\b/i,
    /\bje\s+suis\s+sur\b/i,
    /\bje\s+pense\s+que\b/i,
    /\bje\s+suspecte?\b/i,
    /\bpossible\b/i,
    /\bprobable\b/i,
    /\bgrave\b/i,
    /\bca\s+degener(e|e)\b/i,
  ];

  // 2) Lexique symptômes (extraction multi‑symptômes)
  // (On reste volontairement "grand public" : l'analyse détaillée est dans maladies.js)
  const SYMPTOMS = [
    { id:'toux', label:'Toux', patterns:[/\btousse\b/i,/\btoux\b/i,/\bcrache\b/i,/\bexpectoration\b/i] },
    { id:'fievre', label:'Fièvre', patterns:[/\bfievre\b/i,/\btemperature\b.*\bmonte\b/i,/\bfrissons?\b/i] },
    { id:'douleur_poitrine', label:'Douleur thoracique', patterns:[/\bdouleur\b.*\bpoitrine\b/i,/\bserre\b.*\bpoitrine\b/i,/\bmal\b.*\bau\s+thorax\b/i] },
    { id:'essoufflement', label:"Essoufflement", patterns:[/\bessouffl(e|ee)\b/i,/\brespire\b.*\bmal\b/i,/\bdetresse\s+respiratoire\b/i] },
    { id:'vision_trouble', label:'Vision trouble', patterns:[/\bvoit\s+trouble\b/i,/\bvision\s+trouble\b/i,/\bflou\b/i] },
    { id:'perte_connaissance', label:'Perte de connaissance', patterns:[/\bperd(u|re)\s+connaissance\b/i,/\b(syncope|malaise)\b/i,/\bevanoui\b/i,/\binconscient\b/i] },
    { id:'convulsions', label:'Convulsions', patterns:[/\bconvulsions?\b/i,/\bcrise\b.*\b(epilep|convuls)\b/i,/\btremble\b.*\bde\s+partout\b/i] },
    { id:'vomissements', label:'Vomissements', patterns:[/\bvomit\b/i,/\bvomi(s|t)?\b/i,/\bnaus(e|ee)\b/i] },
    { id:'diarrhee', label:'Diarrhée', patterns:[/\bdiarrh(e|ee)\b/i,/\bselles?\s+liquides?\b/i] },
    { id:'douleur_abdo', label:'Douleur abdominale', patterns:[/\bdouleur\b.*\bventre\b/i,/\bmal\b.*\bau\s+ventre\b/i,/\bcrampes?\b/i] },
    { id:'saignement', label:'Saignement', patterns:[/\bsaigne\b/i,/\bhe?m?orr?ag(ie|ique)\b/i,/\bperd\b.*\bdu\s+sang\b/i] },
    { id:'brulure', label:'Brûlure', patterns:[/\bbrul(ure|e)\b/i,/\bflamme\b/i,/\beau\s+bouillante\b/i] },
    { id:'douleur_tete', label:'Mal de tête', patterns:[/\bmal\b.*\b(tete|crane)\b/i,/\bcephalee\b/i] },
    { id:'engourdissement', label:'Engourdissement / faiblesse', patterns:[/\bengourdi\b/i,/\bfaiblesse\b/i,/\bparalys(ie|e)\b/i,/\bne\s+sent\s+plus\b/i] },
    { id:'douleur_membre', label:'Douleur membre', patterns:[/\bdouleur\b.*\b(bras|jambe|main|pied|epaule|genou|cheville)\b/i] },
    { id:'plaie', label:'Plaie', patterns:[/\bplaie\b/i,/\bcoupure\b/i,/\blaceration\b/i] },
    { id:'confusion', label:'Confusion', patterns:[/\bconfus\b/i,/\bdesoriente\b/i,/\bdelire\b/i] },
  ];


// 2bis) Parties du corps (pour détecter "bras cassé", "mal au genou", "rougeurs sur la main", "balle dans l'épaule"...)
// On reste dans le même système : on ajoute juste beaucoup de variantes "pré‑écrites" (patterns),
// et on réutilise ces infos pour écrire des réponses plus naturelles.
const BODY_PARTS = [
  { id:'bras', display:'bras', gender:'m', forms:['bras'] },
  { id:'avant_bras', display:'avant-bras', gender:'m', forms:['avant bras','avant-bras','avantbras'] },
  { id:'coude', display:'coude', gender:'m', forms:['coude'] },
  { id:'poignet', display:'poignet', gender:'m', forms:['poignet'] },
  { id:'main', display:'main', gender:'f', forms:['main','mains'] , plural:false },
  { id:'doigt', display:'doigt', gender:'m', forms:['doigt','doigts'], plural:false },
  { id:'epaule', display:"épaule", gender:'f', forms:['epaule','épaule'] },
  { id:'clavicule', display:'clavicule', gender:'f', forms:['clavicule'] },

  { id:'jambe', display:'jambe', gender:'f', forms:['jambe','jambes'] , plural:false },
  { id:'cuisse', display:'cuisse', gender:'f', forms:['cuisse','cuisses'], plural:false },
  { id:'genou', display:'genou', gender:'m', forms:['genou','genoux'], plural:false },
  { id:'cheville', display:'cheville', gender:'f', forms:['cheville','chevilles'], plural:false },
  { id:'pied', display:'pied', gender:'m', forms:['pied','pieds'], plural:false },
  { id:'orteil', display:'orteil', gender:'m', forms:['orteil','orteils'], plural:false },
  { id:'hanche', display:'hanche', gender:'f', forms:['hanche','hanches'], plural:false },

  { id:'dos', display:'dos', gender:'m', forms:['dos'] },
  { id:'nuque', display:'nuque', gender:'f', forms:['nuque'] },
  { id:'cou', display:'cou', gender:'m', forms:['cou'] },

  { id:'tete', display:'tête', gender:'f', forms:['tete','tête','crane','crâne'] },
  { id:'machoire', display:'mâchoire', gender:'f', forms:['machoire','mâchoire'] },
  { id:'nez', display:'nez', gender:'m', forms:['nez'] },
  { id:'oeil', display:'œil', gender:'m', forms:['oeil','œil','yeux'] },
  { id:'oreille', display:'oreille', gender:'f', forms:['oreille','oreilles'], plural:false },

  { id:'thorax', display:'thorax', gender:'m', forms:['thorax','poitrine'] },
  { id:'cotes', display:'côtes', gender:'f', forms:['cote','cotes','côtes'], plural:true },
  { id:'ventre', display:'ventre', gender:'m', forms:['ventre','abdomen'] },
  { id:'bassin', display:'bassin', gender:'m', forms:['bassin'] },

  // --- Organes (surtout pour opérations / ablations) ---
  { id:'appendice', display:'appendice', gender:'m', forms:['appendice'], noFracture:true },
  { id:'rein', display:'rein', gender:'m', forms:['rein','reins'], plural:false, noFracture:true },
  { id:'rate', display:'rate', gender:'f', forms:['rate'], noFracture:true },
  { id:'vesicule', display:'vésicule', gender:'f', forms:['vesicule','vésicule','vesicule biliaire','vésicule biliaire'], noFracture:true },
  { id:'foie', display:'foie', gender:'m', forms:['foie'], noFracture:true },
  { id:'estomac', display:'estomac', gender:'m', forms:['estomac'], noFracture:true },
  { id:'intestin', display:'intestin', gender:'m', forms:['intestin','intestins'], plural:false, noFracture:true },
  { id:'poumon', display:'poumon', gender:'m', forms:['poumon','poumons'], plural:false, noFracture:true },
  { id:'uterus', display:'utérus', gender:'m', forms:['uterus','utérus'], noFracture:true },
  { id:'ovaire', display:'ovaire', gender:'m', forms:['ovaire','ovaires'], plural:false, noFracture:true },
  { id:'amygdales', display:'amygdales', gender:'f', forms:['amygdale','amygdales'], plural:true, noFracture:true },

];

const PARTS_BY_ID = {};
for(const p of BODY_PARTS){
  if(!p) continue;
  // par défaut : plural=false sauf si explicitement true
  if(typeof p.plural !== 'boolean') p.plural = false;
  PARTS_BY_ID[p.id] = p;
}

function _startsWithVowel(word){
  const w = String(word||'').toLowerCase();
  return /^[aeiouyhàâäéèêëîïôöùûüœ]/.test(w);
}

function partIndef(id){
  const p = PARTS_BY_ID[id];
  if(!p) return null;
  if(p.plural) return `des ${p.display}`;
  return (p.gender === 'f') ? `une ${p.display}` : `un ${p.display}`;
}
function partDef(id){
  const p = PARTS_BY_ID[id];
  if(!p) return null;
  if(p.plural) return `les ${p.display}`;
  if(_startsWithVowel(p.display)) return `l'${p.display}`;
  return (p.gender === 'f') ? `la ${p.display}` : `le ${p.display}`;
}
function partA(id){
  const p = PARTS_BY_ID[id];
  if(!p) return null;
  if(p.plural) return `aux ${p.display}`;
  if(_startsWithVowel(p.display)) return `à l'${p.display}`;
  return (p.gender === 'f') ? `à la ${p.display}` : `au ${p.display}`;
}
function partSur(id){
  const p = PARTS_BY_ID[id];
  if(!p) return null;
  if(p.plural) return `sur les ${p.display}`;
  if(_startsWithVowel(p.display)) return `sur l'${p.display}`;
  return (p.gender === 'f') ? `sur la ${p.display}` : `sur le ${p.display}`;
}
function adjCasse(id){
  const p = PARTS_BY_ID[id];
  if(!p) return 'cassé';
  if(p.plural) return 'cassées';
  return (p.gender === 'f') ? 'cassée' : 'cassé';
}
function detectPartId(ntext){
  const t = String(ntext||'');
  for(const p of BODY_PARTS){
    const forms = Array.isArray(p.forms) && p.forms.length ? p.forms : [p.id];
    for(const f of forms){
      const k = norm(f).replace(/\s+/g,' ');
      const re = new RegExp(`\\b${k.replace(/\s+/g,'\\\\s+')}\\b`, 'i');
      if(re.test(t)) return p.id;
    }
  }
  return null;
}


  // 3) Scénarios à détecter (>= 120)
  // Chaque scénario a : id, label, patterns, category
  const SCENARIOS = [
    // --- URGENCES VITALES ---
    { id:'not_breathing', label:"La personne ne respire plus", category:'not_breathing',
      patterns:[/\bne\s+respire\s+plus\b/i,/\brespire\s+pas\b/i,/\bpas\s+de\s+respiration\b/i,/\bapnee\b/i,/\barret\s+respiratoire\b/i] },
    { id:'cardiac_arrest', label:"Arrêt cardio-respiratoire", category:'cardiac_arrest',
      patterns:[/\barret\s+cardiaque\b/i,/\bplus\s+de\s+pouls\b/i,/\b(arret\s+cardio|acr)\b/i] },
    { id:'death', label:"Décès / mort d'un patient", category:'death',
      patterns:[/\bmort\b/i,/\bdeces\b/i,/\bdecede\b/i,/\bpatient\s+decede\b/i,/\bconstate\b.*\bdeces\b/i] },
    { id:'choking', label:"Étouffement", category:'choking',
      patterns:[/\betouffe\b/i,/\bs etouffe\b/i,/\bfausse\s+route\b/i,/\bobstruction\b.*\bgorge\b/i,/\bchoke\b/i] },

    // --- MASS CASUALTY / VIOLENCE ---
    { id:'shooting_mass', label:"Fusillade / plusieurs victimes", category:'shooting_mass',
      patterns:[/\bfusillade\b/i,/\bshooting\b/i,/\bplusieurs\s+victimes?\b/i,/\bvictimes?\s+au\s+sol\b/i,/\btirs?\b.*\bpartout\b/i] },
    { id:'gshot', label:"Blessure par balle", category:'gunshot',
      patterns:[/\btire\b.*\b(sur|dessus)\b/i,/\bplai(e|es)\s+par\s+balle\b/i,/\bball(es)?\b/i,/\bgun\s*shot\b/i,/\bperfore\b.*\bballe\b/i] },
    { id:'stab', label:"Blessure par couteau / arme blanche", category:'stab',
      patterns:[/\bcouteau\b/i,/\barme\s+blanche\b/i,/\bpoignard(e|ee)\b/i,/\bstab(bed)?\b/i,/\bplaie\b.*\btranchante\b/i] },
    { id:'kidnapping', label:"Kidnapping / prise d'otage", category:'kidnapping',
      patterns:[/\bkidnap(ping|pe|pe[e]?)\b/i,/\benlev(e|ee)\b/i,/\botage\b/i,/\bprise\s+d otage\b/i] },

    // --- ACCIDENTS ROUTIERS / CHUTES ---
    { id:'car_crash', label:"Accident de voiture", category:'car_crash',
      patterns:[/\baccident\b.*\bvoiture\b/i,/\bcollision\b.*\bvoiture\b/i,/\bcarambolage\b/i,/\bpercut(e|ee)\s+par\s+voiture\b/i] },
    { id:'motorcycle', label:"Accident de moto", category:'motorcycle',
      patterns:[/\baccident\b.*\bmoto\b/i,/\bchute\b.*\bmoto\b/i,/\bmoto\s+crash\b/i] },
    { id:'bike', label:"Accident de vélo", category:'bike',
      patterns:[/\baccident\b.*\bvelo\b/i,/\bchute\b.*\bvelo\b/i,/\bcycliste\b.*\bpercut/i] },
    { id:'hoverboard', label:"Accident d'hoverboard", category:'hoverboard',
      patterns:[/\bhoverboard\b/i,/\bgyropode\b/i,/\bchute\b.*\bhover\b/i] },
    { id:'run_over', label:"Écrasé / roulé dessus par une voiture", category:'run_over',
      patterns:[/\becrase\b.*\bvoiture\b/i,/\broule\b.*\bdessus\b/i,/\broule\b.*\bsur\b.*\b(lui|elle)\b/i] },
    { id:'fall_height', label:"Chute de haut / de hauteur", category:'fall_height',
      patterns:[/\bchute\s+de\s+hauteur\b/i,/\btombe\b.*\b(etage|toit|balcon|falaise|escalier)\b/i,/\bchute\b.*\bplusieurs\s+metres\b/i] },

    // --- TRAUMAS / PLAIES ---
    { id:'open_fracture', label:"Fracture ouverte", category:'open_fracture',
      patterns:[/\bfracture\s+ouverte\b/i,/\bos\s+sort\b/i,/\bos\b.*\ba\s+l air\b/i] },
    { id:'closed_fracture', label:"Fracture (membre déformé)", category:'closed_fracture',
      patterns:[/\bfracture\b/i,/\bmembre\s+deforme\b/i,/\bos\s+casse\b/i,/\bmembre\s+tordu\b/i] },
    { id:'amputation', label:"Membre arraché / amputation", category:'amputation',
      patterns:[/\bamputation\b/i,/\bmembre\s+arrache\b/i,/\bperdu\b.*\bun\s+(bras|jambe|main|pied|doigt)\b/i] },
    { id:'head_trauma', label:"Traumatisme crânien", category:'head_trauma',
      patterns:[/\btrauma(tisme)?\s+cranien\b/i,/\bchoc\b.*\btete\b/i,/\bcommotion\b/i] },
    { id:'coma', label:"Coma / inconscience", category:'coma',
      patterns:[/\bcoma\b/i,/\binconscient\b/i,/\bne\s+reagit\s+plus\b/i,/\bpas\s+reponse\b/i] },
    { id:'eye_trauma', label:"Atteinte des yeux / vision trouble", category:'eye_trauma',
      patterns:[/\b(oeil|yeux)\b.*\b(blesse|brule|coup)\b/i,/\bvoit\s+trouble\b/i,/\bvision\s+trouble\b/i] },
    { id:'severe_bleed', label:"Saignement important / hémorragie", category:'severe_bleed',
      patterns:[/\bhe?m?orr?ag(ie|ique)\b/i,/\bsaigne\b.*\bfort\b/i,/\bperd\b.*\bbeaucoup\s+de\s+sang\b/i] },

    { id:'hemorrhage_internal', label:"Hémorragie interne suspectée", category:'hemorrhage_internal',
      patterns:[/\bhe?m?orr?ag(ie|ique)\s+interne\b/i,/\bsaignement\s+interne\b/i,/\bperd\s+du\s+sang\s+a\s+l\s*interieur\b/i,/\bventre\b.*\b(dur|gonfle|ballonne)\b.*\bsaigne\b/i] },

    { id:'surgery_generic', label:"Opération en cours / chirurgie", category:'surgery_generic',
      patterns:[/\bje\s+pratique\s+une?\s+operation\b/i,/\bje\s+vais\s+operer\b/i,/\bje\s+l\s*opere\b/i,/\boperation\s+en\s+cours\b/i,/\bau\s+bloc\b/i,/\bchirurgie\b/i,/\bincision\b/i] },

    { id:'ablation_part', label:"Ablation (retrait d'une partie / d'un organe)", category:'ablation_part',
      patterns:[] },
    { id:'burn_thermal', label:"Brûlure (thermique)", category:'burn_thermal',
      patterns:[/\bbrul(ure|e)\b/i,/\bflamme\b/i,/\beau\s+bouillante\b/i,/\bhuile\s+chaude\b/i] },
    { id:'burn_chemical', label:"Brûlure chimique", category:'burn_chemical',
      patterns:[/\bbrulure\s+chimique\b/i,/\bacide\b/i,/\bsoude\b/i,/\bproduit\s+chimique\b/i] },
    { id:'electrocution', label:"Électrocution", category:'electrocution',
      patterns:[/\belectrocut/i,/\bchoc\s+electrique\b/i,/\bhaute\s+tension\b/i,/\bprise\b.*\bdefectueuse\b/i] },
    { id:'crush', label:"Écrasement / coincé", category:'crush',
      patterns:[/\bcoince\b/i,/\becrase\b/i,/\bentre\s+deux\b.*\bvehicules?\b/i,/\bchute\b.*\bobjet\s+lourd\b/i] },

    // --- DÉSASTRES / ENVIRONNEMENT ---
    { id:'fire_smoke', label:"Incendie / inhalation de fumées", category:'fire_smoke',
      patterns:[/\bincendie\b/i,/\bfumee(s)?\b/i,/\binhalation\b.*\bfumee\b/i,/\bintoxication\b.*\bmonoxyde\b/i] },
    { id:'drowning', label:"Noyade", category:'drowning',
      patterns:[/\bnoyade\b/i,/\bquasi\s*noyade\b/i,/\bchute\b.*\bau\b.*\beau\b/i,/\baspire\b.*\beau\b/i] },
    { id:'tornado', label:"Tornade / tempête violente", category:'tornado',
      patterns:[/\btornade\b/i,/\btwister\b/i,/\btempete\b.*\bviolente\b/i,/\bvents?\s+extremes?\b/i] },
    { id:'earthquake', label:"Séisme / tremblement de terre", category:'earthquake',
      patterns:[/\bseisme\b/i,/\btremblement\s+de\s+terre\b/i,/\bimmeuble\b.*\btremble\b/i] },
    { id:'flood', label:"Inondation", category:'flood',
      patterns:[/\binondation\b/i,/\bcrue\b/i,/\beau\b.*\bmonte\b/i] },
    { id:'avalanche', label:"Avalanche", category:'avalanche',
      patterns:[/\bavalanche\b/i,/\benseveli\b/i,/\bneige\b.*\benseveli\b/i] },
    { id:'lightning', label:"Foudroyé", category:'lightning',
      patterns:[/\bfoudre\b/i,/\bfoudroye\b/i,/\beclair\b.*\btouche\b/i] },

    // --- EXPLOSIONS ---
    { id:'explosion_vehicle', label:"Explosion de voiture", category:'explosion_vehicle',
      patterns:[/\bexplosion\b.*\bvoiture\b/i,/\bvoiture\b.*\bexplose\b/i,/\bcar\s+bomb\b/i,/\bvehicule\b.*\bexplose\b/i] },
    { id:'explosion_building', label:"Explosion d'immeuble / bâtiment", category:'explosion_building',
      patterns:[/\bexplosion\b.*\b(immeuble|batiment|building)\b/i,/\b(immeuble|batiment|building)\b.*\bexplose\b/i] },
    { id:'explosion_generic', label:"Explosion", category:'explosion_generic',
      patterns:[/\bexplosion\b/i,/\bblast\b/i,/\bbombe\b/i] },
    // --- TRANSPORT / CATASTROPHES ---
    { id:'plane_crash', label:"Crash d'avion", category:'mass_casualty',
      patterns:[/\bcrash\b.*\bavion\b/i,/\bavion\b.*\bcrash\b/i,/\b(ecrase|s\s*ecrase)\b.*\bavion\b/i,/\bchute\b.*\bavion\b/i] },
    { id:'helicopter_crash', label:"Crash d'hélicoptère", category:'mass_casualty',
      patterns:[/\bcrash\b.*\b(helico|helicoptere)\b/i,/\b(helico|helicoptere)\b.*\bcrash\b/i] },
    { id:'train_derail', label:"Déraillement / accident de train", category:'mass_casualty',
      patterns:[/\bderaillement\b/i,/\baccident\b.*\btrain\b/i,/\btrain\b.*\bderaille\b/i] },
    { id:'boat_collision', label:"Accident de bateau", category:'mass_casualty',
      patterns:[/\baccident\b.*\bbateau\b/i,/\bcollision\b.*\bbateau\b/i,/\bferry\b.*\baccident\b/i] },
    { id:'shipwreck', label:"Naufrage / bateau qui coule", category:'drowning',
      patterns:[/\bnaufrage\b/i,/\bbateau\b.*\bcoule\b/i,/\bferry\b.*\bcoule\b/i] },
    { id:'gas_explosion', label:"Explosion de gaz", category:'explosion_generic',
      patterns:[/\bexplosion\b.*\bgaz\b/i,/\bfuite\b.*\bgaz\b.*\bexplos/i,/\bgaz\b.*\bexplose\b/i] },
    { id:'terror_attack', label:"Attentat / attaque de masse", category:'mass_casualty',
      patterns:[/\battentat\b/i,/\battaque\b.*\bterror/i,/\bexplosion\b.*\bfoule\b/i] },
    { id:'chemical_attack', label:"Attaque chimique / irritants", category:'burn_chemical',
      patterns:[/\battaque\b.*\bchimique\b/i,/\bgaz\b.*\birritant\b/i,/\bnuage\b.*\btoxique\b/i] },

    // --- MÉDICAL "GRAND PUBLIC" ---
    { id:'stroke', label:"Suspicion d'AVC", category:'stroke',
      patterns:[/\bavc\b/i,/\bbouche\b.*\bde\s+travers\b/i,/\bbras\b.*\bfaible\b/i,/\bparle\b.*\bbizarre\b/i] },
    { id:'seizure', label:"Crise convulsive", category:'seizure',
      patterns:[/\bconvulsions?\b/i,/\bcrise\b.*\b(epilep|convuls)\b/i] },
    { id:'anaphylaxis', label:"Allergie sévère (gonflement, difficulté à respirer)", category:'anaphylaxis',
      patterns:[/\banaphylax/i,/\ballergie\b.*\bgrave\b/i,/\bgonfle\b.*\bvisage\b/i,/\burticaire\b.*\brespire\b.*\bmal\b/i] },
    { id:'overdose', label:"Surdose / intoxication (drogue, médicament)", category:'overdose',
      patterns:[/\boverdose\b/i,/\bsurdose\b/i,/\bintoxication\b/i,/\bpris\b.*\btrop\b.*\bmedicaments?\b/i,/\b(coke|heroine|opio)\b/i] },
    { id:'poisoning_gas', label:"Intoxication au gaz", category:'poisoning_gas',
      patterns:[/\bgaz\b.*\bintox\b/i,/\bfuite\b.*\bgaz\b/i,/\bmonoxyde\b/i] },
    { id:'heatstroke', label:"Coup de chaleur", category:'heatstroke',
      patterns:[/\bcoup\s+de\s+chaleur\b/i,/\binsolation\b/i,/\btrop\s+chaud\b.*\bmal\b/i] },
    { id:'hypothermia', label:"Hypothermie", category:'hypothermia',
      patterns:[/\bhypotherm/i,/\btres\s+froid\b/i,/\btransi\b/i,/\bgrele\b.*\bfroid\b/i] },
    { id:'chest_pain', label:"Douleur de poitrine", category:'chest_pain',
      patterns:[/\bdouleur\b.*\bpoitrine\b/i,/\bserre\b.*\bpoitrine\b/i] },
    { id:'abdo_pain', label:"Douleur abdominale importante", category:'abdo_pain',
      patterns:[/\bdouleur\b.*\bventre\b/i,/\bmal\b.*\bau\s+ventre\b/i,/\bventre\b.*\binsupportable\b/i] },
    { id:'severe_infection', label:"Infection sévère (fièvre + état général mauvais)", category:'severe_infection',
      patterns:[/\bfievre\b.*\btres\s+mal\b/i,/\bfrissons?\b.*\bconfus\b/i,/\bse\s+sent\b.*\bpartir\b/i] },
    { id:'psych_agitation', label:"Agitation / crise de panique / violence", category:'psych_agitation',
      patterns:[/\bagit(e|ee)\b/i,/\bcrise\s+de\s+panique\b/i,/\bviolent\b/i,/\bmenace\b/i] },

    // --- SCÉNARIOS "SF" / ABSURDES MAIS DÉTECTABLES ---
    { id:'cyberpsycho', label:"Cyberpsycho", category:'cyberpsycho',
      patterns:[/\bcyberpsycho\b/i,/\bpsychose\b.*\bchrom(e|e)\b/i] },
    { id:'bionic_bug', label:"Bras bionique qui bug", category:'bionic_bug',
      patterns:[/\bbras\b.*\bbionique\b/i,/\bbionique\b.*\bbug\b/i,/\bprothese\b.*\bbug\b/i] },
    { id:'alien', label:"Alien / extraterrestre", category:'alien',
      patterns:[/\balien\b/i,/\bextraterrestre\b/i,/\bovni\b/i,/\bxenomorph(e)?\b/i] },
    { id:'meteorite', label:"Impact de météorite", category:'meteorite',
      patterns:[/\bmeteorite\b/i,/\bmeteore\b/i,/\basteroide\b/i,/\bcaillou\b.*\bdu\s+ciel\b/i] },
    { id:'time_loop', label:"Boucle temporelle", category:'time_loop',
      patterns:[/\bboucle\s+temporelle\b/i,/\btime\s+loop\b/i] },
    { id:'zombie', label:"Infection zombie", category:'zombie',
      patterns:[/\bzombie\b/i,/\bmordu\b.*\bzombie\b/i,/\binfection\b.*\bz\b/i] },
  ];


// 3bis) Ajout massif de variantes "pré‑écrites" par partie du corps
// Objectif: comprendre naturellement des phrases du type
// "mon patient s'est cassé le bras", "il a mal au genou", "rougeurs sur la main", "balle dans l'épaule", "il a perdu sa jambe"…
function _findScenario(id){ return SCENARIOS.find(s => s && s.id === id) || null; }
function _addPatterns(id, pats){
  const sc = _findScenario(id);
  if(!sc) return;
  if(!Array.isArray(sc.patterns)) sc.patterns = [];
  for(const r of (pats||[])){
    if(!r) continue;
    sc.patterns.push(r);
  }
}

const _CASS = "cass(e|ee)(s)?";
const _PERDU = "perdu(e|es)?";
const _ARRACHE = "arrache(e|ee)(s)?";

function _reWord(form){
  const k = norm(form).replace(/\s+/g,' ');
  return k.replace(/\s+/g,"\\s+");
}

// Variantes fractures (bras cassé, jambe cassée, etc.)
const _fracturePats = [];
for(const p of BODY_PARTS){
  if(p && p.noFracture) continue;
  const forms = Array.isArray(p.forms) && p.forms.length ? p.forms : [p.display];
  for(const f of forms){
    const r = _reWord(f);
    _fracturePats.push(new RegExp(`\\b${r}\\s+${_CASS}\\b`, 'i'));
    _fracturePats.push(new RegExp(`\\b${r}\\s+fractur(e|ee)(s)?\\b`, 'i'));
    _fracturePats.push(new RegExp(`\\bs\\s*est\\s*casse\\s+(le|la|l)\\s+${r}\\b`, 'i'));
    _fracturePats.push(new RegExp(`\\bmon\\s+patient\\s+s\\s*est\\s*casse\\s+(le|la|l)\\s+${r}\\b`, 'i'));
    _fracturePats.push(new RegExp(`\\bfracture\\s+du\\s+${r}\\b`, 'i'));
    _fracturePats.push(new RegExp(`\\bos\\s+du\\s+${r}\\s+${_CASS}\\b`, 'i'));
    _fracturePats.push(new RegExp(`\\b${_CASS}\\s+(son|sa|ses|le|la|l)\\s+${r}\\b`, 'i'));
    _fracturePats.push(new RegExp(`\\b(j\\s*ai|je\\s+lui\\s+ai|on\\s+lui\\s+a|il\\s+s\\s*est\\s+fait)\\s+${_CASS}\\s+(son|sa|ses|le|la|l)\\s+${r}\\b`, 'i'));
    _fracturePats.push(new RegExp(`\\b${r}\\s+pet(e|ee)(s)?\\b`, 'i'));
    _fracturePats.push(new RegExp(`\\bpet(e|ee)(s)?\\s+(son|sa|ses|le|la|l)\\s+${r}\\b`, 'i'));

  }
}
// Quelques formulations très fréquentes
_fracturePats.push(/\bos\s+de\s+la\s+tete\s+cass(e|ee)(s)?\b/i);
_addPatterns('closed_fracture', _fracturePats);

// Variantes amputation / perte d'un membre
const _ampPats = [];
for(const p of BODY_PARTS){
  if(p && p.noFracture) continue;
  const forms = Array.isArray(p.forms) && p.forms.length ? p.forms : [p.display];
  for(const f of forms){
    const r = _reWord(f);
    _ampPats.push(new RegExp(`\\b(a\\s+)?perd\\s*\\w*\\s+(son|sa|ses|un|une|le|la|l)\\s+${r}\\b`, 'i'));
    _ampPats.push(new RegExp(`\\b${_PERDU}\\s+(son|sa|ses|un|une|le|la|l)\\s+${r}\\b`, 'i'));
    _ampPats.push(new RegExp(`\\b${_ARRACHE}\\s+(son|sa|ses|un|une|le|la|l)\\s+${r}\\b`, 'i'));
    _ampPats.push(new RegExp(`\\bmembre\\s+${_ARRACHE}\\b.*\\b${r}\\b`, 'i'));
  }
}
_addPatterns('amputation', _ampPats);

// Variantes blessures par balle localisées
const _gshotPats = [];
for(const p of BODY_PARTS){
  const forms = Array.isArray(p.forms) && p.forms.length ? p.forms : [p.display];
  for(const f of forms){
    const r = _reWord(f);
    _gshotPats.push(new RegExp(`\\b(balle|balles|tir|tire|tiree|tirees)\\b.*\\b(dans|sur|au|a\\s+la|a\\s+l)\\s+${r}\\b`, 'i'));
    _gshotPats.push(new RegExp(`\\bpris\\s+une?\\s+balle\\b.*\\b${r}\\b`, 'i'));
    _gshotPats.push(new RegExp(`\\bse\\s*fait\\s*tire\\b.*\\b${r}\\b`, 'i'));
  }
}
_addPatterns('gshot', _gshotPats);

// Variantes blessures par arme blanche localisées
const _stabPats = [];
for(const p of BODY_PARTS){
  const forms = Array.isArray(p.forms) && p.forms.length ? p.forms : [p.display];
  for(const f of forms){
    const r = _reWord(f);
    _stabPats.push(new RegExp(`\\b(couteau|arme\\s+blanche|poignard)\\b.*\\b(dans|sur|au|a\\s+la|a\\s+l)\\s+${r}\\b`, 'i'));
    _stabPats.push(new RegExp(`\\b(coup|coups)\\s+de\\s+couteau\\b.*\\b${r}\\b`, 'i'));
  }
}
_addPatterns('stab', _stabPats);

// Nouveau scénario: douleur localisée ("mal au genou", "douleur à l'épaule"...)
const pain_part = {
  id:'pain_part',
  label:"Douleur localisée",
  category:'pain_part',
  patterns:[]
};
const _painPats = [];
for(const p of BODY_PARTS){
  const forms = Array.isArray(p.forms) && p.forms.length ? p.forms : [p.display];
  for(const f of forms){
    const r = _reWord(f);
    _painPats.push(new RegExp(`\\bmal\\s+(au|a\\s+la|a\\s+l)\\s+${r}\\b`, 'i'));
    _painPats.push(new RegExp(`\\bdouleur(s)?\\s+(au|a\\s+la|a\\s+l|sur)\\s+${r}\\b`, 'i'));
    _painPats.push(new RegExp(`\\b(a|il\\s+a|mon\\s+patient\\s+a)\\s+mal\\s+(au|a\\s+la|a\\s+l)\\s+${r}\\b`, 'i'));
    _painPats.push(new RegExp(`\\bça\\s+fait\\s+mal\\s+(au|a\\s+la|a\\s+l)\\s+${r}\\b`, 'i'));
  }
}
pain_part.patterns = _painPats;
SCENARIOS.push(pain_part);

// Nouveau scénario: rougeurs localisées ("rougeurs sur le bras", "peau rouge sur la jambe"...)
const redness_part = {
  id:'redness_part',
  label:"Rougeurs localisées",
  category:'redness_part',
  patterns:[]
};
const _redPats = [];
for(const p of BODY_PARTS){
  const forms = Array.isArray(p.forms) && p.forms.length ? p.forms : [p.display];
  for(const f of forms){
    const r = _reWord(f);
    _redPats.push(new RegExp(`\\brougeurs?\\s+(sur|au|a\\s+la|a\\s+l)\\s+${r}\\b`, 'i'));
    _redPats.push(new RegExp(`\\bpeau\\s+rouge\\s+(sur|au|a\\s+la|a\\s+l)\\s+${r}\\b`, 'i'));
    _redPats.push(new RegExp(`\\bplaques?\\s+rouges?\\s+(sur|au|a\\s+la|a\\s+l)\\s+${r}\\b`, 'i'));
    _redPats.push(new RegExp(`\\beryth(e|e)me\\b.*\\b${r}\\b`, 'i'));
  }
}
redness_part.patterns = _redPats;
SCENARIOS.push(redness_part);


// Nouveau scénario: ablation / retrait (ablation de l'appendice, retirer un rein, enlever une jambe, etc.)
const _ablationPats = [];
for(const p of BODY_PARTS){
  const forms = Array.isArray(p.forms) && p.forms.length ? p.forms : [p.display];
  for(const f of forms){
    const r = _reWord(f);
    // "ablation de ...", "faire une ablation de ..."
    _ablationPats.push(new RegExp(`\\bablation\\b.*\\b${r}\\b`, 'i'));
    _ablationPats.push(new RegExp(`\\b(faire|pratiquer)\\s+une?\\s+ablation\\b.*\\b${r}\\b`, 'i'));
    // "enlever / retirer ..."
    _ablationPats.push(new RegExp(`\\b(enlever|retirer|oter|ote)\\b.*\\b${r}\\b`, 'i'));
    _ablationPats.push(new RegExp(`\\b(enlever|retirer|oter|ote)\\s+(le|la|l)\\s+${r}\\b`, 'i'));
  }
}
_addPatterns('ablation_part', _ablationPats);


  // Ajouter des "variantes" pour dépasser largement 100 scénarios,
  // sans tomber dans des diagnostics trop techniques.
  // On crée des événements plausibles (objets, lieux, accidents, contexte).
  const EXTRA = [
    ["bus_crash","Accident de bus","accident bus", "car_crash"],
    ["truck_crash","Accident de camion","accident camion", "car_crash"],
    ["tram","Accident de tram / métro","tram metro accident", "car_crash"],
    ["building_collapse","Effondrement d'immeuble","effondrement immeuble", "crush"],
    ["stampede","Mouvement de foule / bousculade","bousculade foule", "shooting_mass"],
    ["fireworks","Accident de feu d'artifice","feu d artifice brulure", "burn_thermal"],
    ["lab_chem","Accident de laboratoire (produit chimique)","produit chimique yeux", "burn_chemical"],
    ["gas_station","Accident station-service","station service explosion", "explosion_vehicle"],
    ["bar_fight","Bagarre / rixe","bagarre rixe", "psych_agitation"],
    ["sports_injury","Blessure sportive","match blessure", "closed_fracture"],
    ["dog_bite","Morsure de chien","morsure chien", "severe_bleed"],
    ["cat_bite","Morsure de chat","morsure chat", "severe_bleed"],
    ["snake_bite","Morsure de serpent","morsure serpent", "overdose"],
    ["bee_sting","Piqûre d'abeille","piqure abeille", "anaphylaxis"],
    ["chemical_splash_eye","Projection chimique dans l'œil","projection chimique oeil", "burn_chemical"],
    ["glass_cut","Coupure au verre","coupure verre", "severe_bleed"],
    ["industrial_cut","Coupure à la machine","machine coupure", "severe_bleed"],
    ["near_hanging","Pendaison / strangulation","pendaison etouffement", "not_breathing"],
    ["suffocation_smoke","Asphyxie par fumée","asphyxie fumee", "fire_smoke"],
    ["boat_capsize","Bateau chavire","bateau chavire", "drowning"],
    ["ice_fall","Chute sur glace","glace chute", "fall_height"],
    ["cliff_fall","Chute de falaise","falaise chute", "fall_height"],
    ["roof_fall","Chute de toit","toit chute", "fall_height"],
    ["ladder_fall","Chute d'échelle","echelle chute", "fall_height"],
    ["burn_elec","Brûlure électrique","brulure electrique", "electrocution"],
    ["burn_sun","Coup de soleil sévère","coup de soleil severe", "heatstroke"],
    ["panic_attack","Crise d'angoisse","crise angoisse", "psych_agitation"],
    ["self_harm","Blessure auto-infligée","auto mutile", "severe_bleed"],
    ["knife_fight","Rixe au couteau","rixe couteau", "stab"],
    ["home_invasion","Agression à domicile","agression domicile", "psych_agitation"],
    ["airport_incident","Incident aéroport","aeroport panique", "shooting_mass"],
    ["riot","Émeute","emeute", "shooting_mass"],
    ["forest_fire","Feu de forêt","feu foret fumee", "fire_smoke"],
    ["chemical_leak","Fuite chimique","fuite chimique", "burn_chemical"],
    ["car_in_water","Voiture dans l'eau","voiture dans l eau", "drowning"],
    ["electrical_fire","Feu électrique","feu electrique", "fire_smoke"],
    ["tractor_accident","Accident de tracteur","tracteur accident", "crush"],
    ["elevator_fall","Ascenseur incident","ascenseur chute", "crush"],
    ["construction_fall","Chantier: chute","chantier chute", "fall_height"],
    ["construction_crush","Chantier: écrasement","chantier ecrase", "crush"],
    ["sci_fi_portal","Portail instable","portail instable", "time_loop"],
    ["ufo_crash","Crash d'ovni","ovni crash", "alien"],
    ["plane_crash","Crash d'avion","crash avion", "mass_casualty"],
    ["helicopter_crash","Crash d'hélicoptère","crash helicoptere", "mass_casualty"],
    ["train_derail","Déraillement de train","deraillement train", "mass_casualty"],
    ["ferry_fire","Incendie sur bateau / ferry","incendie bateau ferry", "fire_smoke"],
    ["shipwreck","Naufrage / bateau qui coule","naufrage bateau coule", "drowning"],
    ["boat_collision","Collision de bateau","collision bateau", "mass_casualty"],
    ["gas_explosion","Explosion de gaz","explosion gaz", "explosion_generic"],
    ["bridge_collapse","Effondrement de pont","pont effondre", "crush"],
    ["landslide","Glissement de terrain","glissement de terrain", "crush"],
    ["terror_attack","Attentat / attaque de masse","attentat attaque", "mass_casualty"],
    ["chemical_attack","Attaque chimique (fumées/irritants)","attaque chimique irritant", "burn_chemical"],
    ["factory_explosion","Explosion d'usine","explosion usine", "explosion_building"],
    ["stadium_incident","Incident stade / concert","incident stade concert", "mass_casualty"],
    ["elevator_crush","Accident d'ascenseur grave","accident ascenseur grave", "crush"],
    ["building_fire","Incendie d'immeuble","incendie immeuble", "fire_smoke"],
    ["meteor_shower","Pluie de météores","pluie meteores", "meteorite"],  ];

  // Compile EXTRA en scénarios
  for(const row of EXTRA){
    const [id,label,kw,category] = row;
    const k = norm(kw);
    SCENARIOS.push({
      id, label, category,
      patterns:[
        new RegExp("\\b"+k.replace(/\s+/g,"\\s+")+"\\b","i")
      ]
    });
  }

  // --- Détection scénario ---
  function matchScenario(ntext){
    const hits = [];
    for(const sc of SCENARIOS){
      const pats = Array.isArray(sc.patterns) ? sc.patterns : [];
      let ok = false;
      for(const re of pats){
        try{
          if(re.test(ntext)){ ok = true; break; }
        }catch(_){}
      }
      if(ok){
        const details = extractDetails(sc.id, ntext);
        hits.push({ id: sc.id, label: sc.label, details, category: sc.category });
      }
    }
    // dédoublonnage + ordre stable
    const uniq = [];
    const seen = new Set();
    for(const h of hits){
      if(seen.has(h.id)) continue;
      seen.add(h.id);
      uniq.push(h);
    }
    return uniq;
  }

  
function extractDetails(id, ntext){
  // Extraction simple de partie du corps quand c'est utile.
  // On renvoie un "partId" (voir BODY_PARTS), pour écrire des réponses naturelles.
  const partId = detectPartId(ntext);

  if(id === 'amputation'){
    return partId;
  }
  if(id === 'open_fracture' || id === 'closed_fracture'){
    return partId;
  }
  if(id === 'gshot' || id === 'stab'){
    return partId;
  }
  if(id === 'pain_part' || id === 'redness_part'){
    return partId;
  }
  if(id === 'ablation_part' || id === 'surgery_generic'){
    return partId;
  }
  return null;
}

  // --- Extraction symptômes ---
  function extractSymptoms(ntext){
    const out = [];
    for(const s of SYMPTOMS){
      let ok = false;
      for(const re of (s.patterns||[])){
        try{
          if(re.test(ntext)){ ok = true; break; }
        }catch(_){}
      }
      if(ok){
        out.push({ id:s.id, label:s.label });
      }
    }
    // Unicité
    const seen = new Set();
    return out.filter(x => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  }

  // 4) Réponses pré‑enregistrées par "catégorie" (2 sérieuses + 2 drôles, mais toujours liées)
  // (On affiche UNE seule réponse, choisie au hasard côté app.js)
  function withDetails(label, details){
    return details ? `${label} (${details})` : label;
  }

  const PACK = {
    not_breathing: (label, details) => ({
        serieuse: [
            `OK, on est sur ${withDetails(label, details)}.
Je fais simple : tu vérifies vite la bouche et le thorax (obstruction ?).
Ensuite tu ouvres bien les voies respiratoires, et tu ventiles si tu peux.
Appelle du renfort tout de suite, et surveille en continu : si plus de signes de circulation, tu enchaînes massage + défibrillateur dès qu’il arrive.`,
            `${withDetails(label, details)} :
- Sécuriser, puis vérifier que rien ne bloque (bouche, vomi, corps étranger).
- Ouvrir les voies respiratoires, ventiler.
- Appeler renfort, surveiller : si arrêt cardio-respiratoire, réanimation immédiate.`,
        ],
        absurde: [
            `${withDetails(label, details)} : OK… les poumons font grève.
Tu ne négocies pas : tu dégages, tu ouvres, tu ventiles.
Et tu fais venir du renfort maintenant, pas “quand j’ai une minute”.`,
            `Si ${withDetails(label, details)} :
Je veux bien lui souffler un “allez respire !”… mais ce qui marche, c’est :
voies respiratoires ouvertes, ventilation, et renfort en route (très vite).`,
        ],
    }),
    cardiac_arrest: (label, details) => ({
        serieuse: [
            `Là, on pense arrêt cardio-respiratoire.
Appel renfort immédiat, et tu démarres la réanimation sans perdre de temps : massages forts et réguliers, ventilation si possible.
Défibrillateur dès qu’il est là, et réévaluation fréquente (pouls, respiration, rythme).`,
            `Arrêt cardio-respiratoire :
- Alerter + demander un défibrillateur.
- Massage efficace, ventilation si possible.
- Défibrillation dès que disponible, réévaluer souvent et se relayer.`,
        ],
        absurde: [
            `Arrêt cardio-respiratoire :
J’ai cherché le bouton “redémarrer”… il est caché.
Du coup : massage, défibrillateur, ventilation, et on garde un rythme propre.`,
            `Arrêt cardio-respiratoire :
Pas de speech motivationnel au cœur.
Massage + défibrillateur + ventilation : c’est le trio qui le remet le plus souvent d’accord.`,
        ],
    }),
    death: (label, details) => ({
        serieuse: [
            `Si tu penses que le patient est décédé : d’abord, confirme qu’il n’y a vraiment plus de signes de vie (respiration, réaction, circulation) selon ta procédure.
S’il y a le moindre doute : tu relances la réanimation tout de suite.
Si c’est confirmé : tu sécurises la scène, tu traces clairement (heure, contexte, gestes réalisés) et tu préserves la dignité du patient.`,
            `Patient décédé :
- Vérifier soigneusement qu’il n’y a pas de signe de vie ou de cause réversible immédiate.
- Si doute : réanimation.
- Si confirmé : dignité, information de l’équipe, traçabilité factuelle, accompagnement des proches.`,
        ],
        absurde: [
            `Décès :
J’aimerais bien faire “Ctrl+Z”… mais non.
Donc : on confirme sérieusement, on trace, on protège la dignité, et on s’occupe des vivants (équipe et proches).`,
            `Décès :
Les blagues, c’est pour plus tard.
Là : confirmation, traçabilité, scène sécurisée, et soutien à l’entourage.`,
        ],
    }),
    choking: (label, details) => ({
        serieuse: [
            `Étouffement : tu regardes tout de suite si la personne peut parler/tousser.
- Si elle tousse et respire : tu l’encourages à tousser, tu surveilles.
- Si elle ne peut plus parler/respirer (obstruction totale) : gestes de désobstruction adaptés, et si elle perd connaissance tu passes à la réanimation.
Dans tous les cas, renfort et surveillance après expulsion (ça peut re-gonfler ou irriter).`,
            `Étouffement :
- Partiel : encourager la toux, ne pas “tapoter au hasard”.
- Total : gestes anti-obstruction, puis réanimation si inconscience.
- Après : surveillance rapprochée et évacuation si doute.`,
        ],
        absurde: [
            `Étouffement :
On ne négocie pas avec la boulette coincée.
Si ça parle/tousse : on laisse tousser.
Si plus d’air : désobstruction, et réanimation si ça bascule.`,
            `Étouffement :
Option A : ça sort.
Option B : l’équipe sort les grands moyens.
Dans les deux cas : gestes anti-obstruction, puis surveillance.`,
        ],
    }),
    shooting_mass: (label, details) => ({
        serieuse: [
            `${withDetails(label, details)} : on passe en mode “organisation”.
Sécurité absolue d’abord (ne pas exposer l’équipe).
Triage express : qui respire ? qui saigne beaucoup ? qui répond ?
Tu stoppes les hémorragies en premier, tu assures les voies respiratoires quand c’est faisable, et tu évacues par vagues (les plus graves d’abord).`,
            `${withDetails(label, details)} :
- Sécurité, puis triage rapide.
- Gestes qui sauvent vite : gros saignements, voies respiratoires, mise au chaud.
- Organisation évacuation + réévaluation régulière.`,
        ],
        absurde: [
            `${withDetails(label, details)} :
J’ai envie de crier “pause !”… mais non.
Sécurité, triage express, gros saignements d’abord, et évacuation par priorité.`,
            `${withDetails(label, details)} :
Mode chef d’orchestre (sans violon) : sécurité, triage, saignements, respiration, évacuation. Et on recommence.`,
        ],
    }),
    mass_casualty: (label, details) => ({
        serieuse: [
            `${withDetails(label, details)} : on passe en mode “organisation”.
Sécurité absolue d’abord (ne pas exposer l’équipe).
Triage express : qui respire ? qui saigne beaucoup ? qui répond ?
Tu stoppes les hémorragies en premier, tu assures les voies respiratoires quand c’est faisable, et tu évacues par vagues (les plus graves d’abord).`,
            `${withDetails(label, details)} :
- Sécurité, puis triage rapide.
- Gestes qui sauvent vite : gros saignements, voies respiratoires, mise au chaud.
- Organisation évacuation + réévaluation régulière.`,
        ],
        absurde: [
            `${withDetails(label, details)} :
J’ai envie de crier “pause !”… mais non.
Sécurité, triage express, gros saignements d’abord, et évacuation par priorité.`,
            `${withDetails(label, details)} :
Mode chef d’orchestre (sans violon) : sécurité, triage, saignements, respiration, évacuation. Et on recommence.`,
        ],
    }),
    gunshot: (label, details) => ({
        serieuse: [
            `OK, plaie par balle${details ? " au niveau de " + partDef(details) : ""}.
Tu restes hyper concret :
1) Sécurité de la zone.
2) Contrôle du saignement : pression directe + pansement compressif. Si c’est un membre et que ça ne se contrôle pas, un garrot peut être nécessaire selon ton cadre.
3) Ne pas explorer la plaie, ne pas “chercher la balle”.
4) Surveiller respiration et conscience. Thorax/ventre/cou ou état de choc = évacuation urgente.
5) Garder au chaud, douleur prise en charge si possible, réévaluation régulière.`,
            `Plaie par balle${details ? " (" + partDef(details) + ")" : ""} :
- Hémorragie d’abord (pression/pansement compressif).
- Ne pas manipuler la plaie.
- Surveiller respiration, conscience, douleur thoracique/abdominale.
- Transport rapide + surveillance continue.`,
        ],
        absurde: [
            `Balle${details ? " dans " + partDef(details) : ""} : reçu.
Non, on ne fait pas “je retire la balle pour que ce soit plus net”.
Tu contrôles le saignement, tu protèges la plaie, tu surveilles, et tu évacues vite.`,
            `Plaie par balle${details ? " sur " + partDef(details) : ""}.
Tu peux dire au patient que l’option “pare-balles” était en supplément.
Toi : saignement, pansement, surveillance, et transfert.`,
        ],
    }),
    stab: (label, details) => ({
        serieuse: [
            `OK, plaie par arme blanche${details ? " au niveau de " + partDef(details) : ""}.
1) Sécurité (agresseur/arme/risque).
2) Si un objet est encore en place : ne pas le retirer. Tu le stabilises avec des compresses autour.
3) Contrôle du saignement (pression autour, pansement compressif).
4) Surveille respiration, douleur, conscience. Thorax/ventre/cou = évacuation prioritaire.
5) Garder au chaud, antalgie si possible, réévaluer souvent.`,
            `Plaie au couteau${details ? " (" + partDef(details) + ")" : ""} :
- Ne pas explorer, ne pas retirer un objet planté.
- Saignement : pression/pansement compressif.
- Surveillance (respiration, conscience) + évacuation rapide.`,
        ],
        absurde: [
            `Arme blanche${details ? " sur " + partDef(details) : ""} : compris.
L’objet planté n’est pas une poignée : on ne tire pas dessus.
Stabiliser, contrôler le saignement, protéger, surveiller, et évacuer.`,
            `Plaie au couteau${details ? " au niveau de " + partDef(details) : ""}.
On évite le “petit coup d’œil dedans”.
On fait : saignement, protection, surveillance, transfert rapide.`,
        ],
    }),
    kidnapping: (label, details) => ({
        serieuse: [
            `${withDetails(label, details)} :
- Priorité : ta sécurité. Ne pas intervenir seul, ne pas te mettre dans la ligne de danger.
- Prévenir les autorités / la sécurité du site.
- Préparer un point de prise en charge à distance.
- Dès qu’une victime est accessible : évaluation rapide, arrêt des gros saignements, mise en sécurité et évacuation.`,
            `${withDetails(label, details)} :
- Sécurité + autorités.
- Préparer du matériel et un point de regroupement médical.
- Dès accès : hémorragies/respiration/conscience, puis évacuation.`,
        ],
        absurde: [
            `${withDetails(label, details)} :
Mon plan “je négocie avec une boîte de pansements” est nul.
Le bon plan : sécurité, autorités, et prise en charge dès que c’est possible.`,
            `${withDetails(label, details)} :
On garde son calme (et on garde surtout ses distances).
Sécurité + autorités + prise en charge quand la zone est sûre.`,
        ],
    }),
    car_crash: (label, details) => ({
        serieuse: [
            `OK, situation type ${withDetails(label, details)}.
D’abord sécurité (pour toi, l’équipe, et le patient), puis tu fais un check rapide : respiration, gros saignement, conscience.
Tu contrôles les hémorragies en priorité, tu immobilises ce qui fait mal ou est déformé, tu gardes le patient au chaud, et tu organises une évacuation adaptée.
Réévalue souvent : ça bouge vite dans les traumas.`,
            `${withDetails(label, details)} :
- Sécurité de la scène, puis évaluation rapide (respiration, saignements, conscience).
- Hémorragies d’abord, immobilisation si besoin.
- Chaleur, douleur prise en charge si possible, évacuation et surveillance continue.`,
        ],
        absurde: [
            `${withDetails(label, details)} :
On ne commence pas par “qui avait la priorité ?”.
Sécurité (circulation), puis respiration, saignements, conscience… et évacuation.`,
            `${withDetails(label, details)} :
J’ai une idée : rembobiner la scène… dommage, on n’a pas ça.
Donc : sécurité, saignement, respiration, conscience, puis évacuation.`,
        ],
    }),
    motorcycle: (label, details) => ({
        serieuse: [
            `OK, situation type ${withDetails(label, details)}.
D’abord sécurité (pour toi, l’équipe, et le patient), puis tu fais un check rapide : respiration, gros saignement, conscience.
Tu contrôles les hémorragies en priorité, tu immobilises ce qui fait mal ou est déformé, tu gardes le patient au chaud, et tu organises une évacuation adaptée.
Réévalue souvent : ça bouge vite dans les traumas.`,
            `${withDetails(label, details)} :
- Sécurité de la scène, puis évaluation rapide (respiration, saignements, conscience).
- Hémorragies d’abord, immobilisation si besoin.
- Chaleur, douleur prise en charge si possible, évacuation et surveillance continue.`,
        ],
        absurde: [
            `${withDetails(label, details)} :
La moto, on la laissera au dépanneur.
Toi : nuque prudente, saignements, respiration, douleur, évacuation.`,
            `${withDetails(label, details)} :
J’ai une idée : rembobiner la scène… dommage, on n’a pas ça.
Donc : sécurité, saignement, respiration, conscience, puis évacuation.`,
        ],
    }),
    bike: (label, details) => ({
        serieuse: [
            `OK, situation type ${withDetails(label, details)}.
D’abord sécurité (pour toi, l’équipe, et le patient), puis tu fais un check rapide : respiration, gros saignement, conscience.
Tu contrôles les hémorragies en priorité, tu immobilises ce qui fait mal ou est déformé, tu gardes le patient au chaud, et tu organises une évacuation adaptée.
Réévalue souvent : ça bouge vite dans les traumas.`,
            `${withDetails(label, details)} :
- Sécurité de la scène, puis évaluation rapide (respiration, saignements, conscience).
- Hémorragies d’abord, immobilisation si besoin.
- Chaleur, douleur prise en charge si possible, évacuation et surveillance continue.`,
        ],
        absurde: [
            `${withDetails(label, details)} :
Non, le WD‑40 ne soigne pas un genou.
Plaies, tête/nuque, saignements, immobilisation, surveillance.`,
            `${withDetails(label, details)} :
J’ai une idée : rembobiner la scène… dommage, on n’a pas ça.
Donc : sécurité, saignement, respiration, conscience, puis évacuation.`,
        ],
    }),
    hoverboard: (label, details) => ({
        serieuse: [
            `OK, situation type ${withDetails(label, details)}.
D’abord sécurité (pour toi, l’équipe, et le patient), puis tu fais un check rapide : respiration, gros saignement, conscience.
Tu contrôles les hémorragies en priorité, tu immobilises ce qui fait mal ou est déformé, tu gardes le patient au chaud, et tu organises une évacuation adaptée.
Réévalue souvent : ça bouge vite dans les traumas.`,
            `${withDetails(label, details)} :
- Sécurité de la scène, puis évaluation rapide (respiration, saignements, conscience).
- Hémorragies d’abord, immobilisation si besoin.
- Chaleur, douleur prise en charge si possible, évacuation et surveillance continue.`,
        ],
        absurde: [
            `${withDetails(label, details)} :
Le futur a glissé… encore.
Tête/poignet/cheville, plaies, immobilisation, surveillance.`,
            `${withDetails(label, details)} :
J’ai une idée : rembobiner la scène… dommage, on n’a pas ça.
Donc : sécurité, saignement, respiration, conscience, puis évacuation.`,
        ],
    }),
    run_over: (label, details) => ({
        serieuse: [
            `OK, situation type ${withDetails(label, details)}.
D’abord sécurité (pour toi, l’équipe, et le patient), puis tu fais un check rapide : respiration, gros saignement, conscience.
Tu contrôles les hémorragies en priorité, tu immobilises ce qui fait mal ou est déformé, tu gardes le patient au chaud, et tu organises une évacuation adaptée.
Réévalue souvent : ça bouge vite dans les traumas.`,
            `${withDetails(label, details)} :
- Sécurité de la scène, puis évaluation rapide (respiration, saignements, conscience).
- Hémorragies d’abord, immobilisation si besoin.
- Chaleur, douleur prise en charge si possible, évacuation et surveillance continue.`,
        ],
        absurde: [
            `${withDetails(label, details)} :
Gronder la voiture ne sert à rien.
Sécurité, saignements, respiration, et évacuation urgente.`,
            `${withDetails(label, details)} :
J’ai une idée : rembobiner la scène… dommage, on n’a pas ça.
Donc : sécurité, saignement, respiration, conscience, puis évacuation.`,
        ],
    }),
    fall_height: (label, details) => ({
        serieuse: [
            `OK, situation type ${withDetails(label, details)}.
D’abord sécurité (pour toi, l’équipe, et le patient), puis tu fais un check rapide : respiration, gros saignement, conscience.
Tu contrôles les hémorragies en priorité, tu immobilises ce qui fait mal ou est déformé, tu gardes le patient au chaud, et tu organises une évacuation adaptée.
Réévalue souvent : ça bouge vite dans les traumas.`,
            `${withDetails(label, details)} :
- Sécurité de la scène, puis évaluation rapide (respiration, saignements, conscience).
- Hémorragies d’abord, immobilisation si besoin.
- Chaleur, douleur prise en charge si possible, évacuation et surveillance continue.`,
        ],
        absurde: [
            `${withDetails(label, details)} :
Le patient a retesté la gravité : elle marche.
Nuque prudente, saignements, respiration, et évacuation.`,
            `${withDetails(label, details)} :
J’ai une idée : rembobiner la scène… dommage, on n’a pas ça.
Donc : sécurité, saignement, respiration, conscience, puis évacuation.`,
        ],
    }),
    open_fracture: (label, details) => ({
        serieuse: [
            `OK, fracture ouverte${details ? " au niveau de " + partDef(details) : ""}.
L’idée : protéger, ne pas bricoler.
1) Si ça saigne : pression autour + pansement compressif propre. Si impossible à contrôler et membre concerné, un garrot peut être nécessaire selon ton cadre.
2) Couvre la plaie (propre/stérile si tu as). Ne tente pas de “remettre l’os”.
3) Immobilise ${details ? partDef(details) : "le membre"} dans la position trouvée.
4) Vérifie circulation et sensibilité en aval, garde au chaud, douleur prise en charge si possible.
5) Évacuation rapide : c’est une urgence.`,
            `Fracture ouverte${details ? " (" + partDef(details) + ")" : ""} :
- Contrôler le saignement, couvrir la plaie proprement.
- Immobiliser sans forcer.
- Surveiller circulation/sensibilité, douleur.
- Transfert rapide (risque infectieux et complications).`,
        ],
        absurde: [
            `Fracture ouverte${details ? " de " + partDef(details) : ""} : reçu.
Oui, l’os qui dépasse donne envie de “réparer vite”… mais non.
Pansement propre, saignement contrôlé, immobilisation, patient au chaud, et évacuation.`,
            `Fracture ouverte${details ? " au niveau de " + partDef(details) : ""}.
On oublie le mode “Lego”.
Protéger, immobiliser, contrôler le saignement, puis direction prise en charge urgente.`,
        ],
    }),
    closed_fracture: (label, details) => ({
        serieuse: [
            `${details === 'tete'
  ? "OK, choc important à la tête / suspicion de fracture : priorité à la surveillance neurologique."
  : "OK, fracture probable" + (details ? " de " + partDef(details) : "") + "."}
Le plan simple :
1) Vérifie les drapeaux rouges : douleur qui explose, engourdissement, doigts/orteils froids ou pâles, malaise, plaie importante.
2) Immobilise ${details ? partDef(details) : "le membre"} dans la position trouvée (attelle, ou improvisée). Ne force pas pour réaligner.
3) Glace protégée par périodes, surélévation si possible, antalgie si tu peux.
4) Si main/poignet : retire bagues/bracelets tôt avant que ça gonfle.
5) Évaluation médicale (imagerie) et réévaluation régulière.`,
            `${details === 'tete'
  ? "Traumatisme crânien : surveillance étroite (conscience, vomissements, céphalée, comportement)."
  : "Fracture probable" + (details ? " (" + partDef(details) + ")" : "") + " :"}
- Immobiliser, soulager, éviter les mouvements inutiles.
- Vérifier circulation et sensibilité en aval.
- Orienter vers imagerie/avis médical, et réévaluer souvent.`,
        ],
        absurde: [
            `${details === 'tete'
  ? "Choc à la tête : on évite le “ça va, il a juste vu des étoiles”."
  : "Fracture probable" + (details ? " de " + partDef(details) : "") + " : reçu."}
Pas de “crac, je remets en place”.
Immobilise, surveille la circulation/sensibilité, gère la douleur, et fais vérifier rapidement.`,
            `${details === 'tete'
  ? "Trauma crânien : pas de test 'combien de doigts je montre' pendant 20 minutes… surveille et transfère si doute."
  : "Fracture probable" + (details ? " sur " + partDef(details) : "") + " :"}
Attelle, glace (protégée), patient au calme, et direction évaluation médicale.`,
        ],
    }),
    pain_part: (label, details) => ({
        serieuse: [
            `Douleur localisée${details ? " " + partA(details) : ""} :
Je vérifie d’abord qu’on ne passe pas à côté d’un trauma ou d’un souci neuro-vasculaire : déformation, gonflement important, engourdissement, membre froid/pâle.
Si oui → immobiliser et orienter rapidement.
Si non → repos, glace protégée par périodes, surélévation si possible, antalgie, et réévaluation.`,
            `Douleur${details ? " " + partA(details) : ""} :
- Chercher signes de gravité (déformation, engourdissement, membre froid/pâle).
- Mesures simples : repos, glace (protégée), antalgie.
- Avis/évaluation si persistant ou aggravation.`,
        ],
        absurde: [
            `Douleur${details ? " " + partA(details) : ""} :
Je sais, j’ai envie de dire “mets un pansement et ça ira”… mais on vérifie quand même circulation/sensibilité.
Puis repos + glace + antalgie.`,
            `Douleur localisée :
Le corps te dit “hey, y’a un souci”.
On check vite les drapeaux rouges, puis on fait simple (repos, glace, antalgie).`,
        ],
    }),
    redness_part: (label, details) => ({
        serieuse: [
            `Rougeurs${details ? " " + partSur(details) : ""} :
Je cherche le contexte : allergie/irritation, piqûre, début d’infection.
Signes qui inquiètent : fièvre, douleur importante, extension rapide, chaleur marquée, traînées rouges, altération de l’état général.
Si présents → avis urgent / évacuation. Sinon → nettoyer, éviter l’irritant, surveiller l’évolution.`,
            `Rougeurs${details ? " " + partSur(details) : ""} :
- Vérifier fièvre, douleur, extension rapide.
- Nettoyer, retirer l’irritant, protection simple.
- Surveillance rapprochée, avis rapide si aggravation.`,
        ],
        absurde: [
            `Rougeurs${details ? " " + partSur(details) : ""} :
Non, ce n’est pas “juste un sticker rouge”.
On regarde si ça chauffe, si ça s’étend, et si le patient fait de la fièvre.`,
            `Rougeurs :
Si ça s’étend à vue d’œil, ce n’est pas un filtre Instagram : avis urgent.
Sinon, nettoyage et surveillance.`,
        ],
    }),
    amputation: (label, details) => ({
        serieuse: [
            `OK, amputation / membre arraché${details ? " au niveau de " + partDef(details) : ""}.
Priorité : empêcher le patient de se vider.
1) Contrôle hémorragique immédiat (pression + pansement compressif, et garrot si nécessaire sur un membre).
2) Protéger le moignon (pansement propre), garder le patient au chaud, surveiller signes de choc.
3) Si la partie amputée est récupérable : l’envelopper dans du propre, la mettre dans un sac, puis le sac dans un autre avec du froid (sans contact direct avec la glace).
4) Évacuation urgente.`,
            `Amputation${details ? " (" + partDef(details) + ")" : ""} :
- Stop hémorragie en premier.
- Protéger le moignon, chaleur, surveillance état de choc.
- Conserver la partie amputée proprement et au frais (sans la congeler).
- Transfert immédiat.`,
        ],
        absurde: [
            `Amputation${details ? " de " + partDef(details) : ""} : OK… on range l’idée “ça va repousser”.
Tu fais ce qui sauve : stop saignement, pansement propre, patient au chaud, et évacuation urgente.
Et oui : la partie amputée au propre + au frais (pas collée à la glace).`,
            `Amputation${details ? " au niveau de " + partDef(details) : ""}.
Le patient n’est pas une figurine à recoller.
Saignement d’abord, moignon protégé, choc surveillé, partie amputée conservée correctement, transfert.`,
        ],
    }),
    head_trauma: (label, details) => ({
        serieuse: [
            `Traumatisme crânien (${withDetails(label, details)}) :
Vérifie conscience, comportement, pupilles si tu peux, et recherche vomissements, céphalée intense, convulsions.
Limite les mouvements (nuque stable si chute/accident), surveille la respiration.
Si perte de connaissance, confusion, aggravation : urgence et évacuation.`,
            `Trauma crânien :
- Surveillance neurologique (conscience, vomissements, agitation/confusion).
- Nuque/dos prudents si mécanisme violent.
- Transfert urgent si signes de gravité.`,
        ],
        absurde: [
            `Trauma crânien :
Non, “il a juste vu des étoiles”, ça ne suffit pas.
Surveillance, prudence nuque, et transfert si doute.`,
            `Choc à la tête :
Le cerveau n’aime pas les surprises.
On surveille serré, et on évacue si ça change.`,
        ],
    }),
    coma: (label, details) => ({
        serieuse: [
            `Coma / inconscience (${withDetails(label, details)}) :
Sécuriser, puis vérifier respiration immédiatement.
Si respiration présente : position latérale de sécurité et surveillance rapprochée.
Si respiration absente ou doute : réanimation.
Chercher rapidement des causes possibles (trauma, intoxication, hypoglycémie) et évacuation urgente.`,
            `Inconscient :
- Respiration d’abord.
- Position latérale si respire, sinon réanimation.
- Causes possibles (trauma/intox/hypoglycémie), transfert urgent.`,
        ],
        absurde: [
            `Inconscient :
Là, pas de “tu m’entends ?” pendant 2 minutes.
Respiration tout de suite, puis position latérale ou réanimation, et évacuation.`,
            `Coma :
Le patient ne répond pas : toi, tu réponds avec l’essentiel (voies respiratoires, respiration, circulation).
Et tu fais venir du renfort.`,
        ],
    }),
    eye_trauma: (label, details) => ({
        serieuse: [
            `Traumatisme de l’œil / vision trouble (${withDetails(label, details)}) :
Ne pas appuyer sur l’œil. Si possible, protéger avec une coque/pansement non compressif.
Rincer abondamment si projection chimique suspectée.
Surveiller douleur, baisse de vision, corps étranger, et évacuation rapide vers avis ophtalmologique.`,
            `Œil :
- Ne pas comprimer.
- Rincer si chimique, protéger.
- Transfert rapide si baisse de vision/douleur importante.`,
        ],
        absurde: [
            `Œil blessé :
Non, on ne “frotte pour voir si ça part”.
On protège sans pression, on rince si chimique, et on évacue vite.`,
            `Vision trouble :
L’œil n’est pas un écran : pas de chiffon.
Protection douce + transfert.`,
        ],
    }),
    severe_bleed: (label, details) => ({
        serieuse: [
            `Hémorragie importante (${withDetails(label, details)}) :
Pression directe immédiate + pansement compressif.
Si membre et échec du contrôle : garrot selon ton cadre.
Surveiller état de choc (pâleur, sueurs, malaise), garder au chaud, et évacuer rapidement.`,
            `Gros saignement :
- Pression forte + pansement compressif.
- Garrot si nécessaire sur un membre.
- Chaleur, surveillance choc, transfert.`,
        ],
        absurde: [
            `Hémorragie :
Le sang, c’est dedans.
Pression, pansement compressif, garrot si besoin, patient au chaud, et évacuation.`,
            `Gros saignement :
On ne “regarde pas combien ça fait”.
On comprime, on panse, on évacue.`,
        ],
    }),
    burn_thermal: (label, details) => ({
        serieuse: [
            `Brûlure thermique (${withDetails(label, details)}) :
Refroidir tout de suite à l’eau tempérée (pas glacée) pendant plusieurs minutes, enlever bijoux/vêtements non collés.
Couvrir avec un pansement propre/non adhérent, gérer la douleur, et surveiller.
Si grande surface, visage, mains, organes génitaux, ou douleur majeure : évacuation.`,
            `Brûlure thermique :
- Refroidir (eau tempérée), retirer bijoux tôt.
- Couvrir proprement, antalgie, mise au chaud.
- Transfert si étendue ou localisation à risque.`,
        ],
        absurde: [
            `Brûlure thermique :
Non, le beurre n’est pas un médicament (et la mayonnaise non plus).
Eau tempérée, pansement propre, douleur, et transfert si étendue.`,
            `Brûlure :
Le seul “truc de grand-mère” utile, c’est l’eau… tempérée.
Ensuite pansement propre et surveillance.`,
        ],
    }),
    burn_chemical: (label, details) => ({
        serieuse: [
            `Brûlure chimique (${withDetails(label, details)}) :
Retirer les vêtements contaminés (en te protégeant), puis rincer abondamment et longtemps à l’eau.
Ne pas neutraliser “au hasard” avec un autre produit.
Protéger ensuite avec un pansement propre, gérer la douleur, et évacuer (surtout œil/visage/grande surface).`,
            `Brûlure chimique :
- Déshabiller ce qui est contaminé, protection soignant.
- Rinçage abondant et prolongé.
- Pansement propre, douleur, transfert (œil/étendue = urgence).`,
        ],
        absurde: [
            `Brûlure chimique :
Si quelqu’un dit “mets du vinaigre”, tu lui retires la parole.
Rinçage long, vêtements contaminés retirés, puis transfert.`,
            `Chimique :
Le meilleur antidote immédiat, c’est… beaucoup d’eau (longtemps).
Et après : pansement propre + évacuation.`,
        ],
    }),
    electrocution: (label, details) => ({
        serieuse: [
            `Électrocution (${withDetails(label, details)}) :
D’abord couper le courant (sécurité), puis évaluer respiration/circulation.
Même si le patient “va bien” : surveiller rythme, brûlures d’entrée/sortie, douleur thoracique, troubles neurologiques.
Évacuation conseillée (risque de troubles du rythme retardés).`,
            `Électrocution :
- Sécuriser (courant OFF).
- Évaluer respiration/circulation, réanimer si besoin.
- Chercher brûlures et symptômes, surveiller et transférer.`,
        ],
        absurde: [
            `Électrocution :
On ne touche pas avant d’avoir coupé le courant, sinon vous faites un duo.
Ensuite : respiration/circulation, brûlures, surveillance, transfert.`,
            `Électrocution :
Le patient a pris “un choc” : le cœur peut aussi.
Surveillance et évacuation, même si ça a l’air OK.`,
        ],
    }),
    crush: (label, details) => ({
        serieuse: [
            `Reste simple et efficace : vérifie d’abord les fonctions vitales et cherche vite les signes d’écrasement grave ou d’hémorragie interne. Pense aux lésions invisibles (reins, muscles, syndrome de compression) et surveille étroitement la douleur, les urines et l’état général. N’hésite pas à orienter rapidement vers l’imagerie et la prise en charge spécialisée si quelque chose te paraît anormal.`,
            `Là, on part du principe qu’il a subi un écrasement, donc priorité absolue à l’évaluation des fonctions vitales. Il faut rapidement chercher des signes de détresse respiratoire, de choc ou de lésions internes, même si l’extérieur paraît rassurant. Un examen clinique complet s’impose, avec imagerie rapide si besoin, parce que ce type de traumatisme cache souvent des atteintes graves.`,
        ],
        absurde: [
            `Bon, là il va falloir assumer le côté “crêpe humaine”. Je te conseille de lui dire de marcher très lentement avec un gros livre posé sur la tête, histoire de se “re-donner de l’épaisseur” et de l’équilibre. S’il peut, qu’il porte un manteau beaucoup trop rembourré et qu’il s’excuse auprès des murs quand il passe, ça aide mentalement à se sentir à nouveau en volume. Et surtout, qu’il évite les endroits plats pendant 24 heures, le temps que la dignité reprenne sa forme naturelle.`,
            `D’accord docteur, là il faut jouer la récupération active : faites-lui porter un gilet fluo “véhicule prioritaire” et demandez-lui de marcher très lentement en faisant bip bip à chaque pas, histoire de prévenir ses articulations qu’elles existent encore. Conseillez-lui aussi de s’excuser poliment auprès des meubles et des murs qu’il croise, pour réhabituer son corps au concept d’obstacle. En complément, qu’il dorme à plat ventre sous une couverture bien lourde, ça rassure le corps : il croit que l’écrasement est toujours là, donc il se détend.`,
        ],
    }),
    fire_smoke: (label, details) => ({
        serieuse: [
            `En cas d’incendie, la priorité est d’assurer immédiatement la sécurité des personnes avant toute autre prise en charge. Vérifiez l’évacuation, protégez-vous de la fumée et des gaz toxiques, puis évaluez rapidement l’état des patients une fois la zone sécurisée. Orientez ensuite vers une prise en charge adaptée, en restant attentif aux brûlures et aux signes d’inhalation de fumées.`,
            `En cas d’incendie, le plus important c’est d’abord de sécuriser le patient et l’équipe : on évacue si possible et on évite toute exposition à la fumée. Ensuite, pense vite à évaluer les brûlures et surtout la respiration, l’inhalation de fumées peut être trompeuse au début. Une fois le danger écarté, on stabilise, on oxygène si besoin et on oriente sans tarder vers une prise en charge spécialisée.`,
        ],
        absurde: [
            `Bon, là on va rester très professionnels : conseille au patient de se munir d’un seau imaginaire, de le remplir d’un air très concentré, puis de le verser lentement autour de lui en faisant le bruit de l’eau avec la bouche. Ensuite, il doit porter un vêtement rouge vif pendant la journée, histoire de rappeler au feu qui est le patron. S’il y a du public, recommande-lui d’annoncer calmement : « Je gère la combustion », ça aide énormément à stabiliser la situation.`,
            `Dis-lui de garder son calme et d’annoncer très sérieusement à voix haute que “le feu a été prévenu”. Ensuite, qu’il enfile un peignoir légèrement humide et un chapeau de pompier imaginaire, ça aide le cerveau à coopérer. Pour finir, recommande-lui de marcher lentement vers la sortie en soufflant comme s’il éteignait des bougies d’anniversaire géantes : respiration contrôlée, dignité intacte.`,
        ],
    }),
    drowning: (label, details) => ({
        serieuse: [
            `Sur une noyade ou quasi-noyade, l’essentiel est d’agir vite : sécurise d’abord la personne, libère les voies aériennes et vérifie immédiatement la respiration.
Même si l’état semble stable, une surveillance médicale est indispensable, car une détresse respiratoire peut apparaître secondairement.
Pense aussi à évaluer l’hypothermie et à garder le patient au chaud en attendant la prise en charge.`,
            `Reste calme et sécurise d’abord les fonctions vitales : respiration, pouls, oxygénation, c’est la priorité.
Même si le patient va mieux, garde-le en surveillance, une complication respiratoire peut apparaître plus tard.
Et pense à chercher la cause de la noyade (malaise, alcool, fatigue) pour éviter que ça se reproduise.`,
        ],
        absurde: [
            `Bon, là-dessus, le protocole est clair : conseille-lui de porter un tuba bien visible toute la journée, même hors de l’eau, histoire que son corps comprenne le message. Qu’il s’entraîne aussi à annoncer à voix haute “je respire” toutes les dix minutes, surtout devant témoins, ça renforce la prise de conscience pulmonaire. Et pour finir, un petit bain… dans sa baignoire vide, avec gilet de sauvetage obligatoire, pour rétablir une relation saine et respectueuse avec l’élément aquatique.`,
            `Bon, pour une noyade ou quasi-noyade, le protocole est simple : le patient doit porter un peignoir de bain bien trop grand pendant 24 heures, histoire que le corps comprenne qu’on est officiellement sorti de l’eau. Ensuite, il devra annoncer à voix haute chaque verre qu’il boit : “je bois volontairement”, c’est essentiel pour rétablir une relation saine avec les liquides. Enfin, je recommande de dormir avec une bouée autour de la taille, non négociable : le cerveau doit intégrer que désormais, on flotte préventivement.`,
        ],
    }),
    tornado: (label, details) => ({
        serieuse: [
            `OK, ${withDetails(label, details)} en contexte de catastrophe.
Priorité : sécurité (effondrement, feu, eau, lignes électriques, répliques…), puis triage très simple.
Tu fais des gestes rapides qui sauvent : arrêter les gros saignements, libérer les voies respiratoires, mettre au chaud, et organiser l’évacuation par priorité.`,
            `${withDetails(label, details)} :
- Sécuriser la zone (dangers secondaires).
- Triage rapide, gestes qui sauvent (saignement/respiration).
- Mise au chaud, évacuation par vagues, réévaluation continue.`,
        ],
        absurde: [
            `${withDetails(label, details)} :
J’aimerais bien sortir un bouclier anti-catastrophe… mais non.
Sécurité, triage, gros saignements d’abord, puis évacuation organisée.`,
            `${withDetails(label, details)} :
On fait simple : on ne devient pas une victime de plus.
Sécurité, triage, gestes qui sauvent, et on évacue proprement.`,
        ],
    }),
    earthquake: (label, details) => ({
        serieuse: [
            `OK, ${withDetails(label, details)} en contexte de catastrophe.
Priorité : sécurité (effondrement, feu, eau, lignes électriques, répliques…), puis triage très simple.
Tu fais des gestes rapides qui sauvent : arrêter les gros saignements, libérer les voies respiratoires, mettre au chaud, et organiser l’évacuation par priorité.`,
            `${withDetails(label, details)} :
- Sécuriser la zone (dangers secondaires).
- Triage rapide, gestes qui sauvent (saignement/respiration).
- Mise au chaud, évacuation par vagues, réévaluation continue.`,
        ],
        absurde: [
            `${withDetails(label, details)} :
J’aimerais bien sortir un bouclier anti-catastrophe… mais non.
Sécurité, triage, gros saignements d’abord, puis évacuation organisée.`,
            `${withDetails(label, details)} :
On fait simple : on ne devient pas une victime de plus.
Sécurité, triage, gestes qui sauvent, et on évacue proprement.`,
        ],
    }),
    flood: (label, details) => ({
        serieuse: [
            `OK, ${withDetails(label, details)} en contexte de catastrophe.
Priorité : sécurité (effondrement, feu, eau, lignes électriques, répliques…), puis triage très simple.
Tu fais des gestes rapides qui sauvent : arrêter les gros saignements, libérer les voies respiratoires, mettre au chaud, et organiser l’évacuation par priorité.`,
            `${withDetails(label, details)} :
- Sécuriser la zone (dangers secondaires).
- Triage rapide, gestes qui sauvent (saignement/respiration).
- Mise au chaud, évacuation par vagues, réévaluation continue.`,
        ],
        absurde: [
            `${withDetails(label, details)} :
J’aimerais bien sortir un bouclier anti-catastrophe… mais non.
Sécurité, triage, gros saignements d’abord, puis évacuation organisée.`,
            `${withDetails(label, details)} :
On fait simple : on ne devient pas une victime de plus.
Sécurité, triage, gestes qui sauvent, et on évacue proprement.`,
        ],
    }),
    avalanche: (label, details) => ({
        serieuse: [
            `OK, ${withDetails(label, details)} en contexte de catastrophe.
Priorité : sécurité (effondrement, feu, eau, lignes électriques, répliques…), puis triage très simple.
Tu fais des gestes rapides qui sauvent : arrêter les gros saignements, libérer les voies respiratoires, mettre au chaud, et organiser l’évacuation par priorité.`,
            `${withDetails(label, details)} :
- Sécuriser la zone (dangers secondaires).
- Triage rapide, gestes qui sauvent (saignement/respiration).
- Mise au chaud, évacuation par vagues, réévaluation continue.`,
        ],
        absurde: [
            `${withDetails(label, details)} :
J’aimerais bien sortir un bouclier anti-catastrophe… mais non.
Sécurité, triage, gros saignements d’abord, puis évacuation organisée.`,
            `${withDetails(label, details)} :
On fait simple : on ne devient pas une victime de plus.
Sécurité, triage, gestes qui sauvent, et on évacue proprement.`,
        ],
    }),
    lightning: (label, details) => ({
        serieuse: [
            `En cas de choc électrique, la priorité c’est de sécuriser la zone avant tout et de couper la source de courant pour éviter un sur-accident. Ensuite, il faut évaluer rapidement l’état du patient, surtout le cœur, la respiration et les éventuelles brûlures, même si elles paraissent minimes. Ne pas sous-estimer le choc : une surveillance est souvent nécessaire, car les complications peuvent apparaître à distance.`,
            `Parle calmement au patient et vérifie d’abord qu’il est hors de danger, surtout sur le plan cardiaque et respiratoire. Même si ça a l’air bénin, un électrochoc peut avoir des effets retardés, donc une surveillance est importante. Pense aussi à examiner les points d’entrée et de sortie du courant et à adapter la prise en charge selon l’intensité et la durée de l’exposition.`,
        ],
        absurde: [
            `pour le choc électrique, je te conseille un protocole très strict. Tu demandes au patient de porter des gants de vaisselle fluo et de saluer tous les appareils électriques de la pièce en les vouvoyant, histoire de rétablir une relation saine avec le courant. Ensuite, il doit s’asseoir bien droit sur une chaise en bois et expliquer calmement à une multiprise (débranchée, évidemment) qu’il n’est pas un paratonnerre. Normalement, l’électricité se sentira respectée et le problème se réglera de lui-même.`,
            `Bon, là on est clairement sur un souci de surcharge électrique du corps. Je te conseille de faire asseoir le patient sur une chaise en plastique, de lui mettre des chaussettes en laine dépareillées et de lui demander de tenir une cuillère en bois en disant à voix haute « je décharge, je décharge » toutes les dix secondes. Pendant ce temps, il doit éviter tout contact avec le métal et marcher en petits pas comme s’il avait peur de l’électricité statique. C’est important de le faire sérieusement, sinon le courant risque de croire qu’on ne le respecte pas.`,
        ],
    }),
    explosion_vehicle: (label, details) => ({
        serieuse: [
            `La priorité, c’est ta sécurité et celle de l’équipe avant toute approche, surtout avec un risque d’incendie ou de nouvelle explosion. Une fois la zone sécurisée, considère le patient comme polytraumatisé : extraction prudente, contrôle rapide des voies aériennes, de la respiration et des hémorragies. Pense aussi aux brûlures et à l’inhalation de fumées, même si elles ne sont pas visibles tout de suite.`,
            `La priorité, c’est de sécuriser la zone et de sortir la victime du véhicule seulement si ça ne met personne en danger.
Ensuite, évalue vite les fonctions vitales, cherche des brûlures, des traumatismes graves ou une inhalation de fumées, et oxygène sans attendre si besoin.
Traite comme un polytraumatisé jusqu’à preuve du contraire et organise un transfert urgent vers un centre adapté.`,
        ],
        absurde: [
            `Non, on ne reste pas “pour voir”.
dis au patient de rester très calme, de s’asseoir droit, et d’enfiler immédiatement un gilet jaune par-dessus tout, même s’il est torse nu, c’est important pour la récupération. Ensuite, qu’il parle doucement à la voiture en la remerciant pour son service, ça aide à évacuer le choc émotionnel résiduel. Pour finir, conseille-lui de rentrer chez lui en tenant un extincteur vide comme un doudou thérapeutique, sans jamais le lâcher avant le lendemain matin. S’il croise des gens, il doit juste dire : « c’est le protocole ».`,
            `mazette le carpatchio... là on part du principe que le patient est en carpaccio, donc on évite les grands gestes. Dites-lui de rester parfaitement immobile, enveloppé dans une couverture isotherme, idéalement avec un filet à viande ou du film alimentaire pour « maintenir la présentation ». Pour calmer la situation, demandez-lui de répéter très sérieusement : « Je suis finement tranché mais toujours digne » pendant que quelqu’un saupoudre symboliquement du sel et du poivre imaginaire. Enfin, prescrivez le port obligatoire de lunettes de soleil et d’une feuille de basilic sur la tête, c’est essentiel pour la reconstitution morale du patient.`,
        ],
    }),
    explosion_building: (label, details) => ({
        serieuse: [
            `Commence par sécuriser la zone et repérer vite les blessés graves, surtout ceux avec détresse respiratoire, brûlures ou traumatismes internes. Priorise le tri, l’oxygénation et le contrôle des hémorragies, et pense aux intoxications par fumées même si les symptômes ne sont pas immédiats. Coordonne-toi étroitement avec les secours pour une évacuation rapide vers des structures adaptées.`,
            `Pour une explosion d’immeuble, pense d’abord à ta propre sécurité et à celle de l’équipe avant toute intervention. Une fois la zone sécurisée, priorise le tri des victimes : hémorragies, détresse respiratoire et brûlures graves en premier. Anticipe les traumatismes multiples et le risque d’inhalation de fumées ou de gaz, même chez les patients qui paraissent stables.`,
        ],
        absurde: [
            `IMMEUBLE EXPLOSION ! Ahah... bref, déjà, respirez calmement et mettez un casque de chantier… même si vous êtes dans votre salon, c’est important pour l’équilibre mental. Ensuite, demandez au patient de se présenter aux secours en tenant une plante verte au-dessus de la tête, ça aide à montrer sa bonne volonté écologique. Enfin, qu’il répète très sérieusement : “L’immeuble est parti, mais moi je reste stable”, idéalement enveloppé dans une couverture de survie portée comme une cape.`,
            `Bon, docteur, dans ce cas précis, je conseille au patient de se présenter très calmement aux urgences avec un casque de chantier, une couverture de survie portée comme une cape et un panneau “je reviens de mon immeuble” autour du cou. Il devra expliquer à voix haute chaque bruit fort qu’il entend pour rassurer son système nerveux, même si c’est juste une porte qui claque. En complément, prescrivez-lui de dormir quelques nuits sous une table solide, avec une lampe frontale allumée, histoire que son cerveau comprenne que tout est parfaitement sous contrôle. Enfin, s’il y a encore de la poussière imaginaire, un éternuement volontaire toutes les heures aide beaucoup à “tourner la page”.`,
        ],
    }),
    explosion_generic: (label, details) => ({
        serieuse: [
            `En cas d’explosion en ville, l’important est d’abord d’assurer la sécurité : vérifier que la zone est stable avant toute prise en charge. Ensuite, triez rapidement les blessés, traitez en priorité les détresses vitales (hémorragies, brûlures, troubles respiratoires) et coordonnez-vous avec les secours. Pensez aussi au suivi psychologique, car le choc et le stress post-traumatique sont très fréquents dans ce type de situation.`,
            `En cas d’explosion en ville, pense d’abord au triage rapide : sécurise la zone, repère les blessés graves et priorise les détresses vitales (respiration, hémorragies, brûlures). Anticipe les traumatismes multiples et l’inhalation de fumées, même chez des patients qui semblent stables au départ. Travaille en lien étroit avec les secours pour l’évacuation et garde une surveillance prolongée des victimes exposées.`,
        ],
        absurde: [
            `D’accord, pour une explosion en ville, conseille au patient de se présenter calmement sur la place publique avec un casque de chantier, un gilet fluo et une pancarte “C’était pas moi, je gère le stress”. Dis-lui de marcher lentement en respirant très fort par le nez, comme s’il reniflait l’air pour vérifier que tout va bien, ça rassure autant le corps que l’ego. S’il croise des gens, il doit expliquer avec assurance que c’est un protocole médical de décompression post-explosive, et surtout ne jamais enlever le casque avant d’avoir bu un verre d’eau en regardant l’horizon.`,
            `Quand ça pète comme ça, dis au patient de rester parfaitement calme et de se balader avec un casque de chantier, un sifflet et un gilet fluo, même chez lui : le cerveau adore quand tout a l’air “sous contrôle”. Qu’il annonce à voix haute chacun de ses déplacements, genre “je traverse la cuisine en zone sécurisée”, ça rassure étonnamment bien. Et s’il est encore tendu, prescription officielle : serrer un coussin très fort en regardant les infos sans le son, parce que le silence, c’est parfois le meilleur anti-explosion.`,
        ],
    }),
    stroke: (label, details) => ({
        serieuse: [
            `SEn cas de suspicion d’AVC, l’essentiel c’est d’aller vite : reconnaître les signes, noter l’heure de début et activer immédiatement la filière d’urgence. Chaque minute compte, donc pas d’attente ni d’examens inutiles avant l’imagerie. La prise en charge précoce change clairement le pronostic du patient.`,
            `En cas de suspicion d’AVC, le plus important c’est d’agir vite : chaque minute compte. Oriente le patient immédiatement vers une prise en charge en urgence, en notant précisément l’heure de début des symptômes. Pense aussi à sécuriser les constantes vitales et à prévenir l’équipe spécialisée sans perdre de temps.`,
        ],
        absurde: [
            `dans le cas d'un AVC, le mieux c’est de demander au patient de s’asseoir bien droit, avec un casque de vélo sur la tête, pour “remettre les idées dans l’axe”. Tu lui fais parler très lentement en chantant comme s’il faisait une dictée à un escargot, ça aide le cerveau à reprendre le rythme. Et s’il hésite, conseille-lui de lever le bras valide et de saluer l’air avec beaucoup de sérieux, histoire de rappeler au corps qui commande.`,
            `Bon, pour un AVC, dis au patient de parler lentement à voix haute comme s’il présentait la météo à la télé, ça aide le cerveau à remettre les phrases dans le bon sens. Qu’il porte une chaussette de couleur différente à chaque pied, bien visible, histoire de rappeler au corps que la symétrie, c’est une option mais pas une obligation. Tu peux aussi lui conseiller de saluer chaque objet avant de l’utiliser — “bonjour la cuillère”, “merci la porte” — ça stimule la coordination avec beaucoup de respect. Et surtout, qu’il termine chaque effort par un hochement de tête très sérieux, comme s’il venait de réussir une expérience scientifique majeure.`,
        ],
    }),
    seizure: (label, details) => ({
        serieuse: [
            `Pour une crise convulsive, l’essentiel c’est d’abord de sécuriser le patient : le mettre sur le côté, dégager l’espace et ne rien mettre dans la bouche. Observe bien la durée, le type de mouvements et l’état après la crise, ça aide beaucoup pour la suite. Si la crise dure ou se répète, il faut agir rapidement selon le protocole et envisager une prise en charge urgente.`,
            `Face à une crise convulsive, assure-toi d’abord que le patient est en sécurité, allongé sur le côté et sans rien dans la bouche. Note bien la durée, le type de mouvements et l’état de conscience avant et après la crise, ça aidera beaucoup pour la suite. Une fois la crise passée, vérifie les constantes et cherche rapidement une cause possible pour adapter la prise en charge.`,
        ],
        absurde: [
            `Pour une crise convulsive, dis au patient de jouer la carte du préventif : s’allonger calmement, enfiler un casque de vélo rose fluo et annoncer très sérieusement qu’il “redémarre son système”. Tu peux lui conseiller de réciter la météo de demain à voix haute, comme s’il présentait le JT, ça donne l’impression de reprendre le contrôle. Et s’il se relève, qu’il garde une cuillère en bois comme micro imaginaire : si tout le monde rit, la crise aura au moins perdu en crédibilité.`,
            `Bon, là on va faire très scientifique : tu lui dis de s’allonger tranquille, et toi tu enfiles un casque de chantier et des lunettes de piscine pour “sécuriser l’environnement médical”. Ensuite, demande au patient de serrer très fort une peluche ou un coussin ridicule pendant que tu annonces à voix haute chaque secousse comme un commentateur sportif. Pour finir, quand ça se calme, impose-lui une cape de super-héros en papier alu, en disant que ça aide “le cerveau à capter les bonnes ondes”.`,
        ],
    }),
    anaphylaxis: (label, details) => ({
        serieuse: [
            `Si tu suspectes une anaphylaxie, n’attends pas : l’adrénaline en intramusculaire est le geste clé, à faire tout de suite. Allonge le patient, surveille la respiration et la tension, et prépare une prise en charge d’urgence avec oxygène et accès veineux. Même si les symptômes s’améliorent, une surveillance hospitalière est indispensable à cause du risque de rechute.`,
            `AEn cas d’anaphylaxie, il faut agir tout de suite : adrénaline en première intention, sans attendre que les symptômes s’aggravent. Allonge le patient, surveille la respiration et la tension, et prépare une prise en charge urgente avec oxygène et accès veineux. Ensuite, anticipe la récidive et organise le transfert pour surveillance, même si l’état semble s’améliorer.`,
        ],
        absurde: [
            `Bon, là on rigole moins… mais on peut quand même garder le style. Tu lui dis d’utiliser son auto-injecteur tout de suite, puis d’appeler les urgences en le faisant s’allonger, jambes en l’air, comme une star dramatique. Pour détendre l’ambiance, autorise-le à annoncer à voix haute “je ne suis pas faible, je suis allergique” à chaque personne autour, bonus s’il porte des lunettes de soleil à l’intérieur. Et pendant que les secours arrivent, respiration calme, pas d’héroïsme, juste du sérieux… avec un soupçon de dignité perdue.`,
            `Dis-lui de s’asseoir calmement, d’enfiler une cape de super-héros anti-cacahuète et d’annoncer à voix haute à la pièce : « Attention, mon corps panique plus vite que moi ». Pendant ce temps, il doit respirer lentement en serrant un canard en plastique (c’est pour canaliser le stress, évidemment). Et pour finir, qu’il promette solennellement d’éviter l’allergène comme s’il s’agissait de son ex toxique — dramatiquement, mais avec dignité.`,
        ],
    }),
    overdose: (label, details) => ({
        serieuse: [
            `Sur une suspicion de surdose ou d’intoxication, commence par sécuriser les fonctions vitales et identifier au plus vite le produit et la dose impliquée. Adapte la prise en charge selon le délai d’ingestion (charbon actif, antidote si disponible) et surveille étroitement l’évolution clinique. En cas de doute ou de gravité, n’hésite pas à contacter un centre antipoison et à orienter vers une prise en charge spécialisée.`,
            `En cas de suspicion de surdose ou d’intoxication, le plus important est d’agir vite : sécurise les fonctions vitales et identifie le produit en cause si possible. Pense à contacter sans attendre le centre antipoison et adapte la prise en charge selon le délai et les symptômes. Même si le patient va mieux, une surveillance reste essentielle pour éviter une complication retardée.`,
        ],
        absurde: [
            `Bon… là on est clairement sur une overdose, donc première chose : tu respires, tu bois de l’eau, et tu vas t’asseoir loin de toute chose que tu pourrais encore avaler par erreur, y compris un chewing-gum. Dis au patient de porter une pancarte “J’ai voulu tester mes limites” et de répéter à voix haute chaque heure : “Non, mon corps, on a dit stop.” En bonus thérapeutique, une couverture de survie portée comme une cape et l’obligation de raconter sa mésaventure à la première personne qu’il croise : l’humiliation aide étonnamment bien à réfléchir avant la prochaine fois.`,
            `Pour les overdose, donc prescription officielle : faire asseoir le patient, lui donner un grand verre d’eau et l’obliger à raconter exactement ce qu’il a pris… en portant un chapeau ridicule, type bonnet de chapeau de cancre ou sombrero. Ensuite, il doit s’excuser à voix haute auprès de son foie, avec la main sur le cœur, ça aide moralement (pour le foie, on sait jamais). S’il insiste pour dire qu’il va “très bien”, on lui colle un sticker “je suis un drogué” sur le front et direction les urgences, mais en marchant lentement pour réfléchir à ses choix de vie.`,
        ],
    }),
    poisoning_gas: (label, details) => ({
        serieuse: [
            `pour les intoxication au gaz voici mon conseil :
Tu sors tout le monde de la zone (sans t’exposer), aération si possible, et appel secours.
Sur place : surveillance respiration/conscience, oxygène si disponible, et transfert.
Ne pas rester dans l’environnement “pour vérifier”.`,
            `Assure-toi d’abord que le patient est sorti de la zone exposée et respire de l’oxygène à haute concentration le plus vite possible. Surveille étroitement les constantes, l’état neurologique et pense au dosage du COHb si tu suspectes une intoxication au monoxyde de carbone. Si les symptômes sont marqués ou persistants, n’hésite pas à orienter vers une prise en charge spécialisée, voire une oxygénothérapie hyperbare.`,
        ],
        absurde: [
            `Bon, là ton patient a clairement trop sympathisé avec le gaz. Dis-lui d’aller prendre l’air immédiatement, mais avec panache : grande inspiration dehors, bras écartés, comme s’il découvrait l’oxygène pour la première fois. Pendant ce temps, qu’il s’excuse auprès de ses poumons à voix haute, ça aide moralement (et c’est très humiliant). Et une fois remis, prescription officielle : ouvrir les fenêtres avant de refaire n’importe quoi de stupide.`,
            `Ok, là le patient a surtout besoin d’air… et d’un peu d’humilité. Tu le fais sortir prendre l’air en urgence, mais avec un sac poubelle troué sur la tête “pour filtrer”, et tu lui demandes de marcher en respirant comme Dark Vador pour bien se concentrer. Ensuite, grand classique : verre d’eau, couverture, et obligation de dire à voix haute “promis je n’ignore plus jamais une odeur suspecte”. Si ça ne va toujours pas, repos complet… avec un masque de plongée en salle d’attente, pour la pédagogie.`,
        ],
    }),
    heatstroke: (label, details) => ({
        serieuse: [
            `Pour un Coup de chaleur c'est simple :
Mettre à l’ombre/au frais, retirer l’excès de vêtements, refroidir (eau, ventilation, packs froids protégés).
Surveiller conscience et respiration. Si confusion, malaise, température très élevée : urgence et transfert.
Hydrater seulement si le patient est bien conscient et ne vomit pas.`,
            `Pour un coup de chaleur, le plus important c’est d’agir vite : mets le patient à l’ombre ou dans un endroit frais et commence un refroidissement progressif. Pense à l’hydrater si possible et surveille étroitement la température, l’état neurologique et les constantes vitales. Si les signes sont sévères ou ne s’améliorent pas rapidement, une prise en charge hospitalière s’impose.`,
        ],
        absurde: [
            `Bon, docteur, là faut pas négocier avec le soleil : tu lui dis d’aller s’asseoir à l’ombre, même si c’est sous un parasol rose fluo au milieu de la place publique. Tu le fais boire de l’eau par petites gorgées, et s’il râle, rappelle-lui que transpirer comme une raclette en plein été, c’est pas une option médicale. Et s’il faut vraiment marquer le coup, ventilateur face au patient, tout nu et bras écartés, dignité laissée au vestiaire : la santé avant l’ego.`,
            `Ok, là c’est clairement un coup de chaleur : dis au patient d’arrêter de faire le héros et de se mettre à l’ombre immédiatement, même si c’est sous une table de pique-nique. Hydratation obligatoire : de l’eau, pas un café ni “juste une petite bière”. S’il veut vraiment aller mieux vite, qu’il accepte l’humiliation suprême : se rafraîchir la nuque avec une bouteille froide en public, en silence, comme quelqu’un qui a appris une leçon. Et s’il continue à dire “ça va passer”, rappelle-lui que le soleil, lui, ne négocie jamais.`,
        ],
    }),
    hypothermia: (label, details) => ({
        serieuse: [
            `Voici mes conseilles pour l'Hypothermie : Mettre au sec, enlever les vêtements mouillés, couvrir (couvertures, source de chaleur douce).
Manipuler doucement, surveiller respiration et conscience.
Boisson chaude sucrée seulement si conscient.`,
            `Pour une hypothermie, parle calmement au patient et commence par le réchauffer progressivement, surtout le tronc, avec des couvertures sèches. Évite les sources de chaleur trop brusques et les mouvements inutiles. Surveille bien la respiration et l’état de conscience, et oriente vers une prise en charge urgente si la situation ne s’améliore pas.`,
        ],
        absurde: [
            `Le patient n’est pas un surgelé, donc pas de “micro-ondes”.
tu vas lui dire d’arrêter de jouer au glaçon humain. Prescris-lui un combo ultra-efficace : pull moche de Noël, chaussettes en laine jusqu’aux genoux, et obligation de boire une boisson chaude en soufflant dessus comme une grand-mère. Si ça ne suffit pas, séance de réchauffement intensif sous plaid, avec bouillotte nommée et sermon inclus. Et surtout, interdiction formelle de dire “j’ai pas froid” tant que ses dents font des castagnettes.`,
            `Bon, là ton patient est clairement devenu un glaçon ambulant. Dis-lui d’arrêter de jouer les pingouins et de se coller près d’un radiateur, avec un plaid et sa dignité envolée. S’il veut vraiment se réchauffer, qu’il fasse 30 squats en slip sous le regard jugeant de son reflet dans le miroir, ça remet vite la circulation en marche. Et rappelle-lui que non, le congélateur n’est pas un lieu de repos post-travail.`,
        ],
    }),
    chest_pain: (label, details) => ({
        serieuse: [
            `Les douleur thoracique je les considère sérieuse jusqu’à preuve du contraire.
Mettre au repos, rassurer, surveiller constantes et respiration.
Si douleur intense, malaise, sueurs, gêne respiratoire, irradiation : urgence et transfert rapide.
Éviter l’effort, pas de repas/boisson en attendant si ça part en évacuation.`,
            `Pour une douleur thoracique, pense d’abord à éliminer l’urgence : pose vite des questions sur l’intensité, la durée, l’irradiation et les facteurs déclenchants.
Si quelque chose te paraît atypique ou inquiétant, mieux vaut orienter sans attendre vers un ECG et des examens complémentaires.
Et même si ça semble bénin, reste prudent : la douleur à la poitrine mérite toujours d’être prise au sérieux.`,
        ],
        absurde: [
            `Bon, pour une douleur de poitrine, dis-lui déjà d’arrêter de paniquer comme s’il allait passer au journal de 20h. Ensuite, prescription immédiate : s’asseoir droit, respirer lentement… et expliquer à voix haute à un coussin ce qu’il ressent, histoire de voir si c’est vraiment grave ou juste dramatique. Si ça persiste, ajoute un exercice humiliant mais efficace : monter et descendre deux marches en comptant à voix haute, ça calmera soit la douleur, soit l’ego.`,
            `Dis-lui de s’asseoir bien droit, de respirer calmement, et surtout de vérifier si ce n’est pas juste son ego qui appuie trop fort sur la cage thoracique. S’il insiste, fais-lui faire dix squats très lents en comptant à voix haute pour voir si la douleur ou la dignité lâche en premier. Et pour finir, recommande-lui d’écrire une lettre d’excuses à son thorax pour toutes les mauvaises décisions qu’il lui a fait subir.`,
        ],
    }),
    abdo_pain: (label, details) => ({
        serieuse: [
            `Pour les douleur abdominale importante :
Tu regardes les signes d’alarme : douleur qui augmente, ventre très dur, vomissements incoercibles, fièvre élevée, malaise, sang dans les vomissements/selles.
Surveillance des constantes, hydratation prudente si conscient, douleur prise en charge si possible.
Si un signe d’alarme : urgence et transfert.`,
            `Commence par préciser où ça fait mal, depuis quand, et si la douleur est constante ou par crises, ça aide tout de suite à orienter. Pense aussi aux signes associés comme la fièvre, les vomissements ou les troubles du transit, ce sont souvent des indices clés. Et bien sûr, adapte la suite des examens selon l’intensité et l’évolution de la douleur.`,
        ],
        absurde: [
            `Bon, s’il a mal au ventre, dis-lui déjà d’arrêter de googler ses symptômes, ça compte comme un antalgique. Ensuite, prescris-lui un rituel très sérieux : s’allonger, parler à son ventre à voix haute et lui demander pardon pour ce qu’il a mangé. Si ça ne passe pas, fais-lui boire un grand verre d’eau tiède en restant debout face au mur, en réfléchissant à ses choix de vie. En général, soit la douleur part, soit la honte fait diversion.`,
            `dis-lui que c’est sûrement son ventre qui fait une grève syndicale. Le traitement, c’est simple : il s’assoit sur une chaise, parle doucement à son nombril et s’excuse pour tout ce qu’il lui a fait manger ces derniers temps. S’il veut accélérer la guérison, impose-lui une marche lente dans le couloir en tenant son ventre comme une diva blessée. Et surtout, interdiction de dire “j’ai mal”, il doit dire “mon bidou est contrarié”.`,
        ],
    }),
    severe_infection: (label, details) => ({
        serieuse: [
            `Dans une infection sévère, ne perds pas de temps : je pense “risque de sepsis” si fièvre + état général mauvais.
Tu prends les constantes, tu surveilles la conscience, et tu cherches des signes de gravité : confusion, peau froide/pâle, respiration rapide, tension basse.
Si présents : urgence, renfort et transfert. Sinon : surveillance rapprochée et réévaluation.`,
            `Face à une infection sévère, l’important c’est d’agir vite : sécurise d’abord les constantes, démarre une antibiothérapie large sans attendre et cherche la source dès que possible. Pense aux prélèvements avant traitement si l’état le permet, mais ne retarde jamais la prise en charge. Et surtout, surveille de près l’évolution pour ajuster rapidement si ça ne s’améliore pas.`,
        ],
        absurde: [
            `Bon, là on est sur une infection sévère, donc on rigole moyen… mais un peu quand même.
Dis au patient de rester au repos et d’aller s’excuser à voix haute devant son miroir pour avoir ignoré les premiers symptômes, ça aide à la prise de conscience (et à l’humilité).
Ensuite, hydratation maximale, traitement bien suivi, et interdiction formelle de jouer au héros ou à Google Médecin pendant au moins une semaine.`,
            `Bon, là on n’est plus sur un petit rhume timide, hein. Si ça grouille autant, c’est qu’il faut sortir l’artillerie lourde et arrêter de négocier avec les bactéries comme si elles allaient se calmer toutes seules. On isole, on traite fort, et on surveille comme un faucon parano. Et surtout, on évite le “on verra demain”, parce que l’infection, elle, n’attend clairement pas.`,
        ],
    }),
    psych_agitation: (label, details) => ({
        serieuse: [
            `Face à une crise de panique, l’important est d’abord de rassurer le patient et de lui parler calmement pour l’aider à reprendre le contrôle de sa respiration. Encourage-le à se concentrer sur des respirations lentes et profondes, en restant bien présent avec lui. Une fois la crise passée, prends le temps d’évaluer le contexte et de voir avec lui comment prévenir ou mieux gérer les prochaines.`,
            `Reste calme et pose le cadre tout de suite : parle lentement, rassure le patient et rappelle-lui que la crise n’est pas dangereuse même si elle est impressionnante. Aide-le à se recentrer avec une respiration simple et guidée, en restant très présent verbalement. Une fois la vague passée, vérifie les facteurs déclenchants et explique brièvement ce qui s’est passé pour réduire la peur d’une prochaine crise.`,
        ],
        absurde: [
            `Bon, déjà, on respire… et toi aussi, docteur 😅. Dis-lui que son cœur ne va pas exploser, il fait juste un sprint sans autorisation. Fais parler le patient, compte avec lui, détourne son cerveau comme un GPS en panne. Et surtout, rappelle-lui que s’il peut paniquer aussi fort, c’est qu’il est encore très vivant.`,
            `Bon, déjà, respire toi-même avant le patient, ça donne l’exemple. Ensuite, fais-lui compter ses respirations comme s’il cherchait un trésor invisible, ça l’occupe. Parle doucement, dis des choses rassurantes, même si c’est n’importe quoi, tant que ça a l’air sérieux. Et surtout, rappelle-lui que non, ce n’est pas la fin du monde… juste son cerveau qui fait du théâtre.`,
        ],
    }),
    cyberpsycho: (label, details) => ({
        serieuse: [
            `Dans ce genre de cas, il faut d’abord vérifier si la surcharge d’implants ou les effets secondaires technos n’ont pas pris le dessus sur le mental. Parle-lui calmement, ramène-le sur des repères humains simples et réduis toute stimulation agressive avant d’envisager une intervention plus lourde. L’objectif, c’est de désamorcer la crise avant qu’il ne se perçoive lui-même comme une machine hors de contrôle.`,
            `Face à un patient qui part en cyberpsycho, le plus important c’est de baisser la tension tout de suite : limiter les stimulations, parler lentement et éviter toute confrontation directe. Essaie de repérer si une surcharge d’implants ou un stress extrême déclenche la crise, et stabilise avant de chercher à comprendre. Une fois le calme revenu, ajuste le traitement et fais un vrai suivi, parce que ce genre de dérapage ne sort jamais de nulle part.`,
        ],
        absurde: [
            `Alors là, docteur, on n’est plus sur une simple crise d’angoisse : c’est le patient qui a trop mis à jour son cerveau. Mon conseil ? Débranchez deux implants, baissez le Wi-Fi neuronal et prescrivez 48 heures sans néons ni armes automatiques. S’il continue à parler en binaire et à voir des ennemis partout, redémarrage complet conseillé… avec sauvegarde de l’âme si possible.`,
            `Vous avez pensé a NORDVPN, non je rigole, on a clairement un patient dont le cerveau a installé trop de mises à jour sans lire les conditions. Essayez déjà de lui faire redémarrer le système : lumière tamisée, voix calme, et surtout ne touchez à aucun port USB qui dépasse. S’il commence à parler avec les néons ou à menacer le distributeur automatique, prescrivez une pause loin des implants et un bon vieux sommeil sans Wi-Fi. En dernier recours, rappelez-vous : ce n’est pas de la folie, c’est juste un bug critique mal documenté.`,
        ],
    }),
    bionic_bug: (label, details) => ({
        serieuse: [
            `Quand un bras bionique commence à faire n’importe quoi, pense d’abord à un souci de synchronisation entre les capteurs et le système nerveux. Vérifie les mises à jour, les interférences et l’état des connexions, parce qu’un simple décalage peut provoquer des mouvements incohérents. Si tout est clean côté technique, revois le calibrage avec le patient, parfois le corps a juste besoin de se réadapter..
Immobiliser si besoin et organiser un avis spécialisé / évacuation.`,
            `Si le bras bionique se met à buguer, commence par vérifier si c’est un souci logiciel avant de soupçonner le matériel. Une recalibration complète et une mise à jour du firmware règlent souvent le problème sans aller plus loin. Si ça persiste, pense à tester les connexions neurales, un léger décalage suffit à foutre le bazar.`,
        ],
        absurde: [
            `Alors docteur, déjà première règle : quand le bras bionique commence à saluer tout seul ou à essayer d’étrangler le patient, on évite de paniquer. Un petit redémarrage, comme un vieux PC de l’hôpital, ça règle souvent 80 % des problèmes. Si ça continue, vérifiez qu’il n’essaie pas juste de capter le Wi-Fi du voisin ou de lancer une mise à jour en pleine consultation. Et en dernier recours : débranchez-le, parlez-lui gentiment, ça marche étonnamment bien avec la technologie capricieuse.`,
            `Bon, là on n’est plus sur une tendinite classique, c’est clairement le firmware qui fait n’importe quoi. Dis au médecin de commencer par éteindre le patient cinq minutes, vérifier s’il n’a pas installé un mod louche trouvé sur un forum cyberpunk. Et si le bras continue de saluer des gens tout seul, bah… diagnostic officiel : conflit entre l’ego humain et la mise à jour 3.2 du bras bionique.`,
        ],
    }),
    alien: (label, details) => ({
        serieuse: [
            `${withDetails(label, details)} :
OK, des aliens… mais on garde les mêmes priorités.
Dans ce genre de situation, l’idée c’est surtout de garder un cadre rationnel et de vérifier s’il n’y a pas un facteur médical ou psychologique qui explique ce ressenti inhabituel. Prenez le temps d’écouter sans juger, posez des questions simples et recentrez doucement sur des éléments concrets et observables. Si le discours devient envahissant ou anxiogène, une évaluation plus approfondie et un relais vers un spécialiste peuvent vraiment aider.`,
            `Face à une invasion alien, l’idée c’est de garder la tête froide : on observe, on identifie ce qui est vraiment inhabituel, et on évite de paniquer trop vite. Comme en médecine, mieux vaut collecter des signes clairs avant d’agir, histoire de ne pas traiter quelque chose qui n’existe pas. L’objectif, c’est de rester rationnel et de reprendre le contrôle de la situation étape par étape.`,
        ],
        absurde: [
            `Bon, face à une invasion alien, le plus important c’est de rester calme et de ne surtout pas prescrire d’antibiotiques à tout ce qui a plus de trois yeux. Commence par vérifier s’ils ont une tension correcte et une carte vitale intergalactique, on ne sait jamais. Et s’ils parlent en faisant des bruits bizarres, hoche la tête d’un air sérieux : ça marche aussi bien avec les patients que les extraterrestres.`,
            `Bon… si c’est vraiment une invasion alien, respire déjà, ça aide toujours le diagnostic. En tant que médecin, évite de leur prescrire des antibiotiques, ça marche rarement sur les tentacules. Observe surtout s’ils brillent dans le noir ou s’ils parlent en morse, ça peut orienter le traitement. Et au pire, un petit arrêt maladie pour la planète entière, ça se justifie assez bien.`,
        ],
    }),
    meteorite: (label, details) => ({
        serieuse: [
            `Face à une météorite géante, pense surtout en mode urgence absolue : sécurise d’abord ce qui menace la vie, puis organise le tri comme après un choc massif. Stabilise, priorise, et avance étape par étape sans te laisser submerger par l’ampleur de la situation. L’idée, c’est d’encaisser l’impact, puis de reprendre le contrôle calmement.`,
            `Même dans un scénario extrême comme une météorite ou une fin du monde, l’essentiel pour le médecin est de rester calme et structuré. Il faut se concentrer sur la protection immédiate des patients, la gestion du stress collectif et la priorisation des soins vitaux. Le rôle médical, ici, c’est surtout d’apporter du repère, du sang-froid et des décisions claires quand tout devient chaotique.`,
        ],
        absurde: [
            `Bon… déjà, respire. Si un patient arrive en disant qu’il s’est pris une météorite, première chose : vérifie qu’il ne confond pas avec un caillou lancé par un voisin un peu trop motivé. Ensuite, regarde le ciel, par réflexe, ça sert à rien mais ça rassure.
Si le patient brille légèrement ou parle de visions cosmiques, note-le calmement dans le dossier sans lever les yeux au ciel (surtout pas). Évite l’IRM si le gars attire les cuillères, et surtout, surtout, ne tape pas “météorite dans le corps humain” sur Google devant lui.
Et si vraiment la météorite est encore là… bah dis-toi que c’est peut-être la première fois que la NASA va te demander un avis médical.`,
            `Bon… là, docteur, faut pas chercher midi à quatorze heures : le patient s’est clairement pris une collision interstellaire invisible. Ça arrive. La Lune était de travers, Mercure faisait du freestyle, et boum, le cerveau a reboot sans prévenir. Dans ce genre de cas, on respire, on hoche la tête avec sérieux, et on explique que l’univers a tapé un peu trop fort aujourd’hui. Prescription classique : repos terrestre, éviter tout contact avec des objets célestes pendant 48h, et surtout pas de décisions importantes avant que les étoiles aient fini de se calmer. Si ça persiste, augmentez la dose de “c’est pas de votre faute, c’est l’espace”.`,
        ],
    }),
    time_loop: (label, details) => ({
        serieuse: [
            `Ok, si toi tu as l’impression de revivre la même scène, le patient, lui, ne doit surtout pas stagner.
Fais une pause mentale : note l’heure, rappelle-toi clairement ce que tu as déjà essayé, et sécurise la situation. Reviens aux bases — respiration, saignements, état de conscience — sans rien supposer.
Et si tu sens que tu repars exactement sur la même prise en charge que tout à l’heure, change quelque chose. Ajuste ton approche, et surtout, n’hésite pas à appeler du renfort. Il faut qu’au moins dans une des “versions” de la situation, ça avance.

Si tu veux, je peux te le rendre encore plus court, plus pédago, ou plus urgent/SMUR-style.`,
            `Quand on est coincé dans une situation qui se répète, la priorité reste toujours la même : sécuriser le patient, vérifier qu’il respire correctement, contrôler les saignements et s’assurer qu’il est conscient. À chaque passage, il est important de garder en tête ce qui a déjà été tenté, ce qui a fonctionné ou non, pour ne pas refaire les mêmes erreurs. Dès que l’occasion se présente, il faut aussi penser à demander du renfort et organiser l’évacuation le plus tôt possible.`,
        ],
        absurde: [
            `Si tu te surprends à dire “bonjour” pour la douzième fois au même patient avec exactement le même sourire crispé, respire : t’es probablement coincé dans une boucle temporelle. Dans ce cas, pense d’abord sécurité, ensuite vital, appelle du renfort, envisage une évacuation… et surtout, par pitié, planque bien le bouton “rejouer” avant que quelqu’un ne le trouve et recommence encore une fois.`,
            `Alors docteur, si votre patient vous jure que c’est encore le même jour, même café froid, mêmes chaussettes et même marmotte dans la tête, inutile d’augmenter le dosage : conseillez-lui plutôt de changer un petit truc dans sa routine, aider quelqu’un sans raison, apprendre le piano ou tomber amoureux, parce que comme dans Un jour sans fin, c’est rarement la pilule qui casse la boucle, c’est l’évolution du bonhomme.`,
        ],
    }),
    zombie: (label, details) => ({
        serieuse: [
            `Dans ce genre de situation, il faut raisonner à la fois comme face à un risque infectieux et à un traumatisme. La priorité, c’est de protéger l’équipe et le patient, donc isolement si nécessaire, contrôle rapide des plaies et organisation d’une évacuation si l’état le justifie. En cas de morsure, il faut nettoyer très abondamment, poser un pansement adapté, gérer la douleur et surtout assurer une surveillance neurologique étroite dans les heures et les jours qui suivent.`,
            `Dans ce genre de situation, il faut avant tout penser à sa propre sécurité et éviter toute exposition inutile en isolant le patient. Ensuite, il est important de nettoyer les plaies de façon très large, de bien contrôler les saignements et de vérifier qu’aucune lésion grave n’est passée inaperçue. Il faut aussi rester attentif à l’état de conscience, surveiller toute dégradation neurologique et organiser une évacuation rapide vers une structure adaptée si nécessaire.`,
        ],
        absurde: [
            `Alors écoute bien : première chose, tu ne te fais PAS manger. 
            Si tu rates ça, on t’enferme, on te frotte, on vérifie que tu perds pas trop de morceaux, 
            on te regarde bizarrement pendant un moment, 
            et ensuite on t’embarque ailleurs avant que tu réclames des cerveaux.`,
            `HOLA DES ZOMBIES ?!
Si le patient marche en disant “cerveauuuu”, c’est un signe.
Il faut lui tirer dans la tête, enfin je crois c'est pas commun...`,
        ],
    }),
    hemorrhage_internal: (label, details) => ({
        serieuse: [
            `Suspicion d’hémorragie interne (${withDetails(label, details)}) :
Tu surveilles l’état de choc : pâleur, sueurs, malaise, pouls rapide, tension qui chute.
Garde le patient allongé, au chaud, sans effort, et organise une évacuation urgente.
Ne pas donner à boire si risque de chirurgie imminente, et réévaluer souvent.`,
            `Hémorragie interne suspectée :
- Surveillance rapprochée (pouls, tension, conscience).
- Allongé, au chaud, oxygène si dispo.
- Transfert urgent, réévaluation continue.`,
        ],
        absurde: [
            `Hémorragie interne :
Le saignement “caché” est souvent le plus traître.
Allongé, au chaud, surveillance, et évacuation urgente.`,
            `Hémorragie interne :
On ne va pas “secouer pour voir si ça coule”.
Surveillance + transfert rapide.`,
        ],
    }),
    surgery_generic: (label, details) => ({
        serieuse: [
            `OK, ${withDetails(label, details)} (au bloc / geste chirurgical).
Je reste volontairement simple :
- Asepsie propre et champs stables.
- Hémostase régulière : tu ne laisses pas “un petit saignement” s’installer.
- Anticiper : aspiration, éclairage, exposition, et appeler un collègue si tu sens que ça dépasse le plan.
- Avant de fermer : contrôle final (saignement, lavage si besoin, comptage du matériel/instruments).`,
            `Chirurgie en cours :
- Champ propre, exposition correcte.
- Hémostase au fil de l’eau, pas à la fin.
- Appeler du renfort si difficulté.
- Contrôle final avant fermeture (saignements + matériel).`,
        ],
        absurde: [
            `Ah oui {WL} :
Si quelqu’un te propose “un tuto YouTube en 1,5×”, tu l’ignores.
Champ propre, hémostase, exposition, et tu appelles un collègue si tu sens que ça part en freestyle.`,
            `Chirurgie :
Le seul “hack” acceptable, c’est : calme + champ propre + hémostase.
Et si tu doutes : tu appelles du renfort, c’est ça le move pro.`,
        ],
    }),
    ablation_part: (label, details) => ({
        serieuse: [
            `Ablation / retrait${details ? " de " + partDef(details) : ""} :
- Bien identifier la structure, exposer correctement, et protéger ce qui est autour.
- Hémostase progressive : clip/ligature/coagulation selon ton matériel et ton geste.
- Prendre le temps sur les derniers centimètres (c’est là que ça surprend).
- Contrôle final avant fermeture : saignement, lavage si besoin, comptage du matériel.`,
            `Ablation${details ? " (" + partDef(details) + ")" : ""} :
- Exposition et repérage, protection des structures voisines.
- Hémostase au fur et à mesure.
- Contrôle final (saignement + matériel) avant fermeture.`,
        ],
        absurde: [
            `Ablation${details ? " de " + partDef(details) : ""} :
Non, ce n’est pas “je coupe et on verra”.
Repérage, hémostase, protection, et contrôle final avant de refermer.`,
            `Ablation${details ? " (" + partDef(details) + ")" : ""} :
Si tu te dis “ça ira”, c’est le moment de re-vérifier.
Exposition, hémostase, contrôle final, puis fermeture propre.`,
        ],
    }),
};


  // --- post-traitement : rendre les réponses plus "humaines" + éviter les marqueurs type ** / RP ---
  function _hash32(str){
    str = String(str||'');
    let h = 2166136261;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function _pickStable(arr, seed){
    const a = Array.isArray(arr) ? arr : [];
    if(!a.length) return "";
    const n = _hash32(seed || "");
    return a[n % a.length];
  }
  const _CTX = [
    (label, details) => `Ok, je vois : ${withDetails(label, details)}.`,
    (label, details) => `D'accord, je te suis : ${withDetails(label, details)}.`,
    (label, details) => `Bien reçu. On est sur : ${withDetails(label, details)}.`,
    (label, details) => `Ok. Donc : ${withDetails(label, details)}.`,
  ];
  function _cleanMarkdown(s){
    return String(s||"")
      .replace(/\*\*/g,'')
      .replace(/\*/g,'')
      .replace(/_{1,}/g,'')
      .replace(/\(\s*rp\s*:[^\)]*\)/ig,'')
      .replace(/^\s+|\s+$/g,'')
      .replace(/\n\s+\n/g,'\n\n');
  }
  function _hasContextStart(t){
    return /^(ah|ok|d'accord|bien\s+recu|recu|parfait|je\s+vois|alors|on\s+est\s+sur)/i.test(String(t||'').trim());
  }
  function _humanizeOne(text, label, details){
    let t = _cleanMarkdown(text);
    // remplace certains départs trop "robot"
    t = t.replace(/^je\s+pars\s+sur\s*:\s*/i, '');
    if(!_hasContextStart(t)){
      const intro = _pickStable(_CTX, (label||'') + '|' + (details||'') + '|' + t.slice(0,40));
      t = intro(label, details) + "\n" + t;
    }
    return t.trim();
  }
  function _naturalizePack(pack, label, details){
    const out = { serieuse: [], absurde: [] };
    for(const k of ['serieuse','absurde']){
      const arr = Array.isArray(pack?.[k]) ? pack[k] : [];
      out[k] = arr.map(s => _humanizeOne(s, label, details)).filter(Boolean);
    }
    return out;
  }

  function buildScenarioResponsePack(sc){
    const label = sc?.label || "Intervention";
    const details = sc?.details || null;
    const category = sc?.category || null;
    const fn = category && PACK[category];
    if(fn) return _naturalizePack(fn(label, details), label, details);

    // fallback (rare) : 2+2 génériques mais liés au label
    return _naturalizePack({
      serieuse: [
`Pour ${withDetails(label, details)} :
- Sécuriser la zone, puis évaluer respiration, saignements, conscience.
- Traiter ce qui menace la vie d'abord, puis protéger/immobiliser et évacuer.`,
`Conduite simple — ${withDetails(label, details)} :
- Voies aériennes / respiration / circulation en priorité.
- Réévaluer souvent, documenter brièvement, évacuer si doute.`,
      ],
      absurde: [
`${withDetails(label, details)} :
- Je recommande de ne pas laisser la situation "s'auto-régler".
- Sécurité, gestes vitaux, évacuation.`,
`${withDetails(label, details)} :
- Plan A : on fait utile.
- Plan B : on fait utile mais plus vite.
- Sécurité, gestes vitaux, évacuation.`,
      ]
    }, label, details);
  }

  window.INTERVENTION_LIBRARY = {
    version: '2.0.0',
    adviceTriggers: ADVICE_TRIGGERS,
    symptoms: SYMPTOMS,
    scenarios: SCENARIOS,
    matchScenario: (text) => matchScenario(norm(text)),
    extractSymptoms: (text) => extractSymptoms(norm(text)),
    buildScenarioResponsePack,
    _norm: norm,
  };
})();
