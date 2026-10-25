import process from 'node:process'
import { parseEnv } from 'node:util'
import { accessToken, login } from './oauth/client'

export interface Connection {
  endpoint: string
  token: string
  auth: 'oauth' | 'token'
}

export function cliEndpoint(): string {
  return process.env.INALIA_ENDPOINT?.trim() || 'https://inalia.app'
}

export async function connect(content: string, onUrl: (message: string) => void): Promise<Connection> {
  const env = parseEnv(content)
  const token = (process.env.VITE_INALIA_API_KEY ?? env.VITE_INALIA_API_KEY ?? '').replace(/\\\$/g, '$').trim()
  const endpoint = cliEndpoint()
  if (token)
    return { endpoint, token, auth: 'token' }

  // Refresh an existing session first; browser sign-in also recovers expired or revoked sessions.
  let oauthToken: string
  try {
    oauthToken = await accessToken(endpoint)
  }
  catch {
    await login({ endpoint, onUrl })
    oauthToken = await accessToken(endpoint)
  }
  return { endpoint, token: oauthToken, auth: 'oauth' }
}

export function connectionEnv(connection: Connection, talkNumber: string): Record<string, string | undefined> {
  return {
    VITE_INALIA_AUTH: undefined,
    VITE_INALIA_TALK_NUMBER: talkNumber,
    VITE_INALIA_API_KEY: connection.auth === 'token' ? connection.token : undefined,
  }
}
