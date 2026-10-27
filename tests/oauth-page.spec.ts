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
    expect(html).toContain('Inalia CLI')
    expect(html).toContain('terminal')
    expect(html).not.toMatch(/<script|<link|<img|@import|url\(/)
  })

  it('does not claim sign-in has completed before the token exchange', () => {
    const html = oauthPage('received')
    expect(html).toContain('finish signing in')
    expect(html).toContain('You can safely close this tab.')
    expect(html).not.toContain('Authentication successful')
  })
})
