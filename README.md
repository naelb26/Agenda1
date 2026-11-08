# Agenda · Habitudes

Agenda hebdomadaire, liste de tâches et suivi d'habitudes. Application autonome
(HTML/CSS/JS, aucune dépendance), sans serveur ni compte.

## Lancer

- Ouvrir `index.html` dans un navigateur, **ou**
- `python3 -m http.server 8080` puis http://localhost:8080 — servie ainsi,
  l'appli s'installe comme un logiciel (« Installer l'application » / « Ajouter à
  l'écran d'accueil ») et fonctionne hors ligne.

## Utilisation

- **Calendrier** : chaque jour a son champ « + Ajouter ». `14h30 Sport` crée la tâche à 14:30.
- **Cocher** : le rond passe de *à faire* → ✓ *fait* → ✕ *pas fait* → *à faire*.
- **Modifier** : cliquer sur le texte d'une tâche (titre, jour, heure, note, statut, suppression).
- **À faire** : tâches sans date ; glisser-déposer vers un jour pour les planifier (et inversement).
- **Habitudes** : une ligne par habitude, une case par jour de la semaine, série 🔥 en cours.
  Cliquer sur son nom pour choisir les jours concernés.
- **Tâches qui se répètent** : dans la fiche d'une tâche, « Répéter » → tous les jours, en
  semaine, chaque semaine ou chaque mois (↻). Chaque occurrence se coche séparément ;
  « Pas ce jour » retire une seule date, « Supprimer » efface la série.
- **Rappels** : choisir une heure puis « Rappel » (à l'heure, 5/15/30 min avant, 1 h avant,
  la veille) 🔔. Une notification s'affiche (après autorisation, via ⋯) ainsi qu'un
  message dans l'appli. Les rappels ne sonnent que si l'agenda est ouvert (onglet ou appli
  installée en arrière-plan) : il n'y a pas de serveur qui les envoie.
- **Vue Mois** : la grille du mois avec les tâches de chaque jour et une barre verte pour
  les habitudes ; cliquer sur un jour ouvre sa semaine.
- **Statistiques** : taux de réalisation de la semaine et des 30 derniers jours (comparé aux
  30 précédents), tâches faites, meilleure série, réalisation par semaine sur 12 semaines,
  meilleurs jours de la semaine, et pour chaque habitude : taux, série, record et les 30
  derniers jours en carrés.
- **Progression** : pourcentage des tâches et habitudes réalisées dans la semaine.
- Flèches ← → du clavier : période précédente / suivante.
- **⋯** : exporter / importer une sauvegarde JSON. Les données restent dans le navigateur.

## Ambiance

Les couleurs changent toutes seules :
- **saison** : hiver bleu, printemps vert, été doré, automne cuivré ;
- **mois** : chaque mois décale légèrement la teinte de sa saison ;
- **heure** : aube rosée, matin lumineux, crépuscule orangé, soirée violette, nuit sombre
  (passage automatique en mode sombre la nuit).

Le bouton **Auto / Clair / Sombre** force le mode. Pour prévisualiser une autre date :
`index.html?at=2026-07-01T06:30`.

## En ligne et sur téléphone

- **Codespace** : bouton « Code » → « Codespaces » → « Create codespace ». L'agenda s'ouvre
  tout seul sur le port 8080.
- **GitHub Pages** (adresse fixe, gratuite) : *Settings* → *Pages* → *Deploy from a branch*,
  branche `main`, dossier `/ (root)`. L'agenda sera sur `https://naelb26.github.io/agenda1/`
  et pourra être installé comme une appli depuis le téléphone.
