# Spécification backend — Propositions commerciales

Document à transmettre au développeur Nest (`63Agency-Solution-Server`).  
Le front **ne génère plus le PDF** : même modèle que **devis** et **factures** (`GET …/pdf` → blob téléchargé).

Référence front :
- Payload : `lib/proposition/backend-proposition.ts` → `BackendPropositionPayload`
- Mise en page visuelle (référence template) : `src/components/dashboard/proposition/PropositionPdfPreview.tsx`

---

## 1. Authentification

Toutes les routes : header `Authorization: Bearer <access_token>` (comme `/devis` et `/factures`).

---

## 2. CRUD Propositions

### `POST /propositions`

Crée une proposition. Corps JSON = `BackendPropositionPayload` :

```json
{
  "titreProposition": "string",
  "preparePour": "string",
  "nomEtablissement": "string",
  "clientNom": "string (optionnel)",
  "preparePar": "string",
  "dateEmission": "YYYY-MM-DD",
  "propositionNumero": "PROP-2026-001 (optionnel, sinon généré côté serveur)",
  "clientIce": "string (optionnel)",
  "clientEmail": "string (optionnel)",
  "clientTelephone": "string (optionnel)",
  "emetteur": {
    "societeNom": "63 AGENCY",
    "societeRc": "…",
    "societeCnie": "…",
    "societeIce": "…",
    "societeTp": "…",
    "societeAdresse": "…",
    "societeTelephone": "…",
    "societeEmail": "…"
  },
  "introduction": {
    "paragraphe1": "string (peut contenir {{etablissement}})",
    "paragraphe2": "string",
    "objectifProspects": 100
  },
  "strategie": {
    "section1CreationContenu": {
      "description": "string",
      "videosMin": 2,
      "videosMax": 4,
      "topics": ["string"]
    },
    "section2CampagnesPublicitaires": {
      "intro": "string",
      "approcheIntro": "string (**gras** supporté)",
      "blocs": [
        { "titre": "1. Création & Paramétrage des campagnes", "intro": "string", "points": ["string"] },
        { "titre": "2. Optimisation continue des performances", "intro": "string", "points": ["string"] }
      ],
      "conclusion": "string (**gras** supporté)"
    },
    "section3FunnelMarketing": {
      "intro": "string",
      "criteres": ["string"],
      "conclusion": "string"
    },
    "section4Automatisation": {
      "points": ["string"],
      "objectif": "string"
    }
  },
  "tarifs": {
    "lignes": [
      {
        "service": "string",
        "detail": "string (colonne Détail ; **gras** → <strong> dans le PDF)",
        "prixInitial": "string",
        "prixOffert": "string"
      }
    ],
    "noteMetaAds": "string"
  },
  "pourquoiChoisir": ["string"],
  "prochainesEtapes": "string (peut contenir {{etablissement}})",
  "contact": {
    "nom": "string",
    "telephone": "string",
    "email": "string",
    "tagline": "string"
  }
}
```

**Réponse 201** (exemple) :

```json
{
  "id": "uuid",
  "numero": "PROP-2026-001",
  "titreProposition": "…",
  "nomEtablissement": "…",
  "preparePour": "…",
  "status": "draft",
  "dateEmission": "2026-05-18",
  "createdAt": "2026-05-18T12:00:00.000Z"
}
```

**À faire côté serveur à la création :**
- Générer `numero` unique `PROP-{ANNÉE}-{SEQ}` si absent.
- **Ne pas** créer / lier de ligne dans `public.clients` : les champs `clientNom`, `clientEmail`, `clientTelephone`, `clientIce` restent **sur le document** uniquement (découplage comme devis/factures — migration `sql/012-decouple-documents-from-clients.sql`).

---

### `GET /propositions`

Liste paginée (même logique que devis).

**Réponse 200** : tableau d’objets `{ id, numero, titreProposition, nomEtablissement, preparePour, status, dateEmission, createdAt }`.

---

### `GET /propositions/:id`

Détail complet (payload + métadonnées).

---

### `PATCH /propositions/:id`

Mise à jour partielle ou complète (même schéma que POST).

---

### `DELETE /propositions/:id`

Suppression en base (réponse **200** ou **204**). Le front appelle cette route **avant** de retirer la ligne du tableau / localStorage.

`ref` = uuid renvoyé par `POST /propositions`, ou numéro `PROP-YYYY-NNN`.

**Alternatives** si `DELETE` est bloqué :

- `POST /propositions/:id/delete`
- `POST /propositions/by-numero/:numero/delete` (numéro `PROP-…`)

---

## 3. PDF — **obligatoire** (comme devis / factures)

### `GET /propositions/:id/pdf`

| Élément | Valeur |
|--------|--------|
| Méthode | `GET` |
| Auth | Bearer JWT |
| Réponse OK | `200`, `Content-Type: application/pdf` |
| Corps | binaire PDF |
| Erreurs | `401`, `403`, `404` (proposition introuvable), `500` |

**Comportement identique à :**
- `GET /devis/:id/pdf`
- `GET /factures/:id/pdf`

Le front télécharge ainsi :

```ts
const res = await fetch(`${API}/propositions/${id}/pdf`, {
  headers: { Authorization: `Bearer ${token}` },
});
const blob = await res.blob();
// anchor.download = "proposition-PROP-2026-001.pdf"
```

**Contenu du PDF (3 pages logiques) :**

1. **Page 1** — Titre, préparée pour, établissement, préparée par, **Introduction** (2 paragraphes).
2. **Page 2** — **Notre stratégie et les étapes vers des résultats concrets** (4 sous-sections).
3. **Page 3** — Tarifs, Pourquoi 63 AGENCY, Prochaines étapes, Contact.

Voir `PropositionPdfPreview.tsx` pour la mise en page exacte.

#### Tableau « Tarifs Proposés » — 4 colonnes

| Colonne PDF | Champ JSON | Notes |
|-------------|------------|--------|
| Service | `tarifs.lignes[].service` | Texte brut |
| **Détail** | `tarifs.lignes[].detail` | Texte ; `**mot**` → gras (comme introduction) |
| Prix Initial (MAD) | `tarifs.lignes[].prixInitial` | Ex. `5 550 / mois` |
| Prix Offert (MAD) | `tarifs.lignes[].prixOffert` | Ex. `Offert`, `4 000 / mois` |

Si `detail` est absent (anciennes données), afficher cellule vide ou `—`.

#### Section « Notre stratégie… » — à respecter dans le PDF

**Titre de section (H2, centré)**  
`Notre stratégie et les étapes vers des résultats concrets`

**1. Création de Contenu** (`strategie.section1CreationContenu`)

| Champ JSON | Rendu PDF |
|------------|-----------|
| `description` | 2 paragraphes séparés par `\n\n` dans la chaîne (ne pas fusionner en un seul bloc) |
| `videosMin`, `videosMax` | Phrase fixe : « Dans le cadre de cette collaboration, **{min} à {max} vidéos** seront produites, orientées autour de : » |
| `topics[]` | Liste à puces (5 items par défaut) |

**Texte par défaut `description` :**

```
Le contenu est le pilier central de la stratégie.

Il vise à rassurer les parents, valoriser l'image de l'établissement et mettre en avant la pédagogie.
```

**Liste `topics` par défaut :**

- Présentation de l'école et de sa vision  
- Direction et équipe pédagogique  
- Vie scolaire et activités des élèves  
- Infrastructures et environnement  
- Approche pédagogique et accompagnement des parents  

**2. Campagnes Publicitaires** — `strategie.section2CampagnesPublicitaires` : intro + approcheIntro (gras `**…**`) + 2 blocs (titre, intro, liste `points[]`) + conclusion. Voir `PropositionPdfPreview.tsx`.

**3. Funnel Marketing** — `intro` + liste `criteres[]` + `conclusion`

**4. Automatisation & Suivi** — liste `points[]` + `objectif`

**Important :** le PDF doit utiliser les champs enregistrés en BDD (`POST`/`PATCH`), pas un ancien template fixe. Les champs `introduction.*` et `strategie.*` du payload sont la source de vérité.

**Implémentation suggérée (Nest) :** même stack que devis/factures (Puppeteer, PDFKit, @react-pdf/renderer côté serveur, etc.).

---

## 4. Envoi email

### `POST /propositions/:id/send-email`

Corps (aligné devis/factures) :

```json
{
  "to": "client@email.com",
  "subject": "Proposition PR-2026-001",
  "message": "texte du mail"
}
```

- Générer ou réutiliser le PDF de la proposition en pièce jointe.
- Réponse `200` / `204` en cas de succès.

Le front essaie aussi `/email` et `/send` en secours ; **préférer** `/send-email`.

---

## 5. Intégration front (état actuel)

| Fonctionnalité | Comportement |
|----------------|--------------|
| Enregistrer / Télécharger PDF | Le front appelle d’abord `POST` ou `PATCH /propositions`, puis `GET /propositions/:id/pdf` |
| Liste | Encore `localStorage` en secours si `GET /propositions` absent |
| Email | `POST /propositions/:id/send-email` |

**Si `GET …/pdf` renvoie 404 :** soit la route PDF n’est pas déployée, soit la proposition n’existe pas en BDD après le POST.

Priorité backend :

1. `POST /propositions` + `GET /propositions`
2. `GET /propositions/:id/pdf`
3. `POST /propositions/:id/send-email`
4. Brancher le front (remplacer `savePropositionLocal` par appels API)

---

## 6. Numérotation

Format : `PROP-YYYY-NNN` (ex. `PROP-2026-001`).  
Le front affiche `PR-2026-001` dans l’UI (remplacement du préfixe uniquement visuel).

---

## 7. Clients (découplés des documents)

- Les coordonnées client sur la proposition (`clientNom`, `clientEmail`, etc.) sont **stockées sur la proposition** (PDF / emails = champs document).
- Le front appelle **`POST /clients`** à l’enregistrement d’une proposition pour alimenter le carnet (voir **`docs/BACKEND-CLIENTS.md`**). Sans `POST /clients`, la page Clients reste vide malgré une proposition créée.
- Supprimer une proposition **ne supprime pas** le client du carnet.

---

## 8. Checklist développeur

- [ ] Entité `Proposition` + migration DB (sans `client_id` — voir `010` / `012`)
- [ ] CRUD `/propositions`
- [ ] Génération PDF `GET /propositions/:id/pdf` (parité devis/factures)
- [ ] `POST /propositions/:id/send-email` avec PDF joint
- [ ] Numéro auto `PROP-YYYY-NNN`
- [ ] Pas de sync `ClientsService` à la création / modification
- [ ] Tests manuels : Postman + téléchargement depuis le dashboard (onglet Propositions)
