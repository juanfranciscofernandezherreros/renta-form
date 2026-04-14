export default {
  default: {
    paths: ['features/**/*.feature'],
    require: ['features/support/*.js', 'features/step_definitions/*.js'],
    format: ['progress', 'html:cucumber-report.html'],
    timeout: 60000,
  },
}
