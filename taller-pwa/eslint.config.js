// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

/**
 * Tamaño y complejidad. De momento solo AVISAN ('warn'): sirven para medir
 * qué ficheros y funciones se pasan antes de partirlos. Los límites son
 * provisionales; cuando se acuerden, se pasarán a 'error'.
 * Se cuentan líneas de código: los comentarios y las líneas en blanco no.
 */
const estructura = {
  'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['warn', { max: 40, skipBlankLines: true, skipComments: true }],
  complexity: ['warn', 10],
  'max-depth': ['warn', 3],
};

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      ...estructura,
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
