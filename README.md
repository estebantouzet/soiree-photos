# � Galerie Photo de Soirée — Web App Immersive

Galerie photo interactive avec Livre d'Or temps réel.  
Partage tes souvenirs avec tes invités et laisse-les signer le livre d'or en temps réel !

✨ **Galerie immersive** — Design glassmorphism avec animations fluides  
💬 **Livre d'Or temps réel** — Synchronisation instantanée entre utilisateurs via Firebase  
🔔 **Notifications dynamiques** — Badge compteur sur le bouton latéral  
🖼️ **Optimisation automatique** — Miniatures WebP générées par scripts Python

---

## 🏗️ Architecture Technique

### Backend & Social
- **Firebase Realtime Database** (v10+) — Synchronisation en temps réel des messages du Livre d'Or
- **LocalStorage** — Favoris et préférences utilisateur

### Traitement d'Images
- **Python + Pillow** — Génération automatique de miniatures WebP 400×400px
- **Format WebP** — Performance optimale avec compression moderne

### Frontend
- **Vanilla JavaScript** — Pas de framework, code pur et performant
- **CSS Glassmorphism** — Effets de verre, animations smooth
- **Intersection Observer** — Lazy loading des images

---

## 📁 Structure du projet

```
soiree/
├── index.html             ← 🎨 Page principale + Config Firebase
├── style.css              ← ✨ Styles glassmorphism + animations
├── app.js                 ← ⚡ Toute la logique + Livre d'Or Firebase
├── photos.json            ← 📋 Généré automatiquement
├── generate_thumbnails.py ← 🖼️ Script Python (Pillow) → miniatures WebP
├── generate_json.py       ← 📊 Génère le JSON avec métadonnées EXIF
├── reset.py               ← 🔄 Réinitialise le projet pour nouvelle soirée
└── photos/                ← ⬅️ 📷 Place tes photos ici
    ├── IMG_0001.jpg
    ├── IMG_0002.jpg
    └── thumbs/            ← ✨ Miniatures générées (400×400px WebP)
        ├── IMG_0001.webp
        └── ...
```

---

## 🚀 Mise en route

### 1. Installer Python et Pillow

```bash
pip3 install Pillow
```

### 2. Copier tes photos

Place toutes tes photos dans le dossier `photos/`.  
Formats acceptés : `.jpg`, `.jpeg`, `.png`, `.webp`, `.heic`, `.tiff`

### 3. Générer les miniatures (recommandé pour 50+ photos)

```bash
python3 generate_thumbnails.py
```

Ce script crée des miniatures WebP 400×400px dans `photos/thumbs/`.  
Les miniatures existantes ne sont pas recréées. Cela accélère considérablement  
le chargement de la galerie, surtout avec beaucoup de photos.

### 4. Générer le fichier JSON

```bash
python3 generate_json.py
```

Le script lit automatiquement la date/heure depuis les métadonnées EXIF  
de chaque photo et génère `photos.json` avec les chemins des miniatures.

### 5. Lancer le site en local

```bash
# Python (recommandé)
python3 -m http.server 8000
# puis ouvre http://localhost:8000

# Node.js
npx serve .
```

> ⚠️ Ne pas ouvrir `index.html` directement dans le navigateur  
> (le `fetch()` sera bloqué). Il faut un serveur local.

---

## 🌐 Déployer en ligne (gratuit)

### Option Netlify (la plus simple)

1. Va sur [netlify.com](https://netlify.com) et crée un compte gratuit
2. Glisse-dépose le dossier `soiree/` entier dans l'interface
3. Ton site est en ligne en 30 secondes avec une URL partageable

### Option GitHub Pages

1. Crée un dépôt GitHub et pousse le dossier
2. Active GitHub Pages dans les paramètres du dépôt
3. Ton site est disponible à `https://tonnom.github.io/soiree`

---

## 🔄 Nouvelle soirée

Pour réinitialiser le projet et recommencer avec de nouvelles photos :

```bash
python3 reset.py
```

Ce script va :
- Supprimer toutes les photos du dossier `photos/`
- Supprimer toutes les miniatures dans `photos/thumbs/`
- Réinitialiser `photos.json` (tableau vide)

Une confirmation est demandée avant toute suppression.

---

## ⭐ Fonctionnalités

### 🎨 UX Premium
- **Glassmorphism** — Effets de verre, transparence, blur
- **Animations fluides** — Transitions cubic-bezier, auto-scroll
- **Haptic feedback** — Vibrations sur mobile (iOS/Android)
- **Responsive** — Optimisé pour tous les écrans

### 💬 Livre d'Or Social
- **Synchro temps réel** — Messages partagés instantanément via Firebase
- **Badge notification** — Compteur dynamique sur le bouton latéral
- **Auto-scroll** — Défilement automatique vers les nouveaux messages
- **Glassmorphism** — Design premium avec slide-in animations

### 📷 Galerie Photos
- **Tri par heure** — Filtres automatiques depuis les EXIF
- **Recherche** — Filtre les photos par heure
- **Favoris** — Sauvegardés dans localStorage avec confettis 🎉
- **Lightbox** — Visionneuse plein écran avec Ken Burns effect
- **Téléchargement** — Photo individuelle ou toutes les photos visibles

### ⚡ Performance
- **Miniatures WebP** — Générées automatiquement par Pillow
- **Lazy loading** — Images chargées à la volée
- **Format moderne** — WebP pour une compression optimale

---

## 🔧 Guide de Maintenance

### Ajouter des photos après le lancement

Si tu veux ajouter de nouvelles photos sans tout réinitialiser :

```bash
# 1. Copie les nouvelles photos dans photos/
cp /chemin/vers/nouvelles_photos/*.jpg photos/

# 2. Régénère uniquement les miniatures manquantes
python3 generate_thumbnails.py

# 3. Mets à jour le JSON
python3 generate_json.py

# 4. Redéploie sur Netlify si nécessaire
```

### Configuration Firebase

La configuration Firebase se trouve dans `index.html` :

```javascript
const firebaseConfig = {
  apiKey: '...',
  authDomain: '...',
  databaseURL: '...',
  // ...
};
```

Pour utiliser ta propre base de données, remplace ces valeurs par celles de ton projet Firebase.

---

Made with ❤️ pour des soirées mémorables