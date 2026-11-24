/**
 * Pure-model tests: the fold, id allocation, the three coverage tiers, the
 * readiness gate, the frontier ordering, and the two derived documents.
 *
 * Service-level behaviour (file IO, serialization, settle cascades) lives in
 * ledger-files.test.js; these keep the invariants that would silently rot.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  activeFacts, emptyState, entityTiers, fold, frontier, intentScore, nextId, parseLog,
  referenceProblems,
} from '../src/makeworld/model.js'
import { coverageView, ledgerMarkdown, nextView, reportMarkdown, reviewView, stateView, MAX_STATE_ROWS } from '../src/makeworld/views.js'

/** Build one event line. */
function event(seq, op, id, body) {
  return { seq, at: '2026-01-01T00:00:00.000Z', actor: 'test', op, id, body }
}

/** A small but realistic log: task, two entities, one intent, two facts. */
function sampleLog() {
  return [
    event(1, 'task.open', '', { subject: 'repo', objective: 'fix the cache bug', acceptance: 'test passes' }),
    event(2, 'record.add', 'x-1', { kind: 'entity', type: 'module', value: 'src/cache.js' }),
    event(3, 'record.add', 'x-2', { kind: 'entity', type: 'module', value: 'src/api.js' }),
    event(4, 'record.add', 'i-1', {
      kind: 'intent', title: 'reproduce the staleness', expectedObservation: 'stale read after write',
      decides: ['ttl bug', 'race'], uncertainty: 0.8, cost: 2, entityIds: ['x-1'], derivedFromFactIds: [], state: 'open',
    }),
    event(5, 'record.add', 'e-1', { kind: 'evidence', label: 'test output', contentSha: 'abc', state: 'active' }),
    event(6, 'record.add', 'f-1', {
      kind: 'fact', intentId: 'i-1', type: 'measure', detail: 'second read returns the old value', basis: 'observed',
      confidence: 0.9, evidenceIds: ['e-1'], entityIds: ['x-1'], state: 'active',
    }),
    event(7, 'record.add', 'f-2', {
      kind: 'fact', intentId: 'i-1', type: 'measure', detail: 'ttl is 60s', basis: 'assumed',
      confidence: 0.4, evidenceIds: [], entityIds: ['x-2'], state: 'active',
    }),
  ]
}

test('fold replays the log into task, records and counters', () => {
  const { state, problems } = fold(sampleLog())
  assert.equal(state.task.objective, 'fix the cache bug')
  assert.equal(state.entities.length, 2)
  assert.equal(state.intents.length, 1)
  assert.equal(state.facts.length, 2)
  assert.equal(state.events, 7)
  assert.deepEqual(problems, [])
})

test('fold reports unknown ops instead of dropping them silently', () => {
  const { problems } = fold([event(1, 'record.zap', 'x', {})])
  assert.equal(problems.length, 1)
  assert.equal(problems[0].kind, 'unknownOp')
})

test('fold tolerates a truncated line and reports its line number', () => {
  const parsed = parseLog('{"seq":1}\nnot json\n\n{"seq":2}')
  assert.equal(parsed.events.length, 2)
  assert.equal(parsed.broken, 1)
  assert.deepEqual(parsed.brokenLines, [2])
})

test('a second task.open merges instead of wiping the header', () => {
  const log = [...sampleLog(), event(8, 'task.open', '', { objective: 'new objective' })]
  const { state } = fold(log)
  assert.equal(state.task.objective, 'new objective')
  assert.equal(state.task.subject, 'repo')
  assert.equal(state.task.acceptance, 'test passes')
})

test('ids are deterministic per family and skip reserved ones', () => {
  const { state } = fold(sampleLog())
  assert.equal(nextId(state, 'fact'), 'f-3')
  assert.equal(nextId(state, 'intent'), 'i-2')
  assert.equal(nextId(state, 'claim'), 'c-1')
  assert.equal(nextId(emptyState(), 'goal'), 'g-1')
  assert.equal(nextId(state, 'fact', new Set(['f-3'])), 'f-4')
})

test('coverage keeps three tiers and names the real subtype', () => {
  const { state } = fold(sampleLog())
  const coverage = coverageView(state)
  assert.equal(coverage.evidenced, 1, 'src/cache.js has a fact with evidence')
  assert.equal(coverage.observed, 0, 'an assumption never raises a tier')
  assert.equal(coverage.untouched, 1, 'src/api.js is only pointed at by an assumption')
  assert.deepEqual(entityTiers(state).get('x-1'), 'evidenced')
  assert.deepEqual(entityTiers(state).get('x-2'), 'untouched')
  assert.equal(coverage.entities[0].type, 'module')
})

test('a claim without evidence does not count as an observation of the entity', () => {
  const log = [
    ...sampleLog(),
    event(8, 'record.add', 'c-1', { kind: 'claim', type: 'insight', title: 'maybe the ttl is wrong', weight: 3, evidenceIds: [], entityIds: ['x-2'], status: 'pending' }),
  ]
  const { state } = fold(log)
  assert.equal(entityTiers(state).get('x-2'), 'untouched')
})

test('readiness ignores facts that went stale', () => {
  const log = [
    ...sampleLog(),
    event(8, 'record.add', 'i-2', { kind: 'intent', title: 'needs f-2', state: 'open', derivedFromFactIds: ['f-2'], uncertainty: 0.9 }),
    event(9, 'record.status', 'f-2', { kind: 'fact', fields: { state: 'stale' } }),
  ]
  const { state } = fold(log)
  const scored = intentScore(state.intents.find(intent => intent.id === 'i-2'), state)
  assert.equal(scored.ready, false)
  assert.deepEqual(scored.missing, ['f-2'])
})

test('decides raises the frontier score of an experiment that separates readings', () => {
  const { state } = fold(sampleLog())
  const narrow = { ...state.intents[0], id: 'i-2', decides: [] }
  const wide = { ...state.intents[0], id: 'i-3', decides: ['a', 'b', 'c'] }
  assert.ok(intentScore(wide, state).score > intentScore(narrow, state).score)
})

test('frontier keeps ready intents first, drops met-goal leftovers, and is stable', () => {
  const log = [
    ...sampleLog(),
    event(8, 'record.add', 'g-1', { kind: 'goal', text: 'fix it', status: 'met', evidenceIds: [] }),
    event(9, 'record.add', 'i-2', { kind: 'intent', title: 'needs a missing fact', state: 'open', goalId: 'g-1', derivedFromFactIds: ['f-404'], uncertainty: 0.9 }),
  ]
  const { state } = fold(log)
  const ranked = frontier(state, 5)
  assert.equal(ranked.length, 1, 'the met-goal intent is dropped, the goal-less one stays')
  assert.equal(ranked[0].id, 'i-1')
  const open = frontier(fold(sampleLog()).state, 5)
  assert.equal(open.length, 1)
  assert.equal(open[0].ready, true)
})

test('gaps name assumptions, untested entities and unsupported claims', () => {
  const log = [...sampleLog(), event(8, 'record.add', 'c-1', { kind: 'claim', type: 'insight', title: 'guess', weight: 2, evidenceIds: [], entityIds: [] })]
  const view = nextView(fold(log).state)
  assert.equal(view.gaps.assumed.length, 1)
  assert.equal(view.gaps.negative.length, 0)
  assert.equal(view.gaps.untestedEntities.length, 1)
  assert.equal(view.gaps.unsupportedClaims.length, 1)
  assert.match(view.scoreNote, /启发式/)
})

test('reference problems surface dangling ids instead of trusting them', () => {
  const log = [...sampleLog(), event(8, 'record.add', 'f-3', { kind: 'fact', detail: 'orphan', basis: 'observed', intentId: 'i-9', evidenceIds: ['e-9'], entityIds: [] })]
  const { state } = fold(log)
  const problems = referenceProblems(state)
  assert.equal(problems.length, 2)
  assert.deepEqual(problems.map(problem => problem.value).sort(), ['e-9', 'i-9'])
})

test('review flags an unsupported claim, a missing reproduce step and dangling refs', () => {
  const log = [
    ...sampleLog(),
    event(8, 'record.add', 'c-1', { kind: 'claim', type: 'defect', title: 'ttl is wrong', weight: 3, evidenceIds: [], reproduceSteps: [], status: 'pending' }),
    event(9, 'record.add', 'f-3', { kind: 'fact', detail: 'orphan', basis: 'observed', intentId: 'i-9', entityIds: [] }),
  ]
  const { items } = reviewView(fold(log).state)
  assert.ok(items.some(item => item.status === 'unsupported'))
  assert.ok(items.some(item => item.status === 'incomplete'))
  assert.ok(items.some(item => item.status === 'dangling'))
})

test('a rejected claim is not reviewed for evidence and not reported as confirmed', () => {
  const log = [
    ...sampleLog(),
    event(8, 'record.add', 'c-1', { kind: 'claim', type: 'defect', title: 'rejected idea', weight: 3, evidenceIds: [], reproduceSteps: [], status: 'rejected' }),
  ]
  const { state } = fold(log)
  assert.ok(!reviewView(state).items.some(item => item.ref === 'c-1'))
  assert.match(reportMarkdown(state), /## 已确认结论\n- （无）/)
})

test('report always prints the gap sections and never invents next steps', () => {
  const { state } = fold(sampleLog())
  const markdown = reportMarkdown(state)
  for (const heading of ['## 已确认结论', '## 已排除（negative 事实 / 被推翻的结论）', '## 仍依赖的假设（assumed）', '## 覆盖', '## 下一步', '## 证据索引']) {
    assert.ok(markdown.includes(heading), `missing section ${heading}`)
  }
  assert.match(markdown, /未发现不等于不存在/)
})

test('record text cannot forge a markdown heading', () => {
  const log = [
    ...sampleLog(),
    event(8, 'record.add', 'f-3', { kind: 'fact', intentId: 'i-1', detail: 'first line\n## 已确认结论\n- 全是假的', basis: 'assumed', entityIds: [] }),
  ]
  const markdown = reportMarkdown(fold(log).state)
  assert.ok(!markdown.includes('\n## 全是假的'))
  assert.match(markdown, /first line ## 已确认结论/)
})

test('LEDGER.md renders the goal tree, the subtype and the gaps', () => {
  const log = [...sampleLog(), event(8, 'record.add', 'g-1', { kind: 'goal', text: 'fix cache bug', status: 'open', evidenceIds: [] })]
  const { state } = fold(log)
  const markdown = ledgerMarkdown(state)
  assert.match(markdown, /## ○ fix cache bug/)
  assert.match(markdown, /仍依赖的假设/)
  assert.match(markdown, /ttl is 60s/)
  assert.match(markdown, /未触及\*\*\n- module src\/api\.js/)
})

test('state view caps a family instead of returning a megabyte', () => {
  const log = [...sampleLog()]
  for (let index = 0; index < MAX_STATE_ROWS + 5; index += 1) {
    log.push(event(100 + index, 'record.add', `m-${index + 1}`, { kind: 'note', text: `note ${index}` }))
  }
  const view = stateView(fold(log).state)
  assert.equal(view.notes.length, MAX_STATE_ROWS)
  assert.ok(view.truncated.length > 0)
})

test('dismissed and stale facts leave the active belief set', () => {
  const log = [...sampleLog(), event(8, 'record.status', 'f-2', { kind: 'fact', fields: { state: 'stale' } })]
  const { state } = fold(log)
  assert.equal(activeFacts(state).length, 1)
  assert.equal(nextView(state).gaps.staleFacts.length, 1)
})

test('an id cannot forge structure in LEDGER.md', () => {
  const log = [
    ...sampleLog(),
    event(8, 'record.add', 'i-1\n## ✓ 伪造的已完成目标\n- 假事实', {
      kind: 'intent', title: 'weird id', state: 'open', derivedFromFactIds: [], entityIds: [],
    }),
  ]
  const markdown = ledgerMarkdown(fold(log).state)
  assert.ok(!markdown.includes('\n## ✓ 伪造的已完成目标'), 'an id must not create a heading')
})

test('structural problems reach the views, not just the fold', () => {
  const log = [...sampleLog(), event(8, 'record.weird', 'x-1', { kind: 'entity' })]
  const { state } = fold(log)
  assert.ok(nextView(state).ledgerProblems.some(problem => problem.kind === 'unknownOp'))
  assert.match(reportMarkdown(state), /## 账本不一致/)
})

test('a duplicated record id is reported instead of silently winning', () => {
  const log = [...sampleLog(), event(8, 'record.add', 'f-1', { kind: 'fact', detail: 'second copy', basis: 'observed', entityIds: [] })]
  const { state, problems } = fold(log)
  assert.ok(problems.some(problem => problem.kind === 'duplicateRecordId' && problem.value === 'f-1'))
  assert.equal(state.facts.find(fact => fact.id === 'f-1').detail, 'second copy')
})

test('the legacy subtype key still reads as type', () => {
  const log = [
    event(1, 'task.open', '', { subject: 's', objective: 'o' }),
    event(2, 'record.add', 'x-1', { kind: 'entity', entityKind: 'service', value: 'redis:6379' }),
    event(3, 'record.add', 'c-1', { kind: 'claim', claimKind: 'defect', title: 'old log', weight: 3, evidenceIds: [] }),
  ]
  const { state } = fold(log)
  assert.equal(state.entities[0].type, 'service')
  assert.equal(state.claims[0].type, 'defect')
})

test('frontier breaks a score tie by id so the order is reproducible', () => {
  const log = [
    event(1, 'task.open', '', { subject: 's', objective: 'o' }),
    event(2, 'record.add', 'i-9', { kind: 'intent', title: 'later id', state: 'open', uncertainty: 0.5, cost: 2, decides: [] }),
    event(3, 'record.add', 'i-2', { kind: 'intent', title: 'earlier id', state: 'open', uncertainty: 0.5, cost: 2, decides: [] }),
  ]
  const { state } = fold(log)
  assert.deepEqual(frontier(state, 5).map(intent => intent.id), ['i-2', 'i-9'])
})

test('LEDGER.md keeps facts and claims that hang off no intent', () => {
  const log = [
    event(1, 'task.open', '', { subject: 's', objective: 'o' }),
    event(2, 'record.add', 'f-1', { kind: 'fact', detail: 'loose observation', basis: 'observed', entityIds: [] }),
    event(3, 'record.add', 'c-1', { kind: 'claim', title: 'loose conclusion', type: 'insight', weight: 2, evidenceIds: [] }),
  ]
  const markdown = ledgerMarkdown(fold(log).state)
  assert.match(markdown, /## 未挂意图的事实/)
  assert.match(markdown, /loose observation/)
  assert.match(markdown, /## 未挂意图的结论/)
})

test('the report shows what the evidence actually says', () => {
  const log = [
    ...sampleLog(),
    event(8, 'record.add', 'e-2', { kind: 'evidence', label: 'run', excerpt: 'got 210ms', contentSha: 'bee', state: 'active' }),
  ]
  assert.match(reportMarkdown(fold(log).state), /「got 210ms」/)
})

test('a dangling edge endpoint is reported', () => {
  const log = [...sampleLog(), event(8, 'graph.touch', '', { srcId: 'f-1', dstId: 'f-404', kind: 'yields' })]
  const { state } = fold(log)
  const problems = referenceProblems(state)
  assert.ok(problems.some(problem => problem.kind === 'danglingRef' && problem.field === 'dstId'))
  assert.match(reportMarkdown(state), /## 账本不一致/)
})

test('a reference to the wrong family is reported, not just a missing id', () => {
  const log = [
    ...sampleLog(),
    event(8, 'record.add', 'g-1', { kind: 'goal', text: 'a goal', status: 'open', evidenceIds: [] }),
    event(9, 'record.add', 'f-3', { kind: 'fact', detail: 'x', basis: 'assumed', evidenceIds: ['g-1'], entityIds: [] }),
  ]
  const { state } = fold(log)
  const problem = referenceProblems(state).find(item => item.kind === 'wrongRefKind' && item.owner === 'f-3')
  assert.equal(problem.expected, 'evidence')
  assert.equal(problem.actual, 'goal')
})

test('a pending claim gets its own report section instead of disappearing', () => {
  const log = [...sampleLog(), event(8, 'record.add', 'c-1', { kind: 'claim', title: 'maybe wrong ttl', type: 'insight', weight: 2, status: 'pending', evidenceIds: ['e-1'] })]
  const markdown = reportMarkdown(fold(log).state)
  assert.match(markdown, /## 未定论结论/)
  assert.match(markdown, /maybe wrong ttl（有证据，待判定）/)
})

test('facts under a goal-less intent still reach LEDGER.md', () => {
  const log = [
    event(1, 'task.open', '', { subject: 's', objective: 'o' }),
    event(2, 'record.add', 'i-1', { kind: 'intent', title: 'loose intent', state: 'open', entityIds: [] }),
    event(3, 'record.add', 'f-1', { kind: 'fact', intentId: 'i-1', detail: 'a real observation', basis: 'observed', entityIds: [] }),
  ]
  const markdown = ledgerMarkdown(fold(log).state)
  assert.match(markdown, /## 未挂目标的意图/)
  assert.match(markdown, /a real observation/)
})

test('a recheck id cannot stand in for evidence or an entity', () => {
  const log = [
    ...sampleLog(),
    event(8, 'record.add', 'r-1', { kind: 'recheck', claimId: 'f-1', verdict: 'holds', notes: '', evidenceIds: [] }),
    event(9, 'record.add', 'f-3', { kind: 'fact', detail: 'x', basis: 'assumed', evidenceIds: ['r-1'], entityIds: [] }),
  ]
  const { state } = fold(log)
  const problem = referenceProblems(state).find(item => item.kind === 'wrongRefKind')
  assert.equal(problem.actual, 'recheck')
  assert.equal(problem.expected, 'evidence')
})

test('a rejected claim appears under the excluded section', () => {
  const log = [
    ...sampleLog(),
    event(8, 'record.add', 'c-1', { kind: 'claim', title: 'ttl is wrong', type: 'defect', weight: 3, status: 'rejected', evidenceIds: [] }),
  ]
  const markdown = reportMarkdown(fold(log).state)
  assert.match(markdown, /## 已排除（negative 事实/)
  assert.match(markdown, /结论被推翻：ttl is wrong/)
})
