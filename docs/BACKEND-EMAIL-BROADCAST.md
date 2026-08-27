# Email broadcast — envoi groupé

Le front expose **Envoi Email** (`/dashboard/conversations/email-multiple`).

## Templates email

L’étape **Template** utilise le **même catalogue** que WhatsApp bulk (`GET /api/whatsapp/templates` / Meta).

Le front **réécrit** chaque template en version **email professionnelle** :

- **Objet** (`subject`) dédié
- **Corps HTML** formel (pas le texte WhatsApp mot pour mot)
- Variable `{{1}}` WhatsApp → `{{name}}` email

Exemples :

| Template WA | Objet email |
|-------------|-------------|
| `just_bonjour` | Prise de contact — 63 Agency |
| `proposal_sent_status` | Suivi de votre proposition — 63 Agency |
| `proposal_sent_2_` | Relance — votre proposition 63 Agency |

## Endpoints attendus

### `GET /email/recipients`

Query :

| Param   | Type   | Description                          |
|---------|--------|--------------------------------------|
| `listId`| string | Optionnel — filtre source ClickUp    |
| `status`| string | Optionnel — un seul statut lead      |

Réponse :

```json
[
  { "email": "karim@example.com", "name": "Karim" }
]
```

### `POST /email/broadcast`

```json
{
  "subject": "Prise de contact — 63 Agency",
  "html": "<p>Bonjour {{name}},</p><p>…</p>",
  "recipients": [
    { "email": "karim@example.com", "name": "Karim" }
  ],
  "templateId": "email-from-…",
  "templateName": "just_bonjour"
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

## Remplacement template

Nest doit remplacer `{{name}}` dans `subject` et `html` **par destinataire**.

## Auth

`Authorization: Bearer <JWT>` — mêmes rôles que WhatsApp broadcast.
