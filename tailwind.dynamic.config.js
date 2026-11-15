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
        'base-100': 'var(--df-paper)',
        'base-200': 'var(--df-surface-raised)',
        'base-300': 'var(--df-rule)',
        'base-content': 'var(--df-ink)'
      }
    }
  }
}
