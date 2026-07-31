# Jours bloqués calendrier — contrat backend

Le frontend permet à l’**admin** de bloquer des jours : l’équipe ne peut plus créer ni déplacer un rendez-vous sur ces dates.

Timezone : **Africa/Casablanca** — la clé `date` est toujours `YYYY-MM-DD` dans ce fuseau.

## Endpoints

### `GET /meetings/blocked-days`

Liste les jours bloqués (tous les rôles authentifiés avec accès calendrier).

**Query (optionnel) :**

| Param | Format | Description |
|-------|--------|-------------|
| `from` | `YYYY-MM-DD` | Début inclus |
| `to` | `YYYY-MM-DD` | Fin inclus |

**Réponse 200 :**

```json
[
  {
    "id": "uuid",
    "date": "2026-08-15",
    "reason": "Congé équipe",
    "createdAt": "2026-07-20T10:00:00.000Z",
    "createdBy": "uuid-user"
  }
]
```

Ou `{ "items": [ … ] }` — le front accepte les deux.

---

### `POST /meetings/blocked-days`

Crée un jour bloqué. **Réservé admin** (`admin` / `superadmin`).

**Body :**

```json
{
  "date": "2026-08-15",
  "reason": "Congé équipe"
}
```

- `date` : obligatoire, unique (un seul bloc par jour).
- `reason` : optionnel, texte libre.

**Réponses :**

| Code | Cas |
|------|-----|
| `201` | Jour créé → objet `BlockedDay` |
| `400` | Date invalide |
| `409` | Date déjà bloquée |
| `403` | Rôle non autorisé |

---

### `DELETE /meetings/blocked-days/:id`

Supprime un jour bloqué. **Réservé admin**.

**Réponses :** `204` ou `200` `{ "ok": true }` · `404` si inconnu · `403` si non admin.

---

## Validation sur les meetings

Sur `POST /meetings` et `PATCH /meetings/:id` :

1. Extraire la date Casablanca de `meetingDate` (ISO timestamptz).
2. Si un enregistrement existe dans `meeting_blocked_days` pour cette date → **rejeter** :
   - HTTP `409 Conflict`
   - Message ex. : `"Ce jour est bloqué. Impossible de planifier un rendez-vous."`

Cette validation s’applique à **tous les rôles** (admin, admin_whatsapp, etc.).

---

## Table suggérée `meeting_blocked_days`

| Colonne | Type | Notes |
|---------|------|-------|
| `id` | uuid PK | |
| `date` | `date` UNIQUE | Jour bloqué (Casablanca) |
| `reason` | text NULL | Motif affiché côté admin |
| `created_by` | uuid FK users NULL | |
| `created_at` | timestamptz | default `now()` |

Index : `UNIQUE(date)`.

---

## Règles métier

1. Un jour bloqué = **toute la journée** (00:00 → 23:59 Casablanca).
2. Les RDV **existants** sur un jour nouvellement bloqué : soit les laisser (recommandé v1), soit avertir l’admin — le front ne les supprime pas automatiquement.
3. Seul l’**admin** peut créer / supprimer des jours bloqués.
4. Tous les utilisateurs du calendrier **voient** les jours bloqués (style rouge sur le calendrier) et ne peuvent pas en créer de nouveaux.

---

## Checklist backend

1. [ ] Migration SQL `meeting_blocked_days`
2. [ ] `GET /meetings/blocked-days` avec filtres `from` / `to`
3. [ ] `POST /meetings/blocked-days` (admin only)
4. [ ] `DELETE /meetings/blocked-days/:id` (admin only)
5. [ ] Validation 409 sur create/update meeting si date bloquée
6. [ ] Tests : double bloc même date → 409, meeting sur jour bloqué → 409

---

## Ce que le frontend fait déjà

- Bouton **« Jours bloqués »** (admin uniquement) sur `/dashboard/calendrier`
- Calendrier : jours bloqués en rouge, clic / création RDV refusés
- Formulaire RDV : message d’erreur si date bloquée, bouton Créer désactivé
- Appels API : `GET/POST/DELETE /meetings/blocked-days`

Le backend doit implémenter ces endpoints pour que la fonctionnalité soit opérationnelle en production.
