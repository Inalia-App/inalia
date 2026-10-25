import process from 'node:process'
import * as p from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { connect } from '../src/connection'
import { login, logout } from '../src/oauth/client'
import { fetchUsername, listTalks } from '../src/talks'

const files = vi.hoisted(() => ({ readFile: vi.fn(), writeFile: vi.fn(), access: vi.fn() }))
vi.mock('node:fs/promises', () => ({ ...files, default: files }))
vi.mock('nypm', () => ({ addDependency: vi.fn() }))
vi.mock('../src/oauth/client', () => ({ login: vi.fn(), logout: vi.fn() }))
vi.mock('../src/connection', async importOriginal => ({
  ...await importOriginal<typeof import('../src/connection')>(),
  connect: vi.fn(),
}))
vi.mock('../src/talks', () => ({ fetchUsername: vi.fn(), listTalks: vi.fn() }))
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  select: vi.fn(),
  isCancel: (value: unknown) => typeof value === 'symbol',
  log: { info: vi.fn(), success: vi.fn(), warn: vi.fn(), error: vi.fn() },
  spinner: () => ({ start: vi.fn(), message: vi.fn(), stop: vi.fn() }),
}))

async function run(...args: string[]) {
  const argv = process.argv
  process.argv = ['node', 'inalia', ...args]
  try {
    await import('../src/index')
  }
  finally {
    process.argv = argv
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.unstubAllEnvs()
  vi.stubEnv('INALIA_ENDPOINT', 'https://dev.example')
  process.exitCode = 0
  files.readFile.mockImplementation(async (path: string) => path.endsWith('slides.md') ? '---\ntheme: default\n---\n' : '# Keep\nOTHER=value\n')
  vi.mocked(connect).mockResolvedValue({ endpoint: 'https://dev.example', token: 'oauth-secret', auth: 'oauth' })
  vi.mocked(fetchUsername).mockResolvedValue('owner')
  vi.mocked(listTalks).mockResolvedValue([{ number: 7, title: 'Talk' }])
  vi.mocked(p.select).mockResolvedValue('7')
})

describe('cli commands', () => {
  it('moves sign-in under auth and preserves login options', async () => {
    await run('auth', 'login', '--no-open', '--read-only')
    expect(login).toHaveBeenCalledWith({ endpoint: 'https://dev.example', open: false, readOnly: true, onUrl: p.log.info })
  })

  it('moves sign-out under auth', async () => {
    await run('auth', 'logout')
    expect(logout).toHaveBeenCalledWith('https://dev.example')
  })

  it('selects a talk using OAuth and persists only deck configuration', async () => {
    await run('talk', 'select')
    expect(fetchUsername).toHaveBeenCalledWith('https://dev.example', 'oauth-secret', 'oauth')
    expect(listTalks).toHaveBeenCalledWith('https://dev.example', 'owner', 'oauth-secret', 'oauth')
    expect(files.writeFile).toHaveBeenCalledWith(expect.stringContaining('.env'), expect.stringContaining('VITE_INALIA_TALK_NUMBER="7"'), expect.any(Object))
    const saved = files.writeFile.mock.calls[0][1]
    expect(saved).toContain('# Keep\nOTHER=value')
    expect(saved).not.toContain('VITE_INALIA_AUTH')
    expect(saved).not.toContain('VITE_INALIA_API_KEY')
    expect(saved).not.toContain('oauth-secret')
    expect(saved).not.toContain('ENDPOINT')
    expect(saved).not.toContain('VITE_INALIA_USERNAME')
  })

  it('runs the shared selection in explicit setup and updates slides', async () => {
    await run('slidev', 'setup')
    expect(connect).toHaveBeenCalledTimes(1)
    expect(files.writeFile).toHaveBeenCalledWith(expect.stringContaining('slides.md'), expect.stringContaining('slidev-addon-inalia'), 'utf8')
  })

  it.each(['cancel', 'empty', 'failure'])('does not change files on %s', async (scenario) => {
    if (scenario === 'cancel')
      vi.mocked(p.select).mockResolvedValue(Symbol('cancel'))
    if (scenario === 'empty')
      vi.mocked(listTalks).mockResolvedValue([])
    if (scenario === 'failure')
      vi.mocked(listTalks).mockRejectedValue(new Error('Unavailable'))
    await run('talk', 'select')
    expect(files.writeFile).not.toHaveBeenCalled()
    if (scenario === 'failure')
      process.exitCode = 0
  })

  it.each([['login'], ['logout'], ['select-talk'], ['setup'], ['slidev', 'setup', '--endpoint', 'https://other.example']])('rejects obsolete commands or options: %j', async (...args) => {
    await run(...args)
    expect(process.exitCode).toBe(1)
    expect(login).not.toHaveBeenCalled()
    expect(files.writeFile).not.toHaveBeenCalled()
    process.exitCode = 0
  })

  it('shows help instead of starting setup without a command', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {})
    await run()
    expect(connect).not.toHaveBeenCalled()
    expect(output).toHaveBeenCalledWith(expect.stringContaining('slidev'))
    output.mockRestore()
  })
})
