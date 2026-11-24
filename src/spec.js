/**
 * Durable storage domain for the makeworld platform layer.
 *
 * Only two global (not session-scoped) tables survive the platform trim:
 *  - `environment_settings`: the single control-center row (id `global`)
 *  - `mcp_servers`: one row per user-configured MCP server, keyed by name
 *
 * Task beliefs live in the working-directory ledger (`src/makeworld/*`), not in
 * this domain, so nothing here is keyed by session.
 *
 * @module dsh-makeworld/spec
 */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'

/** Non-empty id. */
const id = z.string().min(1)

const iso = z.string().min(1)

/** Global environment settings for the control center. */
export const environmentSettingsSchema = z.object({
  id,
  gitbashEnabled: z.boolean().default(false),
  gitbashShellPath: z.string().default(''),
  updatedAt: iso,
})

/** One user-configured MCP server; transport-specific fields are ignored when unused. */
export const mcpServerSchema = z.object({
  id,
  serverName: z.string().min(1),
  transport: z.enum(['stdio', 'streamable-http']).default('stdio'),
  command: z.string().default(''),
  args: z.array(z.string()).default([]),
  env: z.array(z.object({ key: z.string(), value: z.string() })).default([]),
  url: z.string().default(''),
  headers: z.array(z.object({ key: z.string(), value: z.string() })).default([]),
  timeoutMs: z.number().default(60000),
  failOnStartupError: z.boolean().default(true),
  enabled: z.boolean().default(true),
  updatedAt: iso,
})

/** The whole platform domain: environment settings plus MCP configurations. */
export const makeworldDomainSpec = defineDomain({
  name: 'makeworld',
  version: 1,
  tables: {
    environment_settings: domainTable(environmentSettingsSchema),
    mcp_servers: domainTable(mcpServerSchema),
  },
})
