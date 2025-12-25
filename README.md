# Docteur GENIUSTER IA — version serveur

Cette version tourne avec un petit serveur Node + Express pour pouvoir :
- lancer le site via `npm start`
- sauvegarder les données côté serveur (dans le dossier `DATA/`) au lieu du navigateur.

## Installation

```bash
npm install
npm start
```

Puis ouvrez :
- http://localhost:3000 (site)
- http://localhost:3000/database.html (console admin)

## Persistance des données

- Les fichiers de base sont servis depuis `DATA/` via l'URL `/data/...`
 - `DATA/users.js`
 - `DATA/compte.js`
 - `DATA/maladies.js`
 - `DATA/bot.js`

- Les données ajoutées pendant l'utilisation (patients custom, overrides, interventions, etc.) sont enregistrées dans :
 - `DATA/store.json`

## Déploiement

N'importe quel hébergeur Node (Render, Railway, Fly.io, etc.) convient. Pensez à conserver un volume persistant si l'hébergeur efface le disque entre redémarrages.
