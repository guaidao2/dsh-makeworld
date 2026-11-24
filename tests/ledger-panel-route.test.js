import { test } from 'node:test'
import assert from 'node:assert/strict'

import { apply } from '../src/ledger-panel.js'

/** Minimal Host stand-ins: capture the route, fake one session and one ledger. */
function harness(options = {}) {
  let handler
  const calls = []
  const ctx = {
    webServer: {
      register: (route) => {
        handler = route.handler
        return () => {}
      },
    },
    sessions: {
      get: (id) => (id === 's-1' ? { id: 's-1' } : undefined),
    },
    makeworldLedger: {
      panel: async (session) => {
        calls.push({ session: session.id, view: 'panel' })
        if (options.fail === true) throw new Error('ledger exploded')
        return {
          next: { initialized: true, ledger: 'C:/w/.cairn', task: { objective: 'o' }, counts: {}, frontier: [], gaps: {} },
          coverage: { total: 0, evidenced: 0, observed: 0, untouched: 0, entities: [] },
          review: { items: [] },
          broken: 0,
          brokenLines: [],
        }
      },
      read: async (session, view) => {
        calls.push({ session: session.id, view })
        if (view === 'report') return { ledger: 'C:/w/.cairn', report: '# o' }
        if (view === 'ledger') return { ledger: 'C:/w/.cairn', markdown: '# ledger' }
        if (view === 'templates') return { ledger: 'C:/w/.cairn', templates: [], note: 'n' }
        return {}
      },
    },
    effect: (fn) => {
      fn()
      return () => {}
    },
  }
  apply(ctx)
  return { handler, calls }
}

/** Fake ServerResponse that records status, headers and body. */
function response() {
  const out = { status: 0, headers: {}, body: '', headersSent: false }
  return {
    out,
    writeHead(status, headers) {
      if (out.headersSent) throw new Error('writeHead twice')
      out.headersSent = true
      out.status = status
      out.headers = headers ?? {}
    },
    end(chunk) {
      out.body = chunk ?? ''
    },
  }
}

function request(url, method = 'GET') {
  return { url, method, headers: { host: '127.0.0.1:3080' } }
}

const owner = { principal: { kind: 'owner' } }
const guest = { principal: { kind: 'peer' } }

test('the ledger route rejects a missing or unknown session', async () => {
  const { handler } = harness()
  const missing = response()
  await handler(request('/makeworld/ledger'), missing, owner)
  assert.equal(missing.out.status, 400)
  assert.match(missing.out.body, /session query parameter is required/)

  const unknown = response()
  await handler(request('/makeworld/ledger?session=s-404'), unknown, owner)
  assert.equal(unknown.out.status, 404)
  assert.match(unknown.out.body, /unknown or closed session/)
  assert.ok(!unknown.out.body.includes('s-404'), 'an unknown id is not echoed back')
})

test('the ledger route merges one panel snapshot for the session', async () => {
  const { handler, calls } = harness()
  const res = response()
  await handler(request('/makeworld/ledger?session=s-1'), res, owner)
  assert.equal(res.out.status, 200)
  const payload = JSON.parse(res.out.body)
  assert.equal(payload.initialized, true)
  assert.equal(payload.task.objective, 'o')
  assert.deepEqual(calls, [{ session: 's-1', view: 'panel' }], 'one fold per page open')
})

test('HEAD answers without reading the ledger', async () => {
  const { handler, calls } = harness()
  const res = response()
  await handler(request('/makeworld/ledger?session=s-1', 'HEAD'), res, owner)
  assert.equal(res.out.status, 200)
  assert.equal(res.out.body, '')
  assert.deepEqual(calls, [])
})

test('the report view returns markdown, not the merged payload', async () => {
  const { handler } = harness()
  const res = response()
  await handler(request('/makeworld/ledger?session=s-1&view=report'), res, owner)
  assert.equal(res.out.status, 200)
  assert.equal(JSON.parse(res.out.body).markdown, '# o')
})

test('an unknown view is a 400, not a silent downgrade', async () => {
  const { handler } = harness()
  const res = response()
  await handler(request('/makeworld/ledger?session=s-1&view=state'), res, owner)
  assert.equal(res.out.status, 400)
  assert.match(res.out.body, /unknown view/)
})

test('a non-owner peer is refused before any ledger read', async () => {
  const { handler, calls } = harness()
  const res = response()
  await handler(request('/makeworld/ledger?session=s-1'), res, guest)
  assert.equal(res.out.status, 403)
  assert.deepEqual(calls, [])
})

test('the route is read-only and reports ledger failures as 500', async () => {
  const { handler } = harness()
  const post = response()
  await handler(request('/makeworld/ledger?session=s-1', 'POST'), post, owner)
  assert.equal(post.out.status, 405)

  const failing = harness({ fail: true })
  const res = response()
  await failing.handler(request('/makeworld/ledger?session=s-1'), res, owner)
  assert.equal(res.out.status, 500)
  assert.match(res.out.body, /ledger exploded/)
})
