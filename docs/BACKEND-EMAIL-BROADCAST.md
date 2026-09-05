# Email broadcast — mapping par template WhatsApp

L’envoi email est intégré dans **Envoi multiple** (`/dashboard/conversations/envoi-multiple`).

## Mapping email ↔ template WA

### `GET /email/templates/:waTemplateName`

```json
{
  "wa_template_name": "welcome_new_lead",
  "subject": "Bienvenue — 63 Agency",
  "html_body": "<p>Bonjour {{name}},</p>…"
}
```

Le front lit **`subject`** + **`html_body`** (snake_case).

### `PUT /email/templates/:waTemplateName`

```json
{
  "subject": "…",
  "html_body": "<p>…</p>"
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
