import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const CLIENT_PATH = new URL('../src/client.js', import.meta.url)

/**
 * Minimal React stand-in. `createElement` merges children into props the way
 * React does, so a component that destructures `children` sees them.
 */
function createElement(type, props, ...children) {
  const next = props === null || props === undefined ? {} : { ...props }
  if (children.length === 1) next.children = children[0]
  else if (children.length > 1) next.children = children
  return { type, props: next }
}

const React = {
  createElement,
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useRef: (initial) => ({ current: initial }),
  useEffect: () => {},
  useMemo: (factory) => factory(),
  Fragment: 'Fragment',
}

/** Load the browser factory inside a sandbox and return its module exports. */
function loadClient(options = {}) {
  const styles = []
  const source = readFileSync(CLIENT_PATH, 'utf8')
  let loaded
  const document = options.document === false ? undefined : {
    head: {
      append: (node) => styles.push(node),
      removeChild: () => {},
    },
    createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
  }
  const sandbox = {
    window: { __ModuleLoader__: { load: (definition) => { loaded = definition } } },
    document,
    console,
    encodeURIComponent,
    decodeURIComponent,
    setTimeout,
    fetch: (url, init) => globalThis.fetch(url, init),
    JSON, Promise, Math, Date, Number, String, Array, Object, RegExp,
  }
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox, { filename: 'src/client.js' })
  assert.ok(loaded, 'the factory registers itself with window.__ModuleLoader__')
  assert.equal(loaded.id, 'dsh-makeworld')
  const module = loaded.factory((name) => {
    assert.equal(name, 'react', 'only react is required at load time')
    return options.react ?? React
  })
  return { module, styles }
}

/** Values cross the vm realm boundary, so compare plain JSON copies. */
const plain = (value) => JSON.parse(JSON.stringify(value))

/* ------------------------------------------------------------------ hooks */

/**
 * A tiny hook runtime: enough to render one component tree, run its effects,
 * take the state updates they cause, and render again. It exists so the tests
 * can drive the real components end to end without a renderer dependency.
 */
function hookRuntime() {
  const slots = []
  let effects = []
  let cursor = 0
  let dirty = false
  return {
    createElement,
    Fragment: 'Fragment',
    __begin() { cursor = 0; effects = []; dirty = false },
    __dirty: () => dirty,
    __takeEffects: () => effects,
    useState(initial) {
      const at = cursor++
      if (!(at in slots)) slots[at] = { value: typeof initial === 'function' ? initial() : initial }
      const slot = slots[at]
      return [slot.value, (next) => {
        const value = typeof next === 'function' ? next(slot.value) : next
        if (value !== slot.value) { slot.value = value; dirty = true }
      }]
    },
    useRef(initial) {
      const at = cursor++
      if (!(at in slots)) slots[at] = { current: initial }
      return slots[at]
    },
    useEffect(run, deps) {
      const at = cursor++
      const previous = slots[at]
      const same = previous !== undefined && Array.isArray(deps) && Array.isArray(previous.deps)
        && deps.length === previous.deps.length && deps.every((value, index) => value === previous.deps[index])
      if (same) return
      slots[at] = { deps }
      effects.push(run)
    },
    useMemo(factory) { cursor += 1; return factory() },
  }
}

/** Expand function components depth-first, the way React would. */
function expand(node, runtime) {
  if (node === null || node === undefined) return node
  if (typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map((child) => expand(child, runtime))
  if (typeof node.type === 'function') return expand(node.type(node.props), runtime)
  return { type: node.type, props: { ...node.props, children: expand(node.props.children, runtime) } }
}

/** Render, drain effects, re-render until the tree settles. */
async function settle(component, props, runtime) {
  let tree
  for (let pass = 0; pass < 12; pass += 1) {
    runtime.__begin()
    tree = expand(createElement(component, props), runtime)
    const effects = runtime.__takeEffects()
    for (const effect of effects) effect()
    if (!runtime.__dirty()) return tree
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return tree
}

/** Render a hook-free section in its own runtime. */
async function section(module, name, props) {
  return settle(module.__test[name], props, hookRuntime())
}

/** Visible text of an expanded element tree. */
function textOf(node) {
  if (node === null || node === undefined || node === false) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  return textOf(node.props.children)
}

/** Every element of one tag in an expanded tree. */
function findAll(node, type) {
  const found = []
  const walk = (current) => {
    if (current === null || current === undefined || typeof current !== 'object') return
    if (Array.isArray(current)) { current.forEach(walk); return }
    if (current.type === type) found.push(current)
    walk(current.props.children)
  }
  walk(node)
  return found
}

function withFetch(payload) {
  const calls = []
  const previous = globalThis.fetch
  globalThis.fetch = async (url) => {
    calls.push(String(url))
    if (payload instanceof Error) throw payload
    return { ok: true, status: 200, json: async () => payload }
  }
  return { calls, restore: () => { globalThis.fetch = previous } }
}

/* ------------------------------------------------------------ registration */

test('the factory registers the panel, the ledger view and the sidebar icon', () => {
  const { module } = loadClient()
  assert.deepEqual([...module.inject].sort(), ['locale', 'slots'])
  const registrations = []
  module.apply({
    effect: (run) => run(),
    locale: { register: () => {}, bind: () => (key) => key },
    slots: { inject: (name, register) => { void name; register() }, register: (definition) => { registrations.push(definition); return () => {} } },
  })
  const ids = registrations.map((definition) => `${definition.name}:${definition.id ?? definition.key}`)
  assert.ok(ids.includes('main:makeworld-panel'), `main slot missing: ${ids.join(', ')}`)
  assert.ok(ids.includes('conversation.view:makeworld-ledger'), `ledger view missing: ${ids.join(', ')}`)
  assert.ok(ids.includes('sidebar.panellist:makeworld-panel'), `sidebar entry missing: ${ids.join(', ')}`)
  const view = registrations.find((definition) => definition.name === 'conversation.view')
  assert.equal(view.locale, 'makeworld')
  assert.equal(typeof view.label, 'function')
})

function applyWithStyles() {
  const { module, styles } = loadClient()
  module.apply({
    effect: (run) => run(),
    locale: { register: () => {}, bind: () => (key) => key },
    slots: { inject: (name, register) => { void name; register() }, register: () => () => {} },
  })
  return styles
}

test('the injected stylesheet is scoped and never mutes a host node globally', () => {
  const styles = applyWithStyles()
  assert.equal(styles.length, 1, 'exactly one stylesheet is injected')
  const css = styles[0].textContent
  assert.match(css, /\[data-makeworld-ledger\]/)
  // The dsh-lingeye workaround this page replaces: an app-wide rule that hid
  // the host's width handles for every view.
  assert.equal(css.includes('[data-width-handle]'), false)
  assert.equal(css.includes('display:none !important'), false)
  // The one rule that reaches outside the page is anchored on the scroll body
  // that contains this view, and only drops the composer's dashed ::after.
  assert.match(css, /\[data-conversation-scroll\]:has\(\[data-makeworld-ledger\]\) \[data-composer-card\]::after \{ display: none; \}/)
})

test('a missing document does not break apply', () => {
  const { module } = loadClient({ document: false })
  let registrations = 0
  assert.doesNotThrow(() => module.apply({
    effect: (run) => run(),
    locale: { register: () => {}, bind: () => (key) => key },
    slots: { inject: (name, register) => { void name; register() }, register: () => { registrations += 1; return () => {} } },
  }))
  assert.equal(registrations, 3)
})

/* --------------------------------------------------------------- markdown */

function parse(text) {
  const { module } = loadClient()
  return plain(module.__test.parseMarkdown(text))
}

test('markdown: headings keep their level and drop the hashes', () => {
  const blocks = parse('# 任务报告\n\n## 已确认结论\n\n### [open] 复现缓存问题（i-7）\n')
  assert.deepEqual(blocks.map((block) => block.type), ['heading', 'heading', 'heading'])
  assert.deepEqual(blocks.map((block) => block.level), [1, 2, 3])
  assert.equal(blocks[0].text, '任务报告')
  assert.equal(blocks[2].text, '[open] 复现缓存问题（i-7）')
})

test('markdown: bullets group into one list and keep their depth', () => {
  const blocks = parse('- 主体：repo\n- 验收：全部通过\n')
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].type, 'list')
  assert.equal(blocks[0].ordered, false)
  assert.equal(blocks[0].items.length, 2)
  assert.equal(blocks[0].items[1].text, '验收：全部通过')
  const nested = parse('- a\n  - b\n1. c\n')
  assert.equal(nested[0].items[1].depth, 1)
  assert.equal(nested[0].items[2].text, 'c', 'an ordered line still belongs to the same list block')
})

test('markdown: inline spans are separate nodes, and raw html stays text', () => {
  const { module } = loadClient()
  const spans = plain(module.__test.parseInline('**结论** 与 `cairn_write` 以及 <img src=x onerror=alert(1)>'))
  assert.deepEqual(spans.map((span) => span.kind), ['strong', 'text', 'code', 'text'])
  assert.equal(spans[2].value, 'cairn_write')
  assert.ok(spans[3].value.includes('<img src=x onerror=alert(1)>'))
  const nodes = plain(module.__test.markdownNodes('<script>alert(1)</script>', 'safety'))
  assert.equal(nodes.length, 1)
  assert.equal(nodes[0].type, 'p')
  assert.equal(nodes[0].props.dangerouslySetInnerHTML, undefined)
  assert.equal(JSON.stringify(nodes).includes('dangerouslySetInnerHTML'), false)
})

test('markdown: fenced code, quotes and tables', () => {
  const blocks = parse('```js\nconst a = 1\n```\n\n> 验收：全部通过\n\n| 档位 | 数量 |\n| --- | --- |\n| 有证据 | 3 |\n')
  assert.deepEqual(blocks.map((block) => block.type), ['code', 'quote', 'table'])
  assert.equal(blocks[0].lang, 'js')
  assert.equal(blocks[0].text, 'const a = 1')
  assert.equal(blocks[1].text, '验收：全部通过')
  assert.deepEqual(blocks[2].head, ['档位', '数量'])
  assert.deepEqual(blocks[2].rows, [['有证据', '3']])
})

test('markdown: paragraphs join wrapped lines and never swallow the next block', () => {
  const blocks = parse('第一行\n第二行\n\n## 下一节\n\n- 项\n')
  assert.equal(blocks[0].type, 'paragraph')
  assert.equal(blocks[0].text, '第一行 第二行')
  assert.deepEqual(blocks.slice(1).map((block) => block.type), ['heading', 'list'])
})

test('markdown: an unterminated fence still renders instead of throwing', () => {
  const blocks = parse('```\n未闭合\n')
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].type, 'code')
  assert.equal(blocks[0].text.trim(), '未闭合')
})

test('markdown: empty and non-string input come back as no blocks', () => {
  assert.deepEqual(parse(''), [])
  assert.deepEqual(parse(undefined), [])
  assert.deepEqual(parse(null), [])
})

/* --------------------------------------------------------------- sections */

test('coverage section: three tiers, percentages and untouched chips', async () => {
  const { module } = loadClient()
  const tree = await section(module, 'CoverageCard', {
    coverage: {
      total: 4, evidenced: 2, observed: 1, untouched: 1,
      entities: [
        { id: 'e-1', type: 'host', value: '10.0.0.5', tier: 'evidenced' },
        { id: 'e-4', type: 'service', value: 'redis', tier: 'untouched' },
      ],
    },
    counts: { goals: 1, intents: 2, facts: 3, claims: 1, entities: 4, evidence: 2, templates: 0 },
  })
  const text = textOf(tree)
  assert.match(text, /有证据 2 \/ 4/, 'the card states the tiered total')
  /* Three 20px counts, each with its label and share. */
  assert.match(text, /2\s+有证据 50%/)
  assert.match(text, /1\s+有观测 25%/)
  assert.match(text, /1\s+未触及 25%/)
  assert.match(text, /redis/, 'the untouched entity value is shown, not just counted')
  assert.match(text, /实体 4/, 'family counts ride the card header')
})

test('frontier section: a waiting item shows its missing deps, a ready one does not', async () => {
  const { module } = loadClient()
  const tree = await section(module, 'FrontierCard', {
    items: [
      { id: 'i-1', title: '复现缓存问题', score: 0.8231, ready: true, decides: ['A', 'B'], expectedObservation: '读到旧值', uncertainty: 0.4, cost: 2, missingDeps: [] },
      { id: 'i-2', title: '验证写放大', score: 0.31, ready: false, decides: [], expectedObservation: '写入翻倍', uncertainty: 0.7, cost: 3, missingDeps: ['f-3'] },
    ],
  })
  const text = textOf(tree)
  assert.match(text, /复现缓存问题/)
  assert.match(text, /读到旧值/)
  assert.match(text, /要区分的读法/)
  assert.match(text, /待前置/)
  assert.match(text, /f-3/)
  assert.match(text, /40%/)
  const bordered = findAll(tree, 'li').filter((row) => row.props.style.borderLeftColor !== undefined)
  assert.equal(bordered.length, 2)
  assert.notEqual(bordered[0].props.style.borderLeftColor, bordered[1].props.style.borderLeftColor, 'ready and waiting differ visually')
})

test('review section: items are grouped by status, worst first, each with a count', async () => {
  const { module } = loadClient()
  const tree = await section(module, 'ReviewCard', {
    items: [
      { kind: 'fact', ref: 'f-1', status: 'assumption', text: '仍依赖假设：缓存会过期' },
      { kind: 'claim', ref: 'c-1', status: 'unsupported', text: '结论没有证据：旧值来自缓存' },
      { kind: 'claim', ref: 'c-2', status: 'blocked', text: '被阻塞：拿不到生产日志' },
      { kind: 'entity', ref: 'e-2', status: 'untested', text: 'host 10.0.0.6 未被观测' },
    ],
  })
  const text = textOf(tree)
  assert.match(text, /f-1/)
  assert.match(text, /e-2/)
  const order = ['被阻塞', '没有证据', '仍是假设', '未被观测'].map((label) => text.indexOf(label))
  assert.ok(order.every((value) => value >= 0), 'every status label is rendered')
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'blocked sorts before assumptions')
})

test('gaps section: four quadrants plus the secondary gap rows', async () => {
  const { module } = loadClient()
  const tree = await section(module, 'GapsCard', {
    gaps: {
      assumed: [{ id: 'f-1', text: '缓存会过期' }],
      negative: [{ id: 'f-2', text: '结论被推翻：旧值来自写队列' }],
      untestedEntities: [{ id: 'e-3', type: 'service', value: 'redis' }],
      unsupportedClaims: [{ id: 'c-4', title: '写放大 3 倍' }],
      blockedIntents: [{ id: 'i-5', title: '拿生产日志' }],
      openGoals: [],
      staleFacts: [{ id: 'f-6', text: '旧事实' }],
      retiredEvidence: [{ id: 'ev-7', label: '旧抓包' }],
    },
  })
  const text = textOf(tree)
  for (const label of ['仍依赖的假设', '已排除', '未触及', '无证据结论', '被阻塞的意图', '已失效事实', '已退役证据']) {
    assert.ok(text.includes(label), `missing gap label ${label}`)
  }
  for (const id of ['f-1', 'f-2', 'e-3', 'c-4']) assert.ok(text.includes(id), `missing id badge ${id}`)
})

test('health section: broken lines and structural problems keep their ids', async () => {
  const { module } = loadClient()
  const tree = await section(module, 'HealthCard', {
    count: 3,
    rows: [
      { id: '', status: 'malformed', color: 'red', text: '2 行无法解析 · 第 4, 9' },
      { id: 'r-2', status: 'dangling', color: 'orange', text: 'edge 的 toId → missing' },
    ],
  })
  const text = textOf(tree)
  assert.match(text, /坏行/)
  assert.match(text, /引用悬空/)
  assert.match(text, /r-2/)
  assert.match(text, /第 4, 9/)
})

test('report section renders markdown as structure, not as a pre block', async () => {
  const { module } = loadClient()
  const tree = await section(module, 'ReportCard', {
    report: { status: 'ready', markdown: '# 任务报告\n\n- 主体：repo\n\n## 已确认结论\n\n**缓存会过期**，见 `cairn_write`。\n' },
  })
  assert.equal(findAll(tree, 'pre').length, 0, 'the report is not dumped into a <pre>')
  /* `#` is the document title, `##` a section, `###` a record: three sizes. */
  const titles = findAll(tree, 'h2').map(textOf).map((value) => value.trim())
  /* The card's own title is an h3 too, so match on the markdown heading only. */
  const sections = findAll(tree, 'h3').map(textOf).map((value) => value.trim()).filter((value) => value !== '报告')
  assert.deepEqual(titles, ['任务报告'])
  assert.deepEqual(sections, ['已确认结论'])
  assert.ok(findAll(tree, 'h2')[0].props.style.fontSize > findAll(tree, 'h3')[0].props.style.fontSize,
    'the document title outranks its sections')
  assert.equal(findAll(tree, 'ul').length, 1)
  assert.match(textOf(tree), /缓存会过期/)
  assert.equal(findAll(tree, 'code').length, 1, 'inline code is a code element')
})

/* ------------------------------------------------------------- whole page */

const SNAPSHOT = {
  initialized: true,
  ledger: 'C:/work/.cairn',
  task: { subject: 'repo', objective: '修好缓存失效', acceptance: '旧值不再出现', openedAt: '2026-11-24T10:00:00Z' },
  counts: { goals: 1, intents: 2, facts: 3, claims: 1, entities: 4, evidence: 2, templates: 0, events: 17 },
  frontier: [
    { id: 'i-1', title: '复现缓存问题', score: 0.8231, ready: true, decides: ['读到旧值', '读不到'], expectedObservation: '第二次读到旧值', uncertainty: 0.4, cost: 2, missingDeps: [], state: 'running', goalId: 'g-1' },
    { id: 'i-2', title: '验证写放大', score: 0.31, ready: false, decides: [], expectedObservation: '', uncertainty: 0.7, cost: 3, missingDeps: ['f-3'], state: 'open' },
  ],
  gaps: {
    assumed: [{ id: 'f-1', text: '缓存会过期' }],
    negative: [{ id: 'f-2', text: '结论被推翻：旧值来自写队列' }],
    untestedEntities: [{ id: 'e-3', type: 'service', value: 'redis' }],
    unsupportedClaims: [{ id: 'c-4', title: '写放大 3 倍' }],
    blockedIntents: [{ id: 'i-5', title: '拿生产日志' }],
    openGoals: [{ id: 'g-1', text: '修好缓存失效' }],
    staleFacts: [],
    retiredEvidence: [],
  },
  causal: { cycles: [['i-1', 'f-1']] },
  hypotheses: [],
  templates: [],
  ledgerProblems: [{ kind: 'danglingRef', owner: 'f-9', field: 'evidenceIds', value: 'ev-404' }],
  ledgerProblemCount: 1,
  scoreNote: 'score 是启发式',
  coverage: { total: 4, evidenced: 2, observed: 1, untouched: 1, entities: [{ id: 'e-3', type: 'service', value: 'redis', tier: 'untouched' }] },
  review: [
    { kind: 'fact', ref: 'f-1', status: 'assumption', text: '仍依赖假设：缓存会过期' },
    { kind: 'reference', ref: 'f-9', status: 'dangling', text: 'evidenceIds 指向不存在的 ev-404' },
  ],
  broken: 2,
  brokenLines: [4, 9],
}

test('ledger page renders the ready snapshot with every section', async () => {
  const runtime = hookRuntime()
  const { module } = loadClient({ react: runtime })
  const scope = withFetch(SNAPSHOT)
  let tree
  try {
    tree = await settle(module.__test.LedgerPanel, { sessionId: 's-1' }, runtime)
  } finally {
    scope.restore()
  }
  const text = textOf(tree)
  assert.match(text, /修好缓存失效/, 'the objective is the page title')
  assert.match(text, /旧值不再出现/, 'acceptance is secondary information')
  assert.match(text, /事件 17/)
  assert.match(text, /复现缓存问题/)
  assert.match(text, /读到旧值/, 'frontier decides are visible')
  assert.match(text, /f-3/, 'a waiting intent shows what it waits on')
  assert.match(text, /仍是假设/, 'review groups by status')
  assert.match(text, /redis/, 'untouched entities are named, not just counted')
  assert.match(text, /写放大 3 倍/)
  assert.match(text, /第 4, 9/, 'broken line numbers are reported')
  assert.match(text, /ev-404/, 'the dangling reference is reported')
  assert.match(text, /i-1 → f-1/, 'reference cycles are reported')
  assert.equal(findAll(tree, 'pre').length, 0, 'nothing on the page is a raw <pre> dump')
  assert.equal(tree.props['data-conversation-composer-overlay'], '', 'the official composer-overlay opt-in is declared')
  assert.equal(tree.props.role, 'region')
  assert.equal(tree.props['data-testid'], 'makeworld-ledger')
})

test('ledger page degrades through no-session, unopened and transport failure', async () => {
  const runtime = hookRuntime()
  const { module } = loadClient({ react: runtime })
  const noSession = await settle(module.__test.LedgerPanel, { sessionId: undefined }, runtime)
  assert.match(textOf(noSession), /没有可读取的会话/)
  const report = findAll(noSession, 'button').find((button) => textOf(button).includes('看报告'))
  assert.equal(report.props.disabled, true, 'the report button is disabled without a session')

  const emptyRuntime = hookRuntime()
  const emptyModule = loadClient({ react: emptyRuntime }).module
  const emptyScope = withFetch({ initialized: false, ledger: 'C:/w/.cairn', hint: '值得记账就先 cairn_open', broken: 0, brokenLines: [], counts: {}, gaps: {} })
  let empty
  try {
    empty = await settle(emptyModule.__test.LedgerPanel, { sessionId: 's-1' }, emptyRuntime)
  } finally { emptyScope.restore() }
  assert.match(textOf(empty), /这个会话还没有开场/, 'the page speaks its own language, not the host hint')

  const errorRuntime = hookRuntime()
  const errorModule = loadClient({ react: errorRuntime }).module
  const errorScope = withFetch(new Error('HTTP 500'))
  let failed
  try {
    failed = await settle(errorModule.__test.LedgerPanel, { sessionId: 's-1' }, errorRuntime)
  } finally { errorScope.restore() }
  const alert = findAll(failed, 'p').find((node) => node.props.role === 'alert')
  assert.ok(alert, 'the transport error is announced')
  assert.match(textOf(alert), /HTTP 500/)
})

test('every dictionary key the page asks for exists in both languages', () => {
  const { module } = loadClient()
  // Keys passed to t() anywhere in the ledger code, collected from the source
  // so a new label cannot be added without a translation.
  const source = readFileSync(CLIENT_PATH, 'utf8')
  const used = new Set([...source.matchAll(/label\('([a-zA-Z.-]+)'/g)].map((match) => match[1]))
  for (const key of used) {
    assert.ok(key in plain(module.__test.dictionaries.zh) || key.startsWith('family.') || key.startsWith('status.'),
      `missing zh label for "${key}"`)
  }
  const zh = plain(module.__test.dictionaries.zh)
  const en = plain(module.__test.dictionaries.en)
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort(), 'zh and en cover the same keys')
})
