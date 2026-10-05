// Bouton de développement : efface uniquement les données de démonstration
// Huntited (clés listées ci-dessous). Aucune autre clé n'est touchée.
import { Button } from "@/components/ui/button";

export const HUNTITED_MOCK_KEYS = [
  "huntited:mock-created-hunts",
  "huntited:mock-commitments",
  "huntited:mock-hunt-states",
  "huntited:mock-chat-rooms",
  "huntited:wallet",
  "huntited:user-hunts",
  "huntited:mock-wallet",
  // anciens formats du prototype
  "huntited:mock-commitment-records",
  "huntited:local-secrets",
  "huntited:mock-settled-hunts",
] as const;

export function clearHuntitedMockData(): void {
  for (const key of HUNTITED_MOCK_KEYS) window.localStorage.removeItem(key);
}

export function DevResetButton() {
  if (!import.meta.env.DEV) return null;
  return (
    <div className="fixed bottom-3 left-3 z-50">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          if (!window.confirm("Réinitialiser les données de démonstration Huntited ?")) return;
          clearHuntitedMockData();
          window.location.reload();
        }}
      >
        Réinitialiser les données de démonstration
      </Button>
    </div>
  );
}
