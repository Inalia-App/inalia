import { describe, expect, it } from 'vitest'
import { oauthPage } from '../src/oauth/page'

describe('OAuth callback pages', () => {
  it.each([
    ['received', 'Authorization received'],
    ['denied', 'Authorization denied'],
    ['invalid', 'Invalid authorization request'],
    ['missing', 'Missing authorization code'],
  ] as const)('renders the %s state as a standalone branded page', (status, heading) => {
    const html = oauthPage(status)
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('name="viewport"')
    expect(html).toContain(`<h1 id="heading">${heading}</h1>`)
    expect(html).toContain('<p class="brand">Inalia</p>')
    expect(html).toContain('terminal')
    expect(html).not.toMatch(/<script|<img|@import|url\(/)
  })

  it('matches the app typography and light palette with a short divider', () => {
    const html = oauthPage('received')
    expect(html).toContain('name="color-scheme" content="light"')
    expect(html).toContain('https://fonts.bunny.net/css?family=noto-sans:')
    expect(html).toContain('font-family: "Noto Sans", sans-serif')
    expect(html).toContain('font-family: "Noto Serif", serif')
    expect(html).toContain('background: #fff')
    expect(html).toContain('background: #e7e5e4')
    expect(html).toContain('.divider { width: 64px; height: 1px;')
    expect(html).toContain('<div class="divider" aria-hidden="true"></div>')
    expect(html).not.toContain('border-top')
  })

  it('does not claim sign-in has completed before the token exchange', () => {
    const html = oauthPage('received')
    expect(html).toContain('finish signing in')
    expect(html).toContain('You can safely close this tab.')
    expect(html).not.toContain('Authentication successful')
  })
})
