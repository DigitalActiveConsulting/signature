// Every screen the audit captures. `who` picks the browser session: admin is
// signed in, client is a fresh visitor with no cookies. `path` may read the
// seeded fixture ids from ctx. `mobile` adds a phone-width capture.
// `printLight` marks a printable page that stays light in dark mode.
export const SURFACES = [
  { id: 'sign-in', who: 'client', path: () => '/sign_in' },
  { id: 'password-new', who: 'client', path: () => '/password/new' },
  { id: 'error-404', who: 'client', path: () => '/this-page-does-not-exist' },

  { id: 'dashboard', who: 'admin', path: () => '/' },
  { id: 'upload-new', who: 'admin', path: () => '/new' },
  { id: 'template-builder', who: 'admin', path: (c) => `/templates/${c.template.id}/edit`, settle: 2500 },
  { id: 'template-show', who: 'admin', path: (c) => `/templates/${c.template.id}` },
  { id: 'template-preview', who: 'admin', path: (c) => `/templates/${c.template.id}/preview` },
  { id: 'template-form-preview', who: 'admin', path: (c) => `/templates/${c.template.id}/form`, settle: 2000 },
  { id: 'template-share-qr', who: 'admin', path: (c) => `/templates/${c.template.id}/share_link_qr`, printLight: true },
  { id: 'templates-archived', who: 'admin', path: () => '/templates/archived' },
  { id: 'submissions', who: 'admin', path: () => '/submissions' },
  { id: 'submissions-archived', who: 'admin', path: () => '/submissions/archived' },
  { id: 'submission-completed', who: 'admin', path: (c) => `/submissions/${c.completed.submissionId}` },
  { id: 'submission-pending', who: 'admin', path: (c) => `/submissions/${c.pending.submissionId}` },
  { id: 'submission-events', who: 'admin', path: (c) => `/submissions/${c.completed.submissionId}/events` },
  { id: 'search', who: 'admin', path: () => '/search?q=Agreement' },
  { id: 'settings-profile', who: 'admin', path: () => '/settings/profile' },
  { id: 'settings-account', who: 'admin', path: () => '/settings/account' },
  { id: 'settings-email', who: 'admin', path: () => '/settings/email' },
  { id: 'settings-storage', who: 'admin', path: () => '/settings/storage' },
  { id: 'settings-sms', who: 'admin', path: () => '/settings/sms' },
  { id: 'settings-notifications', who: 'admin', path: () => '/settings/notifications' },
  { id: 'settings-esign', who: 'admin', path: () => '/settings/esign' },
  { id: 'settings-personalization', who: 'admin', path: () => '/settings/personalization' },
  { id: 'settings-users', who: 'admin', path: () => '/settings/users' },
  { id: 'settings-api', who: 'admin', path: () => '/settings/api' },
  { id: 'settings-webhooks', who: 'admin', path: () => '/settings/webhooks' },
  { id: 'settings-sso', who: 'admin', path: () => '/settings/sso' },
  { id: 'user-new', who: 'admin', path: () => '/users/new' },
  { id: 'user-signature', who: 'admin', path: () => '/user_signature/edit' },
  { id: 'mfa-setup', who: 'admin', path: () => '/mfa_setup/new' },

  { id: 'start-form', who: 'client', path: (c) => `/d/${c.template.slug}`, mobile: true },
  { id: 'signing-form', who: 'client', path: (c) => `/s/${c.pending.slug}`, settle: 2000, mobile: true },
  { id: 'signing-awaiting', who: 'client', path: (c) => `/s/${c.ordered.secondSlug}`, mobile: true },
  { id: 'signing-completed', who: 'client', path: (c) => `/s/${c.completed.slug}/completed`, mobile: true },
  { id: 'signing-declined', who: 'client', path: (c) => `/s/${c.declined.slug}`, mobile: true },
  { id: 'signing-expired', who: 'client', path: (c) => `/s/${c.expired.slug}`, mobile: true },
  { id: 'signing-archived', who: 'client', path: (c) => `/s/${c.archived.slug}`, mobile: true },
  { id: 'submission-preview', who: 'client', path: (c) => `/e/${c.completed.slug}`, mobile: true },
  { id: 'draw-signature', who: 'client', path: (c) => `/p/${c.pending.slug}`, mobile: true }
]
