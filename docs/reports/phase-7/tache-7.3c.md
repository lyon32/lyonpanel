# Tâche 7.3c — handler à 2 arguments

- Fichier modifié : `src/server/http/handler.ts` (seul).
- `handler()` renvoie maintenant `(req: NextRequest, routeCtx?: unknown) => Promise<Response>` ; le second argument est ignoré, le comportement est inchangé.
- Typecheck : plus d'erreur sur `POST(req, ctx)`. Restent seulement des erreurs dans `tests/**` (composants et hook à venir, et `mockImplementation` dans orders-sync.test.ts).
- `vitest run tests/unit/http tests/unit/providers` : 9 fichiers, 102 tests passés. Lint du fichier : OK.
- Pas de commit.
