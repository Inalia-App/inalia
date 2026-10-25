import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cliEndpoint, connect, connectionEnv } from '../src/connection'
import { accessToken, login } from '../src/oauth/client'

vi.mock('../src/oauth/client', () => ({ accessToken: vi.fn(), login: vi.fn() }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
  vi.stubEnv('INALIA_ENDPOINT', '')
  vi.stubEnv('VITE_INALIA_API_KEY', undefined)
})

describe('cLI connection', () => {
  it('uses only the CLI endpoint override', () => {
    vi.stubEnv('VITE_INALIA_ENDPOINT', 'https://ignored.example')
    expect(cliEndpoint()).toBe('https://inalia.app')
    vi.stubEnv('INALIA_ENDPOINT', 'http://localhost:8000')
    expect(cliEndpoint()).toBe('http://localhost:8000')
  })

  it('reuses OAuth without opening the browser', async () => {
    vi.mocked(accessToken).mockResolvedValue('oauth-secret')
    expect(await connect('VITE_INALIA_ENDPOINT=https://ignored.example', vi.fn())).toEqual({
      endpoint: 'https://inalia.app',
      token: 'oauth-secret',
      auth: 'oauth',
    })
    expect(login).not.toHaveBeenCalled()
  })

  it('signs in when the session is unavailable and reads the new credentials', async () => {
    const onUrl = vi.fn()
    vi.mocked(accessToken).mockRejectedValueOnce(new Error('No session')).mockResolvedValueOnce('new-secret')
    expect((await connect('', onUrl)).auth).toBe('oauth')
    expect(login).toHaveBeenCalledWith({ endpoint: 'https://inalia.app', onUrl })
    expect(accessToken).toHaveBeenCalledTimes(2)
  })

  it('propagates cancelled or failed login without retrying', async () => {
    vi.mocked(accessToken).mockRejectedValue(new Error('No session'))
    vi.mocked(login).mockRejectedValue(new Error('Cancelled'))
    await expect(connect('', vi.fn())).rejects.toThrow('Cancelled')
    expect(accessToken).toHaveBeenCalledTimes(1)
  })

  it('prefers an existing token over OAuth, with shell precedence over .env', async () => {
    vi.stubEnv('VITE_INALIA_API_KEY', ' shell-secret ')
    const connection = await connect('VITE_INALIA_API_KEY=deck-secret', vi.fn())
    expect(connection).toEqual({ endpoint: 'https://inalia.app', token: 'shell-secret', auth: 'token' })
    expect(accessToken).not.toHaveBeenCalled()
    expect(login).not.toHaveBeenCalled()
  })

  it('uses a deck token even if the deck previously selected OAuth', async () => {
    expect((await connect('VITE_INALIA_AUTH=oauth\nVITE_INALIA_API_KEY="deck\\$secret"', vi.fn())).token).toBe('deck$secret')
    expect(login).not.toHaveBeenCalled()
  })

  it('persists an explicitly configured API key without an authentication mode', () => {
    expect(connectionEnv({ endpoint: 'https://dev.example', token: 'api-secret', auth: 'token' }, '2')).toEqual({
      VITE_INALIA_AUTH: undefined,
      VITE_INALIA_TALK_NUMBER: '2',
      VITE_INALIA_API_KEY: 'api-secret',
    })
  })

  it('does not persist OAuth credentials or endpoint settings', () => {
    expect(connectionEnv({ endpoint: 'https://dev.example', token: 'oauth-secret', auth: 'oauth' }, '2')).toEqual({
      VITE_INALIA_AUTH: undefined,
      VITE_INALIA_TALK_NUMBER: '2',
      VITE_INALIA_API_KEY: undefined,
    })
  })
})
