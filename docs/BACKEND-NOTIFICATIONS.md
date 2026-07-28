# Notifications — intégration frontend

Le dashboard consomme l’API Nest documentée côté backend (`GET /notifications`, webhook WhatsApp, etc.).

## Endpoints utilisés

| Méthode | Route | Usage front |
|--------|--------|-------------|
| `GET` | `/notifications?limit=50` | Cloche + liste (`unreadCount`, `items`) |
| `PATCH` | `/notifications/:id/read` | Clic sur une notification |
| `PATCH` | `/notifications/read-all` | Bouton « Tout lire » |
| `PATCH` | `/whatsapp/conversations/:id/read` | Ouverture d’un fil (sync notifs côté backend) |

Auth : `Authorization: Bearer <JWT>` (même session que le reste du dashboard).

## Format attendu (`GET /notifications`)

```json
{
  "unreadCount": 2,
  "items": [
    {
      "id": "uuid",
      "type": "whatsapp.message",
      "title": "Karim",
      "body": "Bonjour, je veux un devis",
      "href": "/dashboard/conversations?c=conv-uuid",
      "createdAt": "2026-06-01T14:32:00.000Z",
      "read": false,
      "meta": { "conversationId": "conv-uuid", "phoneNumber": "212612345678" }
    }
  ]
}
```

Le front accepte aussi `created_at`, `read_at`, `conversation_id` (snake_case).

## Repli si l’API notifications est indisponible

Si `GET /notifications` renvoie **404** ou une **erreur** (ex. table Supabase non migrée) :

- Repli sur `GET /whatsapp/conversations` (`unreadCount`, `lastMessageText`, …)
- Toasts / alertes dérivés du polling WhatsApp

Après exécution de `sql/017-notifications-table.sql` et redémarrage Nest, le front bascule automatiquement sur `source: "api"`.

## Polling

Intervalle : `NEXT_PUBLIC_WHATSAPP_POLL_MS` (défaut 3000 ms). Un seul poll alimente la cloche et les toasts.

## Déduplication WhatsApp (backend)

Après migration `sql/024-notifications-whatsapp-dedup.sql` :

- **Une notification par conversation** (upsert au lieu d’une row par webhook).
- Nouveau message sur une conversation déjà notifiée → **mise à jour** (`body`, `createdAt`), pas de doublon.
- `GET /notifications` → liste sans doublons par conversation.
- `unreadCount` = nombre de **notifications non lues** (≠ nombre de messages WhatsApp).
- Ouvrir un fil (`PATCH /whatsapp/conversations/:id/read`) marque la notification associée comme lue (`markReadByConversationId` côté Nest).

Le frontend ne change pas d’endpoint ; il consomme `unreadCount` tel quel et garde une couche anti-doublon sur les toasts (poll / preview).

## Déploiement checklist

1. Exécuter `sql/017-notifications-table.sql` dans Supabase  
2. Exécuter **`sql/024-notifications-whatsapp-dedup.sql`** dans Supabase (prod + staging)  
3. Redémarrer l’API Nest  
4. Vérifier `GET /notifications` (200 + JSON, pas de doublons par `conversationId`)  
5. Envoyer un message WhatsApp test → badge cloche + entrée dans le panneau  
6. Renvoyer un 2ᵉ message sur la même conversation → **1 seule** entrée mise à jour, pas 2 lignes
