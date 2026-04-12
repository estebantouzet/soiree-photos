"""
generate_thumbnails.py
────────────────────
Génère des miniatures WebP 400×400px max dans photos/thumbs/.
Les miniatures existantes ne sont pas recréées.

Usage :
    pip install Pillow
    python generate_thumbnails.py

Options :
    --photos-dir   Chemin vers le dossier de photos  (défaut : ./photos)
    --quality      Qualité WebP (défaut : 80)
    --size         Taille max en pixels (défaut : 400)
"""

import os
import argparse
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("❌  Pillow n'est pas installé. Lance : pip install Pillow")
    exit(1)

SUPPORTED = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.tiff', '.tif'}


def generate_thumbnail(src_path: Path, thumbs_dir: Path, max_size: int, quality: int) -> Path:
    """Génère une miniature WebP, retourne le chemin de sortie."""
    # Nom de sortie : original.webp
    thumb_name = f"{src_path.stem}.webp"
    thumb_path = thumbs_dir / thumb_name
    
    # Skip si existe déjà
    if thumb_path.exists():
        return thumb_path
    
    try:
        with Image.open(src_path) as img:
            # Convertir en RGB si nécessaire (pour HEIC, CMYK, etc.)
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGBA')
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Redimensionner en conservant le ratio
            img.thumbnail((max_size, max_size), Image.LANCZOS)
            
            # Sauvegarder en WebP
            img.save(thumb_path, 'WEBP', quality=quality, method=6)
        
        return thumb_path
    except Exception as e:
        print(f"  ❌  Erreur sur {src_path.name}: {e}")
        return None


def main():
    parser = argparse.ArgumentParser(description='Génère des miniatures WebP pour les photos.')
    parser.add_argument('--photos-dir', default='./photos', help='Dossier contenant les photos')
    parser.add_argument('--quality', type=int, default=80, help='Qualité WebP (1-100)')
    parser.add_argument('--size', type=int, default=400, help='Taille max en pixels')
    args = parser.parse_args()
    
    photos_dir = Path(args.photos_dir)
    thumbs_dir = photos_dir / 'thumbs'
    
    if not photos_dir.exists():
        print(f"❌  Le dossier '{photos_dir}' n'existe pas.")
        exit(1)
    
    # Créer le dossier thumbs si inexistant
    thumbs_dir.mkdir(exist_ok=True)
    
    # Collecte les fichiers
    files = sorted([
        f for f in photos_dir.iterdir()
        if f.is_file() and f.suffix.lower() in SUPPORTED
    ])
    
    if not files:
        print(f"⚠️   Aucune image trouvée dans '{photos_dir}'.")
        exit(0)
    
    print(f"📷  {len(files)} photo(s) trouvée(s)")
    print(f"📁  Dossier des miniatures : {thumbs_dir}")
    print(f"📐  Taille max : {args.size}px | Qualité : {args.quality}%")
    print()
    
    created = 0
    skipped = 0
    errors = 0
    
    for f in files:
        thumb_path = generate_thumbnail(f, thumbs_dir, args.size, args.quality)
        
        if thumb_path is None:
            errors += 1
        elif thumb_path.exists() and thumb_path.stat().st_size > 0:
            # Vérifier si on vient de créer ou si existait déjà
            # (on considère que si la fonction retourne un chemin valide, c'est OK)
            if thumb_path.stat().st_mtime >= os.path.getmtime(f):
                created += 1
                print(f"  ✅  {f.name} → {thumb_path.name}")
            else:
                skipped += 1
                print(f"  ⏭️  {f.name} → déjà existant")
    
    print()
    print(f"✅  {created} miniature(s) créée(s)")
    if skipped:
        print(f"⏭️  {skipped} miniature(s) déjà existante(s)")
    if errors:
        print(f"❌  {errors} erreur(s)")
    print()
    print("💡  Prochaine étape : python generate_json.py")


if __name__ == '__main__':
    main()
