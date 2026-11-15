import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { SURFACES } from './surfaces.mjs'
import { collectFindings, AUDIT_ARGS } from './rules.mjs'

const BASE = process.env.APP_URL || 'http://localhost:3000'
const MAILPIT = process.env.MAILPIT_URL || 'http://localhost:8025'
const OUT = process.env.OUT_DIR || 'brand-audit-out'
const FIXTURE = process.env.FIXTURE_PDF || 'spec/fixtures/sample-document.pdf'
const ADMIN = { email: 'admin@example.com', password: 'Audit-password-1234' }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const rails = (code) => execFileSync('docker', ['exec', 'app', '/app/bin/rails', 'runner', code], { encoding: 'utf8' })

async function api (token, method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body)
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

async function csrf (page) {
  return page.$eval('meta[name="csrf-token"]', (el) => el.content)
}

async function seed (browser) {
  const context = await browser.newContext({ baseURL: BASE })
  const page = await context.newPage()

  await page.goto('/setup')
  await page.fill('input[name="user[first_name]"]', 'Audit')
  await page.fill('input[name="user[last_name]"]', 'Admin')
  await page.fill('input[name="user[email]"]', ADMIN.email)
  await page.fill('input[name="account[name]"]', 'Digital Active Consulting DOOEL')
  await page.fill('input[name="user[password]"]', ADMIN.password)
  const appUrl = page.locator('input[name="encrypted_config[value]"]')
  if (await appUrl.count()) await appUrl.fill(BASE)
  await Promise.all([page.waitForNavigation(), page.click('form [type="submit"]')])
  console.log('after setup', page.url())

  const token = rails(`
    account = Account.first
    EncryptedConfig.find_or_initialize_by(account:, key: EncryptedConfig::EMAIL_SMTP_KEY).update!(value: {
      'host' => 'localhost', 'port' => '1025', 'username' => 'audit', 'password' => 'audit', 'domain' => 'example.com',
      'authentication' => 'plain', 'security' => 'none', 'from_email' => 'sign@example.com'
    })
    puts User.first.access_token.token
  `).trim().split('\n').pop()
  if (!token) throw new Error('API token not found on /settings/api')

  const pdf = await fs.readFile(FIXTURE)
  const createTemplate = async (name, roles) => {
    await page.goto('/new')
    const res = await page.request.post('/templates_upload', {
      multipart: { authenticity_token: await csrf(page), 'files[]': { name: `${name}.pdf`, mimeType: 'application/pdf', buffer: pdf } },
      maxRedirects: 0
    })
    const location = res.headers().location || ''
    const id = Number((location.match(/templates\/(\d+)/) || [])[1])
    if (!id) throw new Error(`template upload failed: ${res.status()} ${location}`)
    const tpl = await api(token, 'GET', `/api/templates/${id}`)
    const doc = tpl.documents[0].uuid
    const submitters = roles.map((role, i) => ({ name: role, uuid: `00000000-0000-4000-8000-00000000000${i + 1}` }))
    const field = (sub, n, type, extra = {}) => ({
      uuid: `00000000-0000-4000-9000-${String(sub * 10 + n).padStart(12, '0')}`,
      submitter_uuid: submitters[sub].uuid,
      name: `${type} ${sub + 1}`,
      type,
      required: false,
      areas: [{ x: 0.1, y: 0.15 + n * 0.1 + sub * 0.4, w: 0.35, h: 0.05, page: 0, attachment_uuid: doc }],
      ...extra
    })
    const fields = submitters.flatMap((_, s) => [field(s, 0, 'text'), field(s, 1, 'date'), field(s, 2, 'signature'), field(s, 3, 'checkbox')])
    await api(token, 'PUT', `/api/templates/${id}`, { name, shared_link: true, submitters, fields })
    return { id, slug: (await api(token, 'GET', `/api/templates/${id}`)).slug }
  }

  const template = await createTemplate('Service Agreement', ['Client'])
  const ordered = await createTemplate('Two Party Agreement', ['Client', 'DacForge'])

  const submit = async (tpl, submitters, extra = {}) =>
    api(token, 'POST', '/api/submissions', { template_id: tpl.id, send_email: true, submitters, ...extra })

  const one = (name) => [{ role: 'Client', email: `${name}@example.com`, name: `${name} Client` }]
  const pending = (await submit(template, one('pending')))[0]
  const completedSub = (await submit(template, one('completed')))[0]
  const declined = (await submit(template, one('declined')))[0]
  const expired = (await submit(template, one('expired')))[0]
  const archived = (await submit(template, one('archived')))[0]
  const orderedSubs = await submit(ordered, [
    { role: 'Client', email: 'first@example.com', name: 'First Client' },
    { role: 'DacForge', email: 'second@example.com', name: 'Second Signer' }
  ], { order: 'preserved' })

  await api(token, 'PUT', `/api/submitters/${completedSub.id}`, { completed: true, values: { 'text 1': 'Completed by audit' } })
  await api(token, 'PUT', `/api/submissions/${expired.submission_id}`, { expire_at: new Date(Date.now() - 86400000).toISOString() })
  await api(token, 'DELETE', `/api/submissions/${archived.submission_id}`)

  const clientPage = await (await browser.newContext({ baseURL: BASE })).newPage()
  await clientPage.goto(`/s/${declined.slug}`)
  await clientPage.request.post(`/s/${declined.slug}/decline`, {
    form: { authenticity_token: await csrf(clientPage), decline_reason: 'Audit decline' }, maxRedirects: 0
  })
  await clientPage.context().close()

  const state = await context.storageState()
  await context.close()

  return {
    token,
    adminState: state,
    template,
    pending: { slug: pending.slug, submissionId: pending.submission_id },
    completed: { slug: completedSub.slug, submissionId: completedSub.submission_id },
    declined: { slug: declined.slug },
    expired: { slug: expired.slug },
    archived: { slug: archived.slug },
    ordered: { secondSlug: orderedSubs[1].slug }
  }
}

async function capture (browser, ctx) {
  const results = []
  for (const mode of ['light', 'dark']) {
    const viewports = [{ name: 'desktop', size: { width: 1366, height: 900 } }, { name: 'mobile', size: { width: 390, height: 844 } }]
    for (const vp of viewports) {
      const admin = await browser.newContext({ baseURL: BASE, storageState: ctx.adminState, colorScheme: mode, viewport: vp.size })
      const client = await browser.newContext({ baseURL: BASE, colorScheme: mode, viewport: vp.size })
      for (const surface of SURFACES) {
        if (vp.name === 'mobile' && !surface.mobile) continue
        const page = await (surface.who === 'admin' ? admin : client).newPage()
        const id = `${surface.id}--${mode}--${vp.name}`
        try {
          const url = surface.path(ctx)
          const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
          await sleep(surface.settle || 800)
          const auditMode = surface.printLight ? 'light' : mode
          const findings = await page.evaluate(`(${collectFindings.toString()})(${JSON.stringify({ mode: auditMode, ...AUDIT_ARGS })})`)
          await page.screenshot({ path: path.join(OUT, 'shots', `${id}.png`), fullPage: true })
          results.push({ id, surface: surface.id, mode, viewport: vp.name, url, status: res && res.status(), finalUrl: page.url().replace(BASE, ''), findings })
        } catch (error) {
          results.push({ id, surface: surface.id, mode, viewport: vp.name, error: String(error).slice(0, 300), findings: [] })
        }
        await page.close()
      }
      await admin.close()
      await client.close()
    }
  }
  return results
}

async function captureEmails (browser) {
  const list = await (await fetch(`${MAILPIT}/api/v1/messages?limit=50`)).json()
  const seen = new Set()
  const page = await browser.newPage({ viewport: { width: 720, height: 900 } })
  const emails = []
  for (const msg of list.messages || []) {
    const key = msg.Subject.replace(/\d+/g, '#')
    if (seen.has(key)) continue
    seen.add(key)
    const file = `email-${emails.length + 1}.png`
    await page.goto(`${MAILPIT}/view/${msg.ID}.html`)
    await page.screenshot({ path: path.join(OUT, 'shots', file), fullPage: true })
    emails.push({ subject: msg.Subject, from: msg.From, file })
  }
  await page.close()
  return emails
}

async function downloadAuditPdf (ctx) {
  for (let i = 0; i < 30; i++) {
    const sub = await api(ctx.token, 'GET', `/api/submissions/${ctx.completed.submissionId}`)
    if (sub.audit_log_url) {
      const res = await fetch(sub.audit_log_url.replace(/^https?:\/\/[^/]+/, BASE))
      await fs.writeFile(path.join(OUT, 'audit-log.pdf'), Buffer.from(await res.arrayBuffer()))
      const doc = sub.combined_document_url || (sub.documents && sub.documents[0] && sub.documents[0].url)
      if (doc) {
        const d = await fetch(doc.replace(/^https?:\/\/[^/]+/, BASE))
        await fs.writeFile(path.join(OUT, 'signed-document.pdf'), Buffer.from(await d.arrayBuffer()))
      }
      return true
    }
    await sleep(2000)
  }
  return false
}

function summarize (results, emails, pdf) {
  const lines = ['# Brand audit', '', `Surfaces: ${results.length}. Errors: ${results.filter((r) => r.error).length}. Audit PDF: ${pdf ? 'yes' : 'no'}. Emails: ${emails.length}.`, '']
  const byRule = {}
  for (const r of results) for (const f of r.findings) byRule[f.rule] = (byRule[f.rule] || 0) + f.count
  lines.push('| Rule | Count |', '| --- | --- |', ...Object.entries(byRule).map(([k, v]) => `| ${k} | ${v} |`), '')
  lines.push('| Capture | Status | Findings | Note |', '| --- | --- | --- | --- |')
  for (const r of results) {
    const counts = {}
    for (const f of r.findings) counts[f.rule] = (counts[f.rule] || 0) + f.count
    const note = r.error ? r.error.replace(/\|/g, '/') : (r.finalUrl !== r.url ? `redirect ${r.finalUrl}` : '')
    lines.push(`| ${r.id} | ${r.status ?? '-'} | ${Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(' ') || '0'} | ${note} |`)
  }
  lines.push('', '## Emails', '', ...emails.map((e) => `- ${e.file}: ${e.subject} (from ${e.from && e.from.Name} <${e.from && e.from.Address}>)`))
  return lines.join('\n') + '\n'
}

await fs.mkdir(path.join(OUT, 'shots'), { recursive: true })
const browser = await chromium.launch()
let ctx
try {
  ctx = await seed(browser)
} catch (error) {
  for (const [i, page] of browser.contexts().flatMap((c) => c.pages()).entries()) {
    await page.screenshot({ path: path.join(OUT, 'shots', `seed-failure-${i}.png`), fullPage: true }).catch(() => {})
    await fs.writeFile(path.join(OUT, `seed-failure-${i}.html`), `<!-- ${page.url()} -->\n` + await page.content().catch(() => ''))
    console.error('seed failure page', i, page.url())
  }
  throw error
}
await fs.writeFile(path.join(OUT, 'fixtures.json'), JSON.stringify({ ...ctx, adminState: undefined, token: undefined }, null, 2))
const results = await capture(browser, ctx)
const pdf = await downloadAuditPdf(ctx)
const emails = await captureEmails(browser)
await browser.close()
await fs.writeFile(path.join(OUT, 'findings.json'), JSON.stringify(results, null, 2))
await fs.writeFile(path.join(OUT, 'summary.md'), summarize(results, emails, pdf))
console.log(await fs.readFile(path.join(OUT, 'summary.md'), 'utf8'))
