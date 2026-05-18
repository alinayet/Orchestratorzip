import { config } from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'

const root = process.cwd()
if (existsSync(resolve(root, '.env'))) config({ path: resolve(root, '.env') })
if (existsSync(resolve(root, 'env'))) config({ path: resolve(root, 'env') })

export const ENV_GROUPS = {
  dynadot: ['DYNADOT_API_KEY'],
  zapmail: ['ZAPMAIL_API_KEY', 'ZAPMAIL_WORKSPACE_KEY', 'ZAPMAIL_SERVICE_PROVIDER'],
  instantly: ['INSTANTLY_API_KEY'],
} as const

export function requireEnv(keys: readonly string[]) {
  const missing = keys.filter(k => !process.env[k]?.trim())
  if (missing.length > 0) {
    console.error(`❌ Missing required env variable(s): ${missing.join(', ')}`)
    console.error('   Copy .env.example to .env (or fill in `env`) and add your API keys.')
    process.exit(1)
  }
}

export const ZAPMAIL_NAMESERVERS = [
  'pns61.cloudns.net',
  'pns62.cloudns.com',
  'pns63.cloudns.net',
  'pns64.cloudns.uk',
] as const

// ─────────────────────────────────────────
// DYNADOT
// ─────────────────────────────────────────
const DYNADOT_BASE = 'https://api.dynadot.com/api3.json'

export function assertDynadotOk(data: Record<string, unknown>, responseKey: string) {
  const resp = data[responseKey] as { ResponseCode?: string | number; Error?: string; Status?: string } | undefined
  if (!resp) return
  if (String(resp.ResponseCode) !== '0') {
    throw new Error(resp.Error || resp.Status || `Dynadot ${responseKey} failed (code ${resp.ResponseCode})`)
  }
}

export const dynadot = {
  get: async (params: Record<string, string>) => {
    requireEnv(ENV_GROUPS.dynadot)
    const query = new URLSearchParams({
      key: process.env.DYNADOT_API_KEY!,
      ...params,
    })
    const res = await fetch(`${DYNADOT_BASE}?${query}`)
    if (!res.ok) throw new Error(`Dynadot HTTP ${res.status} ${res.statusText}`)
    return res.json() as Promise<Record<string, unknown>>
  },

  setNameservers: async (domains: string[]) => {
    const params: Record<string, string> = {
      command: 'set_ns',
      domain: domains.join(','),
    }
    ZAPMAIL_NAMESERVERS.forEach((ns, i) => {
      params[`ns${i}`] = ns
    })
    const data = await dynadot.get(params)
    assertDynadotOk(data, 'SetNsResponse')
    return data
  },
}

// ─────────────────────────────────────────
// ZAPMAIL
// ─────────────────────────────────────────
const ZAPMAIL_BASE = 'https://api.zapmail.ai/api/v2'

function zapmailHeaders() {
  requireEnv(ENV_GROUPS.zapmail)
  return {
    'x-auth-zapmail': process.env.ZAPMAIL_API_KEY!,
    'x-workspace-key': process.env.ZAPMAIL_WORKSPACE_KEY!,
    'x-service-provider': process.env.ZAPMAIL_SERVICE_PROVIDER!,
    'Content-Type': 'application/json',
  }
}

async function parseZapmailResponse(res: Response) {
  const text = await res.text()
  let body: Record<string, unknown> = {}
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { message: text }
  }
  if (!res.ok) {
    const msg = (body.message as string) || text || res.statusText
    throw new Error(`Zapmail ${res.status}: ${msg}`)
  }
  if (typeof body.status === 'number' && body.status >= 400) {
    throw new Error(`Zapmail: ${(body.message as string) || 'request failed'}`)
  }
  return body
}

export const zapmail = {
  get: async (endpoint: string, params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params) : ''
    const res = await fetch(`${ZAPMAIL_BASE}${endpoint}${query}`, {
      headers: zapmailHeaders(),
    })
    return parseZapmailResponse(res)
  },

  post: async (endpoint: string, body: unknown) => {
    const res = await fetch(`${ZAPMAIL_BASE}${endpoint}`, {
      method: 'POST',
      headers: zapmailHeaders(),
      body: JSON.stringify(body),
    })
    return parseZapmailResponse(res)
  },
}

export type ZapmailMailbox = {
  id: string
  username: string
  email: string
  status: string
  domain: string
  domainId: string
}

export type ZapmailDomain = {
  id: string
  domain: string
  status: string
  mailboxes: ZapmailMailbox[]
}

export async function getZapmailDomains(): Promise<ZapmailDomain[]> {
  const data = await zapmail.get('/mailboxes/list', { limit: '500', page: '1' })
  const domains = (data.data as { domains?: ZapmailDomain[] })?.domains
  return domains || []
}

export async function fetchZapmailDomainRecords(): Promise<{ id: string; domain: string; status: string }[]> {
  const data = await zapmail.get('/domains', { limit: '500', page: '1' })
  const domains = (data.data as { domains?: { id: string; domain: string; status: string }[] })?.domains
  return domains || []
}

export async function getDomainIdMap(domainNames: string[]): Promise<Map<string, string>> {
  const zapDomains = await fetchZapmailDomainRecords()
  const map = new Map<string, string>()
  for (const name of domainNames) {
    const found = zapDomains.find(d => d.domain.toLowerCase() === name.toLowerCase())
    if (found) map.set(name, found.id)
  }
  return map
}

export async function connectDomainsToZapmail(domainNames: string[]) {
  return zapmail.post('/domains/connect-domain', { domainNames })
}

export type ConnectDomainStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'DOMAIN_ALREADY_CONNECTED'
  | 'NS_NOT_CHANGED'
  | 'DOMAIN_NOT_REGISTERED'
  | string

export function parseConnectDomainStatuses(
  data: Record<string, unknown>,
  domainNames: string[]
): Record<string, ConnectDomainStatus> {
  const domains = (data.data as { domains?: Record<string, { status: string }> })?.domains || {}
  const out: Record<string, ConnectDomainStatus> = {}
  for (const name of domainNames) {
    out[name] = domains[name]?.status || 'PENDING'
  }
  return out
}

const CONNECT_TERMINAL_OK = new Set(['SUCCESS', 'DOMAIN_ALREADY_CONNECTED'])

export function allDomainsConnected(statuses: Record<string, ConnectDomainStatus>) {
  return Object.values(statuses).every(s => CONNECT_TERMINAL_OK.has(s))
}

export function anyConnectTerminalFailure(statuses: Record<string, ConnectDomainStatus>) {
  const failures = ['DOMAIN_NOT_REGISTERED', 'BLACKLISTED_DOMAIN', 'BANNED_DOMAIN', 'WORKSPACE_ALREADY_EXISTS']
  return Object.values(statuses).some(s => failures.includes(s))
}

export type MailboxAssignInput = {
  firstName: string
  lastName: string
  mailboxUsername: string
  domainName: string
}

export async function assignMailboxes(
  payload: Record<string, MailboxAssignInput[]>
) {
  return zapmail.post('/mailboxes', payload)
}

export async function listAllMailboxes(): Promise<ZapmailMailbox[]> {
  const domains = await getZapmailDomains()
  return domains.flatMap(d => d.mailboxes || [])
}

export async function exportMailboxesToInstantly(mailboxIds: string[]) {
  const body: Record<string, unknown> = {
    apps: ['INSTANTLY'],
    ids: mailboxIds,
    excludeIds: [],
    tagIds: [],
    status: '',
    contains: '',
  }
  const thirdPartyId = process.env.ZAPMAIL_INSTANTLY_THIRD_PARTY_ACCOUNT_ID?.trim()
  if (thirdPartyId) body.thirdPartyAccountId = thirdPartyId
  return zapmail.post('/exports/mailboxes', body)
}

// ─────────────────────────────────────────
// INSTANTLY (REST — warmup uses MCP; export goes through Zapmail)
// ─────────────────────────────────────────
const INSTANTLY_BASE = 'https://api.instantly.ai/api/v2'

export const instantly = {
  get: async (endpoint: string, params?: Record<string, string>) => {
    requireEnv(ENV_GROUPS.instantly)
    const query = params ? '?' + new URLSearchParams(params) : ''
    const res = await fetch(`${INSTANTLY_BASE}${endpoint}${query}`, {
      headers: {
        Authorization: `Bearer ${process.env.INSTANTLY_API_KEY!}`,
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) throw new Error(`Instantly HTTP ${res.status} ${res.statusText}`)
    return res.json()
  },
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
export const wait = (seconds: number) =>
  new Promise(resolve => setTimeout(resolve, seconds * 1000))

export const readDomains = async (): Promise<string[]> => {
  const { readFileSync } = await import('fs')
  const lines = readFileSync('domains.txt', 'utf-8').split('\n')
  return lines
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
}

export const saveMailboxes = async (data: unknown) => {
  const { writeFileSync } = await import('fs')
  writeFileSync('mailboxes.json', JSON.stringify(data, null, 2))
}

export const readMailboxes = async () => {
  const { readFileSync } = await import('fs')
  return JSON.parse(readFileSync('mailboxes.json', 'utf-8'))
}
