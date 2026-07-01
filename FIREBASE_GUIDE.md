# Guide Firebase — Photo Soirée

Firebase est **optionnel** — la galerie fonctionne sans lui. Il active uniquement :
- ❤️ Réactions sur les photos
- 🏷 Tags (identifier des personnes sur les photos)  
- 📖 Livre d'or
- 📤 Upload invités *(nécessite le plan Blaze)*

---

## 1. Créer un projet Firebase

1. Va sur [console.firebase.google.com](https://console.firebase.google.com)
2. Clique **Ajouter un projet**
3. Nomme-le (ex: `photo-soiree-mae`) — tu peux en créer un par soirée ou en partager un pour toutes
4. Désactive Google Analytics si tu n't'en as pas besoin → **Créer le projet**

---

## 2. Activer la Realtime Database

1. Dans le menu gauche → **Realtime Database** → **Créer une base de données**
2. Choisis une région (ex: `europe-west1`)
3. Démarre en **mode test** (on sécurisera après)

Tu obtiens une URL de type :
```
https://photo-soiree-mae-default-rtdb.europe-west1.firebasedatabase.app
```
**Garde-la, tu en auras besoin.**

---

## 3. Récupérer les clés de l'app

1. Dans la console Firebase → ⚙️ **Paramètres du projet** (icône engrenage)
2. Onglet **Général** → descends jusqu'à **Vos applications**
3. Clique **</>** (ajouter une app Web)
4. Nomme-la (ex: `album-web`) → **Enregistrer l'application**
5. Firebase affiche un bloc `firebaseConfig` :

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "photo-soiree-mae.firebaseapp.com",
  databaseURL: "https://photo-soiree-mae-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "photo-soiree-mae",
  storageBucket: "photo-soiree-mae.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

Tu as besoin de **3 valeurs** :
| Champ admin | Valeur Firebase |
|---|---|
| Firebase databaseURL | `databaseURL` |
| Firebase API Key | `apiKey` |
| Firebase Project ID | `projectId` |

---

## 4. Configurer la soirée dans l'admin

1. Ouvre `http://localhost:8080/admin/`
2. Clique sur ta soirée
3. Dans **Configuration**, remplis les 3 champs Firebase
4. Clique **Sauvegarder**

C'est tout — les réactions, tags et livre d'or fonctionnent immédiatement.

---

## 5. Sécuriser la base de données (important)

Par défaut le mode test autorise tout le monde à lire et écrire. Change les règles pour limiter l'accès.

Dans Firebase Console → **Realtime Database** → onglet **Règles** :

```json
{
  "rules": {
    "reactions": {
      "$eventSlug": {
        "$photoId": {
          "$emoji": {
            "$fingerprint": {
              ".read": true,
              ".write": true
            }
          }
        }
      }
    },
    "tags": {
      "$eventSlug": {
        "$photoId": {
          ".read": true,
          ".write": true
        }
      }
    },
    "messages": {
      "$eventSlug": {
        ".read": true,
        ".write": true,
        "$messageId": {
          ".validate": "newData.hasChildren(['name', 'message', 'date']) && newData.child('message').val().length <= 280"
        }
      }
    },
    "guest-photos": {
      "$eventSlug": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

Clique **Publier**.

> Ces règles permettent à tout le monde de lire/écrire (accès public). Pour restreindre davantage, il faudrait implémenter Firebase Auth — non nécessaire pour un album privé protégé par PIN.

---

## 6. Upload invités (optionnel — plan Blaze requis)

L'upload de photos par les invités utilise **Firebase Storage**, qui nécessite le passage au **plan Blaze** (pay-as-you-go). Le plan Blaze a un **quota gratuit généreux** :
- 5 Go de stockage gratuit
- 1 Go de téléchargement/jour gratuit

### Activer Firebase Storage

1. Firebase Console → **Storage** → **Commencer**
2. Accepte les règles par défaut → choisir la région
3. Dans **Règles**, remplace par :

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /guest-uploads/{eventSlug}/{allPaths=**} {
      allow read: if true;
      allow write: if request.resource.size < 20 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

4. Ajoute le `storageBucket` dans la config de la soirée dans l'admin
   *(le champ n'est pas encore dans le panel — à ajouter si besoin)*

---

## 7. Un Firebase pour toutes les soirées ou un par soirée ?

| | Firebase partagé | Firebase par soirée |
|---|---|---|
| **Avantage** | Une seule config | Isolation complète des données |
| **Inconvénient** | Données mélangées si mal structurées | Plusieurs projets à gérer |
| **Recommandation** | ✅ Suffisant | Pour usage multi-clients |

L'app namespaces toutes les données par slug (`reactions/mae-18ans-2025/...`), donc un seul projet Firebase suffit même pour plusieurs soirées.

---

## Résumé des étapes

```
1. console.firebase.google.com → Créer un projet
2. Realtime Database → Créer (mode test)
3. Paramètres → Ajouter app web → Copier apiKey, databaseURL, projectId
4. Admin Photo-soirée → Soirée → Coller les 3 valeurs → Sauvegarder
5. Realtime Database → Règles → Coller les règles ci-dessus → Publier
```

**Temps estimé : 10 minutes.**
