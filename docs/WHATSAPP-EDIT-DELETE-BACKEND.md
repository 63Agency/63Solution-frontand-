# WhatsApp message update / delete — backend contract

Frontend (CRM) is ready. Nest must expose the endpoints below so edit & delete work end-to-end.

## Endpoints required

### 1) Update message text

```http
PATCH /whatsapp/conversations/:conversationId/messages/:messageId
Authorization: Bearer <token>
Content-Type: application/json

{ "text": "nouveau contenu" }
```

**Rules**
- Only **outbound** messages of type `text` (or caption edit if you support it later).
- Reject empty `text` → `400`.
- Unknown / foreign conversation message → `404`.
- Persist new body + `edited_at` (ISO timestamp).
- Response: full message object (same shape as GET / POST messages), including:

```json
{
  "id": "uuid",
  "conversationId": "uuid",
  "direction": "outbound",
  "body": "nouveau contenu",
  "type": "text",
  "status": "delivered",
  "metaMessageId": "wamid....",
  "editedAt": "2026-08-01T20:00:00.000Z",
  "isDeleted": false,
  "createdAt": "..."
}
```

**Meta / WhatsApp Cloud API**
- Message **edit** on the recipient phone is **not reliably available** on the Business Cloud API the same way as consumer WhatsApp.
- **Minimum (required for CRM):** update the row in Supabase so the agent sees the new text after refresh / poll.
- **Optional later:** if Meta adds / you find an edit Graph call for your WABA, call it; otherwise document that edit is **CRM-only** (contact still sees the original text on their phone).

Also update conversation `lastMessageText` / `lastMessageAt` when the edited message is the latest one.

---

### 2) Delete message

```http
DELETE /whatsapp/conversations/:conversationId/messages/:messageId?forEveryone=true|false
Authorization: Bearer <token>
```

| Query | Meaning |
|-------|---------|
| `forEveryone=false` or omitted | Soft-delete **CRM only** (« Supprimer pour moi ») |
| `forEveryone=true` | Soft-delete CRM **+** revoke on Meta for the contact (« Supprimer pour tout le monde ») — outbound only |

**Soft-delete (required)**
- Set `deleted_at = now()`, `is_deleted = true` (or equivalent).
- Prefer **keeping the row** so quotes / history stay consistent.
- GET messages may either:
  - still return the row with `isDeleted: true` / `deletedAt`, **or**
  - omit hard-hidden rows — frontend already removes optimistically and shows « Ce message a été supprimé » when `isDeleted` is true.
- Do **not** resurrect a deleted message on poll without `isDeleted`.

**forEveryone=true (Meta)**
- Call WhatsApp Cloud API message delete / revoke using `metaMessageId` (`wamid…`).
- If Meta rejects (too old, already deleted, missing wamid) → return clear `4xx` with message; frontend shows toast and rolls back optimistic UI.
- Inbound messages: reject `forEveryone=true` with `400` (CRM only offers « pour moi »).

**Response:** `204 No Content` or `200` with the soft-deleted message object.

Also refresh conversation preview (`lastMessageText`) if the deleted message was the last one.

---

## Suggested SQL (Supabase)

```sql
alter table public.whatsapp_messages
  add column if not exists edited_at timestamptz;

alter table public.whatsapp_messages
  add column if not exists deleted_at timestamptz;

-- optional convenience flag (or derive from deleted_at IS NOT NULL)
alter table public.whatsapp_messages
  add column if not exists is_deleted boolean not null default false;
```

---

## Auth / ownership

Same as existing WhatsApp routes: authenticated agent, message must belong to `:conversationId`, conversation must be accessible to the org/user.

---

## Frontend already calls

| Action | Client helper |
|--------|----------------|
| Edit | `updateWhatsAppMessage(conversationId, messageId, { text })` |
| Delete | `deleteWhatsAppMessage(conversationId, messageId, { forEveryone })` |

Files: `lib/whatsapp/backend-whatsapp.ts`, UI in `ChatThread` / `MessageContextMenu` / `MessageBubble`.

---

## Smoke test checklist (backend)

1. Run SQL migration.
2. Deploy Nest.
3. Send a text message from CRM → PATCH it → GET messages shows new `body` + `editedAt`.
4. DELETE with `forEveryone=false` → message shows deleted / hidden in CRM.
5. DELETE outbound with `forEveryone=true` → Meta revoke succeeds (or documented error); CRM soft-deleted.
6. Poll / refresh does not bring the old body back without `editedAt` / deleted flags.
