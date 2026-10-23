// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

/**
 * Tamaño y complejidad, con los límites acordados (los mismos que PMD en Java):
 * 250 líneas de código por fichero, 40 por función, complejidad 10 y 3 niveles
 * de anidamiento. Se cuentan líneas de código: comentarios y líneas en blanco no.
 * De momento solo AVISAN ('warn'); cuando esté todo partido pasan a 'error'.
 */
const estructura = {
  'max-lines': ['warn', { max: 250, skipBlankLines: true, skipComments: true }],
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
    // Una prueba se lee como una historia de pasos seguidos: partirla en trozos
    // la hace más difícil de seguir. Por eso 80 líneas por prueba, no 40.
    files: ['e2e/**/*.ts'],
    rules: {
      'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
]);
