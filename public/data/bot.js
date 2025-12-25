window.BOT_PRESETS = {
 "INTRO": "👋 Bonjour. Je suis le Docteur GENIUSTER IA.\nEntrez le nom d'une personne, et je calculerais un diagnostic grace a l'IA BNI.",
 "CMD_HELP": "Commandes:\n- /help : afficher l'aide\n- /random : choisir un patient aléatoire\n- /dossier [nom] : afficher le dossier (sans nom = patient actif)\n- /intervention [nom] : démarrer une dictée d'intervention (le prochain message sera ajouté au dossier)\n- /intervention <texte> : ajouter directement une intervention au patient actif\n- /créer \"Nom Prénom\" : créer un nouveau dossier (uniquement sur commande)\n\nAstuce: vous pouvez taper un nom avec des fautes, j'essaie de deviner le bon dossier.",
 "CMD_BASE": "Base chargée.\nPatients: 163\nMaladies: 212\n(Interface sans sidebar, version “bord droit”.)",
 "MATCH_FOUND": [
 "Je pense avoir retrouvé le dossier de \"{name}\".",
 "Dossier repéré : \"{name}\".",
 "Je vois un dossier qui correspond : \"{name}\"."
 ],
 "MATCH_NOT_FOUND": "Aucun patient trouvé dans la base.\nVous pouvez en créer un en me demandant /créer \"{name}\".",
 "CREATE_START": [
 "Création d'un nouveau dossier {name}…\nJe vais poser 3 questions pour avoir suffisamment de données.",
 "Très bien. J'ouvre un nouveau dossier au nom de {name}.\nJe vais poser 3 questions pour avoir suffisamment de données."
 ],
 "CREATE_ALREADY_EXISTS": [
 "Ce dossier existe déjà : {name}.",
 "J'ai déjà un dossier pour {name}."
 ],
 "DID_YOU_MEAN_HEAD": [
 "Je ne suis pas certain d'avoir compris. Vous vouliez dire :",
 "J'ai trouvé des dossiers proches de votre saisie :"
 ],
 "INCOMPLETE_NAME_HEAD": [
 "Je n'ai reçu que \"{token}\".",
 "Tu m'as donné \"{token}\" seulement."
 ],
 "INCOMPLETE_NAME_TAIL": [
 "Il me faut le nom complet (prénom + nom) pour ouvrir le bon dossier.",
 "Donne le nom complet (prénom + nom) pour éviter les confusions."
 ],
 "INCOMPLETE_SUGGEST": [
 "Dossiers qui ressemblent à ce prénom/nom :",
 "Je trouve ces dossiers possibles :"
 ],
 "EXTRA_FIELDS": [
 "birthDate",
 "sex",
 "alimentation",
 "corpulence",
 "sport",
 "cigarette",
 "alcoholFreq",
 "drugs",
 "socialScore",
 "happiness",
 "healthProblems",
 "operation",
 "criminal",
 "transhuman",
 "confession"
 ],
 "FIELD_LABELS": {
 "birthDate": "Date de naissance",
 "sex": "Sexe",
 "alimentation": "Alimentation",
 "corpulence": "Corpulence",
 "sport": "Sport",
 "cigarette": "Tabac / Vapotage",
 "alcoholFreq": "Fréquence alcool",
 "drugs": "Drogues",
 "socialScore": "Score social",
 "happiness": "Bonheur / humeur",
 "healthProblems": "Problèmes de santé",
 "operation": "Opération",
 "criminal": "Criminal (vie dangereuse)",
 "transhuman": "Transhumain",
 "confession": "Confession (religion)"
 },
 "QUESTION_BANK": {
 "birthDate": {
 "type": "date",
 "question": "Quelle est la date de naissance ?",
 "placeholder": "AAAA-MM-JJ"
 },
 "sex": {
 "question": "Sexe :",
 "choices": [
 {"label":"Homme","value":"Homme"},
 {"label":"Femme","value":"Femme"},
 {"label":"Autre","value":"Autre"}
 ]
 },
 "alimentation": {
 "question": "Comment s'alimente la personne le plus souvent ?",
 "choices": [
 {"label":"ne mange jamais (coma régulié)","value":"ne mange jamais (coma régulié)","klass":"bad"},
 {"label":"ultra-tranformé (ltd)","value":"ultra-tranformé (ltd)","klass":"bad"},
 {"label":"fast food","value":"fast food"},
 {"label":"restaurant (bonne qualité)","value":"restaurant (bonne qualité)","klass":"good"},
 {"label":"a la maison (meilleur qualité)","value":"a la maison (meilleur qualité)","klass":"good"}
 ]
 },
 "cigarette": {
 "question": "Tabac / Vapotage ?",
 "choices": [
 {
 "label": "non",
 "value": "non",
 "klass": "good"
 },
 {
 "label": "un peu cigarette",
 "value": "un peu cigarette"
 },
 {
 "label": "un peu Vap",
 "value": "un peu Vap",
 "klass": "bad"
 },
 {
 "label": "beaucoup cigarette",
 "value": "beaucoup cigarette",
 "klass": "bad"
 },
 {
 "label": "beaucoup Vap",
 "value": "beaucoup Vap",
 "klass": "bad"
 }
 ]
 },
 "corpulence": {
 "question": "Votre corpulence est plutôt…",
 "choices": [
 {
 "label": "Maigre",
 "value": "Maigre",
 "klass": "good"
 },
 {
 "label": "Normal",
 "value": "Normal",
 "klass": "good"
 },
 {
 "label": "Enrobé",
 "value": "Enrobé"
 },
 {
 "label": "Obèse",
 "value": "Obèse",
 "klass": "bad"
 }
 ]
 },
 "sport": {
 "question": "À quelle fréquence faites-vous du sport ?",
 "choices": [
 {
 "label": "Jamais",
 "value": "Jamais",
 "klass": "bad"
 },
 {
 "label": "1–2 / semaine",
 "value": "1-2/sem"
 },
 {
 "label": "3–5 / semaine",
 "value": "3-5/sem",
 "klass": "good"
 },
 {
 "label": "Tous les jours",
 "value": "Tous les jours",
 "klass": "good"
 }
 ]
 },
 "alcoholFreq": {
 "question": "À quelle fréquence boit-il/elle de l'alcool ?",
 "choices": [
 {"label":"Jamais","value":"Jamais","klass":"good"},
 {"label":"1 fois / semaine","value":"1 fois / semaine"},
 {"label":"2 à 4 / semaine","value":"2 à 4 / semaine"},
 {"label":"2 à 3 / jour","value":"2 à 3 / jour","klass":"bad"},
 {"label":"Au moins 4 fois / jour","value":"Au moins 4 fois / jour","klass":"bad"}
 ]
 },
 "drugs": {
 "question": "Consommation de drogues ?",
 "choices": [
 {"label":"Non","value":"Non","klass":"good"},
 {"label":"Oui, en soirée","value":"Oui, en soirée"},
 {"label":"Oui, régulièrement","value":"Oui, régulièrement","klass":"bad"}
 ]
 },
 "socialScore": {
 "type": "number",
 "question": "Quel est le score social ?",
 "placeholder": "ex: 2500"
 },
 "happiness": {
 "question": "Bonheur / humeur (0 à 5) ?",
 "choices": [
 {"label":"0","value":"0","klass":"bad"},
 {"label":"1","value":"1","klass":"bad"},
 {"label":"2","value":"2"},
 {"label":"3","value":"3"},
 {"label":"4","value":"4","klass":"good"},
 {"label":"5","value":"5","klass":"good"}
 ]
 },
 "healthProblems": {
 "question": "Problèmes de santé :",
 "choices": [
 {"label":"NON","value":"NON","klass":"good"},
 {"label":"Cancer","value":"Cancer","klass":"bad"},
 {"label":"Handicap moteur","value":"Handicap moteur"},
 {"label":"Immunodépressive","value":"Immunodépressive","klass":"bad"},
 {"label":"Greffe","value":"Greffe","klass":"bad"},
 {"label":"Handicap mental","value":"Handicap mental"},
 {"label":"Maladie Sexuel","value":"Maladie Sexuel"},
 {"label":"Maladie genetique non transmissible","value":"Maladie genetique non transmissible"},
 {"label":"Maladie genetique héréditaire","value":"Maladie genetique héréditaire"},
 {"label":"Signe de vieillesse (Ostéo / Cataracte ...)","value":"Signe de vieillesse (Ostéo / Cataracte ...)"},
 {"label":"Autre","value":"Autre"},
 {"label":"N/A","value":"N/A"}
 ]
 },
 "operation": {
 "question": "Opération ?",
 "choices": [
 {"label":"Non","value":"Non","klass":"good"},
 {"label":"Oui","value":"Oui"}
 ]
 },
 "criminal": {
 "question": "Criminal (vie dangereuse) ?",
 "choices": [
 {"label":"Non","value":"Non","klass":"good"},
 {"label":"Oui","value":"Oui","klass":"bad"}
 ]
 },
 "transhuman": {
 "question": "Transhumain ?",
 "choices": [
 {"label":"Non","value":"Non","klass":"good"},
 {"label":"Oui","value":"Oui"}
 ]
 },
 "confession": {
 "question": "Confession (religion) :",
 "choices": [
 {"label":"Aucune / Athée","value":"Aucune / Athée"},
 {"label":"Chrétien","value":"Chrétien"},
 {"label":"Musulman","value":"Musulman"},
 {"label":"Juif","value":"Juif"},
 {"label":"Bouddhiste","value":"Bouddhiste"},
 {"label":"Hindou","value":"Hindou"},
 {"label":"Sikh","value":"Sikh"},
 {"label":"Autre / Non précisé","value":"Autre / Non précisé"}
 ]
 }
 },
 "SUMMARY": {
 "mood": {
 "low": [
 "semble tendu et fatigué",
 "n'a pas l'air au meilleur de sa forme",
 "donne l'impression d'être à bout de nerfs"
 ],
 "mid": [
 "va “à peu près”",
 "a des jours avec et des jours sans",
 "tient le coup, sans plus"
 ],
 "high": [
 "a l'air plutôt en forme",
 "semble d'humeur correcte",
 "donne une impression d'énergie"
 ]
 },
 "mood_unknown": [
 "reste flou sur son moral",
 "ne veut pas trop s'étendre sur son humeur",
 "n'a pas répondu clairement sur son état d'esprit"
 ],
 "social": {
 "very_low": [
 "mène une vie sociale très discrète",
 "vit plutôt en mode solitaire",
 "croise peu de monde"
 ],
 "low": [
 "voit du monde de temps en temps",
 "a une vie sociale plutôt calme",
 "reste assez réservé socialement"
 ],
 "mid": [
 "a une vie sociale plutôt active",
 "semble bien entouré",
 "a l'air de sortir régulièrement"
 ],
 "high": [
 "a une vie sociale très remplie (voire trop)",
 "semble toujours entouré",
 "donne l'impression de ne jamais être seul"
 ]
 },
 "social_unknown": [
 "ne donne pas d'indication sur sa vie sociale",
 "reste vague sur ses relations",
 "ne laisse rien filtrer côté social"
 ],
 "alcohol": {
 "none": [
 "dit boire rarement",
 "déclare éviter l'alcool",
 "ne semble pas trop porté sur la bouteille"
 ],
 "some": [
 "boit à l'occasion",
 "admet quelques verres de temps en temps",
 "semble boire surtout dans des contextes sociaux"
 ],
 "often": [
 "laisse entendre que l'alcool revient souvent",
 "semble avoir la main assez lourde sur les verres",
 "parle d'une consommation d'alcool régulière"
 ]
 },
 "alcohol_unknown": [
 "ne précise pas son rapport à l'alcool",
 "reste muet sur l'alcool",
 "ne donne pas d'info claire sur la boisson"
 ],
 "drugs": {
 "no": [
 "assure ne pas toucher aux substances",
 "déclare éviter les drogues",
 "dit rester à distance des substances"
 ],
 "party": [
 "reconnaît quelques “extras” en soirée",
 "mentionne des écarts ponctuels",
 "laisse entendre des essais occasionnels"
 ],
 "regular": [
 "parle d'une consommation régulière de substances",
 "laisse planer une habitude inquiétante",
 "sous-entend une consommation assez installée"
 ]
 },
 "drugs_unknown": [
 "ne dit rien sur les substances",
 "évite le sujet des drogues",
 "reste flou sur d'éventuelles consommations"
 ],
 "health": {
 "ok": [
 "ne signale pas de souci majeur",
 "dit aller plutôt bien",
 "n'indique rien d'alarmant"
 ],
 "issues": [
 "mentionne déjà quelques problèmes de santé",
 "a l'air d'avoir un historique médical",
 "signale des soucis existants"
 ]
 },
 "health_unknown": [
 "ne donne pas beaucoup d'indices sur sa santé",
 "reste vague sur son état général",
 "n'entre pas dans les détails médicaux"
 ],
 "rp_cathedral": [
 "(et le dossier mentionne une histoire de cathédrale… on ne juge pas.)",
 "(petit détail dossier : “cathédrale” cochée… intrigant.)"
 ]
 },
 "CATEGORY_PHRASES": {
 "cigarette": {
 "non": [
 "ne consomme pas de tabac",
 "évite cigarettes et vape",
 "dit être non‑fumeur"
 ],
 "un peu cigarette": [
 "fume un peu",
 "a quelques cigarettes",
 "fume légèrement"
 ],
 "un peu Vap": [
 "vapote un peu",
 "utilise un peu la vape",
 "vapote légèrement"
 ],
 "beaucoup cigarette": [
 "fume beaucoup",
 "enchaîne les cigarettes",
 "semble accro au tabac"
 ],
 "beaucoup Vap": [
 "vapote beaucoup",
 "a une grosse consommation de vape",
 "semble accro à la vape"
 ]
 },
 "alimentation": {
 "ne mange jamais (coma régulié)": [
 "a une alimentation quasi inexistante",
 "ne mange presque jamais",
 "a un rythme alimentaire très inquiétant"
 ],
 "ultra-tranformé (ltd)": [
 "mange surtout de l'ultra‑transformé",
 "vit au régime “ltd”",
 "carbure aux produits industriels"
 ],
 "fast food": [
 "mange souvent du fast‑food",
 "fait beaucoup de fast‑food",
 "a une alimentation plutôt rapide"
 ],
 "restaurant (bonne qualité)": [
 "mange souvent au restaurant (bonne qualité)",
 "privilégie des restos de qualité",
 "a une alimentation plutôt correcte"
 ],
 "a la maison (meilleur qualité)": [
 "mange surtout à la maison",
 "privilégie une cuisine maison",
 "a une alimentation plutôt saine"
 ]
 },
 "corpulence": {
 "Maigre": [
 "est plutôt mince",
 "a une corpulence fine",
 "semble plutôt maigre"
 ],
 "Normal": [
 "a une corpulence normale",
 "semble dans la moyenne",
 "a un gabarit standard"
 ],
 "Enrobé": [
 "est un peu enrobé",
 "a pris un peu de volume",
 "a une corpulence plutôt ronde"
 ],
 "Obèse": [
 "a une corpulence très élevée",
 "semble en situation d'obésité",
 "a un gabarit vraiment lourd"
 ]
 },
 "sport": {
 "Jamais": [
 "ne fait pas vraiment de sport",
 "bouge très peu",
 "semble sédentaire"
 ],
 "1-2/sem": [
 "fait un peu de sport",
 "bouge 1–2 fois par semaine",
 "s'entretient occasionnellement"
 ],
 "3-5/sem": [
 "fait du sport régulièrement",
 "s'entretient 3–5 fois par semaine",
 "a une routine sportive solide"
 ],
 "Tous les jours": [
 "fait du sport tous les jours",
 "s'entretient quotidiennement",
 "semble très actif physiquement"
 ]
 }
 }
};
