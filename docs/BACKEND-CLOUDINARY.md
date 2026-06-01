# Upload médias — intégration frontend

API Nest uniquement (pas d’appel Cloudinary direct depuis Next.js).

## Configuration

```env
NEXT_PUBLIC_API_URL=http://localhost:3002
# Optionnel — player embed vidéo
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=votre_cloud_name
```

Auth : `Authorization: Bearer <JWT>` sur toutes les routes.

## Endpoints

| Action | Route | Body |
|--------|--------|------|
| Image | `POST /upload/image` | `FormData` → `file` |
| Vidéo | `POST /upload/video` | `FormData` → `file` |
| Plusieurs | `POST /upload/multiple` | `FormData` → `files[]` (max 10) |
| Galerie | `GET /upload/media` | — |
| URLs optimisées | `GET /upload/transform?publicId=...&width=...` | — |
| Supprimer | `DELETE /upload?publicId=...` | — |

Query optionnelle : `?folder=mon-dossier` (défaut `63agency`).

**Limites** : images 10 Mo (jpg, png, webp, gif), vidéos 100 Mo (mp4, mov, avi, mkv).

## Réponse upload

Utiliser en priorité :

- `optimizedUrl` — affichage (`f_auto`, `q_auto`)
- `secureUrl` — secours
- `thumbnailUrl` — vignette vidéo
- `breakpoints[]` — `srcset` responsive

Objet `media` = ligne Supabase (`id`, `publicId`, etc.).

## Progression upload

`XMLHttpRequest` + `xhr.upload.onprogress` — implémenté dans `lib/upload/backend-upload.ts`.

## publicId avec `/`

`encodeURIComponent('folder/file')` dans l’URL ou `?publicId=...`.

## Composants frontend (ce repo)

| Fichier | Rôle |
|---------|------|
| `lib/upload/backend-upload.ts` | Client API + XHR |
| `lib/upload/types.ts` | Types |
| `src/hooks/useCloudinaryUpload.ts` | Hook upload |
| `src/components/media/MediaUploader.tsx` | Drag & drop |
| `src/components/media/MediaGallery.tsx` | Galerie |
| `src/components/media/VideoPlayer.tsx` | Lecture vidéo |
| `app/dashboard/medias/page.tsx` | Page démo |

## Déploiement backend

Exécuter `sql/018-media-files-table.sql` dans Supabase, puis redémarrer Nest.
