// Régénère la liste des pages (src/routeTree.gen.ts) à partir de src/routes.
// À lancer après avoir ajouté, renommé ou supprimé une page : npm run routes.
import { Generator, getConfig } from "@tanstack/router-generator";

const root = process.cwd();
const config = getConfig(
  { routesDirectory: "./src/routes", generatedRouteTree: "./src/routeTree.gen.ts" },
  root,
);
await new Generator({ config, root }).run();
console.log("src/routeTree.gen.ts régénéré");
