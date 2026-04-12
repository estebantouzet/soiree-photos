# 📷 Galerie Photo de Soirée

Site web mobile pour partager les photos d'une soirée.  
Tri par heure, recherche, favoris, téléchargement global.

---

## Structure du projet

```
soiree/
├── index.html             ← page principale
├── style.css              ← tous les styles
├── app.js                 ← toute la logique
├── photos.json            ← généré automatiquement par le script
├── generate_thumbnails.py ← script Python pour générer les miniatures
├── generate_json.py       ← script Python à lancer une fois
├── legendes.csv           ← légendes optionnelles (à remplir)
└── photos/                ← ⬅️ place tes photos ici
    ├── IMG_0001.jpg
    ├── IMG_0002.jpg
    └── thumbs/            ← miniatures générées automatiquement
        ├── IMG_0001.webp
        └── ...
```

---

## Mise en route

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

### 5. Ajouter des légendes (optionnel)

Remplis le fichier `legendes.csv` :

```csv
nom_fichier,legende
IMG_0001.jpg,Arrivée de Julie
IMG_0002.jpg,Premier verre !
```

Puis relance les scripts dans l'ordre :

```bash
python3 generate_thumbnails.py
python3 generate_json.py --captions legendes.csv
```

### 6. Lancer le site en local

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

## Déployer en ligne (gratuit)

### Option Netlify (la plus simple)

1. Va sur [netlify.com](https://netlify.com) et crée un compte gratuit
2. Glisse-dépose le dossier `soiree/` entier dans l'interface
3. Ton site est en ligne en 30 secondes avec une URL partageable

### Option GitHub Pages

1. Crée un dépôt GitHub et pousse le dossier
2. Active GitHub Pages dans les paramètres du dépôt
3. Ton site est disponible à `https://tonnom.github.io/soiree`

---

## Fonctionnalités

- **Tri par heure** — filtres automatiques générés depuis les données EXIF
- **Recherche** — filtre les photos par légende en temps réel
- **Favoris** — sauvegardés dans le navigateur (localStorage)
- **Lightbox** — visionneuse plein écran avec actions
- **Téléchargement** — photo individuelle ou toutes les photos visibles
- **Mode sombre** — automatique selon les préférences système
- **Optimisé mobile** — responsive, lazy loading des images
