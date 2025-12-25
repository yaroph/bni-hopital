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
            `Écrasement / coincé (${withDetails(label, details)}) :
Sécurité et libération seulement si c’est faisable sans ajouter de danger.
Ensuite : respiration, gros saignements, conscience, douleur.
Méfiance syndrome d’écrasement si compression prolongée : surveillance rapprochée, mise au chaud, et évacuation médicalisée.`,
            `Écrasement :
- Sécuriser et dégager prudemment.
- Hémorragies/respiration/conscience.
- Surveiller (risque retardé), douleur, évacuation.`,
        ],
        absurde: [
            `Écrasement :
Non, on ne “tire fort et basta”.
On sécurise, on libère prudemment, puis on surveille et on évacue.`,
            `Coincé :
La seule chose à écraser ici, c’est le risque.
Sécurité, dégagement prudent, surveillance, transfert.`,
        ],
    }),
    fire_smoke: (label, details) => ({
        serieuse: [
            `Incendie / inhalation de fumées (${withDetails(label, details)}) :
Sortir de la fumée (sécurité), oxygène si dispo, et surveillance de la respiration.
Chercher brûlures au visage, voix rauque, toux noire, gêne respiratoire : ça peut évoluer vite.
Évacuation et surveillance, suspicion intoxication au monoxyde si céphalées/malaise/confusion.`,
            `Fumées :
- Extraire du milieu, oxygène si possible.
- Surveiller respiration et signes de brûlure des voies aériennes.
- Transfert (risque d’aggravation + monoxyde).`,
        ],
        absurde: [
            `Fumées :
Le patient n’a pas “juste senti un peu”.
Sortie, oxygène, surveillance, et transfert (les voies aériennes sont rancunières).`,
            `Incendie :
On ne fait pas “un dernier aller-retour”.
On sort, on oxygène, on surveille, on évacue.`,
        ],
    }),
    drowning: (label, details) => ({
        serieuse: [
            `Noyade / quasi-noyade (${withDetails(label, details)}) :
Sécuriser le sauvetage, puis priorité aux voies respiratoires : ventilation si nécessaire.
Surveiller conscience et respiration (ça peut se dégrader après coup), mettre au chaud.
Évacuation et surveillance, même si le patient “semble aller mieux”.`,
            `Noyade :
- Sécurité, puis respiration d’abord (ventilation si besoin).
- Mise au chaud, surveillance.
- Transfert et observation (aggravation possible).`,
        ],
        absurde: [
            `Noyade :
Le patient a bu la piscine, pas un cocktail.
Respiration d’abord, puis chaleur + surveillance, et transfert.`,
            `Quasi-noyade :
Même si ça va mieux : les poumons aiment faire des surprises.
Surveillance et évacuation.`,
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
            `Foudroyé (${withDetails(label, details)}) :
Sécurise la zone (orage encore actif), puis check immédiat respiration/circulation.
La foudre peut provoquer un arrêt : si besoin, réanimation et défibrillateur.
Ensuite : brûlures, traumatisme de chute, troubles du rythme → surveillance et évacuation.`,
            `Foudre :
- Sécurité, puis évaluer respiration/circulation.
- Réanimation si arrêt.
- Rechercher brûlures/trauma, surveiller et évacuer.`,
        ],
        absurde: [
            `Foudre :
Oui, le patient a “pris le DLC Zeus”.
Tu fais : respiration/circulation d’abord, puis brûlures/trauma, et évacuation.`,
            `Foudroyé :
Ce n’est pas un power-up, c’est un vrai risque cardiaque.
Surveillance serrée et transfert.`,
        ],
    }),
    explosion_vehicle: (label, details) => ({
        serieuse: [
            `${withDetails(label, details)} (explosion) :
Sécuriser (risque secondaire), puis évaluer respiration/saignements/conscience.
Pense blessures “blast” : thorax, tympans, brûlures, éclats.
Contrôle hémorragique, oxygène si possible, pansements propres, et évacuation.`,
            `Explosion :
- Sécurité, puis triage rapide.
- Saignements/respiration d’abord.
- Rechercher brûlures, éclats, douleur thoracique, surdité.
- Surveillance + transfert.`,
        ],
        absurde: [
            `Explosion :
Non, on ne reste pas “pour voir”.
Sécurité, saignements, respiration, et transfert (avec une check-list blast/brûlures).`,
            `Explosion :
Le bruit, c’est impressionnant… les complications aussi.
Surveille, panse, oxygène si possible, et évacue.`,
        ],
    }),
    explosion_building: (label, details) => ({
        serieuse: [
            `${withDetails(label, details)} (explosion) :
Sécuriser (risque secondaire), puis évaluer respiration/saignements/conscience.
Pense blessures “blast” : thorax, tympans, brûlures, éclats.
Contrôle hémorragique, oxygène si possible, pansements propres, et évacuation.`,
            `Explosion :
- Sécurité, puis triage rapide.
- Saignements/respiration d’abord.
- Rechercher brûlures, éclats, douleur thoracique, surdité.
- Surveillance + transfert.`,
        ],
        absurde: [
            `Explosion :
Non, on ne reste pas “pour voir”.
Sécurité, saignements, respiration, et transfert (avec une check-list blast/brûlures).`,
            `Explosion :
Le bruit, c’est impressionnant… les complications aussi.
Surveille, panse, oxygène si possible, et évacue.`,
        ],
    }),
    explosion_generic: (label, details) => ({
        serieuse: [
            `${withDetails(label, details)} (explosion) :
Sécuriser (risque secondaire), puis évaluer respiration/saignements/conscience.
Pense blessures “blast” : thorax, tympans, brûlures, éclats.
Contrôle hémorragique, oxygène si possible, pansements propres, et évacuation.`,
            `Explosion :
- Sécurité, puis triage rapide.
- Saignements/respiration d’abord.
- Rechercher brûlures, éclats, douleur thoracique, surdité.
- Surveillance + transfert.`,
        ],
        absurde: [
            `Explosion :
Non, on ne reste pas “pour voir”.
Sécurité, saignements, respiration, et transfert (avec une check-list blast/brûlures).`,
            `Explosion :
Le bruit, c’est impressionnant… les complications aussi.
Surveille, panse, oxygène si possible, et évacue.`,
        ],
    }),
    stroke: (label, details) => ({
        serieuse: [
            `Suspicion d’AVC (${withDetails(label, details)}).
Tu notes l’heure de début (ou “dernière fois vu normal”), et tu déclenches une prise en charge urgente.
Sur place : surveille respiration et conscience, glycémie si possible, pas à boire/à manger, et transfert rapide vers une structure adaptée.`,
            `AVC suspecté :
- Visage/bras/parole anormaux = urgence.
- Heure de début, constantes, glycémie si possible.
- Pas d’aliments/boissons, transfert rapide.`,
        ],
        absurde: [
            `AVC suspecté :
Non, on ne “attend pas pour voir si ça passe”.
On note l’heure, on alerte, on surveille, et on transfère vite.`,
            `AVC :
Le cerveau n’aime pas les délais.
Heure de début, surveillance, et direction filière AVC.`,
        ],
    }),
    seizure: (label, details) => ({
        serieuse: [
            `Crise convulsive (${withDetails(label, details)}) :
Tu protèges la personne des chocs (enlever objets dangereux, protéger la tête), sans la retenir.
Tu chronomètres. Après la crise : position latérale de sécurité si somnolence, surveillance de la respiration.
Si crise prolongée, répétée, ou première crise : renfort/urgence.`,
            `Crise convulsive :
- Protéger sans contraindre, ne rien mettre dans la bouche.
- Chronométrer.
- Après : position latérale si besoin, surveillance, appel si prolongée/récidive/1ère fois.`,
        ],
        absurde: [
            `Crise convulsive :
Le patient ne “joue pas la scène”, donc pas de lutte corps à corps.
Tu sécurises, tu chronomètres, puis position latérale et surveillance.`,
            `Crise convulsive :
La cuillère dans la bouche, c’est non.
Sécuriser, chronométrer, surveiller, et appeler si ça dure.`,
        ],
    }),
    anaphylaxis: (label, details) => ({
        serieuse: [
            `Allergie sévère / anaphylaxie (${withDetails(label, details)}) : urgence.
Si auto-injecteur d’adrénaline disponible : l’utiliser rapidement.
Allonger le patient (jambes surélevées si malaise), oxygène si dispo, surveillance respiration.
Appeler renfort et prévoir évacuation, car ça peut re-chuter.`,
            `Anaphylaxie :
- Adrénaline IM si disponible.
- Position allongée, surveillance respiratoire, oxygène si possible.
- Renfort + évacuation, réévaluation fréquente.`,
        ],
        absurde: [
            `Anaphylaxie :
Là, on n’essaie pas “un petit verre d’eau et ça ira”.
Adrénaline si dispo, surveillance serrée, et renfort en route.`,
            `Allergie grave :
Le corps fait une crise de drama… et c’est dangereux.
Adrénaline, position allongée, surveillance, évacuation.`,
        ],
    }),
    overdose: (label, details) => ({
        serieuse: [
            `Surdose / intoxication (${withDetails(label, details)}) :
Sécurité (produits, aiguilles, fumées), puis vérifier respiration et conscience.
Si respiration lente/inefficace : ventilation, appel renfort, et naloxone si suspicion d’opioïdes et disponible.
Surveiller étroitement, position latérale si somnolence, évacuation.`,
            `Surdose :
- Sécuriser la scène, évaluer respiration/conscience.
- Ventiler si besoin, appeler renfort.
- Naloxone si opioïdes suspectés et disponible.
- Surveillance + transfert.`,
        ],
        absurde: [
            `Surdose :
J’aimerais bien demander au patient “tu peux respirer un peu plus ?”… mais on va faire mieux.
On sécurise, on ventile si besoin, renfort, et naloxone si adaptée.`,
            `Intoxication :
Pas de jugement, juste de l’air qui rentre.
Respiration d’abord, puis renfort et transfert.`,
        ],
    }),
    poisoning_gas: (label, details) => ({
        serieuse: [
            `Intoxication au gaz (${withDetails(label, details)}) :
Tu sors tout le monde de la zone (sans t’exposer), aération si possible, et appel secours.
Sur place : surveillance respiration/conscience, oxygène si disponible, et transfert.
Ne pas rester dans l’environnement “pour vérifier”.`,
            `Gaz / monoxyde suspect :
- Évacuer et ventiler les lieux.
- Surveillance, oxygène si possible.
- Renfort et transfert (risque d’aggravation).`,
        ],
        absurde: [
            `Gaz :
Si tu sens “ça pique” : c’est déjà trop tard pour rester.
On évacue, on ventile, on surveille, et on transfère.`,
            `Intoxication au gaz :
Le seul bon réflexe : sortir, aérer, appeler, oxygéner.
Les héros qui restent, on n’en veut pas.`,
        ],
    }),
    heatstroke: (label, details) => ({
        serieuse: [
            `Coup de chaleur (${withDetails(label, details)}) :
Mettre à l’ombre/au frais, retirer l’excès de vêtements, refroidir (eau, ventilation, packs froids protégés).
Surveiller conscience et respiration. Si confusion, malaise, température très élevée : urgence et transfert.
Hydrater seulement si le patient est bien conscient et ne vomit pas.`,
            `Coup de chaleur :
- Refroidir activement (ombre, eau, ventilation).
- Surveiller conscience/respiration.
- Urgence si confusion, malaise, aggravation. Transfert.`,
        ],
        absurde: [
            `Coup de chaleur :
Le patient a “surchauffé”. Pas de riz, pas de reboot.
On refroidit vite, on surveille, et on transfère si signes de gravité.`,
            `Coup de chaleur :
La clim, c’est ton meilleur ami.
Frais, eau, ventilation, surveillance, et urgence si confusion.`,
        ],
    }),
    hypothermia: (label, details) => ({
        serieuse: [
            `Hypothermie (${withDetails(label, details)}) :
Mettre au sec, enlever les vêtements mouillés, couvrir (couvertures, source de chaleur douce).
Manipuler doucement, surveiller respiration et conscience.
Boisson chaude sucrée seulement si conscient. Transfert si frissons intenses, confusion, ou somnolence.`,
            `Hypothermie :
- Sec + couvrir + réchauffer progressivement.
- Manipulation douce, surveillance.
- Transfert si confusion/somnolence ou état qui s’aggrave.`,
        ],
        absurde: [
            `Hypothermie :
Le patient n’est pas un surgelé, donc pas de “micro-ondes”.
On réchauffe doucement, on surveille, et on transfère si ça va mal.`,
            `Hypothermie :
Objectif : remettre de la chaleur, pas le secouer pour “le réveiller”.
Sec, couvrir, surveiller.`,
        ],
    }),
    chest_pain: (label, details) => ({
        serieuse: [
            `Douleur thoracique (${withDetails(label, details)}) : je la considère sérieuse jusqu’à preuve du contraire.
Mettre au repos, rassurer, surveiller constantes et respiration.
Si douleur intense, malaise, sueurs, gêne respiratoire, irradiation : urgence et transfert rapide.
Éviter l’effort, pas de repas/boisson en attendant si ça part en évacuation.`,
            `Douleur de poitrine :
- Repos, surveillance (pouls, tension, saturation si dispo).
- Chercher signes de gravité (malaise, sueurs, dyspnée).
- Urgence et transfert si suspicion cardiaque ou aggravation.`,
        ],
        absurde: [
            `Douleur de poitrine :
Ce n’est pas le moment de tester “si ça passe en marchant”.
Repos, surveillance, et appel urgent si signes de gravité.`,
            `Thorax qui serre :
Le cœur n’envoie pas des notifications pour rien.
Repos, constantes, et transfert si doute.`,
        ],
    }),
    abdo_pain: (label, details) => ({
        serieuse: [
            `Douleur abdominale importante (${withDetails(label, details)}) :
Tu regardes les signes d’alarme : douleur qui augmente, ventre très dur, vomissements incoercibles, fièvre élevée, malaise, sang dans les vomissements/selles.
Surveillance des constantes, hydratation prudente si conscient, douleur prise en charge si possible.
Si un signe d’alarme : urgence et transfert.`,
            `Douleur abdominale :
- Chercher signes de gravité (ventre dur, malaise, fièvre, vomissements importants).
- Surveiller constantes, soulager si possible.
- Transfert rapide si doute ou aggravation.`,
        ],
        absurde: [
            `Douleur abdominale :
Non, on ne “palpe fort pour voir”.
On surveille, on cherche les signes d’alarme, et on transfère si ça sent mauvais.`,
            `Ventre en vrac :
Si ça s’aggrave ou que le patient se dégrade, on ne fait pas l’autopsie sur place.
Surveillance + évacuation.`,
        ],
    }),
    severe_infection: (label, details) => ({
        serieuse: [
            `Infection sévère possible (${withDetails(label, details)}) : je pense “risque de sepsis” si fièvre + état général mauvais.
Tu prends les constantes, tu surveilles la conscience, et tu cherches des signes de gravité : confusion, peau froide/pâle, respiration rapide, tension basse.
Si présents : urgence, renfort et transfert. Sinon : surveillance rapprochée et réévaluation.`,
            `Infection sévère :
- Constantes + état neurologique.
- Signes de gravité (confusion, hypotension, dyspnée) = urgence.
- Transfert et surveillance, traitement symptomatique en attendant.`,
        ],
        absurde: [
            `Infection sévère :
Le patient n’a pas juste “un petit rhume de compétition”.
Constantes, signes de gravité, et transfert si ça dérape.`,
            `Infection sévère :
Quand ça devient confusion + fièvre, on ne fait pas “on verra demain”.
Urgence et transfert.`,
        ],
    }),
    psych_agitation: (label, details) => ({
        serieuse: [
            `Agitation / crise (${withDetails(label, details)}) :
Ta sécurité et celle de l’équipe d’abord. Mettre de la distance, parler calmement, éviter de provoquer.
Chercher une cause médicale (hypoglycémie, intoxication, douleur, fièvre) si possible.
Si risque pour le patient ou autrui : renfort, environnement sécurisé, et prise en charge adaptée.`,
            `Agitation :
- Sécurité, désescalade verbale, distance.
- Vérifier causes simples (hypoglycémie, intoxication, traumatisme, fièvre).
- Renfort et évacuation si danger ou aggravation.`,
        ],
        absurde: [
            `Agitation :
On évite le duel “moi plus fort que toi”.
Distance, voix calme, sécurité, et renfort si ça chauffe.`,
            `Crise de panique/agitation :
Tu parles doucement, tu sécurises, tu laisses de l’espace.
Et si ça devient dangereux : renfort, point final.`,
        ],
    }),
    cyberpsycho: (label, details) => ({
        serieuse: [
            `Cyberpsycho (${withDetails(label, details)}) :
Priorité sécurité (patient potentiellement violent), désescalade, distance, et renfort.
Ensuite tu cherches une cause médicale possible (intoxication, hypoglycémie, traumatisme, douleur).
Si accessible : constantes, plaies/hémorragies, et évacuation dans un cadre sécurisé.`,
            `Cyberpsycho :
- Sécurité + renfort, désescalade.
- Vérifier causes médicales simples.
- Traiter urgences (saignements/respiration), transfert sécurisé.`,
        ],
        absurde: [
            `Cyberpsycho :
Oui, il a plus de métal que ta trousse… mais il saigne pareil.
Sécurité, renfort, puis bilan et évacuation.`,
            `Cyberpsycho :
Si ça sort des lames, tu prends de la distance.
Renfort, sécurité, puis prise en charge et transfert.`,
        ],
    }),
    bionic_bug: (label, details) => ({
        serieuse: [
            `Prothèse / membre bionique qui bug (${withDetails(label, details)}) :
Sécurité d’abord : couper/éloigner la source d’énergie si possible, éviter que la prothèse blesse le patient ou l’équipe.
Puis bilan : plaies, saignements, douleur, circulation/sensibilité en aval.
Immobiliser si besoin et organiser un avis spécialisé / évacuation.`,
            `Bionique qui bug :
- Sécuriser (énergie / mouvements involontaires).
- Vérifier blessures, circulation/sensibilité.
- Immobiliser, douleur, transfert/avis spécialisé.`,
        ],
        absurde: [
            `Bras bionique qui bug :
On évite la “mise à jour Windows” en pleine intervention.
Tu sécurises l’alimentation, tu contrôles les plaies, tu immobilises, et tu évacues pour réparation.`,
            `Prothèse en vrac :
Si ça clignote, ce n’est pas bon signe.
Sécurité, bilan trauma, immobilisation, transfert.`,
        ],
    }),
    alien: (label, details) => ({
        serieuse: [
            `${withDetails(label, details)} :
OK, des aliens… mais on garde les mêmes priorités.
Sécurité de la scène, triage, et tu traites d’abord ce qui tue vite (gros saignements / respiration).
Si tu as un doute “biologique”, isole et protège-toi, puis évacuation vers une structure adaptée.`,
            `${withDetails(label, details)} :
- Sécurité, triage.
- Saignements/respiration/conscience.
- Isolement si risque inconnu, transfert.`,
        ],
        absurde: [
            `Ah oui, ${withDetails(label, details)} ?!
Je lui offre un croissant pour la diplomatie… mais priorité aux blessés.
Tu sécurises, tu tries (humains / aliens, sans te faire mordre), tu traites d’abord les urgences vitales, et tu évacues.`,
            `${withDetails(label, details)} :
Si l’alien demande un “bilan complet”, tu dis oui… mais d’abord :
sécurité, triage, saignements, respiration, et transfert (avec une zone d’isolement, tant qu’à faire).`,
        ],
    }),
    meteorite: (label, details) => ({
        serieuse: [
            `Impact de météorite (${withDetails(label, details)}) :
Tu gères comme un blast/trauma : sécurité (débris, incendie), triage, saignements, respiration.
Méfiance fractures, brûlures, lésions thoraciques, et état de choc.
Évacuation par priorité.`,
            `Météorite :
- Sécurité (débris/feu), triage.
- Hémorragies/respiration/conscience.
- Brûlures/trauma, évacuation.`,
        ],
        absurde: [
            `Météorite :
Le patient a pris un caillou du ciel : la gravité fait encore des excès.
Sécurité, saignements, respiration, et évacuation avant la prochaine “pluie”.`,
            `Impact cosmique :
Ce n’est pas un souvenir, c’est un trauma.
Triage, hémorragies, respiration, transfert.`,
        ],
    }),
    time_loop: (label, details) => ({
        serieuse: [
            `Boucle temporelle (${withDetails(label, details)}) :
Très bien… mais le patient, lui, ne doit pas “boucler”.
Note l’heure et ce que tu as déjà tenté, sécurise, puis respiration/saignements/conscience.
Si tu recommences la même scène : adapte, et fais venir du renfort (dans au moins UNE timeline).`,
            `Boucle temporelle :
- Sécurité, respiration, saignements, conscience.
- Noter ce qui a été fait, éviter de répéter les erreurs.
- Renfort et évacuation dès que possible.`,
        ],
        absurde: [
            `Boucle temporelle :
Si tu te revois dire “bonjour” pour la 12e fois, c’est un indice.
Sécurité, vital, renfort, évacuation. Et tu caches le bouton “rejouer”.`,
            `Time loop :
La seule chose qu’on répète, c’est la réévaluation.
Le reste : on améliore, et on évacue.`,
        ],
    }),
    zombie: (label, details) => ({
        serieuse: [
            `Infection “zombie” (${withDetails(label, details)}) :
Tu traites ça comme un risque infectieux + trauma.
Protection/isolement, contrôle des plaies, et évacuation.
Si morsure : nettoyage abondant, pansement, douleur prise en charge, et surveillance neurologique.`,
            `Zombie :
- Se protéger et isoler.
- Nettoyer largement les plaies, contrôler saignements.
- Surveiller conscience, évacuer rapidement.`,
        ],
        absurde: [
            `Zombie :
OK… règle n°1 : tu ne te fais pas croquer.
Ensuite : isolement, nettoyage des plaies, saignement, surveillance, et transfert.`,
            `Zombie :
Si le patient marche en disant “braaaains”, c’est un signe.
Toi : protection, isolement, plaies, surveillance, évacuation.`,
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
            `{WL} :
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