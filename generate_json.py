"""
generate_json.py
────────────────
Lit toutes les photos du dossier `photos/`, extrait la date/heure
depuis les métadonnées EXIF (DateTimeOriginal), et génère `photos.json`.

Usage :
    pip install Pillow
    python generate_json.py

Options :
    --photos-dir   Chemin vers le dossier de photos  (défaut : ./photos)
    --output       Chemin du fichier JSON généré     (défaut : ./photos.json)
    --captions     Fichier CSV optionnel nom,légende (défaut : aucun)

Exemple avec légendes pré-remplies :
    python generate_json.py --captions legendes.csv
"""

import os
import json
import argparse
import csv
from pathlib import Path
from datetime import datetime

try:
    from PIL import Image
    from PIL.ExifTags import TAGS
except ImportError:
    print("❌  Pillow n'est pas installé. Lance : pip install Pillow")
    exit(1)


SUPPORTED = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.tiff', '.tif'}


from typing import Optional

def get_exif_datetime(path: Path) -> Optional[str]:
    """Retourne la date/heure originale depuis l'EXIF, ou None si absente."""
    try:
        img = Image.open(path)
        exif_data = img._getexif()
        if not exif_data:
            return None
        for tag_id, value in exif_data.items():
            tag_name = TAGS.get(tag_id, '')
            if tag_name == 'DateTimeOriginal':
                return value  # format "2024:11:23 20:35:10"
    except Exception:
        pass
    return None


def parse_datetime(raw: str):
    """Convertit "2024:11:23 20:35:10" en objet datetime."""
    try:
        return datetime.strptime(raw, '%Y:%m:%d %H:%M:%S')
    except Exception:
        return None


def load_captions(captions_file: str) -> dict:
    """
    Charge un CSV optionnel avec les colonnes : nom_fichier, legende
    Retourne un dict { 'img001.jpg': 'Ma légende' }
    """
    captions = {}
    if not captions_file or not os.path.exists(captions_file):
        return captions
    with open(captions_file, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            filename = row.get('nom_fichier', '').strip()
            caption  = row.get('legende', '').strip()
            if filename:
                captions[filename] = caption
    print(f"📋  {len(captions)} légende(s) chargée(s) depuis {captions_file}")
    return captions


def main():
    parser = argparse.ArgumentParser(description='Génère photos.json depuis un dossier de photos.')
    parser.add_argument('--photos-dir', default='./photos', help='Dossier contenant les photos')
    parser.add_argument('--output',     default='./photos.json', help='Fichier JSON de sortie')
    parser.add_argument('--captions',   default='',  help='Fichier CSV nom_fichier,legende (optionnel)')
    args = parser.parse_args()

    photos_dir = Path(args.photos_dir)
    if not photos_dir.exists():
        print(f"❌  Le dossier '{photos_dir}' n'existe pas.")
        print(f"    Crée-le et place tes photos dedans, puis relance le script.")
        exit(1)

    # Charge les légendes depuis le CSV si fourni
    captions_map = load_captions(args.captions)

    # Collecte les fichiers
    files = sorted([
        f for f in photos_dir.iterdir()
        if f.suffix.lower() in SUPPORTED
    ])

    if not files:
        print(f"⚠️   Aucune image trouvée dans '{photos_dir}'.")
        print(f"    Formats acceptés : {', '.join(SUPPORTED)}")
        exit(0)

    print(f"📷  {len(files)} photo(s) trouvée(s) dans '{photos_dir}'")
    print()

    results = []
    no_exif_count = 0

    for idx, f in enumerate(files):
        raw_dt  = get_exif_datetime(f)
        dt      = parse_datetime(raw_dt) if raw_dt else None
        caption = captions_map.get(f.name, '')

        if dt:
            time_str = dt.strftime('%H:%M')
            hour_str = dt.strftime('%Hh')
            status   = f"  ✅  {f.name}  →  {time_str}"
        else:
            time_str = '00:00'
            hour_str = '00h'
            no_exif_count += 1
            status = f"  ⚠️   {f.name}  →  pas de date EXIF (00:00 par défaut)"

        print(status)

        # Chemin de la miniature (webp avec le même nom de base)
        thumb_path = f"photos/thumbs/{f.stem}.webp"
        
        results.append({
            "id":      idx,
            "src":     f"photos/{f.name}",
            "thumb":   thumb_path,
            "caption": caption,
            "time":    time_str,
            "hour":    hour_str,
        })

    # Trie par heure croissante
    results.sort(key=lambda p: p['time'])

    # Réassigne les IDs après tri
    for i, p in enumerate(results):
        p['id'] = i

    # Écriture du JSON
    output_path = Path(args.output)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print()
    print(f"✅  {len(results)} photo(s) exportée(s) → '{output_path}'")

    if no_exif_count:
        print(f"⚠️   {no_exif_count} photo(s) sans EXIF ont reçu l'heure 00:00.")
        print(f"    Tu peux les corriger manuellement dans photos.json")

    print()
    print("💡  Astuce : pour ajouter des légendes, crée un fichier legendes.csv :")
    print("    nom_fichier,legende")
    print("    img001.jpg,Arrivée de Julie")
    print("    img002.jpg,Premier verre !")
    print("    puis relance : python generate_json.py --captions legendes.csv")


if __name__ == '__main__':
    main()
