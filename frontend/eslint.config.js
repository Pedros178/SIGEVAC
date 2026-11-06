import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

/**
 * Config plana de ESLint (formato ESLint 9+). Reglas mínimas pero con
 * intención: react-hooks/rules-of-hooks y exhaustive-deps atrapan la
 * clase de bugs más común en componentes con estado (dependencias
 * olvidadas en useEffect, hooks llamados condicionalmente), y no-unused-vars
 * detecta imports muertos que se acumulan al mover código entre archivos
 * (como en el refactor de Administracion.jsx / VoluntarioDetalle.jsx).
 */
export default [
  { ignores: ['dist/**', 'coverage/**', 'public/vendor/**'] }, // librerías de terceros sin modificar (minificadas)
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2022 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/jsx-uses-vars': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['tests/**/*.{js,jsx}', 'src/**/__tests__/**/*.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest, vi: 'readonly' },
    },
  },
];
