# WhatsApp media (Cloudinary)

## Supabase

Run in SQL Editor:

`sql/018-whatsapp-media-fields.sql`

Adds `media_url`, `file_name`, `file_size` on `whatsapp_messages`.

Also run `sql/019-media-files-raw.sql` so `media_files.resource_type` allows `raw`.

## API

- `POST /upload/raw` — documents (`resource_type: raw`)
- `POST /whatsapp/conversations/:id/messages` accepts optional:
  - `mediaUrl`, `type` (`image`|`video`|`document`), `fileName`, `fileSize`, `mimeType`
  - `text` is optional when `mediaUrl` is set (caption)

## Inbound media (Meta webhook)

When a contact sends image / video / document / audio:

1. Webhook reads Meta `media_id` from the message payload
2. `GET graph.facebook.com/v19.0/{media_id}` → temporary URL
3. Download bytes with `Authorization: Bearer META_ACCESS_TOKEN`
4. Upload to Cloudinary (`image` / `video` / `raw`; audio uses `video`)
5. Persist `media_url`, `file_name`, `file_size` on `whatsapp_messages`

On failure the message is still saved with body `Media unavailable` (chat does not break).

Requires SQL migrations `018` + `019` (see above).
