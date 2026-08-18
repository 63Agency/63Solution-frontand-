# Visibilité RDV — assignees (équipe interne)

## Objectif

Quand **admin** ou **admin_whatsapp** crée / édite un rendez-vous, ils **mentionnent** quels utilisateurs (`fixed_meeting`, etc.) doivent aussi voir ce RDV.

Exemple :

| Utilisateur | Rôle |
|-------------|------|
| Saad | `admin` |
| Sara | `admin_whatsapp` |
| Bilal | `fixed_meeting` |

- Saad et Sara **voient toujours tous les RDV** (nouveaux + déjà créés / legacy).
- Bilal ne voit un RDV **que** s’il est dans `assignedUserIds`.
- Les RDV **déjà en base sans assignees** → visibles **seulement** pour `admin` + `admin_whatsapp` (pas `fixed_meeting`).

> **Ne pas confondre** avec `members` (leads côté **client** / rappels WhatsApp-email).  
> Ici : staff 63Agency (`users`), champ **`assignedUserIds` / `assignees`**.

---

## Champs API

### Create / Update

```json
{
  "title": "Call client X",
  "meetingDate": "2026-08-12T10:00:00.000Z",
  "contactName": "…",
  "assignedUserIds": ["uuid-sara", "uuid-billel"]
}
```

| Champ | Type | Notes |
|-------|------|--------|
| `assignedUserIds` | `string[]` | IDs `users.id`. Remplace la liste à l’update. |

Le **créateur** doit toujours avoir accès (soit inclus dans `assignedUserIds`, soit auto-ajouté côté Nest).

### Lecture (GET meeting / list)

```json
{
  "id": "…",
  "assignedUserIds": ["uuid-sara", "uuid-billel"],
  "assignees": [
    {
      "userId": "uuid-sara",
      "prenom": "Sara",
      "nom": "…",
      "email": "sara@…",
      "role": "admin_whatsapp"
    }
  ]
}
```

**Ne pas** réutiliser `members`, `attendees`, `teamMembers` — déjà utilisés pour les leads client.

---

## Règles de visibilité (`GET /meetings`, `/today`, `/upcoming`, stats)

### `admin` et `admin_whatsapp`

```
→ TOUS les meetings (pas de filtre assignees)
→ y compris legacy (assignedUserIds vide / null)
```

### `fixed_meeting`

```
meeting visible ⇔ currentUserId ∈ assignedUserIds
```

- Si `assignedUserIds` est **vide / null** (RDV déjà créés avant la feature) → **ne pas** les renvoyer à `fixed_meeting`.
- Ces legacy restent visibles uniquement pour admin + admin_whatsapp.

---

## Qui peut assigner

| Rôle | Mentionner l’équipe (UI) | Voir les RDV |
|------|--------------------------|--------------|
| `admin` | oui | **tous** |
| `admin_whatsapp` | **oui** | **tous** |
| `fixed_meeting` | non | seulement s’il est dans `assignedUserIds` |

À la création par `fixed_meeting` : Nest assigne automatiquement `[creatorId]`.

---

## Liste des users pour le picker

Le front appelle, dans l’ordre :

1. `GET /users` — si OK  
2. sinon `GET /meetings/assignable-users`

**Important :** `admin_whatsapp` doit pouvoir **lister** les users (lecture seule) pour cocher Bilal / etc.

---

## Schéma suggéré

```sql
CREATE TABLE meeting_assignees (
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (meeting_id, user_id)
);
```

---

## Checklist Nest

1. Table `meeting_assignees` + `assignedUserIds` sur POST/PATCH  
2. **GET /meetings** :  
   - si rôle `admin` ou `admin_whatsapp` → **aucun filtre** (tous les RDV)  
   - si rôle `fixed_meeting` → filtre `userId IN assignedUserIds` (exclure legacy vides)  
3. Même règle pour `/today`, `/upcoming`, stats  
4. Autoriser `admin` + `admin_whatsapp` à lister les users  
5. Auto-assign créateur si besoin  
6. Ne pas envoyer rappels WhatsApp/email aux assignees internes  

---

## Front

- Filtre client de secours : `filterMeetingsForViewer`  
- Admin / Admin WhatsApp : affichent tout ce que l’API renvoie  
- `fixed_meeting` : filtre local sur `assignedUserIds`  
- Formulaire : section « Visible pour l’équipe » pour **admin** + **admin_whatsapp**
