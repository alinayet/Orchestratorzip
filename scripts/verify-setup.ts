/**
 * Smoke / credential check — no purchases. Run: npx tsx scripts/verify-setup.ts
 */
import * as p from '@clack/prompts'
import { existsSync } from 'fs'
import {
  ENV_GROUPS,
  requireEnv,
  dynadot,
  assertDynadotOk,
  fetchZapmailDomainRecords,
} from '../_lib.ts'

p.intro('🔍 Verify Outbound Infra Setup')

const checks: { name: string; ok: boolean; detail: string }[] = []

function record(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail })
  if (ok) p.log.success(`✓ ${name}: ${detail}`)
  else p.log.error(`✗ ${name}: ${detail}`)
}

record('.env or env file', existsSync('.env') || existsSync('env'), existsSync('.env') ? '.env' : existsSync('env') ? 'env' : 'missing')
record('domains.txt', existsSync('domains.txt'), existsSync('domains.txt') ? 'present' : 'missing (ok before skill 1)')
record('mailboxes.json', existsSync('mailboxes.json'), existsSync('mailboxes.json') ? 'present' : 'missing (ok before skill 2)')

const hasDynadot = Boolean(process.env.DYNADOT_API_KEY?.trim())
const hasZapmail =
  Boolean(process.env.ZAPMAIL_API_KEY?.trim()) &&
  Boolean(process.env.ZAPMAIL_WORKSPACE_KEY?.trim()) &&
  Boolean(process.env.ZAPMAIL_SERVICE_PROVIDER?.trim())

if (hasDynadot) {
  try {
    requireEnv(ENV_GROUPS.dynadot)
    const data = await dynadot.get({ command: 'account_info' })
    assertDynadotOk(data, 'AccountInfoResponse')
    record('Dynadot API', true, 'account_info OK')
  } catch (err) {
    record('Dynadot API', false, String(err))
  }
} else {
  record('Dynadot API', false, 'DYNADOT_API_KEY not set (skipped)')
}

if (hasZapmail) {
  try {
    requireEnv(ENV_GROUPS.zapmail)
    const domains = await fetchZapmailDomainRecords()
    record('Zapmail API', true, `${domains.length} domain(s) in workspace`)
  } catch (err) {
    record('Zapmail API', false, String(err))
  }
} else {
  record('Zapmail API', false, 'Zapmail keys not set (skipped)')
}

if (process.env.INSTANTLY_API_KEY?.trim()) {
  record('Instantly API key', true, 'set (used for MCP warmup)')
} else {
  record('Instantly API key', false, 'INSTANTLY_API_KEY not set (needed for skill 4)')
}

const failed = checks.filter(c => !c.ok && !c.detail.includes('skipped') && !c.detail.includes('ok before'))
if (failed.length === 0) {
  p.outro('All checks passed (or skipped where keys are missing).')
} else {
  p.outro(`${failed.length} check(s) need attention.`)
  process.exit(1)
}
