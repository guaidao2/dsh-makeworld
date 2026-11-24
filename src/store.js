/**
 * Platform store for dsh-makeworld.
 *
 * Owns the two-table `makeworld` storage domain and exposes it as
 * `ctx.makeworldPlatform` for the two host rows that need durable state:
 *
 *   - `environment.js` — the Git Bash switch and its manual shell path;
 *   - `mcp.js` — the user-configured MCP server list.
 *
 * There is no session dimension here: both callers read and write global rows,
 * so writes are serialized through one queue instead of a per-session map, and
 * there is no projection, dispatcher or engagement bookkeeping left. Task
 * beliefs live in the working-directory ledger, not in this domain.
 *
 * @module dsh-makeworld/store
 */

import { Service } from '@deepseek-ai/cordis'
import { makeworldDomainSpec } from './spec.js'

/** Node/browser-neutral timestamp. */
function now() {
  return new Date().toISOString()
}

/** The platform store service (`ctx.makeworldPlatform`). */
export default class MakeworldPlatform extends Service {
  static inject = ['storageDomain']

  constructor(ctx) {
    super(ctx, 'makeworldPlatform')
    this.domainPromise = undefined
    this.writeQueue = Promise.resolve()
    ctx.effect(() => async () => {
      const pending = this.domainPromise
      this.domainPromise = undefined
      await this.writeQueue
      if (pending !== undefined) {
        // A domain that never opened has nothing to close; a rejected open is
        // reported where it happened, not again during unload.
        const domain = await pending.catch(() => undefined)
        if (domain !== undefined) await domain.close()
      }
    }, 'makeworld:domain')
  }

  /** Resolve the opened domain, opening it lazily on first use. */
  async domain() {
    if (this.domainPromise === undefined) {
      this.domainPromise = this.ctx.storageDomain.open(makeworldDomainSpec).catch((error) => {
        // Do not cache a failed open: the next call may succeed (backend ready later).
        this.domainPromise = undefined
        throw error
      })
    }
    return this.domainPromise
  }

  /**
   * Serialize one read/allocate/write transaction. Both tables are global, so a
   * single queue is enough; callers never see a rejected predecessor.
   * @param operation - work to run once the previous transaction settled.
   */
  enqueue(operation) {
    const current = this.writeQueue.then(operation, operation)
    this.writeQueue = current.then(
      () => undefined,
      () => undefined,
    )
    return current
  }

  /** Global environment settings, with safe defaults for a fresh install. */
  async environmentSettings() {
    return this.enqueue(async () => {
      const domain = await this.domain()
      const row = domain.table('environment_settings').get('global')
      return row ?? { id: 'global', gitbashEnabled: false, gitbashShellPath: '', updatedAt: now() }
    })
  }

  /**
   * Merge and persist the environment settings owned by the control-center form.
   * An omitted field keeps its stored value; an unsaved row starts from defaults.
   * @param input - `{ gitbashEnabled?, gitbashShellPath? }`.
   */
  async saveEnvironmentSettings(input = {}) {
    return this.enqueue(async () => {
      const domain = await this.domain()
      const table = domain.table('environment_settings')
      const existing = table.get('global')
      const row = {
        id: 'global',
        gitbashEnabled: typeof input.gitbashEnabled === 'boolean'
          ? input.gitbashEnabled
          : existing?.gitbashEnabled === true,
        gitbashShellPath: typeof input.gitbashShellPath === 'string'
          ? input.gitbashShellPath.trim()
          : existing?.gitbashShellPath ?? '',
        updatedAt: now(),
      }
      await table.put('global', row)
      return row
    })
  }

  /** All configured MCP servers, ordered by name. */
  async mcpServers() {
    return this.enqueue(async () => {
      const domain = await this.domain()
      return [...domain.table('mcp_servers').entries()]
        .map(([, row]) => row)
        .sort((left, right) => left.serverName.localeCompare(right.serverName))
    })
  }

  /** Create or replace one MCP server configuration. */
  async saveMcpServer(input = {}) {
    const serverName = typeof input.serverName === 'string' ? input.serverName.trim() : ''
    if (!/^[A-Za-z0-9_-]{1,32}$/u.test(serverName)) {
      throw new Error('serverName must match [A-Za-z0-9_-]{1,32}')
    }
    const transport = input.transport === 'streamable-http' ? 'streamable-http' : 'stdio'
    if (transport === 'stdio' && (typeof input.command !== 'string' || input.command.trim() === '')) throw new Error('stdio requires command')
    if (transport === 'streamable-http' && (typeof input.url !== 'string' || input.url.trim() === '')) {
      throw new Error('streamable-http requires url')
    }
    const pairs = value => (Array.isArray(value) ? value : [])
      .map(item => ({ key: String(item?.key ?? '').trim(), value: String(item?.value ?? '') }))
      .filter(item => item.key !== '')
    const row = {
      id: serverName,
      serverName,
      transport,
      command: transport === 'stdio' ? String(input.command ?? '').trim() : '',
      args: Array.isArray(input.args) ? input.args.map(String) : [],
      env: transport === 'stdio' ? pairs(input.env) : [],
      url: transport === 'streamable-http' ? String(input.url ?? '').trim() : '',
      headers: transport === 'streamable-http' ? pairs(input.headers) : [],
      timeoutMs: Number.isFinite(Number(input.timeoutMs)) && Number(input.timeoutMs) > 0 ? Number(input.timeoutMs) : 60000,
      failOnStartupError: input.failOnStartupError !== false,
      enabled: input.enabled !== false,
      updatedAt: now(),
    }
    return this.enqueue(async () => {
      const domain = await this.domain()
      await domain.table('mcp_servers').put(serverName, row)
      return row
    })
  }

  /** Delete one MCP server configuration. */
  async deleteMcpServer(serverName) {
    const name = String(serverName ?? '').trim()
    return this.enqueue(async () => {
      const domain = await this.domain()
      await domain.table('mcp_servers').delete(name)
      return { serverName: name }
    })
  }
}
