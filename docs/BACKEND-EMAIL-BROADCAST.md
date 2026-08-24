# Email broadcast — envoi groupé

Le front expose **Envoi Email** (`/dashboard/conversations/email-multiple`).

## Endpoints attendus

### `GET /email/recipients`

Query :

| Param   | Type   | Description                          |
|---------|--------|--------------------------------------|
| `listId`| string | Optionnel — filtre source ClickUp    |
| `status`| string | Optionnel — un seul statut lead      |

Réponse (array ou `{ recipients: [...] }`) :

```json
[
  { "email": "karim@example.com", "name": "Karim" }
]
```

- Uniquement des contacts **avec email valide**.
- Dédupliquer par email côté Nest si possible.

### `POST /email/broadcast`

```json
{
  "subject": "Bonjour {{name}}",
  "html": "<p>Bonjour {{name}},</p><p>…</p>",
  "recipients": [
    { "email": "karim@example.com", "name": "Karim" }
  ]
}
```

Réponse :

```json
{
  "sent": 1,
  "failed": 0,
  "total": 1,
  "results": [
    {
      "email": "karim@example.com",
      "name": "Karim",
      "success": true
    }
  ]
}
```

En échec : `"success": false`, `"error": "…"`.

## Remplacement template

Le backend (ou le front avant envoi — actuellement le **backend**) doit remplacer `{{name}}` dans `subject` et `html` **par destinataire**.

Le front envoie le template brut + la liste `recipients` ; Nest personnalise puis envoie via SMTP / provider.

## Auth

`Authorization: Bearer <JWT>` — mêmes rôles que WhatsApp broadcast (`admin`, `admin_whatsapp`, etc.).
