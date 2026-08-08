# EduQuest Data Model

Este documento describe el modelo de datos usado por el flujo de batalla y el rompecabezas en modo dev/Firebase.

## Entidades principales

### Battle

- `id`: string
- `status`: `pending` | `active` | `finished`
- `timestamp`: number
- `betAmount`: number
- `player1`: PlayerBattleState
- `player2`: PlayerBattleState
- `questions`: Question[]

### PlayerBattleState

- `uid`: string
- `name`: string
- `avatar`: string
- `score`: number
- `currentQ`: number
- `done`: boolean

### Question

- `type`: string
- `text`: string
- `answer`: string
- `options`: string[]
- `qText`?: string
- `grid`?: string[][]
- `startCoord`?: [number, number]
- `endCoord`?: [number, number]

En el caso de `PuzzleQuestion`, la pregunta se mapea a:
- `type`: `puzzle`
- `question`: { `id`, `fragments`: string[] }
- `answer`: cadena ordenada separada por `||`

## Flujo de batalla

### Modo dev

- Se crea un `battle` en `localStorage` con clave `dev_battle_{id}`.
- Se dispara un `storage` event manual para sincronizar otras pestañas.
- El `battle` comienza en `pending` y cambia a `active` cuando el rival acepta.
- Las respuestas se almacenan en el objeto `battle` guardado en localStorage.
- Cuando ambos jugadores terminan, `status` se mueve a `finished`.
- `finalizeBattleDev()` aplica la apuesta localmente y actualiza el ranking en `playersList`.

### Modo Firebase

- Se crea un documento de batalla en `artifacts/{APP_ID}/public/data/battles/{battleId}`.
- La batalla también puede registrarse en `players` para ranking de puntuaciones.
- `acceptChallenge()` genera preguntas y actualiza `status` a `active`.
- `handleBattleAnswer()` actualiza la puntuación de `player1` o `player2` y marca `done`.
- `finalizeBattle()` corre una transacción en Firestore para:
  - establecer `status: finished`
  - aplicar la `betAmount` al ganador
  - actualizar document(s) de `players` con el nuevo score

## Tipos de pregunta

- `puzzle`: rompecabezas de fragmentos reorder
- `order`: ordenar palabras de una oración
- `spelling`: detectar palabra mal escrita
- `vocab`: sinónimos/antónimos
- `grammar`: mayúsculas correctas
- `tf`: verdadero/falso
- `wordsearch`: sopa de letras
- `complex_reading`: lectura con pregunta

## Claves locales

- `eduquest_name`
- `eduquest_avatar`
- `eduquest_score_{name}`
- `dev_battle_{battleId}`

## Notas de robustez

1. En modo dev se usa un `StorageEvent` manual porque el mismo contexto no dispara el evento.
2. `finalizeBattleDev()` decide al ganador por `score` y `currentQ` en empate.
3. `handleBattleAnswer()` permite payloads de tipo `{ answer, timeTakenMs }` para los puzzles.
