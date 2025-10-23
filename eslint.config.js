import js from '@eslint/js'
import globals from 'globals'

export default [
  js.configs.recommended,
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node, console: true, __dirname: true, URLSearchParams: true, setTimeout: true }
    },
    rules: {
      'no-empty': ['error', { 'allowEmptyCatch': true }]
    }
  }
]
