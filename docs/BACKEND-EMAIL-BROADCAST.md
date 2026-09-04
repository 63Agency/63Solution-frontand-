# Email broadcast — mapping par template WhatsApp

L’envoi email est intégré dans **Envoi multiple** (`/dashboard/conversations/envoi-multiple`).

## Mapping email ↔ template WA

### `GET /email/templates/:waTemplateName`

Retourne la version email enregistrée pour ce template Meta.

```json
{
  "waTemplateName": "just_bonjour",
  "subject": "Prise de contact — 63 Agency",
  "html": "<p>Bonjour {{name}},</p>…",
  "found": true
}
```

- **404** ou mapping absent → le front affiche des champs vides + hint.
- Variable : `{{name}}` (nom du contact).

### `PUT /email/templates/:waTemplateName`

Enregistre / met à jour la version par défaut (bouton « Enregistrer comme version par défaut »).

```json
{
  "subject": "…",
  "html": "<p>…</p>"
}
```

## Envoi groupé

### `POST /email/broadcast`

Appelé en parallèle du broadcast WhatsApp si la case est cochée.

```json
{
  "subject": "…",
  "html": "…",
  "recipients": [{ "email": "karim@example.com", "name": "Karim" }],
  "templateName": "just_bonjour"
}
```

- Uniquement destinataires **avec email**.
- Phone-only → WhatsApp seul ; email-only → email seul.
- Nest remplace `{{name}}` dans subject + html.

Réponse : `{ sent, failed, total, results[] }`.

## Auth

Mêmes rôles JWT que WhatsApp broadcast.
