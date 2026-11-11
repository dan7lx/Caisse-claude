// Configuration ESLint officielle d'Expo (https://docs.expo.dev/guides/using-eslint/).
// Lancer : npm run lint  (ou npm run verify pour tout vérifier d'un coup).
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*'],
  },
  {
    // Ces règles servent à préparer le « React Compiler », qui n'est pas activé dans ce projet.
    // Le code actuel les enfreint volontairement (refs à jour pendant le rendu, Date.now pour les chronos).
    // Elles restent visibles en avertissement, à réduire progressivement (voir docs/claude.md › Dette technique).
    rules: {
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
]);
