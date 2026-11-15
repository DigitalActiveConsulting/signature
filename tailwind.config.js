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
      },
      {
        'dacforge-dark': {
          'color-scheme': 'dark',
          primary: '#2a2a26',
          'primary-content': '#f1f0ea',
          secondary: '#ef5a38',
          accent: '#ef5a38',
          neutral: '#ef5a38',
          'neutral-content': '#ffffff',
          'base-100': '#111110',
          'base-200': '#1a1a18',
          'base-300': '#2a2a26',
          'base-content': '#f1f0ea',
          '--rounded-btn': '1.9rem',
          '--tab-border': '2px',
          '--tab-radius': '.5rem'
        }
      }
    ]
  }
}
