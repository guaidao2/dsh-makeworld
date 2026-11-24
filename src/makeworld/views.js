/**
 * Derived views over the belief state: the frontier, the gaps, the coverage
 * tiers, the review checklist, and the two documents a human reads
 * (`LEDGER.md` and `report.md`).
 *
 * Everything here is pure — it reads a folded state and returns JSON or
 * markdown. The service owns file IO; the tools own presentation.
 *
 * @module dsh-makeworld/views
 */

import {
  activeFacts,
  clampInt,
  counterfactual,
  entityTiers,
  findCycles,
  frontier,
  hypotheses,
  liveClaims,
  referenceProblems,
  untestedEntities,
} from './model.js'

/** Records per family a `state` read may return before truncating. */
export const MAX_STATE_ROWS = 200

/** Record text is one line: it must never forge a markdown heading. */
export function oneLine(value, limit = 400) {
  const text = typeof value === 'string' ? value : ''
  const collapsed = text.replace(/\s*\n+\s*/g, ' ').trim()
  return collapsed.length > limit ? `${collapsed.slice(0, limit)}…` : collapsed
}

/** Counts shared by every view header. */
export function counts(state) {
  return {
    goals: state.goals.length,
    intents: state.intents.length,
    facts: state.facts.length,
    claims: state.claims.length,
    entities: state.entities.length,
    evidence: state.evidence.length,
    templates: state.templates.length,
    events: state.events,
  }
}

/** The one-line summary of a record. */
function describe(record) {
  return record.detail ?? record.summary ?? record.title ?? record.label ?? record.text ?? record.value ?? record.id
}

/** The default read: where to go next and what is still missing. */
export function nextView(state, options = {}) {
  const limit = Number.isFinite(options.limit) ? clampInt(options.limit, 1, 20, 6) : 6
  const tiers = entityTiers(state)
  const facts = activeFacts(state)
  const problems = referenceProblems(state)
  return {
    task: state.task,
    hint: state.task === null ? '账本还没开场：值得记账就先 cairn_open（主体/目的/验收），或直接 cairn_write 开始记。' : undefined,
    counts: counts(state),
    frontier: frontier(state, limit),
    gaps: {
      assumed: facts.filter(fact => fact.basis === 'assumed').map(fact => ({ id: fact.id, text: describe(fact) })),
      negative: [
        ...facts.filter(fact => fact.basis === 'negative').map(fact => ({ id: fact.id, text: describe(fact) })),
        ...state.claims.filter(claim => claim.status === 'rejected').map(claim => ({ id: claim.id, text: `结论被推翻：${claim.title}` })),
      ],
      blockedIntents: state.intents.filter(intent => intent.state === 'blocked').map(intent => ({ id: intent.id, title: intent.title })),
      openGoals: state.goals.filter(goal => goal.status === 'open').map(goal => ({ id: goal.id, text: goal.text, acceptance: goal.acceptance ?? '' })),
      untestedEntities: untestedEntities(state).map(entity => ({ id: entity.id, type: entity.type, value: entity.value })),
      staleFacts: state.facts.filter(fact => fact.state === 'stale').map(fact => ({ id: fact.id, text: describe(fact) })),
      retiredEvidence: state.evidence.filter(item => item.state === 'retired').map(item => ({ id: item.id, label: item.label })),
      unsupportedClaims: liveClaims(state)
        .filter(claim => (claim.evidenceIds ?? []).length === 0)
        .map(claim => ({ id: claim.id, title: claim.title })),
    },
    hypotheses: hypotheses(state),
    causal: {
      cycles: findCycles(state.edges),
      danglingRefs: problems.slice(0, 20),
      danglingRefCount: problems.length,
    },
    ledgerProblems: (state.problems ?? []).slice(0, 20),
    ledgerProblemCount: (state.problems ?? []).length,
    templates: state.templates.map(template => ({ id: template.id, name: template.name, pre: template.pre, action: template.action, observation: template.observation, post: template.post })),
    untested: state.entities.filter(entity => tiers.get(entity.id) === 'untouched').length,
    scoreNote: 'score 是启发式（ready × uncertainty × (1+decides) × 广度 / cost），不是最优策略；decides 越多说明这条实验越能分开假设。',
  }
}

/** Full state, compacted and capped for the model rather than a database. */
export function stateView(state) {
  const families = ['goals', 'intents', 'facts', 'claims', 'entities', 'evidence',
    'chains', 'plans', 'rechecks', 'hints', 'constraints', 'notes', 'templates', 'edges']
  const view = { task: state.task, counts: counts(state) }
  const truncated = []
  for (const family of families) {
    const list = state[family] ?? []
    const rows = list.slice(-MAX_STATE_ROWS).map((record) => {
      const copy = { ...record }
      delete copy.actor
      delete copy.content
      return copy
    })
    view[family] = rows
    if (list.length > MAX_STATE_ROWS) truncated.push(`${family} ${list.length}`)
  }
  view.truncated = truncated
  view.danglingRefs = referenceProblems(state).slice(0, 20)
  view.ledgerProblems = (state.problems ?? []).slice(0, 20)
  return view
}

/** Reusable relation templates: 前置条件 → 动作 → 预期观测 → 后置条件. */
export function templatesView(state) {
  return {
    total: state.templates.length,
    templates: state.templates.map(template => ({
      id: template.id,
      name: template.name,
      pre: template.pre,
      action: template.action,
      observation: template.observation,
      post: template.post,
      evidenceIds: template.evidenceIds ?? [],
    })),
    note: '模板复用「前置条件 → 动作 → 观测」的关系结构，不要复用具体 payload、版本号或目标表面特征。',
  }
}

/** Read-only replay without selected records. */
export function counterfactualView(state, remove = []) {
  const ids = [...new Set(remove.map(id => oneLine(id, 40)).filter(Boolean))]
  if (ids.length === 0) throw new Error('counterfactual needs `remove`: fact or evidence ids to replay without')
  return { remove: ids, ...counterfactual(state, ids) }
}

/** Three-tier coverage. Never collapse this back into tested/untested. */
export function coverageView(state) {
  const tiers = entityTiers(state)
  const rows = state.entities.map(entity => ({
    id: entity.id,
    type: entity.type,
    value: entity.value,
    tier: tiers.get(entity.id) ?? 'untouched',
  }))
  const bucket = tier => rows.filter(row => row.tier === tier)
  return {
    total: rows.length,
    evidenced: bucket('evidenced').length,
    observed: bucket('observed').length,
    untouched: bucket('untouched').length,
    entities: rows,
  }
}

/** Checklist of what is still open before calling the work done. */
export function reviewView(state) {
  const items = []
  for (const goal of state.goals) {
    items.push({
      kind: 'goal',
      ref: goal.id,
      status: goal.status === 'met' ? 'satisfied' : goal.status === 'abandoned' ? 'deferred' : 'incomplete',
      text: oneLine(goal.text),
    })
  }
  for (const intent of state.intents) {
    if (intent.state === 'blocked') items.push({ kind: 'intent', ref: intent.id, status: 'blocked', text: oneLine(intent.title) })
  }
  for (const fact of state.facts) {
    if (fact.basis === 'assumed' && fact.state !== 'dismissed' && fact.state !== 'stale') {
      items.push({ kind: 'fact', ref: fact.id, status: 'assumption', text: `仍依赖假设：${oneLine(describe(fact))}` })
    }
    if (fact.state === 'stale') items.push({ kind: 'fact', ref: fact.id, status: 'stale', text: `事实已失效：${oneLine(describe(fact))}` })
  }
  for (const claim of liveClaims(state)) {
    if ((claim.evidenceIds ?? []).length === 0) {
      items.push({ kind: 'claim', ref: claim.id, status: 'unsupported', text: `结论没有证据：${oneLine(claim.title)}` })
    }
    if (!Array.isArray(claim.reproduceSteps) || claim.reproduceSteps.length === 0) {
      items.push({ kind: 'claim', ref: claim.id, status: 'incomplete', text: `结论缺少复现步骤：${oneLine(claim.title)}` })
    }
  }
  for (const entity of untestedEntities(state)) {
    items.push({ kind: 'entity', ref: entity.id, status: 'untested', text: `${entity.type ?? 'other'} ${oneLine(entity.value)} 未被观测` })
  }
  for (const evidence of state.evidence) {
    if (evidence.state === 'retired') items.push({ kind: 'evidence', ref: evidence.id, status: 'stale', text: `证据已退役：${oneLine(evidence.label)}` })
  }
  for (const problem of referenceProblems(state)) {
    items.push({
      kind: 'reference',
      ref: problem.owner,
      status: problem.kind === 'wrongRefKind' ? 'wrong-kind' : 'dangling',
      text: problem.kind === 'wrongRefKind'
        ? `${problem.field} 指向 ${problem.actual} ${problem.value}，应为 ${problem.expected}`
        : `${problem.field} 指向不存在的 ${problem.value}`,
    })
  }
  for (const problem of state.problems ?? []) {
    items.push({ kind: 'ledger', ref: String(problem.seq ?? ''), status: 'malformed', text: `第 ${problem.seq} 条事件异常：${problem.kind} ${problem.value ?? ''}` })
  }
  return { items }
}

/** Bullet list helper that keeps empty sections honest. */
function bullets(lines, items, empty = '（无）') {
  if (items.length === 0) {
    lines.push(`- ${empty}`)
    return
  }
  for (const item of items) lines.push(`- ${oneLine(item, 300)}`)
}

/** Ready intents only: an unready one is not a next step, it is a wait. */
function nextSteps(state, limit = 3) {
  return frontier(state, 20).filter(intent => intent.ready).slice(0, limit)
}

/** The deliverable report. Gaps are a required section, not an appendix. */
export function reportMarkdown(state) {
  const lines = []
  const task = state.task ?? {}
  lines.push(`# ${oneLine(task.objective) || '任务报告'}`)
  lines.push('')
  if (task.subject) lines.push(`- 主体：${oneLine(task.subject)}`)
  if (task.acceptance) lines.push(`- 验收：${oneLine(task.acceptance)}`)
  lines.push(`- 记录：${state.events} 条事件，${state.claims.length} 条结论，${state.facts.length} 条事实`)
  lines.push('')

  lines.push('## 已确认结论')
  const standing = ['confirmed', 'resolved', 'accepted']
  bullets(lines, state.claims
    .filter(claim => standing.includes(claim.status))
    .sort((left, right) => (right.weight ?? 3) - (left.weight ?? 3))
    .map(claim => `[${claim.id}] ${claim.title}（${claim.type ?? 'insight'} · w${claim.weight ?? 3}${(claim.evidenceIds ?? []).length === 0 ? ' · 无证据' : ''}）`))
  lines.push('')

  lines.push('## 未定论结论')
  bullets(lines, state.claims
    .filter(claim => claim.status === 'pending')
    .map(claim => `[${claim.id}] ${claim.title}（${(claim.evidenceIds ?? []).length > 0 ? '有证据，待判定' : '无证据'}）`))
  lines.push('')

  lines.push('## 目标')
  bullets(lines, state.goals.map(goal => `[${goal.id}] ${goal.text} — ${goal.status}`))
  lines.push('')

  const facts = activeFacts(state)
  lines.push('## 已排除（negative 事实 / 被推翻的结论）')
  bullets(lines, [
    ...facts.filter(fact => fact.basis === 'negative').map(fact => `[${fact.id}] ${describe(fact)}`),
    ...state.claims.filter(claim => claim.status === 'rejected').map(claim => `[${claim.id}] 结论被推翻：${claim.title}`),
  ])
  lines.push('')

  lines.push('## 仍依赖的假设（assumed）')
  bullets(lines, facts.filter(fact => fact.basis === 'assumed').map(fact => `[${fact.id}] ${describe(fact)}`))
  lines.push('')

  const coverage = coverageView(state)
  lines.push('## 覆盖')
  lines.push(`- 已观测且有证据：${coverage.evidenced}`)
  lines.push(`- 已观测但无证据：${coverage.observed}`)
  lines.push(`- 未触及：${coverage.untouched}`)
  if (coverage.untouched > 0) {
    lines.push('')
    lines.push('未触及：')
    bullets(lines, coverage.entities.filter(row => row.tier === 'untouched').map(row => `${row.type ?? 'other'} ${row.value}（${row.id}）`))
  }
  lines.push('')

  lines.push('## 下一步')
  const ranked = nextSteps(state, 3)
  if (ranked.length === 0) {
    lines.push('- 没有就绪的实验。要么补前置事实，要么这里就是终点。')
  } else {
    bullets(lines, ranked.map(intent => `[${intent.id}] ${intent.title}（score ${intent.score}）`))
  }
  lines.push('')

  lines.push('## 可复用的关系模板')
  bullets(lines, state.templates.map(template => [`[${template.id}] ${template.pre}`, template.action, template.observation, template.post].filter(Boolean).join(' → ')))
  lines.push('')

  lines.push('## 证据索引')
  bullets(lines, state.evidence.map(item => `[${item.id}] ${item.label}${item.excerpt ? ` · 「${item.excerpt}」` : ''}${item.contentSha ? ` · sha256:${String(item.contentSha).slice(0, 12)}` : ''}${item.state === 'retired' ? ' · 已退役' : ''}`))
  lines.push('')

  const problems = referenceProblems(state)
  const structural = state.problems ?? []
  if (problems.length > 0 || structural.length > 0) {
    lines.push('## 账本不一致')
    bullets(lines, [
      ...problems.slice(0, 20).map(problem => (problem.kind === 'wrongRefKind'
        ? `${problem.owner} 的 ${problem.field} 指向 ${problem.actual} ${problem.value}，应为 ${problem.expected}`
        : `${problem.owner} 的 ${problem.field} 指向不存在的 ${problem.value}`)),
      ...structural.slice(0, 20).map(problem => `第 ${problem.seq} 条事件异常：${problem.kind} ${problem.value ?? ''}`),
    ])
    lines.push('')
  }

  lines.push('## 边界')
  lines.push('- 未发现不等于不存在；本报告区分「未触及」「有观测无证据」「有证据」三档。')
  lines.push('- 排序是启发式，不是求解器；假设与否定证据都保留在账本里。')
  lines.push('')
  return lines.join('\n')
}

/** The human-facing ledger view. Rebuilt from the log; never hand-edited. */
export function ledgerMarkdown(state) {
  const lines = []
  const task = state.task ?? {}
  lines.push(`# ${oneLine(task.objective) || '任务账本'}`)
  lines.push('')
  if (task.subject) lines.push(`主体：${oneLine(task.subject)}`)
  if (task.acceptance) lines.push(`验收：${oneLine(task.acceptance)}`)
  lines.push(`事件：${state.events} · 更新：${state.lastAt || '—'}`)
  lines.push('')

  const factsByIntent = new Map()
  for (const fact of state.facts) {
    const key = fact.intentId ?? ''
    if (!factsByIntent.has(key)) factsByIntent.set(key, [])
    factsByIntent.get(key).push(fact)
  }
  const claimsByIntent = new Map()
  for (const claim of state.claims) {
    const key = claim.intentId ?? ''
    if (!claimsByIntent.has(key)) claimsByIntent.set(key, [])
    claimsByIntent.get(key).push(claim)
  }

  const renderIntent = (intent) => {
    lines.push(`### [${intent.state ?? 'open'}] ${oneLine(intent.title)}（${oneLine(intent.id, 40)}）`)
    if (intent.expectedObservation) lines.push(`预期观测：${oneLine(intent.expectedObservation)}`)
    for (const fact of factsByIntent.get(intent.id) ?? []) {
      lines.push(`- \`${fact.basis}\` ${oneLine(describe(fact))}${(fact.evidenceIds ?? []).length > 0 ? `（证据 ${(fact.evidenceIds ?? []).map(id => oneLine(id, 40)).join(', ')}）` : ''}`)
    }
    for (const claim of claimsByIntent.get(intent.id) ?? []) {
      lines.push(`- **结论** ${oneLine(claim.title)}（${claim.status ?? 'pending'} · ${claim.type ?? 'insight'}）`)
    }
    lines.push('')
  }

  for (const goal of state.goals) {
    lines.push(`## ${goal.status === 'met' ? '✓' : goal.status === 'abandoned' ? '–' : '○'} ${oneLine(goal.text)}`)
    if (goal.acceptance) lines.push(`> 验收：${oneLine(goal.acceptance)}`)
    lines.push('')
    for (const intent of state.intents.filter(item => item.goalId === goal.id)) renderIntent(intent)
  }

  const goalLess = state.intents.filter(intent => !intent.goalId || !state.goals.some(goal => goal.id === intent.goalId))
  if (goalLess.length > 0) {
    lines.push('## 未挂目标的意图')
    for (const intent of goalLess) renderIntent(intent)
  }

  const renderedIntents = new Set([...goalLess.map(intent => intent.id), ...state.intents.filter(intent => intent.goalId).map(intent => intent.id)])
  const looseFacts = state.facts.filter(fact => !renderedIntents.has(fact.intentId))
  if (looseFacts.length > 0) {
    lines.push('## 未挂意图的事实')
    for (const fact of looseFacts) lines.push(`- ${fact.basis}: ${oneLine(describe(fact))}（${oneLine(fact.id, 40)}）`)
    lines.push('')
  }
  const looseClaims = state.claims.filter(claim => !renderedIntents.has(claim.intentId))
  if (looseClaims.length > 0) {
    lines.push('## 未挂意图的结论')
    for (const claim of looseClaims) lines.push(`- ${oneLine(claim.title)}（${oneLine(claim.id, 40)} · ${claim.status ?? 'pending'}）`)
    lines.push('')
  }

  const facts = activeFacts(state)
  lines.push('## 缺口')
  lines.push('')
  lines.push('**仍依赖的假设**')
  bullets(lines, facts.filter(fact => fact.basis === 'assumed').map(fact => `[${fact.id}] ${describe(fact)}`))
  lines.push('')
  lines.push('**已排除**')
  bullets(lines, facts.filter(fact => fact.basis === 'negative').map(fact => `[${fact.id}] ${describe(fact)}`))
  lines.push('')
  lines.push('**未触及**')
  bullets(lines, untestedEntities(state).map(entity => `${entity.type ?? 'other'} ${entity.value}（${entity.id}）`))
  lines.push('')
  return lines.join('\n')
}

/** Counts-only header used by the write/settle confirmations. */
export function shortSummary(state) {
  const c = counts(state)
  return `${c.intents} 意图 / ${c.facts} 事实 / ${c.claims} 结论 / ${c.entities} 实体（${c.events} 事件）`
}
