/**
 * Platform-layer contract after the trim.
 *
 * The control center needs exactly two durable tables and one service; the two
 * HTTP routes live under `/makeworld`. These are source-level assertions (the
 * same shape the old mcp test used) so a regression shows up without mounting a
 * Cordis context or a storage backend.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

test('the platform domain keeps only the two control-center tables', () => {
  const spec = read('spec.js')
  assert.match(spec, /name: 'makeworld'/)
  assert.match(spec, /environment_settings: domainTable\(environmentSettingsSchema\)/)
  assert.match(spec, /mcp_servers: domainTable\(mcpServerSchema\)/)
  const dropped = [
    'engagements', 'goals', 'intents', 'facts', 'findings', 'hints', 'assets', 'edges',
    'flows', 'evidence', 'activity', 'retests', 'constraints', 'attack_paths',
    'project_tombstones', 'projects', 'concepts', 'concept_relations',
  ]
  for (const table of dropped) {
    assert.doesNotMatch(spec, new RegExp(`\\b${table}: domainTable`), `${table} must not be declared`)
  }
  assert.doesNotMatch(spec, /lingeye/, 'the domain is no longer named after the pentest layer')
})

test('the platform service is makeworldPlatform and exposes only the control-center methods', () => {
  const store = read('store.js')
  assert.match(store, /super\(ctx, 'makeworldPlatform'\)/)
  assert.match(store, /static inject = \['storageDomain'\]/)
  assert.match(store, /storageDomain\.open\(makeworldDomainSpec\)/)
  for (const method of ['environmentSettings', 'saveEnvironmentSettings', 'mcpServers', 'saveMcpServer', 'deleteMcpServer']) {
    assert.match(store, new RegExp(`async ${method}\\(`), `${method} must stay available`)
  }
  for (const gone of ['publishLatest', 'startDispatcher', 'dispatchPending', 'registerProjection', 'snapshot', 'engagements']) {
    assert.doesNotMatch(store, new RegExp(gone), `${gone} belongs to the trimmed engagement layer`)
  }
  assert.doesNotMatch(store, /makeworldStore|lingeye/, 'the old service name and domain name are gone')
})

test('the control-center routes live under /makeworld and read the platform service', () => {
  const mcp = read('mcp.js')
  assert.match(mcp, /path: '\/makeworld\/mcp'/)
  assert.match(mcp, /ctx\.makeworldPlatform\.mcpServers\(\)/)
  assert.match(mcp, /ctx\.makeworldPlatform\.saveMcpServer\(/)
  assert.match(mcp, /ctx\.makeworldPlatform\.deleteMcpServer\(/)
  assert.match(mcp, /@deepseek-ai\/dsh-mcp-client/)
  assert.match(mcp, /ctx\.plugin\(McpClient/)

  const environment = read('environment.js')
  assert.match(environment, /path: '\/makeworld\/environment'/)
  assert.match(environment, /ctx\.makeworldPlatform\.environmentSettings\(\)/)
  assert.match(environment, /ctx\.makeworldPlatform\.saveEnvironmentSettings\(/)
  assert.doesNotMatch(environment, /\/lingeye\//)
  assert.doesNotMatch(mcp, /\/lingeye\//)
})

test('the environment row injects the platform service, not the removed store name', () => {
  const environment = read('environment.js')
  assert.match(environment, /export const inject = \['webServer', 'makeworldPlatform'\]/)
  assert.doesNotMatch(environment, /makeworldStore/)
  // The gitbash row consumes the environment row, so it must not name the store.
  const gitbash = read('gitbash.js')
  assert.doesNotMatch(gitbash, /makeworldStore|makeworldPlatform/)
})
