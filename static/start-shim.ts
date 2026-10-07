// Version statique : remplace @tanstack/react-start (le serveur n'existe pas).
// Seule fonction utilisée côté navigateur : createClientOnlyFn, qui ne sert
// qu'à écarter du code du rendu serveur — ici, tout est rendu dans le navigateur.
export const createClientOnlyFn = <T extends (...args: never[]) => unknown>(fn: T): T => fn;
