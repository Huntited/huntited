- The site is fully static: no Huntited server, and no external editor (the
  Lovable starter template has been removed). Avoid rewriting published git
  history (no force push).
- Keep the MVP covenant limited to active, activated, and expired states; abuse handling remains off-chain to preserve protocol simplicity.
- Never put a secret in a `VITE_*` variable or anywhere in `src/`: everything
  shipped in the static site is public. Publishing keys stay in the
  git-ignored `.env.publish`.
