# Meeting members — équipe **côté client** (leads)

Le frontend ajoute des **participants côté client** (owner, assistant, autres personnes du client) en plus du contact principal.

Ce ne sont **pas** les users internes 63Agency (`GET /users` / Paramètres).

Accessible aux rôles **`admin`** et **`admin_whatsapp`**.

## Différence contact vs members

| Champ | Source UI | Qui |
|-------|-----------|-----|
| `contactName` / `contactPhone` / `contactEmail` + `leadId` | Recherche **leads** (ou saisie manuelle) | Contact principal du RDV |
| `members[]` | Recherche **autres leads** | Autres personnes côté client qui participent |

Les deux listes viennent de `GET /leads` — **pas** de la page Clients (`/clients`), **pas** de `/users`.

### Email lead (contact principal)

Sur `GET /leads` et `GET /leads/:id`, renvoyer **`email`** (ou `contact_email`) pour chaque lead.  
Le front remplit `contactEmail` à la sélection du lead (sinon saisie manuelle).

---

## Payload create / update

`POST /meetings` et `PATCH /meetings/:id` :

```json
{
  "title": "Appel découverte",
  "meetingDate": "2026-08-03T10:00:00.000Z",
  "leadId": "lead-principal-id",
  "contactName": "Karim Directeur",
  "contactPhone": "+212612345678",
  "contactEmail": "karim@client.com",
  "members": [
    {
      "leadId": "lead-assistant-id",
      "name": "Sara Assistante",
      "phone": "+212600000001",
      "email": "sara@client.com"
    },
    {
      "leadId": "lead-owner-id",
      "name": "Youssef Owner",
      "phone": "+212600000002",
      "email": null
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
- Sur `PATCH` : **remplacer** toute la liste.
- `leadId` optionnel mais recommandé (référence ClickUp / table leads).
- Snapshot `name` / `phone` / `email` au moment du RDV.
- Un membre sans phone **et** sans email → ignorer pour l’envoi (ou `400`).

---

## Réponse Meeting

```json
{
  "id": "uuid",
  "leadId": "lead-principal-id",
  "contactName": "Karim Directeur",
  "contactPhone": "+2126…",
  "contactEmail": "…",
  "members": [
    {
      "leadId": "lead-assistant-id",
      "name": "Sara Assistante",
      "phone": "+212600000001",
      "email": "sara@client.com"
    }
  ]
}
```

Aliases parse front : `members` | `attendees` | `teamMembers`.

---

## Rappels — fan-out

Pour chaque rappel (auto + `POST .../send-reminder`) :

1. Destinataires = **contact principal** + **chaque membre**.
2. WhatsApp → chaque `phone` non vide.
3. Email → chaque `email` non vide.
4. Dédupliquer numéros / emails.

---

## SQL suggéré

```sql
create table if not exists public.meeting_members (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  lead_id text null,
  name text not null,
  phone text null,
  email text null,
  created_at timestamptz not null default now()
);

create index if not exists meeting_members_meeting_id_idx
  on public.meeting_members (meeting_id);
```

> Ne pas lier à `users` (staff). `lead_id` = id lead ClickUp / leads Nest.

---

## Auth

| Action | admin | admin_whatsapp |
|--------|-------|----------------|
| Créer / éditer RDV + `members` | oui | oui |
| Envoyer rappel (fan-out) | oui | oui |
| Lister leads pour le picker | oui | oui (déjà le cas) |

**Pas besoin** d’ouvrir `GET /users` à `admin_whatsapp` pour cette feature.

---

## Checklist Nest

- [ ] Accepter `members` avec `leadId` / `name` / `phone` / `email` sur POST / PATCH
- [ ] Persister + retourner `members` sur GET
- [ ] Rappels → contact + tous les members
- [ ] Migration `meeting_members` (`lead_id`, pas `user_id`)
