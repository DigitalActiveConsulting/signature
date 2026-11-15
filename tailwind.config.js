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
          info: '#6b6b6b',
          'info-content': '#ffffff',
          success: '#2f7d5b',
          'success-content': '#ffffff',
          warning: '#d94925',
          'warning-content': '#ffffff',
          error: '#b8322a',
          'error-content': '#ffffff',
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
          info: '#8a8a82',
          'info-content': '#111110',
          success: '#4fb38a',
          'success-content': '#111110',
          warning: '#ef5a38',
          'warning-content': '#ffffff',
          error: '#f06a55',
          'error-content': '#111110',
          '--rounded-btn': '1.9rem',
          '--tab-border': '2px',
          '--tab-radius': '.5rem'
        }
      }
    ]
  }
}
