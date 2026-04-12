export default {
  default: {
    paths: ['features/**/*.feature'],
    require: ['features/support/world.js', 'features/support/hooks.js', 'features/step_definitions/**/*.js'],
    format: ['progress-bar', 'html:reports/cucumber-report.html'],
    timeout: 30000,
    parallel: 1,
  },
}
