/**
 * dsh-makeworld Web client half: the platform control panel.
 *
 * Hand-written `window.__ModuleLoader__` factory — no bundler. Platform
 * modules (React, locale, slots) arrive through the injected `require`.
 *
 * Two surfaces share one panel: the task ledger (read-only, `/makeworld/ledger`)
 * and the platform settings (Git Bash + MCP). The ledger view only reads; the
 * `cairn_*` tools remain the only writers.
 */

window.__ModuleLoader__.load({
  id: 'dsh-makeworld',
  factory(require) {
    const React = require('react')
    const module = { exports: {} }
    const exports = module.exports

    const NS = 'makeworld'
    const h = React.createElement

    const zh = {
      panel: 'makeworld',
      title: 'makeworld 工作台',
      subtitle: '平台设置：Git Bash 环境诊断与 MCP 服务器。账本在会话顶栏的「账本」页签里。',
      ledger: '账本',
      environment: '环境',
      mcp: 'MCP',
      loading: '正在读账本…',
      noSession: '没有可读取的会话：打开一个会话后再回来。',
      empty: '这个会话还没有开场。让 agent 调 cairn_open 写下主体、目的与验收，账本才有东西可看。',
      emptyBroken: '账本读不出任何记录，先修好上面列出的行；或用 cairn_open({reset:true}) 归档重开。',
      refresh: '刷新',
      report: '看报告',
      close: '关闭',
      frontier: '前沿',
      gaps: '缺口',
      coverage: '覆盖',
      review: '待处理',
      none: '（无）',
      assumed: '仍依赖的假设',
      negative: '已排除',
      untested: '未触及',
      unsupported: '无证据结论',
      blocked: '被阻塞的意图',
      score: 'score',
      recentWrite: '最近写入',
      morePrefix: '还有',
      moreSuffix: '条',
      ready: '就绪',
      notReady: '待前置',
      evidenced: '有证据',
      observed: '有观测',
      untouched: '未触及',
      'family.goals': '目标',
      'family.intents': '意图',
      'family.facts': '事实',
      'family.claims': '结论',
      'family.entities': '实体',
      'family.evidence': '证据',
      'family.templates': '模板',
      familyCounts: '家族计数',
      'status.incomplete': '未完成',
      'status.satisfied': '已满足',
      'status.deferred': '已搁置',
      'status.blocked': '被阻塞',
      'status.assumption': '仍是假设',
      'status.stale': '已失效',
      'status.unsupported': '没有证据',
      'status.untested': '未被观测',
      'status.dangling': '引用悬空',
      'status.wrong-kind': '引用类型错',
      'status.malformed': '坏行',
      'status.cycle': '引用成环',
      inconsistent: '账本不一致',
      scoreHint: 'score 是启发式，不是最优策略；要区分的读法越多，这条实验越能分开假设。',
      topPrefix: '按分数排序，前',
      topSuffix: '条',
      'kind.goal': '目标',
      'kind.intent': '意图',
      'kind.fact': '事实',
      'kind.claim': '结论',
      'kind.entity': '实体',
      'kind.evidence': '证据',
      'kind.reference': '引用',
      'kind.ledger': '账本行',
      'state.open': '未开工',
      'state.running': '进行中',
      'state.paused': '已暂停',
      'state.done': '已完成',
      'state.blocked': '已阻塞',
      'state.exhausted': '已穷尽',
      'state.stopped': '已终止',
      'state.deleted': '已删除',
      healthHint: '结构性问题优先修；下面各区可能因此不准。',
      consistent: '结构一致',
      cycle: '引用成环',
      brokenLines: '行无法解析',
      atLines: '第',
      of: '的',
      expected: '应为',
      subject: '主体',
      acceptance: '验收',
      openedAt: '开场',
      updatedAt: '更新',
      synced: '已同步',
      syncing: '更新中',
      syncFailed: '同步失败',
      syncTitle: '账本每 4 秒、窗口聚焦与页面可见时自动重读',
      regenerate: '重新生成',
      path: '账本路径',
      events: '事件',
      groups: '组',
      decides: '要区分的读法',
      expectedObservation: '预期观测',
      missingDeps: '缺前置',
      uncertainty: '不确定度',
      cost: '成本',
      openGoals: '未完成目标',
      blockedIntents: '被阻塞的意图',
      staleFacts: '已失效事实',
      retiredEvidence: '已退役证据',
      untestedEntities: '未触及实体',
      frontierHint: 'score 是启发式，不是最优策略',
      gapHint: '没发现不等于不存在',
      reportTitle: '报告',
      reportHint: '渲染自 report.md',
      copy: '复制 Markdown',
      copied: '已复制',
      closeReport: '收起报告',
    }
    const en = {
      panel: 'makeworld',
      title: 'makeworld workbench',
      subtitle: 'Platform settings: Git Bash diagnostics and MCP servers. The ledger lives in the Ledger tab of each conversation.',
      ledger: 'Ledger',
      environment: 'Environment',
      mcp: 'MCP',
      loading: 'Reading the ledger…',
      noSession: 'No session to read: open a conversation and come back.',
      empty: 'This session has no ledger yet. Ask the agent to call cairn_open with subject, objective and acceptance.',
      emptyBroken: 'Nothing could be read from the ledger. Fix the lines listed above, or archive it with cairn_open({reset:true}).',
      refresh: 'Refresh',
      report: 'Report',
      close: 'Close',
      frontier: 'Frontier',
      gaps: 'Gaps',
      coverage: 'Coverage',
      review: 'Open items',
      none: '(none)',
      assumed: 'Assumptions',
      negative: 'Ruled out',
      untested: 'Untouched',
      unsupported: 'Unsupported claims',
      blocked: 'Blocked intents',
      score: 'score',
      recentWrite: 'Last write',
      morePrefix: 'and',
      moreSuffix: 'more',
      ready: 'ready',
      notReady: 'waiting',
      evidenced: 'evidenced',
      observed: 'observed',
      untouched: 'untouched',
      'family.goals': 'goals',
      'family.intents': 'intents',
      'family.facts': 'facts',
      'family.claims': 'claims',
      'family.entities': 'entities',
      'family.evidence': 'evidence',
      'family.templates': 'templates',
      familyCounts: 'Family counts',
      'status.incomplete': 'incomplete',
      'status.satisfied': 'satisfied',
      'status.deferred': 'deferred',
      'status.blocked': 'blocked',
      'status.assumption': 'assumption',
      'status.stale': 'stale',
      'status.unsupported': 'unsupported',
      'status.untested': 'untested',
      'status.dangling': 'dangling',
      'status.wrong-kind': 'wrong kind',
      'status.malformed': 'malformed',
      'status.cycle': 'reference cycle',
      inconsistent: 'Ledger inconsistencies',
      scoreHint: 'score is a heuristic, not an optimum: more readings mean the experiment separates more hypotheses.',
      topPrefix: 'sorted by score, top',
      topSuffix: '',
      'kind.goal': 'goal',
      'kind.intent': 'intent',
      'kind.fact': 'fact',
      'kind.claim': 'claim',
      'kind.entity': 'entity',
      'kind.evidence': 'evidence',
      'kind.reference': 'reference',
      'kind.ledger': 'ledger row',
      'state.open': 'open',
      'state.running': 'running',
      'state.paused': 'paused',
      'state.done': 'done',
      'state.blocked': 'blocked',
      'state.exhausted': 'exhausted',
      'state.stopped': 'stopped',
      'state.deleted': 'deleted',
      healthHint: 'Fix structural problems first; the sections below may be wrong because of them.',
      consistent: 'Structurally sound',
      cycle: 'Reference cycle',
      brokenLines: 'unparsable line(s)',
      atLines: 'lines',
      of: 'of',
      expected: 'expected',
      subject: 'Subject',
      acceptance: 'Acceptance',
      openedAt: 'Opened',
      updatedAt: 'Updated',
      synced: 'Synced',
      syncing: 'Updating',
      syncFailed: 'Sync failed',
      syncTitle: 'The ledger re-reads every 4 seconds, on window focus and when the page becomes visible',
      regenerate: 'Regenerate',
      path: 'Ledger path',
      events: 'Events',
      groups: 'group(s)',
      decides: 'Separates',
      expectedObservation: 'Expected observation',
      missingDeps: 'needs',
      uncertainty: 'Uncertainty',
      cost: 'Cost',
      openGoals: 'Open goals',
      blockedIntents: 'Blocked intents',
      staleFacts: 'Stale facts',
      retiredEvidence: 'Retired evidence',
      untestedEntities: 'Untouched entities',
      frontierHint: 'score is a heuristic, not an optimum',
      gapHint: 'Not found is not the same as absent',
      reportTitle: 'Report',
      reportHint: 'Rendered from report.md',
      copy: 'Copy Markdown',
      copied: 'Copied',
      closeReport: 'Hide report',
    }

    /* ---------------------------------------------------------------- colors */

    const C = {
      text: 'var(--dsw-alias-label-primary, #1b1b1f)',
      muted: 'var(--dsw-alias-label-secondary, #60646c)',
      faint: 'var(--dsw-alias-label-tertiary, #8b8d98)',
      border: '0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,.28))',
      layer: 'var(--dsw-alias-bg-layer-1, rgba(127,127,127,.06))',
      layer2: 'var(--dsw-alias-bg-layer-2, rgba(127,127,127,.1))',
      brand: 'var(--dsw-alias-brand-primary, #4f46e5)',
      error: 'var(--dsw-alias-state-error, #e5484d)',
      warn: 'var(--dsw-alias-state-warn, #f5a524)',
      success: 'var(--dsw-alias-state-success, #30a46c)',
      info: 'var(--dsw-alias-state-info, #6e56cf)',
      borderColor: 'var(--dsw-alias-border-l2, rgba(127,127,127,.28))',
      borderColorSoft: 'var(--dsw-alias-border-l1, rgba(127,127,127,.16))',
      /* layer-3 exists only for hover states. */
      /* --dsw-alias-label-caption and --dsw-alias-bg-base are the two tokens
         dsh-pentest leans on for meta text and nested blocks. */
      caption: 'var(--dsw-alias-label-caption, #8b8d98)',
      base: 'var(--dsw-alias-bg-base, transparent)',
    }

    const S = {
      root: { boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', height: '100%', padding: '16px 20px', overflowX: 'hidden', overflowY: 'auto', color: C.text, fontSize: '13px', lineHeight: 1.5 },
      card: { flex: 'none', border: C.border, borderRadius: '10px', padding: '14px 16px', background: C.layer },
      cardTitle: { margin: '0 0 10px', fontSize: '13px', fontWeight: 600, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
      kv: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
      kvLabel: { fontSize: '11px', color: C.faint },
      kvValue: { fontSize: '13px', color: C.text, overflowWrap: 'anywhere' },
      badge: { display: 'inline-flex', alignItems: 'center', padding: '0 6px', borderRadius: '999px', fontSize: '11px', lineHeight: '18px', border: C.border, color: C.muted },
      tabBar: { display: 'flex', gap: '4px', flexWrap: 'wrap', borderBottom: C.border, paddingBottom: '6px', flex: 'none' },
      tab: { border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', padding: '4px 10px', borderRadius: '6px', fontSize: '12px' },
      tabActive: { background: C.layer2, color: C.text, fontWeight: 600 },
      item: { border: C.border, borderRadius: '8px', padding: '10px 12px', background: 'transparent' },
      itemHead: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '4px' },
      itemTitle: { fontWeight: 600, color: C.text },
      detail: { color: C.muted, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: '4px 0 0' },
      muted: { color: C.muted },
      faint: { color: C.faint },
      empty: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '160px', color: C.muted, padding: '24px', textAlign: 'center' },
      button: { border: C.border, background: C.layer2, color: C.text, borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontSize: '12px' },
    }

    /* --------------------------------------------------------------- helpers */

    function fmtValue(value) {
      return value === undefined || value === null || value === '' ? '（未声明）' : String(value)
    }

    function badge(text, color) {
      return h('span', { style: { ...S.badge, color: color || C.muted } }, text)
    }

    function kv(label, value) {
      return h('div', { style: S.kv, key: label },
        h('span', { style: S.kvLabel }, label),
        h('span', { style: S.kvValue }, fmtValue(value)))
    }

    function card(title, body, extra) {
      return h('section', { style: S.card },
        h('h2', { style: S.cardTitle }, h('span', null, title), extra || null),
        body)
    }

    /* --------------------------------------------------------------- shell */

    /** Panel icon: a stack of stones, neutral and asset-free. */
    function MakeworldIcon({ size, active }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: active ? C.brand : C.muted, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': 'true',
      },
      h('rect', { x: 3, y: 15, width: 18, height: 5.5, rx: 1.6 }),
      h('rect', { x: 5.5, y: 9.5, width: 13, height: 5.5, rx: 1.6 }),
      h('rect', { x: 8, y: 4, width: 8, height: 5.5, rx: 1.6 }))
    }

    /** In-app confirmation used instead of the native browser dialog. */
    function useConfirm() {
      const [request, setRequest] = React.useState(null)
      const resolver = React.useRef(null)
      const previousFocus = React.useRef(null)
      const dialogRef = React.useRef(null)
      const ask = options => new Promise(resolve => {
        previousFocus.current = document.activeElement
        resolver.current = resolve
        setRequest(options)
      })
      const settle = value => {
        const resolve = resolver.current
        resolver.current = null
        setRequest(null)
        if (resolve !== null) resolve(value)
        window.requestAnimationFrame(() => {
          if (previousFocus.current !== null && typeof previousFocus.current.focus === 'function') previousFocus.current.focus()
        })
      }
      React.useEffect(() => {
        if (request === null) return undefined
        const dialog = dialogRef.current
        const focusables = dialog === null ? [] : [...dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
          .filter(element => !element.disabled && element.getAttribute('aria-hidden') !== 'true')
        if (focusables.length > 0) focusables[0].focus()
        const onKey = event => {
          if (event.key === 'Escape') {
            settle(false)
            return
          }
          if (event.key !== 'Tab' || focusables.length === 0) return
          const first = focusables[0]
          const last = focusables[focusables.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [request])
      const dialog = request === null ? null : h('div', {
        role: 'presentation',
        style: { position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(0,0,0,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
        onMouseDown: event => { if (event.target === event.currentTarget) settle(false) },
      },
        h('div', {
          ref: dialogRef,
          role: 'dialog', 'aria-modal': 'true', 'aria-label': request.title,
          style: { width: 'min(420px, 100%)', border: C.border, borderRadius: '12px', background: C.layer, padding: '16px', boxShadow: '0 18px 48px rgba(0,0,0,.35)' },
        },
          h('div', { style: { fontSize: '14px', fontWeight: 600, color: C.text } }, request.title),
          request.body ? h('p', { style: { ...S.detail, margin: '8px 0 0' } }, request.body) : null,
          h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' } },
            request.cancelLabel === null ? null : h('button', { type: 'button', style: S.button, onClick: () => settle(false) }, request.cancelLabel || '取消'),
            h('button', {
              type: 'button', autoFocus: true,
              style: { ...S.button, color: request.danger ? C.error : C.text, borderColor: request.danger ? C.error : C.border },
              onClick: () => settle(true),
            }, request.confirmLabel || '确认'))))
      return { ask, dialog }
    }

    /* ------------------------------------------------------------- sections */

    /**
     * Environment section: Git Bash switch/path plus cookie diagnostics.
     * Reads `{ gitbash, settings, cookies }` from /makeworld/environment and
     * writes the same shape back; the cookie cleanup is a confirmed POST.
     */
    function EnvironmentPanel() {
      const confirm = useConfirm()
      const [environment, setEnvironment] = React.useState(null)
      const [environmentError, setEnvironmentError] = React.useState('')
      const [gitbashEnabled, setGitbashEnabled] = React.useState(false)
      const [gitbashPath, setGitbashPath] = React.useState('')
      const [savingEnvironment, setSavingEnvironment] = React.useState(false)
      const [environmentSaveError, setEnvironmentSaveError] = React.useState('')
      const [cleaningCookies, setCleaningCookies] = React.useState(false)
      const [cleanupMessage, setCleanupMessage] = React.useState('')
      const loadEnvironment = () => {
        fetch('/makeworld/environment', { cache: 'no-store', credentials: 'same-origin' })
          .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
          .then(value => {
            setEnvironment(value)
            setEnvironmentError('')
            if (value.settings !== undefined) {
              setGitbashEnabled(value.settings.gitbashEnabled === true)
              setGitbashPath(value.settings.gitbashShellPath ?? '')
            }
          })
          .catch(error => { setEnvironmentError(error instanceof Error ? error.message : String(error)) })
      }
      const saveEnvironment = () => {
        setSavingEnvironment(true)
        setEnvironmentSaveError('')
        fetch('/makeworld/environment', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ gitbashEnabled, gitbashShellPath: gitbashPath }),
        })
          .then(async response => {
            const value = await response.json()
            if (!response.ok) throw new Error(value.error || `HTTP ${response.status}`)
            setEnvironment(previous => ({ ...previous, gitbash: value.gitbash, settings: value.settings }))
          })
          .catch(error => { setEnvironmentSaveError(error instanceof Error ? error.message : String(error)) })
          .finally(() => setSavingEnvironment(false))
      }
      const cleanupCookies = async () => {
        const count = environment?.cookies?.authCount ?? 0
        const confirmed = await confirm.ask({ title: '清理旧的认证 Cookie？', body: `会保留当前端口的登录，只删除其他 ${Math.max(0, count - 1)} 条 dsh-auth-*；不会碰其他 cookie。`, confirmLabel: '清理' })
        if (!confirmed) return
        setCleaningCookies(true)
        setCleanupMessage('')
        fetch('/makeworld/environment', {
          method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'cleanup-cookies', confirm: true }),
        })
          .then(async response => {
            const value = await response.json()
            if (!response.ok) throw new Error(value.error || `HTTP ${response.status}`)
            setCleanupMessage(`已清理 ${value.cleaned} 条旧 Cookie。`)
            window.setTimeout(loadEnvironment, 300)
          })
          .catch(error => { setCleanupMessage(error instanceof Error ? error.message : String(error)) })
          .finally(() => setCleaningCookies(false))
      }
      React.useEffect(loadEnvironment, [])
      const gitbashText = environment?.gitbash === undefined
        ? '正在检测…'
        : environment.gitbash.supported === false
          ? '仅 Windows 支持；当前平台不适用。'
          : environment.gitbash.missing === true
            ? '已开启，但未找到 Git Bash；请填写路径。'
            : environment.gitbash.enabled !== true
              ? '未启用（默认关闭）。'
              : `已启用 · ${environment.gitbash.shellPath}`
      const cookieText = environment?.cookies === undefined
        ? '正在检测…'
        : `${environment.cookies.authCount} 条 dsh-auth-* · 请求头约 ${(environment.cookies.estimatedRequestHeaderBytes / 1024).toFixed(1)} KB / ${(environment.cookies.headerLimitBytes / 1024).toFixed(0)} KB`
      return h('div', { style: { display: 'grid', gap: '12px' }, 'data-testid': 'makeworld-environment' },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          h('button', { type: 'button', style: S.button, onClick: loadEnvironment }, '重新检测'),
          environmentError ? badge('检测不可用', C.error) : null,
          environmentError ? h('span', { style: { ...S.faint, fontSize: '11px' } }, environmentError) : null),
        card('Git Bash',
          h('div', { style: { display: 'grid', gap: '8px' } },
            kv('状态', gitbashText),
            environment?.gitbash?.supported === false ? null : h('div', { style: { display: 'grid', gap: '6px' } },
              h('label', { style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' } },
                h('input', { type: 'checkbox', checked: gitbashEnabled, onChange: event => setGitbashEnabled(event.target.checked) }),
                '启用 Git Bash（显式切换）'),
              h('input', {
                type: 'text',
                value: gitbashPath,
                placeholder: '留空自动检测；或填 ...\\Git\\bin\\bash.exe',
                onChange: event => setGitbashPath(event.target.value),
                style: { width: '100%', boxSizing: 'border-box', padding: '5px 7px', borderRadius: '6px', border: C.border, background: C.layer2, color: C.text, fontSize: '11px' },
              }),
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                h('button', { type: 'button', style: S.button, disabled: savingEnvironment, onClick: saveEnvironment }, savingEnvironment ? '保存中…' : '保存'),
                environmentSaveError ? h('span', { style: { ...S.faint, fontSize: '11px' } }, environmentSaveError) : null)))),
        card('认证 Cookie',
          h('div', { style: { display: 'grid', gap: '8px' } },
            kv('用量', cookieText),
            environment?.cookies?.warning
              ? h('p', { style: { ...S.faint, margin: 0 } }, '接近 Node 的请求头上限；继续累积会出现 431。默认只检测，手动确认后才清理。')
              : null,
            h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' } },
              h('button', { type: 'button', style: S.button, disabled: cleaningCookies, onClick: cleanupCookies }, cleaningCookies ? '清理中…' : '清理旧 Cookie'),
              cleanupMessage ? h('span', { style: { ...S.faint, fontSize: '11px' } }, cleanupMessage) : null))),
        h('p', { style: { ...S.faint, margin: 0, fontSize: '11px' } },
          '环境增强默认关闭；Cookie 默认只检测，清理必须手动确认。'),
        confirm.dialog)
    }

    /** Human-readable MCP server form; all write paths go through /makeworld/mcp. */
    function McpPanel() {
      const empty = { serverName: '', transport: 'stdio', command: '', args: '', env: '', url: '', headers: '', timeoutMs: '60000', enabled: true }
      const [data, setData] = React.useState(null)
      const [error, setError] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const [message, setMessage] = React.useState('')
      const [draft, setDraft] = React.useState(empty)
      const confirm = useConfirm()
      const field = { width: '100%', boxSizing: 'border-box', padding: '5px 7px', borderRadius: '6px', border: C.border, background: C.layer2, color: C.text, fontSize: '11px' }
      const area = { ...field, minHeight: '52px', resize: 'vertical' }
      const load = () => {
        fetch('/makeworld/mcp', { cache: 'no-store', credentials: 'same-origin' })
          .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`)))
          .then(value => { setData(value); setError('') })
          .catch(reason => setError(reason instanceof Error ? reason.message : String(reason)))
      }
      React.useEffect(load, [])
      const pairs = text => text.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
        const at = line.indexOf('=')
        return at <= 0 ? { key: line, value: '' } : { key: line.slice(0, at).trim(), value: line.slice(at + 1).trim() }
      })
      const save = () => {
        setBusy(true); setMessage('')
        fetch('/makeworld/mcp', {
          method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'save', serverName: draft.serverName, transport: draft.transport, command: draft.command,
            args: draft.args.split('\n').map(line => line.trim()).filter(Boolean),
            env: pairs(draft.env), url: draft.url, headers: pairs(draft.headers),
            timeoutMs: Number(draft.timeoutMs), enabled: draft.enabled,
          }),
        })
          .then(async response => {
            const value = await response.json()
            if (!response.ok) throw new Error(value.error || `HTTP ${response.status}`)
            setData(value); setMessage('已保存，正在连接。')
          })
          .catch(reason => setMessage(reason instanceof Error ? reason.message : String(reason)))
          .finally(() => setBusy(false))
      }
      const remove = async row => {
        if (!(await confirm.ask({ title: `删除 MCP 服务器「${row.serverName}」？`, body: '删除后该服务器会断开并移除，不影响其他会话。', confirmLabel: '删除', danger: true }))) return
        setBusy(true)
        fetch('/makeworld/mcp', {
          method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'delete', serverName: row.serverName }),
        })
          .then(async response => {
            const value = await response.json()
            if (!response.ok) throw new Error(value.error || `HTTP ${response.status}`)
            setData(value); setMessage('已删除。')
          })
          .catch(reason => setMessage(reason instanceof Error ? reason.message : String(reason)))
          .finally(() => setBusy(false))
      }
      const edit = row => setDraft({
        serverName: row.serverName, transport: row.transport, command: row.command ?? '',
        args: (row.args ?? []).join('\n'), env: (row.env ?? []).map(item => `${item.key}=${item.value}`).join('\n'),
        url: row.url ?? '', headers: (row.headers ?? []).map(item => `${item.key}=${item.value}`).join('\n'),
        timeoutMs: String(row.timeoutMs ?? 60000), enabled: row.enabled !== false,
      })
      const statusOf = name => data?.status?.servers?.find(item => item.serverName === name)
      return h('div', { style: { display: 'grid', gap: '12px' }, 'data-testid': 'makeworld-mcp' },
        h('section', { style: S.card },
          h('div', { style: S.itemHead },
            h('span', { style: S.itemTitle }, 'MCP 服务器'),
            data?.status?.available === false ? badge('官方客户端不可用', C.error) : null,
            data?.status?.available === true ? badge('官方 mcp-client', C.success) : null),
          data?.status?.error ? h('p', { style: { ...S.faint, marginTop: '6px' } }, data.status.error) : null,
          error ? h('p', { style: { ...S.faint, marginTop: '6px' } }, error) : null,
          h('div', { style: { display: 'grid', gap: '6px', marginTop: '8px' } },
            (data?.servers ?? []).length === 0 ? h('p', { style: S.faint }, '还没有 MCP 服务器。') : (data?.servers ?? []).map(row => {
              const status = statusOf(row.serverName)
              return h('div', { key: row.serverName, style: { border: C.border, borderRadius: '8px', padding: '8px 10px' } },
                h('div', { style: S.itemHead },
                  h('span', { style: S.itemTitle }, row.serverName),
                  badge(row.transport, C.muted),
                  badge(row.enabled === false ? '停用' : status?.ok === true ? '已连接' : status?.error ? '连接失败' : '配置中',
                    status?.ok === true ? C.success : status?.error ? C.error : C.muted)),
                h('div', { style: S.faint }, row.transport === 'stdio' ? `${row.command} ${(row.args ?? []).join(' ')}` : row.url),
                status?.error ? h('div', { style: { ...S.faint, marginTop: '4px' } }, status.error) : null,
                h('div', { style: { display: 'flex', gap: '6px', marginTop: '6px' } },
                  h('button', { type: 'button', style: S.button, onClick: () => edit(row) }, '编辑'),
                  h('button', { type: 'button', style: S.button, disabled: busy, onClick: () => remove(row) }, '删除')))
            })),
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' } },
            h('button', { type: 'button', style: S.button, onClick: () => { setDraft(empty); setMessage('') } }, '新建'),
            h('button', { type: 'button', style: S.button, onClick: load }, '刷新状态'))),
        h('section', { style: S.card },
          h('h3', { style: { margin: '0 0 8px', fontSize: '14px' } }, draft.serverName === '' ? '新建 MCP 服务器' : `编辑 ${draft.serverName}`),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' } },
            h('label', { style: { fontSize: '11px' } }, '名称（serverName，唯一）',
              h('input', { style: field, value: draft.serverName, onChange: e => setDraft({ ...draft, serverName: e.target.value }), placeholder: 'github' })),
            h('label', { style: { fontSize: '11px' } }, '传输',
              h('select', { style: field, value: draft.transport, onChange: e => setDraft({ ...draft, transport: e.target.value }) },
                h('option', { value: 'stdio' }, 'stdio（本地进程）'),
                h('option', { value: 'streamable-http' }, 'streamable-http（HTTP 流式）'))),
            h('label', { style: { fontSize: '11px' } }, '超时（毫秒）',
              h('input', { style: field, value: draft.timeoutMs, onChange: e => setDraft({ ...draft, timeoutMs: e.target.value }) }))),
          draft.transport === 'stdio'
            ? h('div', { style: { display: 'grid', gap: '8px', marginTop: '8px' } },
              h('label', { style: { fontSize: '11px' } }, '命令',
                h('input', { style: field, value: draft.command, onChange: e => setDraft({ ...draft, command: e.target.value }), placeholder: 'npx' })),
              h('label', { style: { fontSize: '11px' } }, '参数（每行一个）',
                h('textarea', { style: area, value: draft.args, onChange: e => setDraft({ ...draft, args: e.target.value }), placeholder: '-y\n@modelcontextprotocol/server-github' })),
              h('label', { style: { fontSize: '11px' } }, '环境变量（每行 KEY=VALUE）',
                h('textarea', { style: area, value: draft.env, onChange: e => setDraft({ ...draft, env: e.target.value }) })))
            : h('div', { style: { display: 'grid', gap: '8px', marginTop: '8px' } },
              h('label', { style: { fontSize: '11px' } }, 'URL',
                h('input', { style: field, value: draft.url, onChange: e => setDraft({ ...draft, url: e.target.value }), placeholder: 'http://127.0.0.1:3000/mcp' })),
              h('label', { style: { fontSize: '11px' } }, '请求头（每行 KEY=VALUE）',
                h('textarea', { style: area, value: draft.headers, onChange: e => setDraft({ ...draft, headers: e.target.value }) }))),
          h('label', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '11px' } },
            h('input', { type: 'checkbox', checked: draft.enabled, onChange: e => setDraft({ ...draft, enabled: e.target.checked }) }), '启用'),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' } },
            h('button', { type: 'button', style: S.button, disabled: busy, onClick: save }, busy ? '保存中…' : '保存并连接'),
            message ? h('span', { style: { ...S.faint, fontSize: '11px' } }, message) : null)), confirm.dialog)
    }

    /* --------------------------------------------------------------- ledger */

    /*
     * The layout follows a Nessus-style scan detail page, as the author asked:
     * a flat header, a tab bar, and then every section as an equal-weight card
     * in one grid. There is deliberately NO "primary/secondary" hierarchy —
     * nothing on this page is more important than anything else, and the reader
     * decides what to look at.
     *
     * What is still borrowed from dsh-pentest (`refs/dsh-pentest/.../client`):
     * the flat header + tab bar skeleton, the 12px rhythm, the neutral pills
     * (`FindingsView .severity`: layer-2 body, tone on the glyphs, `0 10px` /
     * 22px), bordered group rows (`AssetsView .row`), and the report toolbar
     * over a bordered Markdown panel (`ReportView`).
     *
     * dsh-pentest gets there with CSS modules and @xyflow/react. This file has
     * no build step and no dependencies, so the same rules live in inline style
     * objects (`L`) plus one view-scoped stylesheet (`LEDGER_CSS`).
     */

    const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'

    /** 1px hairlines, as dsh-pentest draws them (`--dsw-alias-border-l1/l2`). */
    const LINE_1 = `1px solid ${C.borderColorSoft}`
    const LINE_2 = `1px solid ${C.borderColor}`

    /*
     * Surfaces (docs/ledger-ui.md §1.1). The baseline is the platform panel in
     * this same file — `McpPanel` draws cards as `C.layer + C.border` and its
     * inputs as `C.layer2 + C.border`. On a page whose background is `base`,
     * that ladder translates to:
     *
     *   page    base, unpainted
     *   card    layer-1 + border-l1
     *   nested  layer-2 + border-l2   (number boxes, entry cards, inner blocks)
     *   input   base + border-l1      (code blocks — the only recessed surface)
     *
     * `base` must never fill something inside a `layer-1` card: it reads as a
     * hole punched in the card. A nested block that should not read as another
     * colour step is drawn as an outline card (border + radius, no fill).
     */
    const L = {
      page: {
        /* One column for the header, the tabs and both tabs' bodies. 1120 matches
           the platform panel, so switching pages never shifts the left edge. */
        maxWidth: '1120px', margin: '0 auto',
        boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '12px',
        flex: '1 1 auto', height: '100%', minHeight: 0, width: '100%',
        padding: '16px 20px',
        /* The shell never scrolls: the header and the tab bar stay put while
           the active tab's content scrolls underneath them. */
        overflow: 'hidden',
        color: C.text, fontSize: '13px', lineHeight: 1.55,
      },

      /* Flat header: title, one meta line, actions on the right. No card. */
      header: { flex: 'none', display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0 },
      headerMain: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: '1 1 auto' },
      title: {
        margin: 0, fontSize: '20px', lineHeight: '28px', fontWeight: 600, color: C.text,
        display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2,
        overflow: 'hidden', overflowWrap: 'anywhere',
      },
      metaLine: {
        display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 8px',
        fontSize: '12px', lineHeight: '18px', color: C.caption, minWidth: 0,
      },
      metaItem: { minWidth: 0, overflowWrap: 'anywhere' },
      metaLabel: { color: C.caption },
      headerActions: { display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' },

      /* Sync signal: one 6px dot (read state) plus the last write time. */
      sync: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', lineHeight: '18px', color: C.caption, whiteSpace: 'nowrap' },
      syncDot: { width: '6px', height: '6px', borderRadius: '999px', flex: 'none' },

      /* Tab bar: full width, 1px rule, 2px brand underline on the active tab. */
      tabs: { flex: 'none', display: 'flex', alignItems: 'center', gap: '4px', width: '100%', borderBottom: LINE_1, overflowX: 'auto' },
      tab: {
        flex: 'none', whiteSpace: 'nowrap', appearance: 'none', border: 0, background: 'none',
        padding: '6px 12px', borderRadius: '8px 8px 0 0', font: 'inherit',
        fontSize: '13px', lineHeight: '20px', color: C.faint, cursor: 'pointer',
      },
      tabActive: { color: C.text, fontWeight: 600, boxShadow: `inset 0 -2px 0 ${C.brand}` },
      tabTail: { marginLeft: 'auto', flex: 'none', padding: '0 2px' },

      /* The 账本 tab owns the page's scroll; the composer seat floats above it
         (composer-overlay opt-in on the root) and DSH publishes its height on
         the shared scrollport, so the scroller reserves that room. */
      content: {
        display: 'flex', flexDirection: 'column', gap: '12px', flex: '1 1 auto', minHeight: 0,
        overflowY: 'auto', overflowX: 'hidden', paddingRight: '2px',
        paddingBottom: 'calc(var(--dsh-composer-height, 0px) + 20px)',
      },
      /* The 报告 tab scrolls inside its own Markdown panel. */
      contentReport: {
        display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 auto', minHeight: 0,
        overflow: 'hidden', paddingBottom: 'calc(var(--dsh-composer-height, 0px) + 20px)',
      },

      /* Structural problems: a full-width strip offered before the grid. */
      strip: {
        flex: 'none', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0,
        padding: '8px 12px', borderRadius: '8px',
        background: `color-mix(in srgb, ${C.error} 8%, transparent)`,
        borderLeft: `3px solid ${C.error}`,
      },
      stripHead: { display: 'flex', alignItems: 'baseline', gap: '6px', fontSize: '12px', lineHeight: '18px', fontWeight: 600, color: C.error },
      stripRow: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px', fontSize: '12px', lineHeight: '18px', color: C.muted, minWidth: 0 },
      stripMore: { margin: 0, fontSize: '12px', lineHeight: '18px', color: C.muted },

      /* Equal-weight grid: every section is one cell of the same size. */
      grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '12px', alignItems: 'stretch', minWidth: 0 },
      card: {
        display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0,
        border: C.border, borderRadius: '12px', padding: '12px 14px', background: C.layer,
      },
      cardHead: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', minWidth: 0 },
      cardTitle: { margin: 0, fontSize: '13px', lineHeight: '20px', fontWeight: 600, color: C.text, whiteSpace: 'nowrap' },
      cardHint: { fontSize: '12px', lineHeight: '18px', color: C.caption, minWidth: 0, overflowWrap: 'anywhere' },

      /* Coverage: four number boxes, then the family counts as one text line. */
      boxes: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))', gap: '8px', minWidth: 0 },
      box: {
        display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0,
        padding: '8px 10px', border: LINE_2, borderRadius: '8px', background: C.layer2,
      },
      boxValue: { fontSize: '20px', lineHeight: '24px', fontWeight: 600, color: C.text },
      boxLabel: { fontSize: '11px', lineHeight: '16px', color: C.caption, overflowWrap: 'anywhere' },
      /* A second row of metrics under the four boxes: value 13/600 in body ink,
         label 11px caption, tabular figures so the numbers line up when they
         wrap. A hairline separates it from the coverage boxes above. */
      familyRow: {
        display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 22px',
        minWidth: 0, paddingTop: '10px', borderTop: LINE_1,
      },
      family: { display: 'inline-flex', alignItems: 'baseline', gap: '6px', minWidth: 0 },
      familyValue: { fontSize: '13px', lineHeight: '20px', fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums' },
      familyLabel: { fontSize: '11px', lineHeight: '16px', color: C.caption, whiteSpace: 'nowrap' },
      field: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 },
      fieldLabel: { fontSize: '11px', lineHeight: '16px', fontWeight: 600, color: C.caption },
      chips: { display: 'flex', flexWrap: 'wrap', gap: '4px 6px', minWidth: 0 },
      /* Outline chip: a fill would add a step the three-step ladder does not have. */
      chip: { fontSize: '12px', lineHeight: '18px', color: C.muted, background: 'transparent', border: LINE_1, borderRadius: '4px', padding: '0 6px', overflowWrap: 'anywhere', minWidth: 0 },

      /* Frontier: equal-width cards, no rail, no coloured border. */
      entries: { display: 'flex', flexDirection: 'column', gap: '8px', margin: 0, padding: 0, listStyle: 'none', minWidth: 0 },
      /* One step above the section card, never a hole. */
      entry: {
        display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0,
        padding: '10px 12px', border: LINE_2, borderRadius: '8px', background: C.layer2,
      },
      entryHead: { display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 },
      entryTitle: { flex: '1 1 auto', minWidth: 0, margin: 0, fontSize: '15px', lineHeight: '22px', fontWeight: 600, color: C.text, overflowWrap: 'anywhere' },
      entryMeta: { margin: 0, fontSize: '12px', lineHeight: '18px', color: C.caption, overflowWrap: 'anywhere' },
      entryText: { margin: 0, fontSize: '13px', lineHeight: '20px', color: C.muted, overflowWrap: 'anywhere' },
      blocks: { display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 },
      /* Inside an entry (already layer-2): outline only, no fourth step. */
      block: { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, padding: '8px 10px', borderRadius: '8px', border: LINE_2, background: 'transparent' },
      blockLabel: { fontSize: '11px', lineHeight: '16px', fontWeight: 600, color: C.caption },

      /* Grouped rows (review / gaps): a name line, then plain id + text + kind. */
      groups: { display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 },
      group: { display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
      groupHead: { display: 'flex', alignItems: 'baseline', gap: '6px', minWidth: 0 },
      groupTitle: { margin: 0, fontSize: '12px', lineHeight: '18px', fontWeight: 600, color: C.text },
      groupCount: { fontSize: '11px', lineHeight: '18px', color: C.caption },
      dot: { width: '6px', height: '6px', borderRadius: '999px', flex: 'none' },
      quadGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', minWidth: 0 },
      rows: { display: 'flex', flexDirection: 'column', gap: 0, margin: 0, padding: 0, listStyle: 'none', minWidth: 0 },
      row: {
        display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px', minWidth: 0,
        padding: '4px 0', borderBottom: LINE_1, fontSize: '12px', lineHeight: '18px',
      },
      rowText: { color: C.muted, minWidth: 0, flex: '1 1 160px', overflowWrap: 'anywhere' },
      rowTail: { fontSize: '11px', lineHeight: '18px', color: C.caption, flex: 'none' },
      extraRow: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px', minWidth: 0, paddingTop: '8px', borderTop: LINE_1 },

      /* Report tab: a thin toolbar over a bordered Markdown panel. */
      reportRoot: { display: 'flex', flexDirection: 'column', gap: '8px', flex: '1 1 auto', minHeight: 0, minWidth: 0 },
      reportBar: { flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
      reportBarHint: { margin: 0, fontSize: '12px', lineHeight: '18px', color: C.caption },
      actions: { display: 'flex', flex: 'none', flexWrap: 'wrap', gap: '10px' },
      action: {
        appearance: 'none', border: 0, background: 'none', padding: '0 2px', font: 'inherit',
        fontSize: '12px', lineHeight: '18px', color: C.muted, cursor: 'pointer',
      },
      markdownPanel: {
        boxSizing: 'border-box', flex: '1 1 auto', minHeight: '160px', minWidth: 0,
        /* Horizontal padding lives on the column so the 1024px measure stays
           centred on wide windows instead of drifting with the panel edge. */
        overflow: 'auto', overflowX: 'hidden', border: LINE_1, borderRadius: '8px',
        background: C.layer, padding: '20px 0',
      },
      /* Fluid measure: never wider than 1024px, never wider than the panel.
         The base size is 13px/1.7; LEDGER_CSS lifts it to 14px/1.75 once the
         viewport is wide enough to carry it. Blocks inherit both. */
      mdColumn: {
        /* Width and type size live in LEDGER_CSS so the wide-screen breakpoint wins. */
        maxWidth: 'min(100%, 860px)', margin: '0 auto', width: '100%', boxSizing: 'border-box',
        padding: '0 28px',
        display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0,
        color: C.muted,
      },
      notice: {
        margin: 0, padding: '16px', borderRadius: '8px', border: LINE_1, background: C.layer,
        fontSize: '13px', lineHeight: '20px', color: C.muted, textAlign: 'center', overflowWrap: 'anywhere',
      },
      empty: { margin: 0, padding: '16px 0', fontSize: '12px', lineHeight: '18px', textAlign: 'center', color: C.caption },
      code: { fontFamily: MONO, fontSize: '11px', lineHeight: '18px', color: C.caption, overflowWrap: 'anywhere', minWidth: 0 },
      inlineCode: { fontFamily: MONO, fontSize: '12px', background: C.layer2, borderRadius: '4px', padding: '0 4px' },
      /* A code block is a recessed surface: base + hairline, like an input. */
      pre: {
        margin: 0, maxWidth: '100%', fontFamily: MONO, fontSize: '12px', lineHeight: 1.6,
        background: C.base, border: LINE_1, borderRadius: '6px', padding: '10px 12px',
        overflowX: 'auto', whiteSpace: 'pre',
      },
      table: { width: '100%', maxWidth: '100%', borderCollapse: 'collapse', fontSize: '12px', overflowX: 'auto' },
      th: { textAlign: 'left', padding: '4px 8px', borderBottom: LINE_2, color: C.caption, fontWeight: 500 },
      td: { padding: '5px 8px', borderBottom: LINE_1, verticalAlign: 'top', overflowWrap: 'anywhere' },
      footnote: { margin: 0, fontSize: '11px', lineHeight: '16px', color: C.caption },
    }

    /** One status colour per state; error is reserved for real breakage. */
    const STATUS_COLOR = {
      blocked: C.error, malformed: C.error, dangling: C.error, 'wrong-kind': C.error,
      stale: C.warn, assumption: C.warn, deferred: C.faint, satisfied: C.success,
      unsupported: C.info, untested: C.faint, incomplete: C.muted, cycle: C.warn,
    }

    const STATUS_ORDER = ['blocked', 'unsupported', 'dangling', 'wrong-kind', 'malformed', 'stale', 'assumption', 'incomplete', 'untested', 'deferred', 'satisfied']

    /**
     * A pill, dsh-pentest style (`FindingsView .severity`): neutral layer-2 body,
     * the tone only on the glyphs, `0 10px` / 22px. Reserved for states that
     * genuinely need a marker — section counts and the tab-bar count. `solid`
     * is the high/critical variant; `surface` lets a pill sit on a layer-2 card
     * without vanishing into it.
     */
    function tag(text, tone, options) {
      const color = tone || C.muted
      const solid = options !== undefined && options.solid === true
      const surface = options !== undefined && options.surface !== undefined ? options.surface : C.layer2
      return h('span', {
        style: {
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '0 10px', borderRadius: '999px', fontSize: '12px', lineHeight: '22px',
          maxWidth: '100%', overflowWrap: 'anywhere',
          background: solid ? color : surface,
          color: solid ? '#fff' : color,
        },
      }, text)
    }

    /** Record ids are caption text: mono, 11px, no box. */
    function idText(id) {
      if (id === undefined || id === null || id === '') return null
      return h('span', { style: { ...L.code, flex: 'none' }, title: String(id) }, String(id))
    }

    function dot(color, size) {
      return h('span', { style: { ...L.dot, width: size || '6px', height: size || '6px', background: color }, 'aria-hidden': 'true' })
    }

    /** Section shell: one equal-weight card — title, optional count/hint. */
    function Card({ title, count, hint, children, tone }) {
      return h('section', { style: L.card },
        h('div', { style: L.cardHead },
          h('h3', { style: L.cardTitle }, title),
          count === undefined || count === null ? null : tag(String(count), tone || C.muted),
          hint ? h('span', { style: L.cardHint }, hint) : null),
        children)
    }

    function Empty({ text }) {
      return h('p', { style: L.empty }, text)
    }

    /** Frontier scores are products of heuristics: two decimals is all a reader can use. */
    function fmtScore(value) {
      const number = Number(value)
      return Number.isFinite(number) ? number.toFixed(2) : '—'
    }

    /** `HH:MM` of one ISO stamp, or '' when the host sent something unparsable. */
    function clockOf(stamp) {
      if (typeof stamp !== 'string' || stamp === '') return ''
      const time = Date.parse(stamp)
      if (!Number.isFinite(time)) return ''
      const date = new Date(time)
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    }

    /**
     * The sync signal for the live read: one 6px dot and a timestamp.
     *
     * Two different facts, kept apart on purpose:
     *   - the TEXT is the ledger's last write (`lastAt`, host clock): "最近写入
     *     15:40". Calling that "已同步" was misleading — an agent that has not
     *     written for an hour would show a stale time on a page that re-reads
     *     every four seconds;
     *   - the DOT is the read itself: green = the last fetch succeeded, amber =
     *     a fetch is in flight, red = the fetch failed.
     *
     * Deliberately NOT an aria-live region: announcing "updating…" every four
     * seconds would be the opposite of quiet, and the fetch state only changes
     * colour. The state word therefore rides in `aria-label` and `title`.
     */
    function SyncBadge({ status, refreshing, lastAt, t }) {
      const label = key => (t ? t(key) : (zh[key] ?? key))
      const tone = status === 'ready'
        ? (refreshing ? C.warn : C.success)
        : status === 'error' ? C.error : C.faint
      const state = status === 'ready' ? (refreshing ? 'syncing' : 'synced') : status === 'error' ? 'syncFailed' : 'syncing'
      const clock = clockOf(lastAt)
      const text = `${label('recentWrite')} ${clock === '' ? '—' : clock}`
      const title = `${text} · ${label(state)} · ${label('syncTitle')}`
      return h('span', {
        'data-testid': 'makeworld-ledger-sync',
        'data-sync': state,
        style: L.sync,
        title,
        'aria-label': title,
        'aria-live': 'off',
      },
        h('span', { style: { ...L.syncDot, background: tone }, 'aria-hidden': 'true' }),
        h('span', null, text))
    }

    /* ---------------------------------------------------------- markdown ---- */

    /*
     * The two documents this page renders are generated by src/makeworld/views.js,
     * so the grammar they use is bounded: ATX headings, flat bullets, ordered
     * lists, `>` quotes, fenced code, simple pipe tables, and `**bold**` /
     * `*em*` / `` `code` `` inline spans. That is the whole renderer — no HTML
     * passthrough and no dangerouslySetInnerHTML: every span becomes a React
     * text node, so a record containing "<img onerror=…>" is printed as
     * characters instead of being parsed.
     */

    /** Split one line into text / code / strong / em spans. */
    function parseInline(text) {
      const spans = []
      const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*/g
      let cursor = 0
      let match = pattern.exec(text)
      while (match !== null) {
        if (match.index > cursor) spans.push({ kind: 'text', value: text.slice(cursor, match.index) })
        if (match[1] !== undefined) spans.push({ kind: 'code', value: match[1] })
        else if (match[2] !== undefined || match[3] !== undefined) spans.push({ kind: 'strong', value: match[2] ?? match[3] })
        else spans.push({ kind: 'em', value: match[4] })
        cursor = pattern.lastIndex
        match = pattern.exec(text)
      }
      if (cursor < text.length) spans.push({ kind: 'text', value: text.slice(cursor) })
      return spans
    }

    /** Cells of one pipe-table line, trimmed, outer pipes dropped. */
    function tableCells(line) {
      return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
    }

    function isTableDivider(line) {
      const cells = tableCells(line)
      return cells.length > 0 && cells.every(cell => /^:?-{1,}:?$/.test(cell))
    }

    const LIST_LINE = /^(\s*)(?:([-*+])|(\d+)[.)])\s+(.*)$/

    /** Parse markdown into blocks. Never throws: unparsable input stays literal. */
    function parseMarkdown(source) {
      const text = source === undefined || source === null ? '' : String(source)
      const lines = text.replace(/\r\n?/g, '\n').split('\n')
      const blocks = []
      let index = 0
      while (index < lines.length) {
        const line = lines[index]
        if (line.trim() === '') { index += 1; continue }
        const fence = /^\s*```(\S*)\s*$/.exec(line)
        if (fence !== null) {
          const body = []
          index += 1
          while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) { body.push(lines[index]); index += 1 }
          index += 1
          blocks.push({ type: 'code', lang: fence[1] || '', text: body.join('\n') })
          continue
        }
        const heading = /^(#{1,6})\s+(.*)$/.exec(line)
        if (heading !== null) {
          blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() })
          index += 1
          continue
        }
        if (/^\s*([-*_])\s*\1\s*\1[-*_\s]*$/.test(line)) { blocks.push({ type: 'rule' }); index += 1; continue }
        if (line.trim().startsWith('|') && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
          const head = tableCells(line)
          index += 2
          const rows = []
          while (index < lines.length && lines[index].trim().startsWith('|')) { rows.push(tableCells(lines[index])); index += 1 }
          blocks.push({ type: 'table', head, rows })
          continue
        }
        if (/^\s*>/.test(line)) {
          const quoted = []
          while (index < lines.length && /^\s*>/.test(lines[index])) { quoted.push(lines[index].replace(/^\s*>\s?/, '')); index += 1 }
          blocks.push({ type: 'quote', text: quoted.join('\n').trim() })
          continue
        }
        const first = LIST_LINE.exec(line)
        if (first !== null) {
          const ordered = first[3] !== undefined
          const items = []
          let match = first
          while (match !== null) {
            items.push({ depth: Math.min(3, Math.floor(match[1].length / 2)), text: match[4] })
            index += 1
            match = index < lines.length ? LIST_LINE.exec(lines[index]) : null
          }
          blocks.push({ type: 'list', ordered, items })
          continue
        }
        const paragraph = []
        while (index < lines.length && lines[index].trim() !== ''
          && !/^(#{1,6})\s/.test(lines[index].trim())
          && !/^```/.test(lines[index].trim())
          && !/^>/.test(lines[index].trim())
          && LIST_LINE.exec(lines[index]) === null) {
          paragraph.push(lines[index].trim())
          index += 1
        }
        blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
      }
      return blocks
    }

    /**
     * Three visual steps, as DSH's own report views draw them: the document
     * title (20/28, ruled underneath), a section (16/24), a record (14/22).
     */
    function mdHeading(level) {
      if (level === 1) {
        return { margin: 0, paddingBottom: '8px', borderBottom: LINE_2, fontSize: '20px', lineHeight: '28px', fontWeight: 600, color: C.text, overflowWrap: 'anywhere' }
      }
      if (level === 2) {
        return { margin: 0, fontSize: '16px', lineHeight: '24px', fontWeight: 600, color: C.text, overflowWrap: 'anywhere' }
      }
      return { margin: 0, fontSize: '14px', lineHeight: '22px', fontWeight: 600, color: C.text, overflowWrap: 'anywhere' }
    }

    /** Inline spans → React nodes (text nodes, never HTML). */
    function inlineNodes(text, keyPrefix) {
      return parseInline(text).map((span, index) => {
        const key = `${keyPrefix}-i${index}`
        if (span.kind === 'code') return h('code', { key, style: L.inlineCode }, span.value)
        if (span.kind === 'strong') return h('strong', { key, style: { fontWeight: 600, color: C.text } }, span.value)
        if (span.kind === 'em') return h('em', { key }, span.value)
        return span.value
      })
    }

    /** Render a markdown document as a list of React elements. */
    function markdownNodes(source, keyPrefix) {
      return parseMarkdown(source).map((block, index) => {
        const key = `${keyPrefix}-b${index}`
        if (block.type === 'heading') {
          const tag = block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4'
          return h(tag, { key, style: mdHeading(block.level) }, inlineNodes(block.text, key))
        }
        if (block.type === 'rule') return h('hr', { key, style: { border: 'none', borderTop: LINE_2, margin: 0 } })
        if (block.type === 'code') return h('pre', { key, style: L.pre }, h('code', null, block.text))
        if (block.type === 'quote') {
          return h('blockquote', {
            key,
            style: { margin: 0, maxWidth: '100%', padding: '0 0 0 10px', borderLeft: `2px solid ${C.borderColor}`, color: C.muted, fontSize: 'inherit', lineHeight: 'inherit', overflowWrap: 'anywhere' },
          }, inlineNodes(block.text, key))
        }
        if (block.type === 'list') {
          return h(block.ordered ? 'ol' : 'ul', {
            key, style: { margin: 0, paddingLeft: '20px', display: 'grid', gap: '4px', fontSize: 'inherit', lineHeight: 'inherit' },
          }, block.items.map((item, itemIndex) => h('li', {
            key: `${key}-l${itemIndex}`,
            style: { margin: 0, paddingLeft: item.depth > 0 ? `${item.depth * 12}px` : 0, overflowWrap: 'anywhere' },
          }, inlineNodes(item.text, `${key}-l${itemIndex}`))))
        }
        if (block.type === 'table') {
          return h('table', { key, style: L.table },
            h('thead', null, h('tr', null, block.head.map((cell, cellIndex) => h('th', { key: `h${cellIndex}`, style: L.th }, cell)))),
            h('tbody', null, block.rows.map((row, rowIndex) => h('tr', { key: `r${rowIndex}` },
              row.map((cell, cellIndex) => h('td', { key: `c${cellIndex}`, style: L.td }, cell))))))
        }
        return h('p', { key, style: { margin: 0, color: C.muted, fontSize: 'inherit', lineHeight: 'inherit', overflowWrap: 'anywhere' } }, inlineNodes(block.text, key))
      })
    }

    /* ------------------------------------------------------ ledger data ----- */

    const FAMILY_LABEL = {
      goals: ['目标', 'goals'], intents: ['意图', 'intents'], facts: ['事实', 'facts'],
      claims: ['结论', 'claims'], entities: ['实体', 'entities'], evidence: ['证据', 'evidence'],
      templates: ['模板', 'templates'],
    }

    /** Structural problems use their own kind names; the dictionary is shared. */
    const HEALTH_STATUS = {
      danglingRef: 'dangling',
      wrongRefKind: 'wrong-kind',
      unknownOp: 'malformed',
      unknownRecordKind: 'malformed',
      unknownRef: 'malformed',
      duplicateRecordId: 'malformed',
      missingRecordId: 'malformed',
      missingEdgeEnd: 'dangling',
    }

    /** Rows a health strip lists before it says "还有 N 条". */
    const HEALTH_ROWS = 5

    /**
     * Read the ledger snapshot.
     *
     * A refresh keeps the previous snapshot on screen while the new one loads,
     * and aborts the superseded request: the page polls, so overlapping reads
     * would otherwise land out of order and flash the loading state.
     */
    function useLedger(sessionId, nonce) {
      const [state, setState] = React.useState({ status: 'idle' })
      React.useEffect(() => {
        if (sessionId === undefined || sessionId === null || sessionId === '') {
          setState({ status: 'no-session' })
          return undefined
        }
        const controller = typeof AbortController === 'function' ? new AbortController() : undefined
        const aborted = () => controller !== undefined && controller.signal.aborted
        setState(previous => (previous.status === 'ready' ? { ...previous, refreshing: true } : { status: 'loading' }))
        fetch('/makeworld/ledger?session=' + encodeURIComponent(String(sessionId)), {
          cache: 'no-store',
          credentials: 'same-origin',
          ...(controller === undefined ? {} : { signal: controller.signal }),
        })
          .then(async (response) => {
            const value = await response.json()
            if (!response.ok) throw new Error(value.error || ('HTTP ' + response.status))
            if (!aborted()) setState({ status: 'ready', data: value })
          })
          .catch((error) => {
            if (aborted()) return
            setState({ status: 'error', error: error instanceof Error ? error.message : String(error) })
          })
        return () => { if (controller !== undefined) controller.abort() }
      }, [sessionId, nonce])
      return state
    }

    /**
     * Re-read on a timer, on tab focus, and when the page becomes visible.
     *
     * The ledger is written by tools in the conversation, so a page that only
     * refreshed on demand showed stale intents and facts — the same class of
     * bug the old 灵眼 panel had. The read is local file IO, so polling is
     * cheap; nothing polls while the page is hidden.
     */
    function useLiveLedger(sessionId, revision, hasPush) {
      const [nonce, setNonce] = React.useState(0)
      const bump = React.useCallback(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
        setNonce(value => value + 1)
      }, [])
      /* A cairn_* write bumps the session projection revision; that is the
         write signal the ledger file itself cannot emit. */
      const seen = React.useRef(revision)
      React.useEffect(() => {
        if (revision === seen.current) return
        seen.current = revision
        bump()
      }, [revision, bump])
      React.useEffect(() => {
        /* Hosts and test harnesses may expose a partial window/document. */
        if (typeof window === 'undefined' || typeof window.setInterval !== 'function') return undefined
        if (typeof document === 'undefined') return undefined
        /* Push is the primary signal; the timer only covers a lost event. Without
           the projection row there is no push at all, so fall back to polling. */
        const timer = window.setInterval(bump, hasPush === false ? 4000 : 15000)
        window.addEventListener('focus', bump)
        const onVisibility = () => { if (document.visibilityState === 'visible') bump() }
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
          window.clearInterval(timer)
          window.removeEventListener('focus', bump)
          document.removeEventListener('visibilitychange', onVisibility)
        }
      }, [bump])
      return { nonce, refresh: bump, state: useLedger(sessionId, nonce) }
    }

    /** Read the markdown deliverable on demand; nothing is fetched until asked. */
    function useReport(sessionId) {
      const [report, setReport] = React.useState({ status: 'closed' })
      const open = () => {
        if (sessionId === undefined || sessionId === null || sessionId === '') return
        setReport({ status: 'loading' })
        fetch('/makeworld/ledger?session=' + encodeURIComponent(String(sessionId)) + '&view=report', { cache: 'no-store', credentials: 'same-origin' })
          .then(async (response) => {
            const value = await response.json()
            if (!response.ok) throw new Error(value.error || ('HTTP ' + response.status))
            setReport({ status: 'ready', markdown: typeof value.markdown === 'string' ? value.markdown : '' })
          })
          .catch((error) => setReport({ status: 'error', error: error instanceof Error ? error.message : String(error) }))
      }
      return { report, open, close: () => setReport({ status: 'closed' }) }
    }

    /* --------------------------------------------------- ledger sections ---- */

    /**
     * Structural problems: a full-width strip above the grid, only when it has
     * rows. Red wash and a 3px left rail are the one coloured surface on the
     * page; the first five rows are listed and the rest is counted.
     */
    function HealthCard({ rows, count, t }) {
      const label = key => (t ? t(key) : (zh[key] ?? key))
      const shown = rows.slice(0, HEALTH_ROWS)
      const rest = rows.length - shown.length
      return h('div', { style: L.strip, 'data-testid': 'makeworld-ledger-health' },
        h('div', { style: L.stripHead },
          h('span', null, label('inconsistent')),
          h('span', { style: { fontWeight: 400, color: C.muted } }, String(count === undefined ? rows.length : count))),
        h('ul', { style: L.rows }, shown.map((row, index) => h('li', { key: `health-${index}`, style: L.stripRow },
          h('span', null, label(`status.${row.status}`)),
          idText(row.id),
          h('span', { style: { ...L.rowText, flex: '1 1 220px' } }, row.text)))),
        rest > 0
          ? h('p', { style: L.stripMore }, `${label('morePrefix')} ${rest} ${label('moreSuffix')}`.replace(/\s+/g, ' ').trim())
          : null)
    }

    /** Coverage as four equal number boxes plus one line of family counts. */
    function CoverageCard({ coverage, counts, t }) {
      const label = key => (t ? t(key) : (zh[key] ?? key))
      const untouched = (coverage.entities || []).filter(entity => entity.tier === 'untouched')
      const boxes = [
        { key: 'evidenced', value: coverage.evidenced || 0, label: label('evidenced') },
        { key: 'observed', value: coverage.observed || 0, label: label('observed') },
        { key: 'untouched', value: coverage.untouched || 0, label: label('untouched') },
        { key: 'entities', value: coverage.total || 0, label: label('family.entities') },
      ]
      return h(Card, { title: label('coverage') },
        h('div', {
          style: L.boxes,
          role: 'group',
          'aria-label': boxes.map(box => `${box.label} ${box.value}`).join(', '),
        }, boxes.map(box => h('div', { key: box.key, style: L.box },
          h('span', { style: L.boxValue }, String(box.value)),
          h('span', { style: L.boxLabel }, box.label)))),
        h('div', { style: L.familyRow, role: 'list', 'aria-label': label('familyCounts') },
          Object.keys(FAMILY_LABEL).filter(key => key !== 'entities').map(key => h('div', {
            key, style: L.family, role: 'listitem',
          },
          h('span', { style: L.familyValue }, String((counts || {})[key] || 0)),
          h('span', { style: L.familyLabel }, label(`family.${key}`))))),
        h('div', { style: L.field },
          h('span', { style: L.fieldLabel }, `${label('untestedEntities')} ${untouched.length}`),
          untouched.length === 0
            ? h(Empty, { text: label('none') })
            : h('div', { style: L.chips }, untouched.map(entity => h('span', {
              key: entity.id,
              style: L.chip,
              title: entity.id,
            }, `${entity.type || 'other'} ${entity.value === undefined ? entity.id : String(entity.value)}`)))))
    }

    function FrontierCard({ items, t }) {
      const label = key => (t ? t(key) : (zh[key] ?? key))
      if (items.length === 0) return h(Card, { title: label('frontier'), count: 0 }, h(Empty, { text: label('none') }))
      return h(Card, {
        title: label('frontier'),
        count: items.length,
        /* The page asks the host for 20 rows; saying "top N" out loud keeps a
           capped list from reading like the whole backlog. */
        hint: `${label('topPrefix')} ${items.length} ${label('topSuffix')}`.replace(/\s+/g, ' ').trim(),
      },
        h('ul', { style: L.entries }, items.map(item => h('li', { key: item.id, style: L.entry },
          h('div', { style: L.entryHead },
            h('h4', { style: L.entryTitle }, item.title),
            idText(item.id)),
          h('p', { style: L.entryMeta },
            [`${label('score')} ${fmtScore(item.score)}`, item.ready ? label('ready') : label('notReady'),
              item.state && item.state !== 'open' ? label(`state.${item.state}`) : ''].filter(Boolean).join(' · ')),
          item.expectedObservation ? h('p', { style: L.entryText }, item.expectedObservation) : null,
          ((item.decides || []).length === 0 && (item.missingDeps || []).length === 0) ? null : h('div', { style: L.blocks },
            (item.decides || []).length > 0
              ? h('div', { style: L.block },
                h('span', { style: L.blockLabel }, label('decides')),
                h('div', { style: L.chips }, item.decides.map(reading => h('span', { key: reading, style: L.chip }, reading))))
              : null,
            (item.missingDeps || []).length > 0
              ? h('div', { style: L.block },
                h('span', { style: L.blockLabel }, label('missingDeps')),
                h('div', { style: L.chips }, item.missingDeps.map(dep => h('span', { key: dep, style: L.chip }, dep))))
              : null),
          h('p', { style: L.entryMeta },
            `${label('uncertainty')} ${Math.round((Number(item.uncertainty) || 0) * 100)}% · ${label('cost')} ${item.cost === undefined ? '—' : item.cost}` +
            (item.goalId ? ` · ${label('family.goals')} ${item.goalId}` : ''))))))
    }

    function ReviewCard({ items, t }) {
      const label = key => (t ? t(key) : (zh[key] ?? key))
      const groups = new Map()
      for (const item of items) {
        const status = item.status || 'incomplete'
        if (!groups.has(status)) groups.set(status, [])
        groups.get(status).push(item)
      }
      const order = [...STATUS_ORDER.filter(status => groups.has(status)), ...[...groups.keys()].filter(status => STATUS_ORDER.indexOf(status) === -1)]
      return h(Card, {
        title: label('review'),
        count: items.length,
        hint: order.length > 1 ? `${order.length} ${label('groups')}` : null,
      },
        items.length === 0 ? h(Empty, { text: label('none') }) : h('div', { style: L.groups },
          order.map(status => {
            const rows = groups.get(status)
            const color = STATUS_COLOR[status] || C.muted
            return h('div', { key: status, style: L.group },
              h('div', { style: L.groupHead },
                dot(color),
                h('span', { style: L.groupTitle }, label(`status.${status}`)),
                h('span', { style: L.groupCount }, String(rows.length))),
              h('ul', { style: L.rows }, rows.map((item, index) => h('li', { key: `review-${status}-${index}`, style: L.row },
                idText(item.ref),
                h('span', { style: L.rowText }, item.text),
                item.kind ? h('span', { style: L.rowTail }, label(`kind.${item.kind}`)) : null))))
          })))
    }

    function GapsCard({ gaps, t }) {
      const label = key => (t ? t(key) : (zh[key] ?? key))
      const quadrants = [
        { key: 'assumed', title: label('assumed'), rows: (gaps.assumed || []).map(item => ({ id: item.id, text: item.text })) },
        { key: 'negative', title: label('negative'), rows: (gaps.negative || []).map(item => ({ id: item.id, text: item.text })) },
        { key: 'untested', title: label('untested'), rows: (gaps.untestedEntities || []).map(item => ({ id: item.id, text: `${item.type || 'other'} ${item.value === undefined ? '' : item.value}`.trim() })) },
        { key: 'unsupported', title: label('unsupported'), rows: (gaps.unsupportedClaims || []).map(item => ({ id: item.id, text: item.title })) },
      ]
      const extra = [
        { key: 'blocked', title: label('blockedIntents'), rows: (gaps.blockedIntents || []).map(item => ({ id: item.id, text: item.title })) },
        { key: 'goals', title: label('openGoals'), rows: (gaps.openGoals || []).map(item => ({ id: item.id, text: item.text })) },
        { key: 'stale', title: label('staleFacts'), rows: (gaps.staleFacts || []).map(item => ({ id: item.id, text: item.text })) },
        { key: 'retired', title: label('retiredEvidence'), rows: (gaps.retiredEvidence || []).map(item => ({ id: item.id, text: item.label })) },
      ].filter(group => group.rows.length > 0)
      const total = quadrants.reduce((sum, group) => sum + group.rows.length, 0)
      return h(Card, { title: label('gaps'), count: total, hint: label('gapHint') },
        h('div', { style: L.quadGrid }, quadrants.map(group => h('div', { key: group.key, style: L.group },
          h('div', { style: L.groupHead },
            h('span', { style: L.groupTitle }, group.title),
            h('span', { style: L.groupCount }, String(group.rows.length))),
          group.rows.length === 0
            ? h('p', { style: { ...L.empty, padding: '4px 0' } }, label('none'))
            : h('ul', { style: L.rows }, group.rows.map((row, index) => h('li', { key: `${group.key}-${index}`, style: L.row },
              idText(row.id),
              h('span', { style: L.rowText }, row.text))))))),
        extra.length === 0 ? null : h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
          extra.map(group => h('div', { key: group.key, style: L.extraRow },
            h('span', { style: { ...L.groupTitle, minWidth: '84px' } }, group.title),
            h('div', { style: L.chips }, group.rows.slice(0, 8).map((row, index) => h('span', {
              key: `${group.key}-x${index}`, style: L.chip, title: row.id,
            }, row.text))),
            group.rows.length > 8 ? h('span', { style: L.rowTail }, `+${group.rows.length - 8}`) : null))))
    }

    /** The 报告 tab: thin toolbar over a bordered, 72ch Markdown panel. */
    function ReportCard({ report, onRefresh, t }) {
      const label = key => (t ? t(key) : (zh[key] ?? key))
      const [copied, setCopied] = React.useState(false)
      const copy = () => {
        const body = report.markdown || ''
        try {
          Promise.resolve(navigator.clipboard.writeText(body)).then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
          }).catch(() => undefined)
        } catch (error) {
          /* clipboard unavailable: the document is already on screen */
        }
      }
      const body = report.status === 'loading'
        ? h(Empty, { text: label('loading') })
        : report.status === 'error'
          ? h('p', { style: { ...L.notice, color: C.error }, role: 'alert' }, report.error)
          : h('div', { style: L.mdColumn, 'data-mw-report': '' }, markdownNodes(report.markdown || '', 'report'))
      return h('section', { style: L.reportRoot, 'data-testid': 'makeworld-ledger-report' },
        h('header', { style: L.reportBar },
          h('p', { style: L.reportBarHint }, label('reportHint')),
          h('div', { style: L.actions },
            h('button', { type: 'button', 'data-mw-action': '', style: L.action, onClick: copy, disabled: report.status !== 'ready' },
              copied ? label('copied') : label('copy')),
            h('button', { type: 'button', 'data-mw-action': '', style: L.action, onClick: onRefresh }, label('regenerate')))),
        h('div', { style: { ...L.markdownPanel, display: 'flex', flexDirection: 'column' }, 'aria-live': 'polite' }, body),
        copied ? h('span', { role: 'status', style: L.reportBarHint }, label('copied')) : null)
    }

    /* ------------------------------------------------------------- ledger --- */

    /**
     * Read-only ledger view: a flat header, two sub-tabs, and every section at
     * the same visual weight in one grid.
     *
     * Root contract: the `data-conversation-composer-overlay` opt-in.
     * ui-conversation ships, as product CSS, both
     *   `.root:has([data-conversation-composer-overlay]) .widthHandle { display:none }`
     *   `.scrollBody:has([data-conversation-composer-overlay]) > … > .viewArea
     *      { flex:1 1 0; min-height:0; overflow:hidden }`
     * and the official precedent for a view that owns its scroller is
     * ui-trajectory's `TrajectoryView` root. Declaring the attribute here is how
     * a view tells the host "I scroll myself, do not put resize strips over me".
     *
     * dsh-lingeye predates that attribute and instead injected
     * `:has([data-lingeye-view]) [data-width-handle] { display:none !important }`
     * into <head>: a global rule muting a foreign DOM node for every view in the
     * app, still firing after the host changed the handle's markup. The data
     * attribute is scoped to this view, is read by the host's own stylesheet,
     * and disappears with the view.
     */
    function LedgerPanel({ sessionId, t, useProjection }) {
      const label = (key, fallback) => (t ? t(key) : (fallback === undefined ? (zh[key] ?? key) : fallback))
      const [tab, setTab] = React.useState('ledger')
      const projection = typeof useProjection === 'function' ? useProjection('makeworldLedger') : undefined
      const revision = projection === null || projection === undefined ? 0 : (projection.revision || 0)
      /* undefined = the projection row is absent (no push at all); null = registered but idle. */
      const { refresh, state } = useLiveLedger(sessionId, revision, projection !== undefined)
      const { report, open } = useReport(sessionId)
      const hasSession = !(sessionId === undefined || sessionId === null || sessionId === '')

      /* The report is fetched when its tab is first shown, then kept: switching
         back and forth must not re-read the deliverable. */
      React.useEffect(() => {
        if (tab !== 'report' || !hasSession) return
        if (report.status === 'closed') open()
      }, [tab, hasSession, report.status])

      const data = state.status === 'ready' ? state.data : undefined
      const task = data && data.task ? data.task : undefined

      /* Structural problems: broken lines, structural problems, reference
         cycles. They ride one strip above the grid, because everything below
         may be wrong when they exist. */
      const brokenLines = data && (data.brokenLines || []).length > 0
        ? ` · ${label('atLines')} ${(data.brokenLines || []).join(', ')}`
        : ''
      const health = data === undefined ? [] : [
        ...(data.broken ? [{
          id: '',
          status: 'malformed',
          color: C.error,
          text: `${data.broken} ${label('brokenLines')}${brokenLines}`,
        }] : []),
        ...(data.ledgerProblems || []).map(problem => ({
          id: problem.id !== undefined ? problem.id : (problem.seq === undefined ? '' : `#${problem.seq}`),
          status: HEALTH_STATUS[problem.kind] || 'malformed',
          color: C.warn,
          text: [
            problem.owner ? `${problem.owner} ${label('of')} ` : '',
            problem.field === undefined ? '' : problem.field,
            problem.value ? ` → ${problem.value}` : '',
            /* No parentheses: 「」 vs () differs per language, a separator does not. */
            problem.expected ? ` · ${label('expected')} ${problem.expected}` : '',
          ].join('') || String(problem.kind === undefined ? '' : problem.kind),
        })),
        ...(((data.causal && data.causal.cycles) || []).map(cycle => ({
          id: '',
          status: 'cycle',
          color: C.warn,
          text: Array.isArray(cycle) ? cycle.join(' → ') : String(cycle),
        }))),
      ]
      const healthCount = health.length

      const counts = (data && data.counts) || {}
      /* Reference and ledger problems are structure, not work: they belong to
         the strip, so the open-items count stays a count of open work. */
      /* reference/ledger problems live in the health strip; an unsupported claim is
         already a gap, so listing it again here would say the same thing twice. */
      const reviewItems = ((data && data.review) || []).filter(item => item.kind !== 'reference' && item.kind !== 'ledger' && item.status !== 'unsupported')

      const metaLine = h('div', { style: L.metaLine },
        task && task.subject ? h('span', { style: L.metaItem }, task.subject) : null,
        task && task.acceptance
          ? h('span', { style: L.metaItem }, `${label('acceptance', '验收')} ${task.acceptance}`)
          : null,
        task && task.openedAt
          ? h('span', { style: L.metaItem }, `${label('openedAt', '开场')} ${task.openedAt}`)
          : null,
        data && data.ledger
          ? h('span', { style: L.metaItem, title: data.ledger }, `${label('path', '账本路径')} ${data.ledger}`)
          : null)

      const header = h('header', { style: L.header },
        h('div', { style: L.headerMain },
          h('h2', { style: L.title, title: (task && task.objective) || label('ledger', '账本') },
            (task && task.objective) || label('ledger', '账本')),
          metaLine),
        h('div', { style: L.headerActions },
          h(SyncBadge, { status: state.status, refreshing: state.refreshing === true, lastAt: data && data.lastAt, t }),
          h('button', {
            type: 'button', 'data-mw-action': '', style: L.action, onClick: refresh, disabled: !hasSession,
          }, label('refresh', '刷新'))))

      const tabs = h('nav', {
        style: L.tabs, 'data-testid': 'makeworld-ledger-tabs', role: 'tablist', 'aria-label': label('ledger', '账本'),
      },
      [
        { id: 'ledger', label: label('ledger', '账本'), disabled: false },
        { id: 'report', label: label('reportTitle', '报告'), disabled: !hasSession },
      ].map(item => h('button', {
        key: item.id,
        type: 'button',
        role: 'tab',
        'data-mw-tab': '',
        'aria-selected': tab === item.id,
        'data-testid': `makeworld-ledger-tab-${item.id}`,
        disabled: item.disabled,
        style: tab === item.id ? { ...L.tab, ...L.tabActive } : L.tab,
        onClick: () => setTab(item.id),
      }, item.label)),
      healthCount > 0
        ? h('span', { style: L.tabTail }, tag(String(healthCount), C.muted))
        : null)

      let body
      const scrolls = tab !== 'report'
      if (tab === 'report') {
        body = h(ReportCard, {
          report: hasSession ? report : { status: 'error', error: label('noSession', '没有可读取的会话。') },
          onRefresh: open,
          t,
        })
      } else if (state.status === 'no-session') body = h(Empty, { text: label('noSession', '没有可读取的会话。') })
      else if (state.status === 'loading' || state.status === 'idle') {
        body = h('p', { style: L.notice, 'aria-live': 'polite' }, label('loading', '正在读账本…'))
      } else if (state.status === 'error') {
        body = h('p', { style: { ...L.notice, color: C.error }, role: 'alert' }, state.error)
      } else if (!data.initialized) {
        body = [
          /* The strip is above the note, so "上面列出的行" stays true. */
          health.length === 0 ? null : h(HealthCard, { rows: health, count: healthCount, t }),
          h('p', { style: L.notice, 'aria-live': 'polite' },
            /* The host's `hint` is Chinese server copy; the page speaks whatever
               language the client is bound to, so it uses its own strings. */
            data.broken
              ? label('emptyBroken', '账本读不出任何记录，先修好上面列出的行。')
              : label('empty', '这个会话还没有开场。')),
        ]
      } else {
        body = [
          health.length === 0 ? null : h(HealthCard, { rows: health, count: healthCount, t }),
          h('div', { style: L.grid },
            h(CoverageCard, {
              coverage: data.coverage || { total: 0, evidenced: 0, observed: 0, untouched: 0, entities: [] },
              counts,
              t,
            }),
            h(FrontierCard, { items: data.frontier || [], t }),
            h(ReviewCard, { items: reviewItems, t }),
            h(GapsCard, { gaps: data.gaps || {}, t })),
          h('p', { style: L.footnote }, label('scoreHint')),
        ]
      }

      return h('div', {
        'data-testid': 'makeworld-ledger',
        /* The official opt-in: DSH hides its width handles for this view and
           lets the view own its scroller (see the block comment above). */
        'data-conversation-composer-overlay': '',
        style: L.page,
        role: 'region',
        'aria-label': label('ledger', '账本'),
      },
        header,
        tabs,
        h('div', {
          'data-testid': 'makeworld-ledger-content',
          'data-scrolls': scrolls ? 'true' : 'false',
          style: scrolls ? L.content : L.contentReport,
        }, body))
    }

    /**
     * The ledger page's own stylesheet. Hover, focus rings and one breakpoint
     * are not expressible as inline styles; every rule is scoped either to our
     * own `[data-makeworld-ledger]` subtree, or to a scroll body that *contains*
     * our view — so no rule here can reach another view's chrome.
     *
     * The last rule answers the composer's dashed outline. `InputBar.module.css`
     * paints `.cardWorkspaceTrigger::after { border: 1px dashed currentColor;
     * color: var(--dsw-alias-border-l4) }` while the composer is inert (no
     * workspace picked): a light dashed frame inset in the card. Behind a
     * read-only page that frame reads as a broken page border, not as a hint.
     * The rule removes only that pseudo-element, only while this view is
     * mounted, keyed off the host's own `data-composer-card` (class names are
     * CSS-module hashed, so a `data-*` hook is the only stable selector). The
     * card keeps its click handling and its "choose workspace" placeholder, so
     * the affordance the frame decorated still exists — and the rule dies with
     * the view, unlike dsh-lingeye's app-wide `[data-width-handle] { display:none
     * !important }`.
     */
    const LEDGER_CSS = [
      '[data-makeworld-ledger] button:focus-visible {',
      '  outline: 2px solid var(--dsw-alias-state-business-primary, var(--dsw-alias-brand-primary, #4f46e5));',
      '  outline-offset: 2px; }',
      '[data-makeworld-ledger] [data-mw-tab]:hover:not([aria-selected="true"]):not(:disabled) {',
      '  color: var(--dsw-alias-label-secondary, #60646c); }',
      /* The report toolbar is text-only: hover to primary ink, no box. */
      '[data-makeworld-ledger] [data-mw-action]:hover:not(:disabled) {',
      '  color: var(--dsw-alias-label-primary, #1b1b1f); text-decoration: underline; }',
      '[data-makeworld-ledger] [data-mw-action]:disabled, [data-makeworld-ledger] [data-mw-tab]:disabled { opacity: .5; cursor: default; }',
      /* The report body scales with the window: 13/1.7 below, 14/1.75 once there
         is width to carry a longer measure. Blocks inherit from the column. */
      '[data-makeworld-ledger] [data-mw-report] { font-size: 13px; line-height: 1.7; }',
      '@media (min-width: 1280px) {',
      '  [data-makeworld-ledger] [data-mw-report] { font-size: 14px; line-height: 1.75; } }',
      '@media (max-width: 560px) {',
      '  [data-makeworld-ledger] { padding-left: 12px !important; padding-right: 12px !important; } }',
      '[data-conversation-scroll]:has([data-makeworld-ledger]) [data-composer-card]::after { display: none; }',
    ].join('\n')

    /**
     * Platform settings panel (sidebar): Git Bash environment and MCP.
     * The ledger lives in the conversation tab bar instead, per session.
     */
    function MakeworldPanel(props) {
      const [tab, setTab] = React.useState('environment')
      const tabDefs = [
        { id: 'environment', label: props.t ? props.t('environment') : '环境' },
        { id: 'mcp', label: props.t ? props.t('mcp') : 'MCP' },
      ]
      return h('div', { style: { ...S.root, maxWidth: '1120px', margin: '0 auto' }, 'data-testid': 'makeworld-panel' },
        h('header', { style: { display: 'flex', flexDirection: 'column', gap: '4px', flex: 'none' } },
          h('h1', { style: { margin: 0, fontSize: '18px' } }, props.t ? props.t('title') : 'makeworld 工作台'),
          h('p', { style: { margin: 0, color: C.muted, fontSize: '12px' } }, props.t ? props.t('subtitle') : '平台设置：Git Bash 环境诊断与 MCP 服务器。账本在会话顶栏的「账本」页签里。')),
        h('nav', { style: S.tabBar, 'data-testid': 'makeworld-tabbar' },
          tabDefs.map(item => h('button', {
            key: item.id,
            type: 'button',
            style: tab === item.id ? { ...S.tab, ...S.tabActive } : S.tab,
            'aria-pressed': tab === item.id,
            onClick: () => setTab(item.id),
          }, item.label))),
        h('div', { style: { flex: 1, minHeight: 0 } },
          tab === 'mcp' ? h(McpPanel) : h(EnvironmentPanel)))
    }

    /** Required client services: slot registry and locale dictionaries. */
    const inject = ['slots', 'locale']

    /**
     * Register the platform control panel: the main view body and the
     * sidebar entry point.
     * @param {object} ctx - client root context.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'makeworld:dictionaries')
      // Styling the ledger page cannot express through inline styles: hover,
      // focus rings, one breakpoint, and the composer's dashed workspace-trigger
      // frame (see LEDGER_CSS). Every selector is anchored on this view, so no
      // rule can silence another view's UI — the thing dsh-lingeye's global
      // `[data-width-handle] { display:none !important }` did.
      ctx.effect(() => {
        if (typeof document === 'undefined' || document.head === undefined) return undefined
        const style = document.createElement('style')
        style.dataset.makeworld = 'ledger'
        style.textContent = LEDGER_CSS
        document.head.append(style)
        return () => style.remove()
      }, 'makeworld:ledger-styles')
      const t = ctx.locale.bind(NS)
      ctx.slots.inject('main', () => ctx.slots.register({
        name: 'main',
        key: 'makeworld-panel',
        locale: NS,
      }, MakeworldPanel))
      ctx.slots.inject('conversation.view', () => ctx.slots.register({
        name: 'conversation.view',
        id: 'makeworld-ledger',
        order: 40,
        locale: NS,
        label: () => t('ledger'),
      }, (props) => h(LedgerPanel, { sessionId: props.sessionId, t: props.t, useProjection: props.useProjection })))
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist',
        id: 'makeworld-panel',
        order: 30,
        locale: NS,
        label: () => t('panel'),
      }, MakeworldIcon))
    }

    exports.apply = apply
    exports.inject = inject
    /* Pure helpers exposed for the stub-host tests: the factory is the only
       place they exist, so tests reach them through the module exports. */
    exports.__test = {
      parseMarkdown, parseInline, markdownNodes, LEDGER_CSS,
      dictionaries: { zh, en },
      /* The colour tokens, so a test can assert the surface ladder by identity. */
      tokens: C,
      LedgerPanel, EnvironmentPanel, McpPanel, CoverageCard, FrontierCard, ReviewCard, GapsCard, HealthCard, ReportCard, SyncBadge, Card, tag,
      useLiveLedger,
    }
    return module.exports
  },
})
