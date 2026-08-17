# Meeting statuses — nouveaux valeurs

## Enum API (snake_case)

```ts
type MeetingStatus =
  | "scheduled"      // Planifié
  | "confirmed"      // Confirmé
  | "bon_qualified"  // Bon Qualified
  | "done"           // Fait
  | "cancelled"      // Annulé
  | "no_show";       // No-show
```

| Valeur API | Label UI |
|------------|----------|
| `scheduled` | Planifié |
| `confirmed` | Confirmé |
| `bon_qualified` | Bon Qualified |
| `done` | Fait |
| `cancelled` | Annulé |
| `no_show` | No-show |

## À faire côté Nest

1. Étendre l’enum / check DB `meetings.status` pour accepter `confirmed` et `bon_qualified`.
2. Migration si colonne enum Postgres (ALTER TYPE … ADD VALUE).
3. `POST` / `PATCH /meetings` : valider ces valeurs.
4. `GET /meetings?status=confirmed` et `?status=bon_qualified` doivent filtrer correctement.
5. Rappels auto : comme pour `done` / `cancelled` / `no_show`, décider si `confirmed` / `bon_qualified` **annulent** ou **gardent** les jobs pending (recommandé : **garder** les rappels pour `confirmed` et `bon_qualified`, annuler seulement pour `cancelled` / `done` / `no_show`).
