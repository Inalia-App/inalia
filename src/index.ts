#!/usr/bin/env node

import { access, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import * as p from '@clack/prompts'
import { cac } from 'cac'
import { addDependency } from 'nypm'
import packageJSON from '../package.json' with { type: 'json' }
import { cliEndpoint, connect, connectionEnv } from './connection'
import { mergeInaliaEnv } from './env'
import { addInaliaAddon } from './frontmatter'
import { login, logout } from './oauth/client'
import { fetchUsername, listTalks } from './talks'

const cli = cac('inalia')
const authCli = cac('inalia auth')
const talkCli = cac('inalia talk')
const slidevCli = cac('inalia slidev')

async function readEnvFile(): Promise<string> {
  try {
    return await readFile(resolve(process.cwd(), '.env'), 'utf8')
  }
  catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
      throw error
    return ''
  }
}

async function selectTalk(): Promise<boolean> {
  const content = await readEnvFile()
  const connection = await connect(content, p.log.info)
  const { endpoint, token, auth } = connection
  const username = await fetchUsername(endpoint, token, auth)
  const talks = await listTalks(endpoint, username, token, auth)
  if (!talks.length) {
    p.log.warn('No talks found. Create a talk in Inalia, then run this command again.')
    return false
  }
  const talkNumber = await p.select({
    message: 'Choose a talk:',
    options: talks.map(talk => ({
      value: String(talk.number),
      label: `${talk.title} (#${talk.number})`,
      hint: talk.scheduled_at,
    })),
  })
  if (p.isCancel(talkNumber)) {
    p.cancel('Selection cancelled. No deck files changed.')
    return false
  }
  const envContent = mergeInaliaEnv(content, connectionEnv(connection, talkNumber))
  await writeFile(resolve(process.cwd(), '.env'), envContent, { encoding: 'utf8', mode: 0o600 })
  return true
}

async function updateSlidesFile(): Promise<void> {
  const slidesPath = resolve(process.cwd(), 'slides.md')
  const content = await readFile(slidesPath, 'utf8')
  await writeFile(slidesPath, addInaliaAddon(content), 'utf8')
}

function reportError(error: unknown): void {
  p.log.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}

authCli
  .command('login', 'Sign in to Inalia (credentials stay outside the deck)')
  .option('--no-open', 'Print the login URL without opening a browser')
  .option('--read-only', 'Request live read access without permission to start talks')
  .action(async (options) => {
    try {
      await login({ endpoint: cliEndpoint(), open: options.open, readOnly: options.readOnly, onUrl: p.log.info })
      p.log.success('Signed in. Run npx inalia talk select to connect your deck.')
    }
    catch (error) {
      reportError(error)
    }
  })

authCli
  .command('logout', 'Revoke the current authorization and remove local credentials')
  .action(async () => {
    try {
      await logout(cliEndpoint())
      p.log.success('Signed out of Inalia.')
    }
    catch (error) {
      reportError(error)
    }
  })

slidevCli
  .command('setup', 'Install and configure Inalia for your presentation')
  .action(async () => {
    p.intro('🎯 Welcome to Slidev Addon Inalia Setup!')
    try {
      try {
        await access(resolve(process.cwd(), 'slides.md'))
      }
      catch {
        throw new Error('slides.md not found in current directory. Please run this command in your Slidev project directory.')
      }
      if (!await selectTalk())
        return

      const s = p.spinner()
      s.start('📦 Installing slidev-addon-inalia...')
      let installSuccess = true
      try {
        await addDependency('slidev-addon-inalia', { silent: true })
      }
      catch {
        installSuccess = false
      }
      try {
        s.message('📝 Updating slides.md...')
        await updateSlidesFile()
        s.stop('✅ Setup tasks completed!')
      }
      catch (error) {
        s.stop('Setup failed.')
        throw error
      }
      if (installSuccess)
        p.log.success('Setup complete! Run your usual Slidev development command to start presenting.')
      else
        p.log.warn('Setup partially complete. Install the package manually: npm install slidev-addon-inalia')
      p.outro('🚀 Happy presenting with Inalia!')
    }
    catch (error) {
      reportError(error)
    }
  })

talkCli
  .command('select', 'Choose an Inalia talk and save the connection to .env')
  .action(async () => {
    p.intro('🎤 Select your Inalia talk')
    try {
      if (await selectTalk())
        p.outro('Talk saved to .env. Restart Slidev to use it.')
    }
    catch (error) {
      reportError(error)
    }
  })

cli.command('auth', 'Manage your Inalia sign-in').action(() => authCli.outputHelp())
cli.command('talk', 'Manage the talk connected to your deck').action(() => talkCli.outputHelp())
cli.command('slidev', 'Set up the Inalia Slidev addon').action(() => slidevCli.outputHelp())

for (const parser of [cli, authCli, talkCli, slidevCli]) {
  parser.help()
  parser.version(packageJSON.version)
}

const group = process.argv[2]
const parser = group === 'auth' ? authCli : group === 'talk' ? talkCli : group === 'slidev' ? slidevCli : cli
const argv = parser === cli ? process.argv : [...process.argv.slice(0, 2), ...process.argv.slice(3)]
try {
  const { args, options } = parser.parse(argv, { run: false })
  if (!parser.matchedCommand && !options.help && !options.version) {
    if (args.length)
      throw new Error(`Unknown command: ${args.join(' ')}. Run with --help to see available commands.`)
    parser.outputHelp()
  }
  else {
    await parser.runMatchedCommand()
  }
}
catch (error) {
  reportError(error)
}
