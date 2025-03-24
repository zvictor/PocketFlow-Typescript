/**
 * @see https://prettier.io/docs/en/configuration.html
 * @type {import("prettier").Config}
 */

module.exports = {
  editorconfig: true,
  semi: false,
  useTabs: false,
  singleQuote: true,
  arrowParens: 'always',
  tabWidth: 2,
  printWidth: 100,
  trailingComma: 'all',
  plugins: ['@ianvs/prettier-plugin-sort-imports'],
  importOrderTypeScriptVersion: '5.4.5',
  importOrder: [
    '<BUILTIN_MODULES>', // Node.js built-in modules
    '^(zod/(.*)$)|^(zod$)',
    '^(react/(.*)$)|^(react$)',
    '^(next/(.*)$)|^(next$)',
    // third-party modules that do not start with @
    '^[\\w-]+$',
    '<THIRD_PARTY_MODULES>',
    '^~/(.*)$',
    '^@/lib/(.*)$',
    '^@/modules/(.*)$',
    '^@/app/(.*)$',
    '^@/config/(.*)$',
    '^@/styles/(.*)$',
    '^@/(.*)$',
    '^[.]',
    '^[./]',
    '',
    '<TYPES>^(node:)',
    '^@types/(.*)$',
    '<TYPES>',
    '^@/types/(.*)$',
    '<TYPES>^[.]',
    '^./types$',
  ],
}
