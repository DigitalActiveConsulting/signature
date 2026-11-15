const path = require('path')

module.exports = {
  future: {
    hoverOnlyWhenSupported: true
  },
  content: [
    path.resolve(__dirname, 'app/javascript/template_builder/dynamic_area.vue'),
    path.resolve(__dirname, 'app/javascript/template_builder/dynamic_section.vue')
  ],
  theme: {
    extend: {
      colors: {
        'base-100': '#fafaf7',
        'base-200': '#f1f0ea',
        'base-300': '#d8d8d2',
        'base-content': '#0a0a0a'
      }
    }
  }
}
