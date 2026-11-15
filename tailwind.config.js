module.exports = {
  future: {
    hoverOnlyWhenSupported: true
  },
  plugins: [
    require('daisyui')
  ],
  daisyui: {
    themes: [
      {
        docuseal: {
          'color-scheme': 'light',
          primary: '#ece9e3',
          secondary: '#d94925',
          accent: '#d94925',
          neutral: '#0a0a0a',
          'base-100': '#fafaf7',
          'base-200': '#f1f0ea',
          'base-300': '#d8d8d2',
          'base-content': '#0a0a0a',
          '--rounded-btn': '1.9rem',
          '--tab-border': '2px',
          '--tab-radius': '.5rem'
        }
      }
    ]
  }
}
