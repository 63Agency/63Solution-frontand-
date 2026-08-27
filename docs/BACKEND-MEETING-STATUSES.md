# Meeting statuses

## Enum API (snake_case)

```ts
type MeetingStatus =
  | "scheduled"      // Planifié
  | "confirmed"      // Confirmed
  | "bon_qualified"  // Bon Qualified
  | "done"           // Fait
  | "no_answer"      // No answer
  | "cancelled"      // Cancelled
  | "reported"       // Reported
  | "no_show";       // No show
```

| Valeur API | Label UI |
|------------|----------|
| `scheduled` | Planifié |
| `confirmed` | Confirmed |
| `bon_qualified` | Bon Qualified |
| `done` | Fait |
| `no_answer` | No answer |
| `cancelled` | Cancelled |
| `reported` | Reported |
| `no_show` | No show |

## Nouveaux statuts à supporter

- **`no_answer`** — pas de réponse du contact
- **`reported`** — RDV signalé / reporté (à traiter)

Les autres (`confirmed`, `cancelled`, `no_show`) existent déjà côté front.

## À faire côté Nest

1. Étendre l’enum / check DB `meetings.status` pour accepter **`no_answer`** et **`reported`**.
2. Migration Postgres si enum :  
   `ALTER TYPE … ADD VALUE 'no_answer';`  
   `ALTER TYPE … ADD VALUE 'reported';`
3. `POST` / `PATCH /meetings` : valider ces valeurs.
4. Filtres : `GET /meetings?status=no_answer` et `?status=reported`.
5. Rappels auto :
   - **Annuler** jobs pending si `cancelled` / `done` / `no_show` / `reported` (recommandé).
   - **Garder** les rappels pour `confirmed`, `bon_qualified`, `no_answer`, `scheduled`.
