import type { Credentials } from './store'
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { mkdir, rm, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname } from 'node:path'
import process from 'node:process'
import { oauthPage } from './page'
import { credentialPath, deleteCredentials, normalizeEndpoint, readCredentials, saveCredentials } from './store'

export interface LoginOptions {
  endpoint?: string
  open?: boolean
  readOnly?: boolean
  onUrl?: (message: string) => void
}

interface AuthorizationMetadata {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  registration_endpoint: string
  code_challenge_methods_supported?: string[]
}

interface ClientRegistration {
  client_id: string
  token_endpoint_auth_method: string
  client_secret?: string
}

interface TokenResponse {
  access_token?: unknown
  refresh_token?: unknown
  token_type?: unknown
  expires_in?: unknown
  scope?: unknown
}

type TokenData = Pick<Credentials, 'access_token' | 'refresh_token' | 'expires_at' | 'scopes'>

export const READ_SCOPE = 'slidev:read'
export const PRESENT_SCOPE = 'slidev:present'

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function trustedUrl(value: string, endpoint: string): string {
  const url = new URL(value)
  if (url.origin !== normalizeEndpoint(endpoint) || url.username || url.password || url.hash)
    throw new Error('OAuth endpoint must belong to the configured Inalia origin.')
  return url.href
}

async function jsonRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { Accept: 'application/json', ...options.headers },
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok)
    throw new Error(`Inalia authentication failed (HTTP ${response.status}). Sign in again if access was revoked.`)
  return response.json() as Promise<T>
}

function tokenData(data: TokenResponse, requiredScopes: string[]): TokenData {
  const scopes = typeof data.scope === 'string' ? data.scope.split(' ') : []
  if (typeof data.access_token !== 'string' || !data.access_token
    || typeof data.refresh_token !== 'string' || !data.refresh_token
    || typeof data.token_type !== 'string' || data.token_type.toLowerCase() !== 'bearer'
    || typeof data.expires_in !== 'number' || !Number.isFinite(data.expires_in) || data.expires_in <= 0
    || !requiredScopes.every(scope => scopes.includes(scope))) {
    throw new Error('Inalia did not grant the requested Slidev permissions.')
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    scopes,
  }
}

function openBrowser(url: string): void {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'rundll32' : 'xdg-open'
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url]
  const child = spawn(command, args, { detached: true, stdio: 'ignore' })
  child.on('error', () => {}) // The URL is always printed for manual opening.
  child.unref()
}

export async function login({ endpoint = 'https://api.inalia.app', open = true, readOnly = false, onUrl = console.info }: LoginOptions = {}): Promise<void> {
  endpoint = normalizeEndpoint(endpoint)
  const metadata = await jsonRequest<AuthorizationMetadata>(`${endpoint}/.well-known/oauth-authorization-server`)
  if (metadata.issuer !== endpoint && metadata.issuer !== `${endpoint}/`)
    throw new Error('Unexpected OAuth issuer.')
  const authorizationEndpoint = trustedUrl(metadata.authorization_endpoint, endpoint)
  const tokenEndpoint = trustedUrl(metadata.token_endpoint, endpoint)
  const registrationEndpoint = trustedUrl(metadata.registration_endpoint, endpoint)
  if (!metadata.code_challenge_methods_supported?.includes('S256'))
    throw new Error('Inalia must support PKCE S256.')

  const verifier = randomBytes(48).toString('base64url')
  const state = randomBytes(32).toString('base64url')
  let settle!: { resolve: (code: string) => void, reject: (error: Error) => void }
  const callback = new Promise<string>((resolve, reject) => {
    settle = { resolve, reject }
  })
  // Attach a rejection handler immediately, even while registration is pending.
  void callback.catch(() => {})
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'")
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'no-referrer')
    const url = new URL(request.url || '/', 'http://127.0.0.1')
    const receivedState = Buffer.from(url.searchParams.get('state') || '')
    const expectedState = Buffer.from(state)
    if (request.method !== 'GET' || url.pathname !== '/callback'
      || receivedState.length !== expectedState.length || !timingSafeEqual(receivedState, expectedState)) {
      response.writeHead(400).end(oauthPage('invalid'))
      return
    }
    if (url.searchParams.has('error')) {
      response.writeHead(400).end(oauthPage('denied'))
      settle.reject(new Error('Inalia authorization was denied.'))
      return
    }
    const code = url.searchParams.get('code')
    if (!code) {
      response.writeHead(400).end(oauthPage('missing'))
      return
    }
    response.end(oauthPage('received'))
    settle.resolve(code)
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    timer = setTimeout(() => settle.reject(new Error('Inalia login timed out. Please try again.')), 180000)
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('Cannot start the Inalia OAuth callback server.')
    const redirectUri = `http://127.0.0.1:${address.port}/callback`
    const client = await jsonRequest<ClientRegistration>(registrationEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Inalia for Slidev', redirect_uris: [redirectUri], token_endpoint_auth_method: 'none' }),
    })
    if (!client.client_id || client.token_endpoint_auth_method !== 'none' || client.client_secret)
      throw new Error('Inalia must register a public OAuth client.')
    const scopes = readOnly ? [READ_SCOPE] : [READ_SCOPE, PRESENT_SCOPE]
    const authorization = new URL(authorizationEndpoint)
    authorization.search = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
      code_challenge: pkceChallenge(verifier),
      code_challenge_method: 'S256',
      prompt: 'consent',
    }).toString()
    onUrl(`Open this URL to sign in to Inalia:\n${authorization.href}`)
    if (open)
      openBrowser(authorization.href)
    const code = await callback
    const data = await jsonRequest<TokenResponse>(tokenEndpoint, {
      method: 'POST',
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: client.client_id, redirect_uri: redirectUri, code, code_verifier: verifier }),
    })
    const credentials = { client_id: client.client_id, token_endpoint: tokenEndpoint, ...tokenData(data, scopes) }
    await withCredentialLock(endpoint, () => saveCredentials(endpoint, credentials))
  }
  finally {
    clearTimeout(timer)
    server.closeAllConnections()
    server.close()
  }
}

// Serialize refreshes across Slidev processes because refresh tokens rotate.
async function withCredentialLock<T>(endpoint: string, action: () => Promise<T>): Promise<T> {
  const lock = `${credentialPath(endpoint)}.lock`
  await mkdir(dirname(lock), { recursive: true, mode: 0o700 })
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await mkdir(lock, { mode: 0o700 })
    }
    catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST'))
        throw error
      const info = await stat(lock).catch(() => null)
      if (info && Date.now() - info.mtimeMs > 60000)
        await rm(lock, { recursive: true, force: true })
      await new Promise(resolve => setTimeout(resolve, 200))
      continue
    }
    try {
      return await action()
    }
    finally {
      await rm(lock, { recursive: true, force: true })
    }
  }
  throw new Error('Inalia credentials are busy. Try again shortly.')
}

export async function accessToken(endpoint: string): Promise<string> {
  endpoint = normalizeEndpoint(endpoint)
  const credentials = await readCredentials(endpoint)
  if (credentials.expires_at > Date.now() + 60000)
    return credentials.access_token
  return withCredentialLock(endpoint, async () => {
    const current = await readCredentials(endpoint)
    if (current.expires_at > Date.now() + 60000)
      return current.access_token
    const data = await jsonRequest<TokenResponse>(trustedUrl(current.token_endpoint, endpoint), {
      method: 'POST',
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: current.client_id, refresh_token: current.refresh_token }),
    })
    const updated = { ...current, ...tokenData(data, current.scopes) }
    await saveCredentials(endpoint, updated)
    return updated.access_token
  })
}

export async function logout(endpoint = 'https://api.inalia.app'): Promise<void> {
  endpoint = normalizeEndpoint(endpoint)
  try {
    await accessToken(endpoint)
    await withCredentialLock(endpoint, async () => {
      try {
        const current = await readCredentials(endpoint)
        const response = await fetch(`${endpoint}/api/slidev/logout`, {
          method: 'POST',
          headers: { Accept: 'application/json', Authorization: `Bearer ${current.access_token}` },
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        })
        if (!response.ok)
          throw new Error('Remote revocation failed')
      }
      finally {
        await deleteCredentials(endpoint)
      }
    })
  }
  catch {
    await deleteCredentials(endpoint)
    throw new Error('Remote revocation failed. Local credentials were removed; ask your Inalia administrator to revoke the authorization.')
  }
}
