# Meeting statuses

Aligné avec le backend.

## Enum API (snake_case)

```ts
type MeetingStatus =
  | "scheduled"      // Planifié — rappels gardés
  | "confirmed"      // Confirmé — rappels gardés
  | "bon_qualified"  // Bon Qualified — rappels gardés
  | "non_qualified"  // Non qualifier — rappels annulés
  | "no_answer"      // No answer — rappels gardés
  | "done"           // Done — rappels annulés
  | "cancelled"      // Annulé — rappels annulés
  | "reported"       // Reported — rappels annulés
  | "no_show";       // No-show — rappels annulés
```

| Valeur API | Label UI | Rappels auto |
|------------|----------|--------------|
| `scheduled` | Planifié | gardés |
| `confirmed` | Confirmé | gardés |
| `bon_qualified` | Bon Qualified | gardés |
| `non_qualified` | Non qualifier | annulés |
| `no_answer` | No answer | gardés |
| `done` | Done | annulés |
| `cancelled` | Annulé | annulés |
| `reported` | Reported | annulés |
| `no_show` | No-show | annulés |

Le front accepte déjà toutes ces valeurs (filtre, formulaire, badges, actions rapides).
