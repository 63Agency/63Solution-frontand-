# API Clients (carnet) — spec backend

Le dashboard appelle **`POST /clients`** quand l’utilisateur crée une **proposition** (ou un devis/facture si branché) avec un nom client.  
Sans cette route, le client n’apparaît pas sur la page **Clients** (liste = `GET /clients` uniquement).

---

## Erreur actuelle (logs navigateur)

```http
POST http://localhost:3002/clients
→ 404 {"message":"Cannot POST /clients"}
```

Nest : la route **n’est pas enregistrée** (seul `GET /clients` existe probablement).

---

## 1. Endpoints requis

| Méthode | Chemin | Rôle |
|--------|--------|------|
| `GET` | `/clients` | Liste du carnet (déjà en place si la page Clients charge) |
| `POST` | `/clients` | **Créer** un client (manquant → 404) |
| `PATCH` ou `PUT` | `/clients/:id` | Modifier (page Clients, édition) |
| `DELETE` | `/clients/:id` | Supprimer (page Clients) |

Auth : même JWT que devis/factures (`Authorization: Bearer …`).

---

## 2. Corps JSON (POST / PATCH)

Le front envoie exactement :

```json
{
  "clientNom": "younes",
  "clientEmail": "yassinbouzyan8@gmail.com",
  "clientTelephone": "0654944157",
  "clientIce": ""
}
```

| Champ | Type | Règle |
|-------|------|--------|
| `clientNom` | string | **Obligatoire** (trim, min 1 caractère) |
| `clientEmail` | string | Optionnel |
| `clientTelephone` | string | Optionnel |
| `clientIce` | string | Optionnel |

---

## 3. Réponse POST (201)

```json
{
  "id": "uuid-ou-serial",
  "clientNom": "younes",
  "clientEmail": "yassinbouzyan8@gmail.com",
  "clientTelephone": "0654944157",
  "clientIce": ""
}
```

Le front accepte aussi une enveloppe `{ "item": { … } }` ou `{ "data": { … } }` si le parseur existant le gère déjà pour GET.

---

## 4. Déduplication (recommandé)

Avant insert, refuser ou retourner l’existant si :

- même `clientEmail` (insensible à la casse), ou
- même `clientIce` non vide, ou
- même `clientNom` (insensible à la casse) si pas d’email/ICE

Le front fait déjà un `GET /clients` + comparaison ; un **409** ou retour du client existant évite les doublons côté API.

---

## 5. Exemple NestJS (ClientsController)

```typescript
@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll(@Req() req: RequestWithUser) {
    return this.clientsService.findAllForUser(req.user.id);
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateClientDto) {
    return this.clientsService.create(req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    return this.clientsService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.clientsService.remove(req.user.id, id);
  }
}
```

`CreateClientDto` : mêmes 4 champs string, `clientNom` avec `@IsNotEmpty()`.

Table suggérée : `clients` (`id`, `user_id` ou `agency_id`, `client_nom`, `client_email`, `client_telephone`, `client_ice`, `created_at`).  
**Pas de `client_id` obligatoire** sur `devis` / `factures` / `propositions` (découplage documents ↔ carnet).

---

## 6. Test rapide (Postman / curl)

```bash
curl -X POST http://localhost:3002/clients \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"clientNom":"Test","clientEmail":"a@b.com","clientTelephone":"","clientIce":""}'
```

Attendu : **201** + JSON avec `id`. Puis `GET /clients` doit lister le client.

---

## 7. Lien avec les propositions

- Création proposition : le front appelle **`registerPropositionClientInDirectory`** → `POST /clients` si absent du carnet.
- Suppression proposition : **ne supprime pas** le client du carnet.
- PDF proposition : champs client **sur le document**, pas besoin de jointure `clients`.

Voir aussi `docs/BACKEND-PROPOSITIONS.md` §7.

---

## 8. Checklist développeur backend

- [ ] `POST /clients` (corps ci-dessus, 201 + `id`)
- [ ] `PATCH /clients/:id` (ou `PUT`)
- [ ] `DELETE /clients/:id`
- [ ] `GET /clients` filtré par utilisateur / agence connectée
- [ ] Redémarrer l’API Nest après ajout du controller
- [ ] Test : créer une proposition → page Clients affiche le nouveau client
