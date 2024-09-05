// eslint-disable-next-line @typescript-eslint/no-var-requires
const jestUnitConfig = require('./jest.config');

/**
 * Jest E2E configuration
 * - Run all tests in `test` folder
 */
module.exports = {
  ...jestUnitConfig,
  roots: ['test'],
  testRegex: '.e2e-spec.ts$',
};
