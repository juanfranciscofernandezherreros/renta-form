const defaultProfile = {
  paths: ['features/**/*.feature'],
  require: ['features/support/*.js', 'features/step_definitions/*.js'],
  format: ['progress', 'html:cucumber-report.html'],
  timeout: 60000,
}

export { defaultProfile as default }

export const api = {
  paths: ['features/api/**/*.feature'],
  require: ['features/support/api_hooks.js', 'features/step_definitions/api.steps.js'],
  format: ['progress', 'html:cucumber-report.html'],
  tags: '@api',
  timeout: 30000,
}
