const defaultProfile = {
  paths: ['features/**/*.feature'],
  require: ['features/support/*.js', 'features/step_definitions/*.js'],
  format: ['progress', 'html:cucumber-report.html'],
  timeout: 60000,
}

// Profile for running only frontend Playwright tests (no backend/DB required).
// Invoked by `npm run test:frontend` or directly:
//   npx cucumber-js --profile frontend
const frontendProfile = {
  paths: ['features/frontend.feature'],
  require: ['features/support/*.js', 'features/step_definitions/frontend.steps.js'],
  format: ['progress', 'html:cucumber-report.html'],
  tags: '@frontend',
  timeout: 60000,
}

export { defaultProfile as default, frontendProfile as frontend }
