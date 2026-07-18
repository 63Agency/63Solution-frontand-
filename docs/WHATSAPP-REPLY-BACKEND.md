# WhatsApp reply / quote — backend notes for API + DB

## Problem
1. When an agent replies in the CRM, the quote disappears after refresh.
2. When a client replies on WhatsApp, the CRM does not show the quoted message.

## Root cause
Quotes were only kept in frontend React state. DB/API did not store or return reply context. Inbound Meta webhooks include `context.id` (wamid of the quoted message) but it was ignored.

## What was implemented in Nest (`63Agency-Solution-Server`)

### 1) SQL (run in Supabase)
File: `sql/017-whatsapp-reply-to.sql`

```sql
alter table public.whatsapp_messages
  add column if not exists reply_to_wati_message_id text;

alter table public.whatsapp_messages
  add column if not exists reply_to_preview text;

alter table public.whatsapp_messages
  add column if not exists reply_to_author text;
```

### 2) POST `/whatsapp/conversations/:id/messages`
Body already accepted:
```json
{ "text": "nadi", "replyToMessageId": "<uuid or wamid.xxx>" }
```

On send:
- Resolve quoted message → Meta `context.message_id`
- Persist `reply_to_*` columns on the outbound row
- API response includes `replyTo: { id, body, authorLabel }`

### 3) Webhook inbound
When Meta sends:
```json
"context": { "from": "...", "id": "wamid.XXX" }
```
- Store `reply_to_wati_message_id`
- Resolve preview/author from the quoted row when possible
- Return `replyTo` on GET messages

### 4) GET messages shape
Each message may include:
```json
{
  "id": "...",
  "body": "...",
  "metaMessageId": "wamid....",
  "watiMessageId": "wamid....",
  "replyTo": {
    "id": "wamid....",
    "body": "Audio",
    "authorLabel": "Vous"
  }
}
```

## Checklist for backend / ops
1. Run `sql/017-whatsapp-reply-to.sql` in Supabase
2. **Deploy Nest to the server that receives Meta webhooks** (often production `api.63agency.com`, not only localhost)
   - Local `localhost:3002` receives CRM sends, but Meta usually posts inbound webhooks to the public URL
   - Until production Nest includes this code, contact replies will keep arriving with `reply_to_* = null`
3. Confirm Meta webhook URL points to: `POST /whatsapp/webhooks/meta` on that deployed API
4. Restart Nest
5. Smoke test: from the phone, **swipe reply** on a CRM message (not a normal new message) → CRM must show the green quote
6. Check Nest logs for: `HAS reply context id=wamid...` (if you see `no reply context`, Meta/WhatChimp is not forwarding `context`)

## How to verify in Supabase
```sql
select direction, body, reply_to_wati_message_id, reply_to_preview, reply_to_author
from whatsapp_messages
order by created_at desc
limit 10;
```
Inbound rows from a real WhatsApp reply must have `reply_to_wati_message_id` filled.
