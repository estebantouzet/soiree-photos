#!/usr/bin/env python3
"""
reset.py — Réinitialise le projet pour une nouvelle soirée

Supprime toutes les photos et réinitialise photos.json.
Usage : python3 reset.py
"""

import os
import json
import sys

# Extensions d'images à supprimer
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.tiff', '.tif'}

def confirm_reset():
    """Demande une confirmation à l'utilisateur."""
    print()
    print("⚠️  Cette action va supprimer toutes les photos et réinitialiser le projet.")
    response = input('Tape "oui" pour confirmer : ')
    return response.strip().lower() == "oui"

def count_files_in_dir(directory, extensions=None):
    """Compte les fichiers dans un dossier, optionnellement filtrés par extension."""
    if not os.path.exists(directory):
        return 0
    count = 0
    for filename in os.listdir(directory):
        filepath = os.path.join(directory, filename)
        if os.path.isfile(filepath):
            if extensions is None:
                count += 1
            else:
                ext = os.path.splitext(filename)[1].lower()
                if ext in extensions:
                    count += 1
    return count

def delete_files_in_dir(directory, extensions=None):
    """Supprime les fichiers d'un dossier, optionnellement filtrés par extension."""
    if not os.path.exists(directory):
        return 0
    deleted = 0
    for filename in os.listdir(directory):
        filepath = os.path.join(directory, filename)
        if os.path.isfile(filepath):
            if extensions is None:
                os.remove(filepath)
                deleted += 1
            else:
                ext = os.path.splitext(filename)[1].lower()
                if ext in extensions:
                    os.remove(filepath)
                    deleted += 1
    return deleted

def ensure_dir_exists(directory):
    """Crée le dossier s'il n'existe pas."""
    if not os.path.exists(directory):
        os.makedirs(directory)
        print(f"📁  Dossier créé : {directory}/")

def reset_json():
    """Réécrit photos.json avec un tableau vide."""
    with open('photos.json', 'w', encoding='utf-8') as f:
        json.dump([], f, indent=2)

def main():
    # Confirmation
    if not confirm_reset():
        print("❌ Opération annulée.")
        sys.exit(0)
    
    # S'assurer que les dossiers existent
    ensure_dir_exists('photos')
    ensure_dir_exists('photos/thumbs')
    
    # Compter avant suppression
    thumbs_count = count_files_in_dir('photos/thumbs')
    photos_count = count_files_in_dir('photos', IMAGE_EXTENSIONS)
    
    # Supprimer les miniatures
    deleted_thumbs = delete_files_in_dir('photos/thumbs')
    
    # Supprimer les photos (uniquement les fichiers images)
    deleted_photos = delete_files_in_dir('photos', IMAGE_EXTENSIONS)
    
    # Réinitialiser photos.json
    reset_json()
    
    # Afficher le résumé
    print()
    print(f"🗑️  {deleted_thumbs} miniatures supprimées")
    print(f"🗑️  {deleted_photos} photos supprimées")
    print("✅  photos.json réinitialisé")
    print()
    print("🎉  Projet prêt pour une nouvelle soirée !")

if __name__ == '__main__':
    main()