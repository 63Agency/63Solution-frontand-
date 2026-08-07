# Rappels rendez-vous — contrat backend

Le frontend calendrier envoie et affiche **3 rappels automatiques** avant chaque RDV, sur **WhatsApp** et/ou **email**.

## Planning attendu

| Offset | Moment d’envoi | Clé API |
|--------|----------------|---------|
| J-2 | `meetingDate - 2 jours` | `"2d"` |
| J-1 | `meetingDate - 24 heures` | `"24h"` |
| H-2 | `meetingDate - 2 heures` | `"2h"` |

Timezone : **Africa/Casablanca** (alignée avec le calendrier front).

## Payload create / update

`POST /meetings` et `PATCH /meetings/:id` acceptent :

```json
{
  "title": "Appel découverte",
  "meetingDate": "2026-08-01T10:00:00.000Z",
  "contactName": "Karim",
  "contactPhone": "+212612345678",
  "contactEmail": "karim@exemple.com",
  "reminders": {
    "whatsapp": { "2d": true, "24h": true, "2h": true },
    "email": { "2d": true, "24h": false, "2h": true }
  }
}
```

- Si le canal n’a pas de contact (pas de phone / pas d’email), ignorer ce canal même si `true`.
- Si `reminders` est omis : défaut = **tous activés** pour les canaux disponibles.
- Recalculer les jobs si `meetingDate` ou `reminders` change (annuler les jobs `pending` et reschedule).

## Réponse Meeting (GET /meetings, create, update)

```json
{
  "id": "uuid",
  "meetingDate": "2026-08-01T10:00:00.000Z",
  "contactPhone": "+2126…",
  "contactEmail": "…",
  "reminderWhatsappSent": false,
  "reminderEmailSent": false,
  "reminders": {
    "whatsapp": { "2d": true, "24h": true, "2h": true },
    "email": { "2d": true, "24h": true, "2h": true }
  },
  "remindersStatus": {
    "whatsapp": { "2d": "pending", "24h": "pending", "2h": "pending" },
    "email": { "2d": "sent", "24h": "pending", "2h": "pending" }
  }
}
```

### `remindersStatus` valeurs

| Valeur | Signification |
|--------|----------------|
| `pending` | Programmé, pas encore envoyé |
| `sent` | Envoyé avec succès |
| `skipped` | Désactivé / canal indisponible |
| `failed` | Tentative échouée |

Les flags legacy `reminderWhatsappSent` / `reminderEmailSent` restent supportés (= true si **au moins un** offset du canal est `sent`).

## Scheduler (à implémenter côté Nest)

1. À la création / update d’un meeting `scheduled` : créer jusqu’à **6 jobs** (3 offsets × 2 canaux) selon `reminders`.
2. Ne programmer un job que si `sendAt > now` (ex. RDV dans 3 h → skip `2d` et `24h`, garder `2h` si encore dans le futur).
3. Worker périodique (cron / queue) : exécuter les jobs dus.
4. WhatsApp : template Meta approuvé (ou message session si fenêtre ouverte) avec titre RDV, date/heure, lien Meet.
5. Email : SMTP / provider existant, même contenu.
5bis. **Fan-out membres côté client** : si le meeting a `members[]` (autres leads / participants client), envoyer aussi WhatsApp/email à chaque membre (voir `docs/BACKEND-MEETING-MEMBERS.md`). Destinataires = contact + members (dédupliqués). **Pas** le staff interne `/users`.
6. Idempotence : unique `(meetingId, channel, offset)` — ne pas renvoyer si déjà `sent`.
7. Si statut passe à `cancelled` / `done` / `no_show` : annuler tous les jobs `pending`.

## Table suggérée `meeting_reminders`

| Colonne | Type |
|---------|------|
| id | uuid PK |
| meeting_id | uuid FK |
| channel | `whatsapp` \| `email` |
| offset | `2d` \| `24h` \| `2h` |
| enabled | boolean |
| send_at | timestamptz |
| status | `pending` \| `sent` \| `skipped` \| `failed` |
| sent_at | timestamptz null |
| error | text null |
| UNIQUE(meeting_id, channel, offset) | |

## Envoi immédiat à la création

Le frontend envoie `notifyOnCreate: true` sur `POST /meetings` (case cochée par défaut), puis appelle aussi `POST /meetings/:id/send-reminder` en secours.

### Attendu Nest (recommandé)

Sur `POST /meetings`, si `notifyOnCreate === true` (ou toujours par défaut) :

1. Créer le RDV + lien Meet.
2. Envoyer **immédiatement** une notification / confirmation au contact (+ `members[]`) :
   - WhatsApp si `contactPhone` / `members[].phone`
   - Email si `contactEmail` / `members[].email`
3. Contenu : titre, date/heure (Casablanca), lien Meet.
4. Ne **pas** marquer les jobs auto `2d` / `24h` / `2h` comme `sent` (même règle que le rappel manuel).
5. Réponse optionnelle : `notificationSent: { whatsapp: boolean, email: boolean }`.

Si Nest gère déjà l’envoi via `notifyOnCreate`, le 2ᵉ appel front `send-reminder` doit rester **idempotent** (ne pas spammer).

---

## Endpoint manuel (existant)

`POST /meetings/:id/send-reminder` — envoi immédiat.

### Rôles autorisés

| Rôle | Accès |
|------|--------|
| `admin` / `superadmin` | Oui |
| `admin_whatsapp` | **Oui** (même droits que admin pour cet endpoint) |
| Autres | Non → `403 Forbidden` |

Le frontend affiche déjà le bouton **« Envoyer le rappel maintenant »** pour `admin` et `admin_whatsapp`. Si le backend refuse encore `admin_whatsapp` avec un `403`, le bouton échoue côté utilisateur.

**Important — séparation manuel vs automatique :**

- L’envoi manuel **ne doit PAS** marquer les jobs auto (`2d` / `24h` / `2h`) comme `sent`.
- Ne pas écraser `remindersStatus` des offsets automatiques.
- Optionnel : tracker à part, ex. `manualReminderSentAt`, `manualReminderWhatsappSent`, `manualReminderEmailSent`.
- Les flags legacy `reminderWhatsappSent` / `reminderEmailSent` peuvent rester `true` après un envoi manuel, **mais** `remindersStatus.whatsapp["2d"|…]` doit rester `pending` jusqu’à l’exécution réelle du job auto.
- Les jobs cron J-2 / 24h / 2h continuent normalement après un envoi manuel.

Optionnel : accepter `{ "channel": "whatsapp" | "email", "offset": "2h" }` pour cibler un rappel précis. Sans body = envoi manuel immédiat (tous les canaux disponibles), sans toucher au scheduler auto.

## Checklist backend

1. Persister `reminders` sur create/update  
2. Table / jobs + cron  
3. Retourner `reminders` + `remindersStatus` dans les réponses Meeting  
4. Annuler les jobs si RDV annulé / date modifiée  
5. Templates WhatsApp + email prêts  
6. Logs d’échec + status `failed`  
7. `POST .../send-reminder` manuel ≠ mise à jour des status auto J-2/24h/2h  
8. Autoriser **`admin` + `admin_whatsapp`** sur `POST /meetings/:id/send-reminder`  
9. Sur `POST /meetings` avec `notifyOnCreate: true` → envoi immédiat confirmation au client (+ members), idempotent avec `send-reminder`  

