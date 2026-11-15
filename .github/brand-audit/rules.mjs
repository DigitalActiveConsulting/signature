export const BRAND = {
  light: { paper: '#fafaf7', ink: '#0a0a0a', muted: '#6b6b6b', rule: '#d8d8d2', accent: '#d94925' },
  dark: { paper: '#111110', ink: '#f1f0ea', muted: '#8a8a82', rule: '#2a2a26', accent: '#ef5a38' }
}

const ACCENT_HUE = 12
const HUE_TOLERANCE = 18
const CHROMA_FLOOR = 0.18

// Runs inside the page. Returns findings for one rendered surface.
export function collectFindings ({ mode, accentHue, hueTolerance, chromaFloor, allowed }) {
  const parse = (value) => {
    const m = value && value.match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[,/ ]+([\d.]+))?\)/)
    if (!m) return null
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] }
  }
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
  const hsl = (c) => {
    const r = c.r / 255; const g = c.g / 255; const b = c.b / 255
    const max = Math.max(r, g, b); const min = Math.min(r, g, b)
    const l = (max + min) / 2; const d = max - min
    if (d === 0) return { h: 0, s: 0, l, chroma: 0 }
    const s = d / (1 - Math.abs(2 * l - 1))
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h = (h * 60 + 360) % 360
    return { h, s, l, chroma: d }
  }
  const luminance = (c) => {
    const ch = [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
  }
  const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const offHue = (c) => {
    if (allowed.includes(hex(c))) return false
    const { h, chroma } = hsl(c)
    const dh = Math.min(Math.abs(h - accentHue), 360 - Math.abs(h - accentHue))
    return chroma >= chromaFloor && dh > hueTolerance
  }
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : ''
    const cls = typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 4).join('.') : ''
    return `${el.tagName.toLowerCase()}${id}${cls === '.' ? '' : cls}`.slice(0, 140)
  }
  const pageContainers = [...document.querySelectorAll('img')]
    .filter((img) => img.getBoundingClientRect().width >= 200 && img.naturalWidth >= 400)
    .map((img) => img.parentElement)
  const onDocumentPage = (el) => pageContainers.some((page) => page !== el && page.contains(el))
  const exempt = (el) => el.closest('.keep-light, canvas, img, video, pre, code, [data-brand-exempt], svg image') || onDocumentPage(el)
  const visible = (el, rect) => rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none'

  const effectiveBg = (el) => {
    for (let node = el; node; node = node.parentElement) {
      const c = parse(getComputedStyle(node).backgroundColor)
      if (c && c.a > 0.5) return c
    }
    return parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }
  }

  const findings = []
  const add = (rule, el, color, extra = {}) => findings.push({ rule, color: color && hex(color), el: describe(el), ...extra })

  for (const el of document.body.querySelectorAll('*')) {
    const rect = el.getBoundingClientRect()
    if (!visible(el, rect) || exempt(el)) continue
    const style = getComputedStyle(el)
    const bg = parse(style.backgroundColor)
    const fg = parse(style.color)
    const area = rect.width * rect.height

    if (bg && bg.a > 0.3 && offHue(bg)) add('off-brand-hue', el, bg, { prop: 'background' })
    if (bg && bg.a > 0.5 && mode === 'dark' && luminance(bg) > 0.45 && area > 1500) add('light-surface-in-dark', el, bg, { area: Math.round(area) })

    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    if (ownText && fg) {
      if (offHue(fg)) add('off-brand-hue', el, fg, { prop: 'color' })
      const ratio = contrast(fg, effectiveBg(el))
      if (ratio < 3) add('low-contrast-text', el, fg, { bg: hex(effectiveBg(el)), ratio: +ratio.toFixed(2) })
      if (/docuseal/i.test(el.textContent) && !el.closest('[data-docuseal-attribution]')) add('docuseal-name', el, null, { text: el.textContent.trim().slice(0, 80) })
    }

    if (el instanceof SVGElement && ['path', 'circle', 'rect', 'svg', 'g'].includes(el.tagName.toLowerCase())) {
      for (const prop of ['fill', 'stroke']) {
        const c = parse(style[prop])
        if (c && c.a > 0.3 && offHue(c)) add('off-brand-hue', el, c, { prop })
      }
    }
  }

  const unique = new Map()
  for (const f of findings) {
    const key = `${f.rule}|${f.color}|${f.el}|${f.prop || ''}`
    const prev = unique.get(key)
    unique.set(key, prev ? { ...prev, count: prev.count + 1 } : { ...f, count: 1 })
  }
  return [...unique.values()]
}

// Semantic success green, kept so a signed status reads as positive.
const ALLOWED = ['#2f7d5b', '#4fb38a']

export const AUDIT_ARGS = { accentHue: ACCENT_HUE, hueTolerance: HUE_TOLERANCE, chromaFloor: CHROMA_FLOOR, allowed: ALLOWED }
