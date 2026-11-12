import { defineConfig } from 'vitest/config';

// legacy/ contient l'ancienne implémentation et ses tests maison : on ne les exécute pas ici.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
