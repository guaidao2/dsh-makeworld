/**
 * File-layer tests: the same operations the five tools call, against a real
 * directory. Covers aliases, atomic batches, refusal of dangling references,
 * the evidence blob, the strict settle matrix and the exported deliverables.
 *
 * Scratch directories stay inside the workspace (`.tmp-test/`) and are removed
 * afterwards.
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, readFile, readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'

import { Ledger } from '../src/makeworld/files.js'

const SCRATCH = path.join(process.cwd(), '.tmp-test')

/** Fresh ledger rooted at a unique directory. */
async function sandbox() {
  const dir = path.join(SCRATCH, `ledger-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`)
  await mkdir(dir, { recursive: true })
  return { dir, ledger: new Ledger({ writeMarkdown: true }), root: path.join(dir, '.cairn') }
}

/** The standard fixture: one goal, one entity, one intent, one fact with evidence. */
async function seeded(ledger, root) {
  await ledger.open(root, 'test', {
    subject: 'repo', objective: '修好缓存过期', acceptance: '回归用例通过', constraints: ['不要动生产数据'],
  })
  const written = await ledger.write(root, 'test', [
    { kind: 'goal', alias: 'goal', text: '复现并定位过期读', acceptance: '能稳定复现' },
    { kind: 'entity', alias: 'mod', type: 'module', value: 'src/cache.js' },
    {
      kind: 'intent', alias: 'repro', title: '复现过期读', state: 'open',
      expectedObservation: '写入后立刻读到旧值', decides: ['ttl 配错', '并发竞态'],
      uncertainty: 0.8, cost: 2, goalId: '$goal', entityIds: ['$mod'],
    },
    { kind: 'evidence', alias: 'log', label: '测试输出', type: 'log', content: 'expected fresh, got stale', channel: 'node --test' },
    {
      kind: 'fact', intentId: '$repro', detail: '写入后第二次读返回旧值', basis: 'observed',
      confidence: 0.9, evidenceIds: ['$log'], entityIds: ['$mod'],
    },
  ])
  return written
}

test('open → write → read → settle → export', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))

  const opened = await ledger.open(root, 'test', {
    subject: 'repo', objective: '修好缓存过期', acceptance: '回归用例通过', constraints: ['不要动生产数据'],
  })
  assert.equal(opened.task.objective, '修好缓存过期')
  assert.equal(opened.constraints, 1)

  const written = await ledger.write(root, 'test', [
    { kind: 'goal', alias: 'goal', text: '复现并定位过期读', acceptance: '能稳定复现' },
    { kind: 'entity', alias: 'mod', type: 'module', value: 'src/cache.js' },
    {
      kind: 'intent', alias: 'repro', title: '复现过期读', state: 'open',
      expectedObservation: '写入后立刻读到旧值', decides: ['ttl 配错', '并发竞态'],
      uncertainty: 0.8, cost: 2, goalId: '$goal', entityIds: ['$mod'],
    },
    { kind: 'evidence', alias: 'log', label: '测试输出', type: 'log', content: 'expected fresh, got stale', channel: 'node --test' },
    {
      kind: 'fact', intentId: '$repro', detail: '写入后第二次读返回旧值', basis: 'observed',
      confidence: 0.9, evidenceIds: ['$log'], entityIds: ['$mod'],
    },
    {
      kind: 'claim', intentId: '$repro', title: '缓存写路径没有失效条目', type: 'defect',
      weight: 4, evidenceIds: ['$log'], entityIds: ['$mod'], reproduceSteps: ['跑 npm test -- cache'],
    },
  ])

  assert.deepEqual(written.created.map(item => item.id), ['g-1', 'x-1', 'i-1', 'e-1', 'f-1', 'c-1'])
  assert.equal(written.aliases.repro, 'i-1')
  assert.equal(written.danglingRefs, 0)

  const next = await ledger.read(root, 'next')
  assert.equal(next.initialized, true)
  assert.equal(next.frontier[0].id, 'i-1')
  assert.equal(next.gaps.untestedEntities.length, 0)

  const coverage = await ledger.read(root, 'coverage')
  assert.equal(coverage.evidenced, 1)
  assert.equal(coverage.entities[0].type, 'module')

  const settled = await ledger.settle(root, 'test', {
    ref: 'c-1', verdict: 'holds', reason: '测试稳定复现', evidenceIds: ['e-1'],
  })
  assert.equal(settled.results[0].status, 'confirmed')
  assert.match(settled.results[0].recheck, /^r-\d+$/)

  const state = await ledger.read(root, 'state')
  assert.equal(state.claims[0].status, 'confirmed')
  assert.equal(state.rechecks[0].verdict, 'holds')

  const bundle = await ledger.exportBundle(root)
  const report = await readFile(bundle.files.report, 'utf8')
  assert.match(report, /## 仍依赖的假设/)
  assert.match(report, /缓存写路径没有失效条目/)
  const claims = JSON.parse(await readFile(bundle.files.claims, 'utf8'))
  assert.equal(claims[0].status, 'confirmed')
  assert.equal(claims[0].type, 'defect')
})

test('a batch is all-or-nothing', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await ledger.open(root, 'test', { subject: 's', objective: 'o' })
  await assert.rejects(
    () => ledger.write(root, 'test', [
      { kind: 'note', text: 'this one is fine' },
      { kind: 'fact', detail: 'this one has no basis' },
    ]),
    /record\[1\] \(fact\): fact needs basis/,
  )
  const state = await ledger.read(root, 'state')
  assert.equal(state.notes.length, 0, 'the valid record must not survive a failed batch')
  assert.equal(state.facts.length, 0)
  const log = await readFile(path.join(root, 'ledger.jsonl'), 'utf8')
  assert.equal(log.trim().split('\n').length, 1, 'only the task header was written')
})

test('dangling references are refused instead of stored', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await ledger.open(root, 'test', { subject: 's', objective: 'o' })
  await assert.rejects(
    () => ledger.write(root, 'test', [{ kind: 'fact', detail: 'x', basis: 'observed', intentId: 'i-404' }]),
    /intentId points at "i-404"/,
  )
  await assert.rejects(
    () => ledger.write(root, 'test', [{ kind: 'intent', title: 'x', derivedFromFactIds: ['f-404'] }]),
    /derivedFromFactIds points at "f-404"/,
  )
})

test('an unknown alias is an error, not a literal id', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await ledger.open(root, 'test', { subject: 's', objective: 'o' })
  await assert.rejects(
    () => ledger.write(root, 'test', [{ kind: 'entity', alias: 'mod', type: 'module', value: 'a.js' }, { kind: 'intent', title: 'x', entityIds: ['$nod'] }]),
    /references alias "\$nod"/,
  )
})

test('an explicit id that already exists is refused', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await seeded(ledger, root)
  await assert.rejects(
    () => ledger.write(root, 'test', [{ kind: 'note', id: 'f-1', text: 'collides with a fact' }]),
    /already exists/,
  )
})

test('settle refuses a verdict that does not fit the ref family', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await seeded(ledger, root)
  await assert.rejects(() => ledger.settle(root, 'test', { ref: 'f-1', verdict: 'met' }), /does not apply to a fact/)
  await assert.rejects(() => ledger.settle(root, 'test', { ref: 'i-1', verdict: 'holds' }), /does not apply to a intent/)
  await assert.rejects(() => ledger.settle(root, 'test', { ref: 'zzz', verdict: 'done' }), /unknown ref/)
  const state = await ledger.read(root, 'state')
  assert.equal(state.intents[0].state, 'open')
})

test('a fact is never silently promoted to observed', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await seeded(ledger, root)
  await ledger.write(root, 'test', [
    { kind: 'fact', alias: 'guess', detail: 'ttl 是 60 秒', basis: 'assumed', entityIds: ['x-1'] },
  ])
  await assert.rejects(
    () => ledger.settle(root, 'test', { ref: 'f-2', verdict: 'holds' }),
    /needs evidence/,
  )
  const state = await ledger.read(root, 'state')
  const guess = state.facts.find(fact => fact.id === 'f-2')
  assert.equal(guess.basis, 'assumed')
  assert.equal(guess.confidence, 0.4)
})

test('refuting a fact records a negative belief and keeps its evidence', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await seeded(ledger, root)
  await ledger.write(root, 'test', [
    { kind: 'fact', alias: 'guess', detail: 'ttl 是 60 秒', basis: 'assumed', entityIds: ['x-1'] },
    { kind: 'evidence', alias: 'ttl', label: '配置读取', content: 'ttl=0' },
  ])
  await ledger.settle(root, 'test', { ref: 'f-2', verdict: 'refuted', evidenceIds: ['e-2'], reason: '配置里 ttl=0' })
  const state = await ledger.read(root, 'state')
  const guess = state.facts.find(fact => fact.id === 'f-2')
  assert.equal(guess.basis, 'negative')
  assert.deepEqual(guess.evidenceIds, ['e-2'])
  const view = await ledger.read(root, 'next')
  assert.equal(view.gaps.negative.length, 1)
  assert.equal(view.gaps.assumed.length, 0)
})

test('settle can reopen a closed intent and record the reason', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await seeded(ledger, root)
  await ledger.settle(root, 'test', { ref: 'i-1', verdict: 'done' })
  assert.equal((await ledger.read(root, 'next')).frontier.length, 0)
  await ledger.settle(root, 'test', { ref: 'i-1', verdict: 'reopen', reason: '又出现了' })
  assert.equal((await ledger.read(root, 'next')).frontier.length, 1)
})

test('evidence bodies are content-addressed and kept out of the log', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await ledger.open(root, 'test', { subject: 's', objective: 'o' })
  await ledger.write(root, 'test', [
    { kind: 'evidence', label: 'a', content: 'same bytes' },
    { kind: 'evidence', label: 'b', content: 'same bytes' },
  ])
  const state = await ledger.read(root, 'state')
  const [first, second] = state.evidence
  assert.equal(first.contentSha, second.contentSha)
  const blob = path.join(root, 'evidence', `${first.contentSha}.txt`)
  assert.equal(await readFile(blob, 'utf8'), 'same bytes')
  const log = await readFile(path.join(root, 'ledger.jsonl'), 'utf8')
  assert.ok(!log.includes('"content"'), 'the evidence body must not be stored in the log')
  assert.ok(log.includes(first.contentSha))
  assert.ok(log.includes('"excerpt"'), 'a short excerpt is kept so views can show it')
})

test('reset archives the old log instead of deleting it', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await ledger.open(root, 'test', { subject: 'first', objective: 'one' })
  await ledger.write(root, 'test', [{ kind: 'note', text: 'something happened' }])
  const reopened = await ledger.open(root, 'test', { subject: 'second', objective: 'two', reset: true })
  assert.equal(reopened.archived.length, 1)
  await stat(reopened.archived[0])
  const names = await readdir(root)
  assert.ok(names.some(name => /^ledger\..*\.jsonl$/.test(name)))
  const state = await ledger.read(root, 'state')
  assert.equal(state.notes.length, 0)
  assert.equal(state.task.subject, 'second')
})

test('write before open still creates a header', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await ledger.write(root, 'test', [{ kind: 'note', text: 'orphan note' }])
  const state = await ledger.read(root, 'state')
  assert.equal(state.task.subject, '未命名任务')
  assert.equal(state.notes.length, 1)
})

test('a broken log line is reported, not silently swallowed', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await seeded(ledger, root)
  const logPath = path.join(root, 'ledger.jsonl')
  const log = await readFile(logPath, 'utf8')
  await rm(logPath)
  await mkdir(root, { recursive: true })
  await readFile(path.join(root, 'LEDGER.md'), 'utf8')
  const fs = await import('node:fs/promises')
  await fs.writeFile(logPath, `${log}not json\n`, 'utf8')
  const view = await ledger.read(root, 'next')
  assert.equal(view.broken, 1)
  assert.deepEqual(view.brokenLines, [log.trim().split('\n').length + 1])
})

test('an explicit id must look like an id', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await ledger.open(root, 'test', { subject: 's', objective: 'o' })
  await assert.rejects(
    () => ledger.write(root, 'test', [{ kind: 'note', id: 'i-1\n## forged', text: 'x' }]),
    /is not an id/,
  )
})

test('a reference hidden in an unlisted field is still refused', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await ledger.open(root, 'test', { subject: 's', objective: 'o' })
  await assert.rejects(
    () => ledger.write(root, 'test', [{ kind: 'goal', text: 'g', entityIds: ['x-ghost'] }]),
    /entityIds points at "x-ghost"/,
  )
  await assert.rejects(
    () => ledger.write(root, 'test', [{ kind: 'entity', type: 'doc', value: 'a.md', parentId: 'x-ghost' }]),
    /parentId points at "x-ghost"/,
  )
})

test('reset does not inherit the previous header', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await ledger.open(root, 'test', { subject: 'first', objective: 'one', acceptance: 'a1' })
  const reopened = await ledger.open(root, 'test', { subject: 'second', objective: 'two', reset: true })
  assert.equal(reopened.task.subject, 'second')
  assert.equal(reopened.task.acceptance, '', 'a reset starts a new header instead of inheriting')
})

test('a reference to the wrong family is refused at write time', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await seeded(ledger, root)
  await assert.rejects(
    () => ledger.write(root, 'test', [{ kind: 'fact', detail: 'x', basis: 'assumed', evidenceIds: ['g-1'], entityIds: [] }]),
    /is a goal; it must be an evidence/,
  )
})

test('settle refuses evidence that is not evidence', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await seeded(ledger, root)
  await ledger.write(root, 'test', [{ kind: 'fact', alias: 'guess', detail: 'ttl 是 60 秒', basis: 'assumed', entityIds: ['x-1'] }])
  await assert.rejects(
    () => ledger.settle(root, 'test', { ref: 'f-2', verdict: 'holds', evidenceIds: ['g-1'] }),
    /is a goal, not evidence/,
  )
  const state = await ledger.read(root, 'state')
  assert.equal(state.facts.find(fact => fact.id === 'f-2').basis, 'assumed')
})

test('retiring evidence cascades to the facts and claims it alone supported', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await seeded(ledger, root)
  // f-1 and the claim both hang off e-1 only.
  await ledger.write(root, 'test', [
    {
      kind: 'claim', intentId: 'i-1', title: '缓存写路径没有失效条目', type: 'defect',
      weight: 4, evidenceIds: ['e-1'], entityIds: ['x-1'], reproduceSteps: ['跑 npm test -- cache'],
    },
    { kind: 'evidence', alias: 'other', label: '独立观测', content: 'second run also stale' },
    { kind: 'fact', intentId: 'i-1', detail: '两次都复现', basis: 'observed', evidenceIds: ['$other'], entityIds: ['x-1'] },
  ])
  const settled = await ledger.settle(root, 'test', { ref: 'e-1', verdict: 'retire', reason: '测试环境已重建' })
  assert.deepEqual(settled.results[0].factsLosingSupport, ['f-1'], 'f-3 is anchored to the other evidence and stays')
  assert.deepEqual(settled.results[0].claimsBumped, ['c-1'])

  const state = await ledger.read(root, 'state')
  assert.equal(state.evidence[0].state, 'retired')
  assert.equal(state.facts.find(fact => fact.id === 'f-1').state, 'stale')
  assert.equal(state.facts.find(fact => fact.id === 'f-2').state, 'active', 'f-2 is anchored to the other evidence and stays')
  assert.equal(state.claims[0].status, 'pending')
  assert.equal(state.claims[0].evidenceVersion, 1)

  const next = await ledger.read(root, 'next')
  assert.equal(next.gaps.retiredEvidence.length, 1)
  assert.equal(next.gaps.staleFacts.length, 1)
})

test('retire is not accepted on a non-evidence ref', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await seeded(ledger, root)
  await assert.rejects(() => ledger.settle(root, 'test', { ref: 'f-1', verdict: 'retire' }), /does not apply to a fact/)
})

test('counterfactual replays without the chosen records', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await seeded(ledger, root)
  const view = await ledger.read(root, 'counterfactual', { remove: ['e-1'] })
  assert.deepEqual(view.removedEvidence, ['e-1'])
  assert.ok(view.factsLosingSupport.some(fact => fact.id === 'f-1'))
  assert.equal(view.coverageBefore.evidenced, 1)
  assert.equal(view.coverageAfter.evidenced, 0)
  assert.equal(view.coverageAfter.observed, 1, 'the observation survives, the proof does not')
  await assert.rejects(() => ledger.read(root, 'counterfactual', { remove: [] }), /needs `remove`/)
})

test('templates are recorded, listed and reported', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await seeded(ledger, root)
  await ledger.write(root, 'test', [{
    kind: 'template',
    name: '未鉴权入口探测',
    pre: '存在一个免鉴权的入口',
    action: '带同一组参数直连，绕过前端',
    observation: '返回 200 且带数据体，而带登录态时返回 403',
    post: '该入口可被未授权访问',
  }])
  const view = await ledger.read(root, 'templates')
  assert.equal(view.total, 1)
  assert.match(view.templates[0].pre, /免鉴权/)
  assert.match(await ledger.read(root, 'report').then(value => value.report), /## 可复用的关系模板/)
})

test('retire is idempotent and never rewrites a dismissed fact', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await seeded(ledger, root)
  await ledger.write(root, 'test', [
    { kind: 'claim', intentId: 'i-1', title: '结论', type: 'defect', weight: 3, evidenceIds: ['e-1'], entityIds: ['x-1'], reproduceSteps: ['x'] },
    { kind: 'fact', intentId: 'i-1', detail: '被用户丢掉的那条', basis: 'assumed', evidenceIds: ['e-1'], entityIds: ['x-1'], state: 'dismissed' },
  ])
  const first = await ledger.settle(root, 'test', { ref: 'e-1', verdict: 'retire', reason: 'r' })
  assert.deepEqual(first.results[0].factsLosingSupport, ['f-1'])
  const second = await ledger.settle(root, 'test', { ref: 'e-1', verdict: 'retire' })
  assert.equal(second.results[0].alreadyRetired, true)
  assert.equal(second.results[0].claimsBumped, undefined)

  const state = await ledger.read(root, 'state')
  assert.equal(state.claims[0].evidenceVersion, 1, 'a second retire must not bump again')
  assert.equal(state.facts.find(fact => fact.id === 'f-2').state, 'dismissed', 'a dismissed fact stays dismissed')
})

test('retired evidence cannot back a new record', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await seeded(ledger, root)
  await ledger.settle(root, 'test', { ref: 'e-1', verdict: 'retire' })
  await assert.rejects(
    () => ledger.write(root, 'test', [{ kind: 'fact', detail: 'new', basis: 'observed', evidenceIds: ['e-1'], entityIds: [] }]),
    /retired evidence/,
  )
  const coverage = await ledger.read(root, 'coverage')
  assert.equal(coverage.evidenced, 0, 'a retired evidence never counts as proof')
})

test('counterfactual refuses ids it cannot replay away', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await seeded(ledger, root)
  await assert.rejects(() => ledger.read(root, 'counterfactual', { remove: ['x-1'] }), /is a entity/)
  await assert.rejects(() => ledger.read(root, 'counterfactual', { remove: ['nope-1'] }), /does not exist/)
})

test('settle refuses retired evidence on every ref family', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await seeded(ledger, root)
  await ledger.settle(root, 'test', { ref: 'e-1', verdict: 'retire' })
  for (const [ref, verdict] of [['g-1', 'met'], ['f-1', 'holds'], ['i-1', 'done']]) {
    await assert.rejects(
      () => ledger.settle(root, 'test', { ref, verdict, evidenceIds: ['e-1'] }),
      /is retired/,
      `${ref} must not accept retired evidence`,
    )
  }
})

test('panel() returns the same next shape as read(next)', async (t) => {
  const { dir, ledger, root } = await sandbox()
  t.after(() => rm(dir, { recursive: true, force: true }))
  const empty = await ledger.panel(root)
  assert.equal(empty.next.initialized, false, 'an untouched directory is not initialized')
  assert.equal(empty.next.missing, true)
  assert.equal(empty.next.ledger, root)

  await seeded(ledger, root)
  const snapshot = await ledger.panel(root)
  const read = await ledger.read(root, 'next')
  assert.equal(snapshot.next.initialized, true)
  assert.equal(snapshot.next.ledger, root)
  assert.equal(snapshot.next.missing, false)
  assert.deepEqual(snapshot.next.frontier, read.frontier)
  assert.deepEqual(snapshot.next.counts, read.counts)
  assert.equal(snapshot.coverage.evidenced, 1)
  assert.ok(Array.isArray(snapshot.review.items))
})
