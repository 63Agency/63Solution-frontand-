# Meeting members (équipe) — contrat backend

Le frontend calendrier permet d’ajouter des **membres internes** (owner, assistant, autres) en plus du **contact client/lead**.

Accessible aux rôles **`admin`** et **`admin_whatsapp`**.

## Différence contact vs membres

| Champ | Source | Qui |
|-------|--------|-----|
| `contactName` / `contactPhone` / `contactEmail` | Lead ClickUp ou saisie manuelle | Client / prospect |
| `members[]` | `GET /users` (équipe Paramètres) | Staff interne |

Les rappels WhatsApp / email doivent partir au **contact + chaque membre** qui a un téléphone / email.

---

## Payload create / update

`POST /meetings` et `PATCH /meetings/:id` :

```json
{
  "title": "Appel découverte",
  "meetingDate": "2026-08-03T10:00:00.000Z",
  "contactName": "Karim Client",
  "contactPhone": "+212612345678",
  "contactEmail": "karim@client.com",
  "leadId": "optional-lead-id",
  "members": [
    {
      "userId": "uuid-user-1",
      "name": "Sara Owner",
      "phone": "+212600000001",
      "email": "sara@63agency.com"
    },
    {
      "userId": "uuid-user-2",
      "name": "Youssef Assistant",
      "phone": "+212600000002",
      "email": "youssef@63agency.com"
    }
  ],
  "reminders": {
    "whatsapp": { "2d": true, "24h": true, "2h": true },
    "email": { "2d": true, "24h": true, "2h": true }
  }
}
```

### Règles `members`

- Tableau optionnel (défaut `[]`).
- Sur `PATCH` : **remplacer** la liste entière par celle envoyée (pas de merge partiel).
- `userId` optionnel mais recommandé (FK vers `users`).
- Snapshot `name` / `phone` / `email` au moment du RDV (si le profil user change plus tard, le RDV garde ces valeurs).
- Ignorer un membre sans `phone` **et** sans `email` pour l’envoi, ou rejeter `400`.

---

## Réponse Meeting

Chaque meeting (GET list / create / update) doit inclure :

```json
{
  "id": "uuid",
  "contactName": "Karim Client",
  "contactPhone": "+2126…",
  "contactEmail": "…",
  "members": [
    {
      "userId": "uuid-user-1",
      "name": "Sara Owner",
      "phone": "+212600000001",
      "email": "sara@63agency.com"
    }
  ]
}
```

Aliases acceptés côté front parse : `members` | `attendees` | `teamMembers`.

---

## Rappels — fan-out

Pour chaque job rappel (offset × canal) :

1. Destinataires = contact principal **+** tous les `members[]`.
2. WhatsApp : envoyer à chaque numéro non vide (`contactPhone` + `members[].phone`).
3. Email : envoyer à chaque email non vide (`contactEmail` + `members[].email`).
4. Dédupliquer les numéros / emails identiques.
5. `POST /meetings/:id/send-reminder` (manuel) : même fan-out.

Idempotence suggérée : unique `(meetingId, channel, offset, recipient)` ou logger les destinataires dans `meeting_reminders`.

---

## SQL suggéré

```sql
create table if not exists public.meeting_members (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid null references public.users(id) on delete set null,
  name text not null,
  phone text null,
  email text null,
  created_at timestamptz not null default now()
);

create index if not exists meeting_members_meeting_id_idx
  on public.meeting_members (meeting_id);
```

---

## Auth / rôles

| Action | admin | admin_whatsapp |
|--------|-------|----------------|
| Créer / éditer RDV avec `members` | oui | oui |
| Envoyer rappel manuel (fan-out) | oui | oui |
| `GET /users` (liste équipe pour le picker) | oui | **oui (lecture seule)** |

> Important : le front charge l’équipe via `GET /users`.  
> `admin_whatsapp` doit pouvoir **lister** les users (name, phone, email) même s’il ne peut pas créer/supprimer des comptes.

Champs minimaux pour le picker : `id`, `prenom`, `nom`, `email`, `telephone`, `role`.

---

## Checklist Nest

- [ ] Accepter `members` sur POST / PATCH `/meetings`
- [ ] Persister + retourner `members` sur GET
- [ ] Rappels auto + `send-reminder` → contact + tous les membres
- [ ] Autoriser `GET /users` en lecture pour `admin_whatsapp`
- [ ] Migration `meeting_members`
