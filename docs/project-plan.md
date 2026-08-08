# EduQuest Project Plan

## Objetivos actuales

1. Habilitar el flujo de batalla con modo dev local y modo Firebase.
2. Integrar `PuzzleQuestion` en la pantalla de batalla.
3. Documentar y testar el componente con Storybook.
4. Asegurar que el flujo dev-mode sea estable sin Firebase.

## Tareas completadas

- [x] Integrar `PuzzleQuestion` como tipo de pregunta reorder.
- [x] Añadir soporte de `timeTakenMs` en `handleBattleAnswer()`.
- [x] Crear mock de batalla dev-mode con `localStorage` + `storage` event.
- [x] Implementar `finalizeBattleDev()` para cierre local de apuestas.
- [x] Añadir Storybook story `CssCheck` y ejecutar `vitest`.
- [x] Crear wireframes base para Lobby / Battle / Resultados.

## Tareas actuales

- [ ] Completar wireframes de `Lobby`, `Battle-Puzzle`, `Resultados` con variantes móviles.
- [ ] Documentar APIs y modelos de datos en `docs/models/eduquest-data-model.md`.
- [ ] Añadir backlog de tareas para mejorar UX de multijugador.
- [ ] Revisar y limpiar configuraciones Storybook/Vitest si hay dependencias sobrantes.

## Backlog sugerido

### Multijugador local

- [ ] Añadir soporte touch reorder para `PuzzleQuestion`.
- [ ] Agregar sincronización de estado de batalla en pestañas diferentes.
- [ ] Soportar observadores/spectators en batalla.
- [ ] Permitir rechazar retos con mensaje personalizado.

### UX de la batalla

- [ ] Mostrar cronómetro visual y bonificación de tiempo en pantalla.
- [ ] Añadir animaciones de acierto/fallo.
- [ ] Agregar resumen de resultados con desglose de puntuaciones.

### Historia y progreso

- [ ] Añadir guardado de progreso del jugador en Firebase/localStorage.
- [ ] Mostrar tabla de posiciones global y local.
- [ ] Implementar retos asíncronos (desafío offline).

## Notas técnicas

- `vite.config.js` ahora incluye `@storybook/addon-vitest` para ejecutar historias con `npx vitest run --run`.
- `App.jsx` usa `devMode` para saltar Firebase en tests locales.
- `PuzzleQuestion.stories.jsx` tiene `CssCheck` que valida la clase `bg-emerald-600`.

## Próximo paso recomendado

1. Añadir el wireframe de `Battle-Puzzle` con una vista mobile/desktop separada.
2. Crear un documento de “Requisitos de multijugador” basado en `App.jsx`.
3. Agregar un test E2E que cubra el proceso completo de reto → batalla → resultados.
