PuzzleQuestion component

Props:
- question: object { id: string|number, fragments: string[] }
- onSubmit: function(payload) where payload is { answer: string, timeTakenMs: number }

Behavior:
- Renders fragments as draggable elements. The user reorders them and presses "Enviar".
- On submit, the component calls `onSubmit({answer, timeTakenMs})` where `answer` is the fragments joined with `||`.
- Data-test attributes: `puzzle-question`, `puzzle-fragment`, `puzzle-submit`, `puzzle-fragments`, `puzzle-selected`.

Example usage:

<PuzzleQuestion question={q} onSubmit={(payload) => handleAnswer(payload)} />

Notes:
- Time measurement starts when the component mounts or when `question.id` changes.
- The component uses HTML5 Drag & Drop; for mobile, further improvements (touch reorder) are recommended.
