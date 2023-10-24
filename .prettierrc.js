/* eslint-env node */
module.exports = {
  printWidth: 100,
  semi: true,
  tabWidth: 2,
  trailingComma: 'none',
  plugins: ["prettier-plugin-solidity"],
  overrides: [
    {
      files: "*.sol",
      options: {
        parser: "solidity-parse",
        printWidth: 100,
        tabWidth: 2,
        useTabs: false,
        singleQuote: false,
        bracketSpacing: false,
      }
    }
  ]
};
