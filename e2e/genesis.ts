// Invitations de départ du backend de test (amorçage des pass), une par personne.
export const GENESIS = Array.from(
  { length: 24 },
  (_, i) => `e2e-genesis-${String(i).padStart(2, "0")}-invitation-de-test`,
);
