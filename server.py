"""
server.py — Backend Flask multi-événements
Lance avec : python server.py
Admin      : http://localhost:5000/admin/
Soirée     : http://localhost:5000/events/<slug>/
"""

import json
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from flask import (Flask, abort, jsonify, render_template,
                   request, send_from_directory)

app = Flask(__name__, template_folder='core/templates')

BASE_DIR    = Path(__file__).parent
EVENTS_DIR  = BASE_DIR / 'events'
EVENTS_JSON = BASE_DIR / 'events.json'
SHARED_DIR  = BASE_DIR / 'shared'
ADMIN_DIR   = BASE_DIR / 'admin'
CORE_DIR    = BASE_DIR / 'core'

SUPPORTED_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.tiff', '.tif'}
MAX_UPLOAD_MB  = 500
app.config['MAX_CONTENT_LENGTH'] = MAX_UPLOAD_MB * 1024 * 1024


# ─── Helpers ──────────────────────────────────────────────────────────────────

def load_events() -> list:
    if not EVENTS_JSON.exists():
        return []
    with open(EVENTS_JSON, encoding='utf-8') as f:
        return json.load(f)

def save_events(events: list):
    with open(EVENTS_JSON, 'w', encoding='utf-8') as f:
        json.dump(events, f, ensure_ascii=False, indent=2)

def load_event_config(slug: str) -> dict:
    p = EVENTS_DIR / slug / 'config.json'
    if not p.exists():
        abort(404, f"Soirée '{slug}' introuvable")
    with open(p, encoding='utf-8') as f:
        return json.load(f)

def save_event_config(slug: str, config: dict):
    with open(EVENTS_DIR / slug / 'config.json', 'w', encoding='utf-8') as f:
        json.dump(config, f, ensure_ascii=False, indent=2)

def update_events_index(slug: str, config: dict):
    events = load_events()
    entry  = {'slug': slug, 'title': config.get('title', slug),
               'date': config.get('date', ''), 'createdAt': config.get('createdAt', '')}
    events = [e for e in events if e['slug'] != slug]
    events.append(entry)
    save_events(events)

def photo_count(slug: str) -> int:
    photos_file = EVENTS_DIR / slug / 'photos.json'
    if not photos_file.exists():
        return 0
    with open(photos_file, encoding='utf-8') as f:
        return len(json.load(f))


# ─── Admin ────────────────────────────────────────────────────────────────────

@app.route('/admin/')
@app.route('/admin')
def admin():
    return send_from_directory(str(ADMIN_DIR), 'index.html')

@app.route('/admin/<path:filename>')
def admin_static(filename):
    return send_from_directory(str(ADMIN_DIR), filename)


# ─── App publique ─────────────────────────────────────────────────────────────

@app.route('/events/<slug>/')
@app.route('/events/<slug>')
def event_app(slug):
    if not (EVENTS_DIR / slug).exists():
        abort(404, f"Soirée '{slug}' introuvable")
    return render_template('event.html', slug=slug)

@app.route('/events/<slug>/<path:filename>')
def event_static(slug, filename):
    event_dir = EVENTS_DIR / slug
    if not event_dir.exists():
        abort(404)
    # Fichiers propres à l'événement (photos, photos.json, config.json)
    event_file = event_dir / filename
    if event_file.exists():
        return send_from_directory(str(event_dir), filename)
    # Fallback : assets statiques du core
    return send_from_directory(str(CORE_DIR), filename)

@app.route('/core/<path:filename>')
def core_static(filename):
    return send_from_directory(str(CORE_DIR), filename)


# ─── API : Soirées ────────────────────────────────────────────────────────────

@app.route('/api/events', methods=['GET'])
def api_list_events():
    events = load_events()
    # Enrichit avec le nb de photos
    for e in events:
        e['photoCount'] = photo_count(e['slug'])
    return jsonify(events)

@app.route('/api/events', methods=['POST'])
def api_create_event():
    data = request.get_json(force=True)
    slug = data.get('slug', '').strip().lower()
    slug = ''.join(c if c.isalnum() or c == '-' else '-' for c in slug).strip('-')

    if not slug:
        return jsonify({'error': 'Slug invalide ou manquant'}), 400

    event_dir = EVENTS_DIR / slug
    if event_dir.exists():
        return jsonify({'error': f"La soirée '{slug}' existe déjà"}), 409

    (event_dir / 'photos' / 'thumbs').mkdir(parents=True)

    config = {
        'slug':      slug,
        'title':     data.get('title', 'Ma soirée'),
        'subtitle':  data.get('subtitle', ''),
        'date':      data.get('date', ''),
        'pin':       data.get('pin', '1234'),
        'createdAt': datetime.now().isoformat(),
        'status':    'draft',
        'firebase':  data.get('firebase', {})
    }

    save_event_config(slug, config)
    with open(event_dir / 'photos.json', 'w') as f:
        json.dump([], f)

    update_events_index(slug, config)
    return jsonify({'slug': slug, 'config': config}), 201

@app.route('/api/events/<slug>', methods=['GET'])
def api_get_event(slug):
    config = load_event_config(slug)
    config['photoCount'] = photo_count(slug)
    return jsonify(config)

@app.route('/api/events/<slug>/config', methods=['PUT'])
def api_update_config(slug):
    config = load_event_config(slug)
    data   = request.get_json(force=True)
    # On ne laisse pas écraser le slug ni createdAt
    for k, v in data.items():
        if k not in ('slug', 'createdAt'):
            config[k] = v
    save_event_config(slug, config)
    update_events_index(slug, config)
    return jsonify(config)

@app.route('/api/events/<slug>', methods=['DELETE'])
def api_delete_event(slug):
    event_dir = EVENTS_DIR / slug
    if not event_dir.exists():
        abort(404)
    shutil.rmtree(event_dir)
    events = [e for e in load_events() if e['slug'] != slug]
    save_events(events)
    return jsonify({'deleted': slug})


# ─── API : Photos ─────────────────────────────────────────────────────────────

@app.route('/api/events/<slug>/photos', methods=['GET'])
def api_list_photos(slug):
    photos_file = EVENTS_DIR / slug / 'photos.json'
    if not photos_file.exists():
        return jsonify([])
    with open(photos_file, encoding='utf-8') as f:
        return jsonify(json.load(f))

@app.route('/api/events/<slug>/photos', methods=['POST'])
def api_upload_photos(slug):
    if not ensure_event_dirs(slug):
        return jsonify({'error': f"Événement '{slug}' introuvable dans events.json"}), 404
    event_dir  = EVENTS_DIR / slug
    photos_dir = event_dir / 'photos'
    photos_dir.mkdir(parents=True, exist_ok=True)
    uploaded   = []
    skipped    = []

    files = request.files.getlist('photos')
    if not files:
        return jsonify({'error': 'Aucun fichier reçu'}), 400

    for file in files:
        if not file.filename:
            continue
        ext = Path(file.filename).suffix.lower()
        if ext not in SUPPORTED_EXTS:
            skipped.append({'name': file.filename, 'reason': 'extension non supportée'})
            continue
        try:
            dest = photos_dir / file.filename
            file.save(str(dest))
            uploaded.append(file.filename)
        except Exception as e:
            skipped.append({'name': file.filename, 'reason': str(e)})

    return jsonify({'uploaded': uploaded, 'skipped': skipped, 'count': len(uploaded)})

@app.route('/api/events/<slug>/photos/<filename>', methods=['DELETE'])
def api_delete_photo(slug, filename):
    event_dir  = EVENTS_DIR / slug
    photo_file = event_dir / 'photos' / filename
    thumb_file = event_dir / 'photos' / 'thumbs' / (Path(filename).stem + '.webp')

    if photo_file.exists():
        photo_file.unlink()
    if thumb_file.exists():
        thumb_file.unlink()

    return jsonify({'deleted': filename})


# ─── API : Génération ─────────────────────────────────────────────────────────

@app.route('/api/events/<slug>/generate', methods=['POST'])
def api_generate(slug):
    try:
        ensure_event_dirs(slug)
        event_dir  = EVENTS_DIR / slug
        if not event_dir.exists():
            return jsonify({'error': f"Événement '{slug}' introuvable", 'photoCount': 0}), 404

        photos_dir = str(event_dir / 'photos')
        json_out   = str(event_dir / 'photos.json')
        py         = sys.executable
        script_thumbs = str(SHARED_DIR / 'generate_thumbnails.py')
        script_json   = str(SHARED_DIR / 'generate_json.py')

        if not Path(script_thumbs).exists():
            return jsonify({'error': f"Script introuvable : {script_thumbs}", 'photoCount': 0}), 500
        if not Path(script_json).exists():
            return jsonify({'error': f"Script introuvable : {script_json}", 'photoCount': 0}), 500

        res_thumbs = subprocess.run(
            [py, script_thumbs, '--photos-dir', photos_dir],
            capture_output=True, text=True, cwd=str(BASE_DIR), timeout=280
        )
        res_json = subprocess.run(
            [py, script_json, '--photos-dir', photos_dir, '--output', json_out],
            capture_output=True, text=True, cwd=str(BASE_DIR), timeout=60
        )

        count = photo_count(slug)
        return jsonify({
            'photoCount': count,
            'thumbnails': res_thumbs.stdout,
            'json':       res_json.stdout,
            'errors':     (res_thumbs.stderr + res_json.stderr).strip() or None,
        })
    except subprocess.TimeoutExpired as e:
        return jsonify({'error': f"Timeout : {e}", 'photoCount': 0}), 500
    except Exception as e:
        return jsonify({'error': str(e), 'photoCount': 0}), 500


# ─── API : Fichiers bruts de l'événement (pour l'app publique) ────────────────

@app.route('/api/events/<slug>/photos.json')
def api_photos_json(slug):
    photos_file = EVENTS_DIR / slug / 'photos.json'
    if not photos_file.exists():
        return jsonify([])
    with open(photos_file, encoding='utf-8') as f:
        return jsonify(json.load(f))


# ─── Diagnostic ───────────────────────────────────────────────────────────────

@app.route('/health')
def health():
    info = {
        'base_dir':   str(BASE_DIR),
        'events_dir': str(EVENTS_DIR),
        'events_dir_exists': EVENTS_DIR.exists(),
        'events_dir_writable': os.access(str(EVENTS_DIR), os.W_OK),
        'events_json_exists': EVENTS_JSON.exists(),
        'events': [],
    }
    for event in load_events():
        slug = event.get('slug')
        ed = EVENTS_DIR / slug
        pd = ed / 'photos'
        info['events'].append({
            'slug': slug,
            'dir_exists': ed.exists(),
            'photos_dir_exists': pd.exists(),
            'photos_dir_writable': pd.exists() and os.access(str(pd), os.W_OK),
            'photo_count': len(list(pd.glob('*.*'))) if pd.exists() else 0,
        })
    return jsonify(info)


# ─── Page d'accueil ───────────────────────────────────────────────────────────

@app.route('/')
def home():
    events = load_events()
    if not events:
        return '<meta http-equiv="refresh" content="0;url=/admin/">'
    return '<meta http-equiv="refresh" content="0;url=/admin/">'


# ─── Gestion des erreurs ──────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': str(e)}), 404

@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': f'Fichier trop volumineux (max {MAX_UPLOAD_MB} Mo)'}), 413


# ─── Initialisation Volume Railway ────────────────────────────────────────────
# Le Volume Railway se monte APRÈS que gunicorn importe server.py, donc on
# initialise les dossiers au premier before_request (pas au niveau module).

def ensure_event_dirs(slug: str):
    """Crée les dossiers nécessaires pour un événement donné sur le Volume."""
    event = next((e for e in load_events() if e.get('slug') == slug), None)
    if not event:
        return False
    event_dir = EVENTS_DIR / slug
    (event_dir / 'photos' / 'thumbs').mkdir(parents=True, exist_ok=True)
    config_file = event_dir / 'config.json'
    if not config_file.exists():
        save_event_config(slug, {
            'slug': slug, 'title': event.get('title', slug),
            'date': event.get('date', ''), 'pin': '1234',
            'createdAt': event.get('createdAt', ''), 'firebase': {},
        })
    photos_file = event_dir / 'photos.json'
    if not photos_file.exists():
        with open(photos_file, 'w') as f:
            json.dump([], f)
    return True

def init_event_dirs():
    for event in load_events():
        slug = event.get('slug')
        if slug:
            ensure_event_dirs(slug)

_dirs_initialized = False

@app.before_request
def lazy_init():
    global _dirs_initialized
    if not _dirs_initialized:
        _dirs_initialized = True
        EVENTS_DIR.mkdir(exist_ok=True)
        if not EVENTS_JSON.exists():
            save_events([])
        init_event_dirs()

# ─── Démarrage ────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    # En local, init immédiate (pas de volume Railway)
    EVENTS_DIR.mkdir(exist_ok=True)
    if not EVENTS_JSON.exists():
        save_events([])
    init_event_dirs()
    port = int(os.environ.get('PORT', 8080))
    debug = os.environ.get('FLASK_ENV') != 'production'
    print('🎉  Serveur démarré')
    print(f'📋  Admin  : http://localhost:{port}/admin/')
    print(f'📷  Events : http://localhost:{port}/events/<slug>/')
    app.run(debug=debug, host='0.0.0.0', port=port)
