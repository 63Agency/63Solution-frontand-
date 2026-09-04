# Meeting titles — liste fixe

## Objectif

Le front n’autorise plus un titre libre. À la création / édition, le titre est choisi dans une liste déroulante.

## Valeurs exactes (`title` string)

```
Audit Performance Marketing
Audit Performance Marketing présentiel
Audit Performance Marketing online
Appel téléphonique
```

Défaut front à la création : `Audit Performance Marketing`.

## Nest

1. Valider `title` sur `POST /meetings` et `PATCH /meetings/:id` : une des **4** valeurs ci-dessus.
2. Les RDV legacy avec un autre titre restent lisibles ; à l’update, forcer une des valeurs autorisées.
3. Pas besoin d’un nouveau champ — garder `title` (string).
4. Les templates WhatsApp / email de confirmation / rappel doivent utiliser ce `title` tel quel.
