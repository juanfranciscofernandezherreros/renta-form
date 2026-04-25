const defaultProfile = {
  paths: ['features/**/*.feature'],
  require: ['features/support/*.js', 'features/step_definitions/*.js'],
  format: ['progress', 'html:cucumber-report.html'],
  timeout: 60000,
}

export { defaultProfile as default }
