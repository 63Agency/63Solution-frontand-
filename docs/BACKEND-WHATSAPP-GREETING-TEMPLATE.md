# WhatsApp — template « bonjour » (fenêtre 24 h)

Le front affiche un bouton **« Envoyer Bonjour »** dans la conversation quand la fenêtre Meta de 24 h est fermée (pas de message libre possible).

## Contexte Meta

- Après le **dernier message entrant** du contact, l’entreprise a **24 h** pour envoyer du texte libre / médias.
- Au-delà (ou si le contact n’a jamais écrit), seuls les **templates approuvés** passent.
- Le front détecte la fermeture côté client (`lastInboundAt` + 24 h) et bloque le composeur.

## Comportement front (déjà en place)

1. Bannière jaune + composeur désactivé si fenêtre fermée.
2. Bouton **« Envoyer Bonjour »** → envoi du template configuré (défaut : `just_bonjour`, langue `fr`).
3. Variable `{{1}}` envoyée **uniquement** si le body du template contient `{{1}}` (ex. `just_bonjour` = texte fixe, **0 paramètre**).
4. Bouton **« Choisir un template »** → liste complète via `GET /api/whatsapp/templates` (proxy Nest ou WhatChimp).

### Envoi côté front

Le front appelle en priorité :

```http
POST /whatsapp/broadcast
Authorization: Bearer <token>
Content-Type: application/json
```

**Template sans variable** (`just_bonjour`) :

```json
{
  "phoneNumbers": ["212612345678"],
  "templateName": "just_bonjour",
  "templateLanguage": "fr",
  "components": []
}
```

**Template avec `{{1}}`** :

```json
{
  "phoneNumbers": ["212612345678"],
  "templateName": "bonjour_personnalise",
  "templateLanguage": "fr",
  "variable1": "Karim",
  "components": [
    {
      "type": "body",
      "parameters": [{ "type": "text", "text": "Karim" }]
    }
  ]
}
```

Fallback testé si 404 : `POST /whatsapp/messages/bulk` (même body).

Variable d’environnement front (optionnelle) :

```env
NEXT_PUBLIC_WHATSAPP_GREETING_TEMPLATE=just_bonjour
```

## Ce qu’il faut côté Nest

### 1. Template Meta approuvé

- Template actuel : **`just_bonjour`** (langue **`fr`**) — texte fixe, **sans** `{{1}}`.
- Exemple body : `Bonjour 👋` / `J'espère que vous allez bien.`
- Statut **APPROVED** obligatoire.
- **Ne pas** injecter `variable1` / `components.body.parameters` si le template Meta n'a aucune variable (sinon erreur `#132000`).

### 2. Endpoint broadcast (recommandé)

`POST /whatsapp/broadcast` doit :

1. Normaliser le numéro (E.164 / digits sans `+`).
2. Appeler **WhatsApp Cloud API** `POST /{phone-number-id}/messages` avec type `template`.
3. **Persister** le message sortant dans la conversation Supabase (comme un message outbound `type: text` ou `template`).
4. Retourner :

```json
{
  "sent": 1,
  "failed": 0,
  "results": [
    {
      "phoneNumber": "212612345678",
      "success": true,
      "conversationId": "uuid",
      "messageId": "uuid"
    }
  ]
}
```

En cas d’échec Meta, renvoyer `success: false` + `error` lisible (idéalement suffixe `Meta: …` pour le front).

### 3. (Optionnel) Endpoint dédié conversation

Pour lier explicitement à une conversation ouverte dans le CRM :

```http
POST /whatsapp/conversations/:conversationId/messages/template
```

```json
{
  "templateName": "just_bonjour",
  "templateLanguage": "fr"
}
```

Réponse : objet message (même shape que `POST .../messages` texte).

Le front utilise aujourd’hui **broadcast** ; cet endpoint simplifierait la traçabilité.

### 4. Liste templates

`GET /whatsapp/templates` (ou proxy existant) doit inclure le template `bonjour` pour qu’il apparaisse aussi dans le sélecteur complet.

## Erreurs à remonter clairement

| Cas | Message suggéré |
|-----|-----------------|
| Fenêtre fermée + envoi texte libre | `Meta: … message failed: 24 hour window …` |
| Paramètres en trop (#132000) | `Meta: (#132000) Number of parameters does not match … expected (0)` — ne pas envoyer `variable1` si le template n'a pas de `{{1}}` |
| Template inconnu / rejeté | `Meta: (#132000) Template name does not exist …` |
| Numéro invalide | `Meta: (#131030) Recipient phone number not valid …` |

Le front mappe les erreurs contenant `24h` / `template` vers : *« Ce contact n'a pas répondu depuis 24h. Envoyez un template. »*

## Checklist backend

1. Template Meta **`just_bonjour`** (fr) approuvé — 0 variable.
2. `POST /whatsapp/broadcast` opérationnel : `templateName` seul si pas de `{{1}}`, sinon `variable1` + `components`.
3. Message enregistré en base et visible au prochain `GET .../messages`.
4. Erreurs Meta exposées dans `results[].error`.
5. (Optionnel) `POST /whatsapp/conversations/:id/messages/template`.
