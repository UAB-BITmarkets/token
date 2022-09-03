module.exports = {
  env: {
    browser: true,
    es2021: true,
    mocha: true,
    node: false
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'standard',
    'plugin:prettier/recommended',
    'plugin:node/recommended',
    'plugin:import/typescript'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12
  },
  rules: {
    camelcase: 'off',
    'node/no-unsupported-features/es-syntax': [
      'error',
      { ignores: ['modules'] }
    ]
  },
  settings: {
    node: {
      tryExtensions: ['.js', '.json', '.node', '.ts', '.d.ts']
    }
  }
};
