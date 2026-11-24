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
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
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
    addEventListener: () => {},
    removeEventListener: () => {},
    visibilityState: 'visible',
  }
  const sandbox = {
    window: {
      __ModuleLoader__: { load: (definition) => { loaded = definition } },
      setInterval: (fn, ms) => { if (options.timers !== undefined) options.timers.push({ fn, ms }); return 1 },
      clearInterval: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    },
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
    useCallback(fn, deps) {
      const at = cursor++
      const previous = slots[at]
      const same = previous !== undefined && Array.isArray(deps) && Array.isArray(previous.deps)
        && deps.length === previous.deps.length && deps.every((value, index) => value === previous.deps[index])
      if (same) return previous.fn
      slots[at] = { deps, fn }
      return fn
    },
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

test('coverage section: four equal number boxes, one family line, untouched chips', async () => {
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
  /* Nessus-style: four equal boxes (tier counts + entity total), no bar. */
  const boxes = findAll(tree, 'div').filter((node) => node.props.role === 'group')
  assert.equal(boxes.length, 1, 'the numbers live in one labelled group')
  assert.equal(boxes[0].props['aria-label'], '有证据 2, 有观测 1, 未触及 1, 实体 4')
  assert.match(text, /2\s+有证据/)
  assert.match(text, /1\s+有观测/)
  assert.match(text, /1\s+未触及/)
  assert.match(text, /4\s+实体/, 'the entity total is the fourth box')
  /* Family counts are their own row of label+value units, not a sentence. */
  const familyRow = findAll(tree, 'div').find((node) => node.props.role === 'list')
  assert.ok(familyRow, 'the family counts form a labelled list')
  assert.equal(familyRow.props['aria-label'], '家族计数')
  const familyItems = findAll(familyRow, 'div').filter((node) => node.props.role === 'listitem')
  assert.equal(familyItems.length, 6, 'six families (the entity total is the fourth box)')
  assert.deepEqual(familyItems.map((item) => findAll(item, 'span').map(textOf).join(' ')),
    ['1 目标', '2 意图', '3 事实', '1 结论', '2 证据', '0 模板'],
    'value first (13/600), label second (11px caption)')
  const familyValue = findAll(familyItems[2], 'span')[0]
  assert.equal(familyValue.props.style.fontSize, '13px')
  assert.equal(familyValue.props.style.fontWeight, 600)
  assert.equal(findAll(familyItems[2], 'span')[1].props.style.fontSize, '11px')
  assert.equal((text.match(/4\s+实体/g) || []).length, 1, 'the entity total is not repeated under the family line')
  assert.match(text, /redis/, 'the untouched entity value is shown, not just counted')
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
  /* Equal-weight cards: no rail, no coloured border, no pills. Readiness is a
     word on the second line. */
  const cards = findAll(tree, 'li')
  assert.equal(cards.length, 2)
  for (const card of cards) {
    assert.equal(card.props.style.borderLeftColor, undefined, 'no left rail')
    const pills = findAll(card, 'span').filter((node) => node.props.style !== undefined && node.props.style.borderRadius === '999px')
    assert.equal(pills.length, 0, 'no pills inside an entry')
  }
  assert.match(textOf(cards[0]), /score 0\.82 · 就绪/)
  assert.match(textOf(cards[1]), /score 0\.31 · 待前置/)
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
  lastAt: '2026-11-24T15:40:00+08:00',
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
  assert.match(text, /旧值不再出现/, 'acceptance rides the meta line')
  assert.match(text, /最近写入 15:40/, 'the sync signal carries the last write')
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
  const reportTab = findAll(noSession, 'button').find((button) => button.props['data-testid'] === 'makeworld-ledger-tab-report')
  assert.ok(reportTab, 'the report sub-tab exists')
  assert.equal(reportTab.props.disabled, true, 'the report sub-tab is disabled without a session')

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

test('the ledger page re-reads on a timer so new intents and facts appear without a manual refresh', async () => {
  const timers = []
  const runtime = hookRuntime()
  const { module } = loadClient({ react: runtime, timers })
  const scope = withFetch(SNAPSHOT)
  try {
    const props = { sessionId: 's-1', useProjection: () => ({ revision: 0 }) }
    const first = await settle(module.__test.LedgerPanel, props, runtime)
    assert.match(textOf(first), /修好缓存失效/)
    assert.equal(scope.calls.length, 1, 'the first render reads once')
    assert.equal(timers.length, 1, 'the page installs exactly one poll timer')
    assert.equal(timers[0].ms, 15000, 'the timer is only the fallback behind the projection push')

    timers[0].fn()
    const second = await settle(module.__test.LedgerPanel, props, runtime)
    assert.equal(scope.calls.length, 2, 'the tick triggers a second read, not a manual click')
    assert.match(textOf(second), /修好缓存失效/, 'the previous snapshot stays while the new one loads')
  } finally {
    scope.restore()
  }
})


/* ------------------------------------------------------- format + sync --- */

test('the page keeps dsh-pentest\'s shape: identity card, sub-tabs, grouped sections', async () => {
  const runtime = hookRuntime()
  const { module } = loadClient({ react: runtime })
  const scope = withFetch(SNAPSHOT)
  let tree
  try {
    tree = await settle(module.__test.LedgerPanel, { sessionId: 's-1' }, runtime)
  } finally { scope.restore() }

  /* Flat header (no card), then the tab bar, then one grid of equal sections. */
  const header = findAll(tree, 'header')[0]
  assert.equal(header.props.style.border, undefined, 'the header is flat, not a card')
  const tabs = findAll(tree, 'nav').find((node) => node.props['data-testid'] === 'makeworld-ledger-tabs')
  assert.ok(tabs, 'the sub-tab bar exists')
  assert.equal(tabs.props.role, 'tablist')
  const tabButtons = findAll(tabs, 'button')
  const tabLabels = tabButtons.map((button) => textOf(button))
  assert.equal(tabLabels[0], '账本', 'the ledger tab stays first')
  assert.equal(tabLabels[tabLabels.length - 1], '报告', 'the report tab stays last')
  assert.deepEqual(tabLabels.slice(1, -1).map((label) => label.split(' ')[0]),
    ['意图', '事实', '结论', '实体', '证据'], 'one tab per record family, in info-density order')
  assert.equal(tabButtons[0].props['aria-selected'], true, 'the ledger tab is active by default')
  assert.equal(tabButtons[0].props.style.boxShadow.includes('inset'), true, 'the active tab carries the inset underline')
  assert.equal(tabs.props.style.width, '100%', 'the tab bar spans the column')
  assert.equal(textOf(tabs).includes(String(SNAPSHOT.broken + SNAPSHOT.ledgerProblemCount)), true,
    'the inconsistency count rides the tab bar as a small chip')

  /* Every section is one cell of the same grid — no primary card. */
  const grid = findAll(tree, 'div').find((node) => node.props.style !== undefined
    && String(node.props.style.gridTemplateColumns || '').includes('minmax(340px'))
  assert.ok(grid, 'the sections live in one auto-fit grid')
  assert.equal(findAll(grid, 'section').length, 4, 'coverage, frontier, review, gaps')
  const titles = findAll(grid, 'h3').map((node) => textOf(node).trim())
  assert.deepEqual(titles, ['覆盖', '前沿', '待处理', '缺口'])
  const weights = new Set(findAll(grid, 'section').map((section) => section.props.style.border))
  assert.equal(weights.size, 1, 'sections share one weight')
  assert.equal([...weights][0], '0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,.28))',
    'the card weight matches the platform panel')

  /* The health strip sits above the grid and is the only tinted surface. */
  const strip = findAll(tree, 'div').find((node) => node.props['data-testid'] === 'makeworld-ledger-health')
  assert.ok(strip, 'the inconsistency strip exists when there are rows')
  assert.equal(String(strip.props.style.borderLeft).includes('3px solid'), true, 'the strip carries the 3px rail')
  assert.match(textOf(strip), /账本不一致/, 'the strip names itself')
  assert.match(textOf(strip), /坏行/, 'the strip lists rows')
})

test('the sync signal stays quiet but visible', async () => {
  const { module } = loadClient()
  const render = (props) => module.__test.SyncBadge(props)

  const synced = await section(module, 'SyncBadge', { status: 'ready', refreshing: false, lastAt: '2026-11-24T15:40:00+08:00' })
  assert.match(textOf(synced), /最近写入 15:40/, 'the text is the last write, not a "synced" claim')
  assert.equal(synced.props['aria-live'], 'off', 'a four-second poll must not be an aria-live region')
  assert.match(synced.props.title, /每 4 秒/, 'the full explanation lives in the tooltip')
  assert.match(synced.props['aria-label'], /已同步/, 'the read state stays reachable as text')
  const dot = findAll(synced, 'span').find((node) => node.props.style.borderRadius === '999px')
  assert.equal(dot.props.style.background, 'var(--dsw-alias-state-success, #30a46c)')

  const refreshing = render({ status: 'ready', refreshing: true, lastAt: '2026-11-24T15:40:00+08:00' })
  assert.match(textOf(refreshing), /最近写入 15:40/, 'the clock does not flicker while a read is in flight')
  assert.match(refreshing.props['aria-label'], /更新中/)
  const busyDot = findAll(refreshing, 'span').find((node) => node.props.style.borderRadius === '999px')
  assert.equal(busyDot.props.style.background, 'var(--dsw-alias-state-warn, #f5a524)')

  const failed = render({ status: 'error', refreshing: false })
  assert.match(failed.props['aria-label'], /同步失败/)
  const failedDot = findAll(failed, 'span').find((node) => node.props.style.borderRadius === '999px')
  assert.equal(failedDot.props.style.background, 'var(--dsw-alias-state-error, #e5484d)')
})

test('the ledger page polls without a control, and the report is fetched only by its tab', async () => {
  const timers = []
  const runtime = hookRuntime()
  const { module } = loadClient({ react: runtime, timers })
  const scope = withFetch(SNAPSHOT)
  let tree
  try {
    tree = await settle(module.__test.LedgerPanel, { sessionId: 's-1' }, runtime)
    assert.equal(scope.calls.length, 1)
    assert.equal(timers.length, 1, 'exactly one poll timer')
    const sync = findAll(tree, 'span').find((node) => node.props['data-testid'] === 'makeworld-ledger-sync')
    assert.equal(sync.props['data-sync'], 'synced')
    assert.equal(findAll(tree, 'button').some((button) => textOf(button).includes('同步')), false, 'no sync toggle was added')

    const reportTab = findAll(tree, 'button').find((button) => button.props['data-testid'] === 'makeworld-ledger-tab-report')
    reportTab.props.onClick()
    tree = await settle(module.__test.LedgerPanel, { sessionId: 's-1' }, runtime)
    assert.equal(scope.calls.length, 2, 'opening the report tab reads the deliverable once')
    assert.equal(scope.calls[1].includes('view=report'), true)
    const again = findAll(tree, 'button').find((button) => button.props['data-testid'] === 'makeworld-ledger-tab-ledger')
    again.props.onClick()
    tree = await settle(module.__test.LedgerPanel, { sessionId: 's-1' }, runtime)
    const back = findAll(tree, 'button').find((button) => button.props['data-testid'] === 'makeworld-ledger-tab-report')
    back.props.onClick()
    tree = await settle(module.__test.LedgerPanel, { sessionId: 's-1' }, runtime)
    assert.equal(scope.calls.filter((url) => url.includes('view=report')).length, 1, 'the report is cached across tab switches')
  } finally { scope.restore() }
})


test('the health strip lists five rows and counts the rest', async () => {
  const { module } = loadClient()
  const rows = Array.from({ length: 7 }, (_, index) => ({
    id: `f-${index}`,
    status: index === 0 ? 'dangling' : 'malformed',
    color: 'x',
    text: `问题 ${index}`,
  }))
  const tree = await section(module, 'HealthCard', { rows, count: 7 })
  const items = findAll(tree, 'li')
  assert.equal(items.length, 5, 'five rows are listed')
  assert.match(textOf(tree), /还有 2 条/, 'the rest is counted, not listed')
})

test('a ledger revision from the session projection triggers a re-read', async () => {
  const runtime = hookRuntime()
  const { module } = loadClient({ react: runtime, timers: [] })
  const scope = withFetch(SNAPSHOT)
  let revision = 0
  const props = () => ({ sessionId: 's-1', useProjection: () => ({ revision }) })
  try {
    await settle(module.__test.LedgerPanel, props(), runtime)
    assert.equal(scope.calls.length, 1, 'the first render reads once')
    revision = 1
    const tree = await settle(module.__test.LedgerPanel, props(), runtime)
    assert.equal(scope.calls.length, 2, 'a cairn_* write bumps the revision and re-reads the file')
    assert.match(textOf(tree), /修好缓存失效/, 'the page stays rendered across the push refresh')
  } finally {
    scope.restore()
  }
})

test('without the ledger projection the page falls back to 4s polling', async () => {
  const timers = []
  const runtime = hookRuntime()
  const { module } = loadClient({ react: runtime, timers })
  const scope = withFetch(SNAPSHOT)
  try {
    /* No useProjection prop at all: the projection row is absent. */
    await settle(module.__test.LedgerPanel, { sessionId: 's-1' }, runtime)
    assert.equal(timers.length, 1)
    assert.equal(timers[0].ms, 4000, 'no push means polling carries the sync')
  } finally {
    scope.restore()
  }
})

test('the report column is fluid: an 860px cap, centred, type scales with the window', async () => {
  const { module } = loadClient()
  const markdown = '# 标题\n\n段落一。\n\n```\ncode\n```\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n'
  const tree = await section(module, 'ReportCard', { report: { status: 'ready', markdown } })

  const column = findAll(tree, 'div').find((node) => node.props['data-mw-report'] !== undefined)
  assert.ok(column, 'the column is the responsive anchor')
  assert.equal(column.props.style.maxWidth, 'min(100%, 860px)', 'never wider than 860px, never wider than the panel')
  assert.equal(column.props.style.margin, '0 auto', 'centred')
  assert.equal(column.props.style.padding, '0 28px', 'horizontal gutters')
  assert.equal(column.props.style.fontSize, undefined, 'type size lives in CSS, or the breakpoint could never win')
  assert.equal(column.props.style.lineHeight, undefined)

  /* Blocks inherit the column's size so the media query can move all of them. */
  const paragraph = findAll(column, 'p')[0]
  assert.equal(paragraph.props.style.fontSize, 'inherit')
  assert.equal(paragraph.props.style.lineHeight, 'inherit')
  assert.equal(findAll(column, 'pre')[0].props.style.maxWidth, '100%', 'code follows the container')
  assert.equal(findAll(column, 'table')[0].props.style.maxWidth, '100%', 'tables follow the container')

  /* Wide windows get 14/1.75; the media query lives in the scoped stylesheet. */
  assert.match(module.__test.LEDGER_CSS, /\[data-makeworld-ledger\] \[data-mw-report\] \{ font-size: 13px; line-height: 1\.7; \}/)
  assert.match(module.__test.LEDGER_CSS, /@media \(min-width: 1280px\) \{\s*\[data-makeworld-ledger\] \[data-mw-report\] \{ font-size: 14px; line-height: 1\.75; \} \}/)
  assert.equal(module.__test.LEDGER_CSS.includes('72ch'), false, 'the fixed ch measure is gone')
})

/* ------------------------------------------------------------ surfaces -- */

test('ledger cards follow the platform panel ladder: nothing paints base inside a card', async () => {
  const runtime = hookRuntime()
  const { module } = loadClient({ react: runtime })
  const C = module.__test.tokens
  const scope = withFetch(SNAPSHOT)
  let tree
  try {
    tree = await settle(module.__test.LedgerPanel, { sessionId: 's-1' }, runtime)
  } finally { scope.restore() }

  /* `base` inside a `layer-1` card reads as a hole; it must not appear at all. */
  const holes = []
  const walk = (node, insideCard) => {
    if (node === null || node === undefined || typeof node !== 'object') return
    if (Array.isArray(node)) { for (const child of node) walk(child, insideCard); return }
    const style = node.props.style
    const card = insideCard || (node.type === 'section' && style !== undefined)
    if (insideCard && style !== undefined && style.background === C.base) holes.push(textOf(node).slice(0, 40))
    walk(node.props.children, card)
  }
  walk(tree, false)
  assert.deepEqual(holes, [], 'no base fill inside a card')

  /* Number boxes and entry cards are one step up from the section card. */
  const boxes = findAll(tree, 'div').filter((node) => node.props.style !== undefined
    && node.props.style.background === C.layer2 && String(node.props.style.border) === `1px solid ${C.borderColor}`)
  assert.equal(boxes.length, 4, 'the four coverage number boxes sit on layer-2')
  const rows = findAll(tree, 'li').filter((node) => node.props.style !== undefined)
  const paintedEntries = rows.filter((node) => node.props.style.background === C.layer2)
  assert.ok(paintedEntries.length >= 2, 'the frontier entries sit on layer-2')
  assert.equal(rows.some((node) => node.props.style.background === C.base), false,
    'no row inside a card is painted with base')
  const blocks = findAll(tree, 'div').filter((node) => node.props.style !== undefined
    && node.props.style.background === 'transparent' && String(node.props.style.border) === `1px solid ${C.borderColor}`)
  assert.ok(blocks.length >= 2, 'inner blocks inside an entry are outline-only, not a fourth colour step')
})

test('report code blocks are the only recessed surface', async () => {
  const { module } = loadClient()
  const C = module.__test.tokens
  const tree = await section(module, 'ReportCard', { report: { status: 'ready', markdown: '```\ncode\n```\n' } })
  const pre = findAll(tree, 'pre')[0]
  assert.equal(pre.props.style.background, C.base, 'a code block is a hole, by design')
  assert.equal(String(pre.props.style.border).includes('1px solid'), true, 'and it is outlined')
  const panel = findAll(tree, 'div').find((node) => node.props['data-mw-report'] !== undefined)
  assert.equal(panel.props.style.background, undefined, 'the report column itself paints nothing')
})

test('the platform panel keeps its own surface logic, unchanged', async () => {
  const runtime = hookRuntime()
  const { module } = loadClient({ react: runtime })
  const C = module.__test.tokens
  const scope = withFetch({ servers: [], status: {} })
  let tree
  try {
    tree = await settle(module.__test.McpPanel, {}, runtime)
  } finally { scope.restore() }

  const cards = findAll(tree, 'section')
  assert.ok(cards.length >= 1, 'the panel renders its cards')
  assert.equal(cards[0].props.style.background, C.layer, 'panel cards stay layer-1')
  assert.equal(cards[0].props.style.border, C.border, 'panel cards keep their own hairline')
  const fields = [...findAll(tree, 'input'), ...findAll(tree, 'textarea')].filter((node) => node.props.style !== undefined)
  assert.ok(fields.length > 0, 'the form has inputs')
  for (const field of fields) {
    assert.equal(field.props.style.background, C.layer2, 'panel inputs are one step up, not a hole')
    assert.equal(field.props.style.border, C.border)
  }
})

/* ------------------------------------------------------------- records -- */

/** One panel payload with every record family populated. */
const RECORDS = {
  goals: [{ id: 'g-1', text: '修好缓存失效', acceptance: '旧值不再出现', status: 'open' }],
  intents: [
    { id: 'i-1', title: '复现缓存问题', state: 'running', expectedObservation: '第二次读到旧值', decides: ['旧值来自缓存', '旧值来自写队列'], uncertainty: 0.4, cost: 2, goalId: 'g-1' },
    { id: 'i-2', title: '验证写放大', state: 'blocked', expectedObservation: '', decides: [], uncertainty: 0.7, cost: 3, goalId: 'g-1' },
    { id: 'i-3', title: '查日志', state: 'done', expectedObservation: '日志里没有写队列', decides: [], uncertainty: 0.2, cost: 1, goalId: 'g-1' },
  ],
  facts: [{ id: 'f-1', basis: 'assumed', type: 'info', detail: '缓存会过期', confidence: 0.3, intentId: 'i-1', evidenceIds: ['ev-1'] }],
  claims: [{ id: 'c-1', type: 'insight', title: '旧值来自缓存', status: 'pending', weight: 3, evidenceIds: ['ev-1'], reproduceSteps: ['打开页面', '再读一次'] }],
  entities: [{ id: 'e-1', type: 'service', value: 'redis', parentId: 'e-2' }],
  evidence: [{ id: 'ev-1', type: 'log', label: 'redis 日志', excerpt: 'expected fresh, got stale', channel: 'node --test', state: 'active', contentSha: 'abc12345deadbeef', layers: ['raw', 'decoded'] }],
  templates: [{ id: 't-1', name: '覆盖断言', pre: '有断言', action: '重放', observation: '旧值', post: '确认' }],
  /* Deliberately larger than the rows: the page must say it is showing a slice. */
  totals: { goals: 1, intents: 5, facts: 1, claims: 1, entities: 1, evidence: 1, templates: 1 },
}

const RECORD_PAYLOAD = { ...SNAPSHOT, records: RECORDS }

test('each record family gets a table tab with its own columns and counts', async () => {
  const runtime = hookRuntime()
  const { module } = loadClient({ react: runtime })
  const scope = withFetch(RECORD_PAYLOAD)
  let tree
  try {
    await settle(module.__test.LedgerPanel, { sessionId: 's-1' }, runtime)
    tree = await settle(module.__test.LedgerPanel, { sessionId: 's-1' }, runtime)
    const button = findAll(tree, 'button').find((node) => node.props['data-testid'] === 'makeworld-ledger-tab-intents')
    assert.ok(button, 'the intent tab exists')
    button.props.onClick()
    tree = await settle(module.__test.LedgerPanel, { sessionId: 's-1' }, runtime)
  } finally { scope.restore() }

  const table = findAll(tree, 'table').find((node) => node.props['data-testid'] === 'makeworld-ledger-table-intents')
  assert.ok(table, 'the intent table renders')
  const headers = findAll(table, 'th').map((node) => textOf(node).trim())
  assert.deepEqual(headers, ['状态', '标题', '预期观测', '要区分的读法', '目标', '不确定度 / 成本', 'id', '明细'])
  const text = textOf(table)
  for (const id of ['i-1', 'i-2', 'i-3']) assert.ok(text.includes(id), `row ${id} renders`)
  assert.match(text, /进行中/)
  assert.match(text, /已阻塞/)

  /* The tab label carries the family total, and the card admits the slice. */
  const tabs = findAll(tree, 'nav').find((node) => node.props['data-testid'] === 'makeworld-ledger-tabs')
  assert.match(textOf(tabs), /意图 5/)
  assert.match(textOf(tree), /仅显示最近 3 条/)
  /* Goals ride under the intent table. */
  assert.match(textOf(tree), /修好缓存失效/)
})

/** Props of one family view, reused by the table-level tests. */
function familyProps(family, overrides) {
  return { family, records: RECORDS, totals: RECORDS.totals, t: undefined, ...overrides }
}

test('a family table expands a row into a detail block and collapses it', async () => {
  const runtime = hookRuntime()
  const { module } = loadClient({ react: runtime })
  const props = familyProps('intents')
  const render = () => settle(module.__test.FamilyView, props, runtime)
  let tree = await render()

  const expand = findAll(tree, 'button').find((node) => node.props['data-testid'] === 'makeworld-ledger-expand-intents-i-1')
  assert.ok(expand, 'the row has an expand button')
  assert.equal(expand.props['aria-expanded'], false)
  expand.props.onClick({ stopPropagation() {} })
  tree = await render()

  const detail = findAll(tree, 'tr').find((node) => node.props['data-testid'] === 'makeworld-ledger-detail-intents-i-1')
  assert.ok(detail, 'the detail row appears under the record')
  const text = textOf(detail)
  assert.match(text, /第二次读到旧值/, 'the full observation is shown')
  assert.match(text, /旧值来自缓存/, 'decides are listed')
  assert.match(text, /0\.40/, 'uncertainty keeps two decimals')
  assert.match(text, /i-1/)

  const collapse = findAll(tree, 'button').find((node) => node.props['data-testid'] === 'makeworld-ledger-expand-intents-i-1')
  assert.equal(collapse.props['aria-expanded'], true, 'the toggle reports its state')
  collapse.props.onClick({ stopPropagation() {} })
  tree = await render()
  assert.equal(findAll(tree, 'tr').some((node) => node.props['data-testid'] === 'makeworld-ledger-detail-intents-i-1'), false,
    'clicking again collapses it')
})

test('the search box and the enum filter narrow a family on the client', async () => {
  const runtime = hookRuntime()
  const { module } = loadClient({ react: runtime })
  const props = familyProps('intents')
  const render = () => settle(module.__test.FamilyView, props, runtime)
  let tree = await render()

  const search = findAll(tree, 'input').find((node) => node.props['data-testid'] === 'makeworld-ledger-search-intents')
  assert.ok(search, 'the family tab has a search box')
  search.props.onChange({ target: { value: '写放大' } })
  tree = await render()
  let table = findAll(tree, 'table').find((node) => node.props['data-testid'] === 'makeworld-ledger-table-intents')
  assert.equal(findAll(table, 'tr').length, 2, 'header plus one matching row')
  assert.match(textOf(table), /i-2/)
  assert.equal(textOf(table).includes('i-1'), false)

  const filter = findAll(tree, 'select').find((node) => node.props['data-testid'] === 'makeworld-ledger-filter-intents')
  assert.ok(filter, 'the intent tab filters by state')
  filter.props.onChange({ target: { value: 'blocked' } })
  tree = await render()
  table = findAll(tree, 'table').find((node) => node.props['data-testid'] === 'makeworld-ledger-table-intents')
  assert.match(textOf(table), /i-2/)
  assert.equal(textOf(table).includes('i-3'), false, 'the state filter stacks on the search')
})

test('an empty family says so and names the tool that writes it', async () => {
  const runtime = hookRuntime()
  const { module } = loadClient({ react: runtime })
  const empty = { ...RECORDS, entities: [], totals: { ...RECORDS.totals, entities: 0 } }
  const tree = await settle(module.__test.FamilyView, { family: 'entities', records: empty, totals: empty.totals, t: undefined }, runtime)
  const text = textOf(tree)
  assert.match(text, /这一族还没有记录/)
  assert.match(text, /cairn_write kind:"entity"/)
  assert.equal(findAll(tree, 'table').length, 0, 'no empty table is rendered')
})

test('a truncated family hint reports the slice it actually received', async () => {
  const runtime = hookRuntime()
  const { module } = loadClient({ react: runtime })
  const tree = await settle(module.__test.FamilyView, familyProps('intents'), runtime)
  assert.match(textOf(tree), /仅显示最近 3 条/, 'the hint counts the rows in hand, not the family total')
})

test('a family with declared rows but no loaded records does not claim to be empty', async () => {
  const { module } = loadClient()
  const tree = await section(module, 'FamilyView', {
    family: 'facts', records: {}, totals: { facts: 500 },
  })
  const text = textOf(tree)
  assert.match(text, /明细没有随这次加载送达/, 'the page explains the gap instead of lying')
  assert.equal(text.includes('这一族还没有记录'), false, 'it must not prompt a duplicate write')
  assert.equal(text.includes('cairn_write'), false)
})

test('each family renders its own rows, and the tab body is keyed by family', async () => {
  const { module } = loadClient()
  /* The tab body passes `key`, so React mounts a fresh FamilyView per family.
     This test pins the intent: same props, different keys, different instances. */
  const facts = await section(module, 'FamilyView', { family: 'facts', records: { facts: [{ id: 'f-1', detail: 'x', basis: 'assumed' }] }, totals: { facts: 1 } })
  const claims = await section(module, 'FamilyView', { family: 'claims', records: { claims: [{ id: 'c-1', title: 'y', status: 'pending' }] }, totals: { claims: 1 } })
  assert.match(textOf(facts), /f-1/)
  assert.match(textOf(claims), /c-1/)
  assert.equal(textOf(facts).includes('c-1'), false)
  /* Keyed by family, so React drops the previous instance (query/expanded) on switch. */
  assert.match(String(module.__test.LedgerPanel), /key: familyTab\.family/,
    'the tab body carries a per-family key')
})

test('a truncated family says how many rows were searched and how many exist', async () => {
  const { module } = loadClient()
  const rows = Array.from({ length: 3 }, (_, index) => ({ id: `f-${index}`, detail: `row ${index}`, basis: 'assumed' }))
  const tree = await section(module, 'FamilyView', { family: 'facts', records: { facts: rows }, totals: { facts: 500 } })
  const text = textOf(tree)
  assert.match(text, /3 \/ 3 · 共 500/, 'the denominator names the loaded rows and the family total')
  assert.match(text, /仅显示最近 3 条/, 'the card hint stays about what was loaded')
})

test('the untouched chips name the slice when the payload capped them', async () => {
  const { module } = loadClient()
  const tree = await section(module, 'CoverageCard', {
    coverage: {
      total: 220, evidenced: 0, observed: 0, untouched: 220,
      entities: [{ id: 'x-1', type: 'host', value: '10.0.0.1', tier: 'untouched' }],
    },
    counts: {},
  })
  const text = textOf(tree)
  assert.match(text, /未触及实体 220/, 'the real count, not the capped list length')
  assert.match(text, /列前 1/, 'and it admits the list is a slice')
})
