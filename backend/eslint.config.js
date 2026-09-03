const js = require('@eslint/js');
const globals = require('globals');

/**
 * Config plana de ESLint para el backend (Node/CommonJS). Reglas mínimas
 * orientadas a atrapar errores reales (variables/imports muertos,
 * `require` de módulos nunca usados) sin imponer un estilo estricto que
 * generaría cientos de cambios cosméticos en código que ya funciona.
 */
module.exports = [
  { ignores: ['coverage/**', 'node_modules/**', 'uploads/**', 'backups/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },
];
