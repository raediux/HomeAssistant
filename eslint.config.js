import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // dist-lib / ds-bundle / .ds-sync / .design-sync are generated design-sync
  // artifacts (already gitignored) — never lint them.
  globalIgnores(['dist', 'dist-lib', 'ds-bundle', '.ds-sync', '.design-sync']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // Context files intentionally export provider + hook + context together;
    // fast refresh falling back to a full reload on those files is fine.
    files: ['src/contexts/**/*.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
