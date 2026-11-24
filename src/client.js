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
      score: '分',
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
      inconsistent: '账本不一致',
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
      inconsistent: 'Ledger inconsistencies',
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

    /** Read the host's read-only ledger snapshot for one session. */
    function useLedger(sessionId, nonce) {
      const [state, setState] = React.useState({ status: 'idle' })
      React.useEffect(() => {
        if (sessionId === undefined || sessionId === null || sessionId === '') {
          setState({ status: 'no-session' })
          return undefined
        }
        let live = true
        setState({ status: 'loading' })
        fetch('/makeworld/ledger?session=' + encodeURIComponent(String(sessionId)), { cache: 'no-store', credentials: 'same-origin' })
          .then(async (response) => {
            const value = await response.json()
            if (!response.ok) throw new Error(value.error || ('HTTP ' + response.status))
            if (live) setState({ status: 'ready', data: value })
          })
          .catch((error) => {
            if (live) setState({ status: 'error', error: error instanceof Error ? error.message : String(error) })
          })
        return () => { live = false }
      }, [sessionId, nonce])
      return state
    }

    function Section({ title, hint, children }) {
      return h('section', { style: S.card },
        h('h2', { style: S.cardTitle }, h('span', null, title), hint ? h('span', { style: { ...S.faint, fontSize: '11px', fontWeight: 400 } }, hint) : null),
        children)
    }

    function Empty({ text }) {
      return h('p', { style: { margin: 0, color: C.faint, fontSize: '12px' } }, text)
    }

    function List({ items, render, empty }) {
      if (items.length === 0) return Empty({ text: empty })
      return h('ul', { style: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: '4px' } },
        items.map((item, index) => h('li', {
          key: String(index),
          style: {
            display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'baseline',
            fontSize: '12px', lineHeight: 1.5, minWidth: 0, overflowWrap: 'anywhere',
          },
        }, ...render(item))))
    }

    /* ------------------------------- ledger view ------------------------- */

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

    const REVIEW_LABEL = {
      incomplete: ['未完成', 'incomplete'], satisfied: ['已满足', 'satisfied'], deferred: ['已搁置', 'deferred'],
      blocked: ['被阻塞', 'blocked'], assumption: ['仍是假设', 'assumption'], stale: ['已失效', 'stale'],
      unsupported: ['没有证据', 'unsupported'], untested: ['未被观测', 'untested'], dangling: ['引用悬空', 'dangling'],
      'wrong-kind': ['引用类型错', 'wrong kind'], malformed: ['坏行', 'malformed'],
    }

    /** Read-only ledger view: objective, coverage, frontier, open items, gaps. */
    function LedgerPanel({ sessionId, t }) {
      const label = (key, fallback) => (t ? t(key) : fallback)
      const [nonce, setNonce] = React.useState(0)
      const [report, setReport] = React.useState(null)
      const state = useLedger(sessionId, nonce)

      const refresh = () => {
        setReport(null)
        setNonce(n => n + 1)
      }

      const openReport = () => {
        if (sessionId === undefined) return
        setReport({ status: 'loading' })
        fetch('/makeworld/ledger?session=' + encodeURIComponent(String(sessionId)) + '&view=report', { cache: 'no-store', credentials: 'same-origin' })
          .then(async (response) => {
            const value = await response.json()
            if (!response.ok) throw new Error(value.error || ('HTTP ' + response.status))
            setReport({ status: 'ready', markdown: value.markdown || '' })
          })
          .catch((error) => setReport({ status: 'error', error: error instanceof Error ? error.message : String(error) }))
      }

      const data = state.status === 'ready' ? state.data : undefined
      const task = data && data.task ? data.task : undefined

      const header = h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '10px' } },
        h('h2', { style: { margin: 0, fontSize: '16px', minWidth: 0, overflowWrap: 'anywhere' } },
          (task && task.objective) || label('ledger', '账本')),
        task && task.subject ? h('span', { style: S.faint }, task.subject) : null,
        h('span', { style: { flex: 1 } }),
        h('button', { type: 'button', style: S.button, onClick: refresh }, label('refresh', '刷新')),
        h('button', { type: 'button', style: S.button, onClick: openReport, disabled: sessionId === undefined }, label('report', '看报告')))

      const reportBlock = report === null ? null : h(Section, { title: label('report', '看报告') },
        report.status === 'loading' ? Empty({ text: label('loading', '正在读账本…') })
          : report.status === 'error' ? Empty({ text: report.error })
            : h('pre', { style: { margin: 0, maxHeight: '420px', overflow: 'auto', fontSize: '11px', lineHeight: 1.5, whiteSpace: 'pre-wrap' } }, report.markdown),
        h('button', { type: 'button', style: { ...S.button, marginTop: '8px' }, onClick: () => setReport(null) }, label('close', '关闭')))

      const health = data === undefined ? [] : [
        ...(data.broken ? [{
          id: String(data.broken),
          // "not counted" only means something once something was counted.
          text: `有 ${data.broken} 行日志无法解析（第 ${(data.brokenLines || []).join(', ')} 行）`
            + (data.initialized ? '，这些记录没有计入总数' : ''),
          color: C.error,
          status: 'malformed',
        }] : []),
        ...(data.ledgerProblems || []).map(problem => ({
          id: problem.id ?? String(problem.seq ?? ''),
          text: [
            problem.owner ? problem.owner + ' 的 ' : '',
            problem.field ?? '',
            problem.value ? ' → ' + problem.value : '',
            problem.expected ? `（应为 ${problem.expected}）` : '',
          ].join(''),
          status: HEALTH_STATUS[problem.kind] || 'malformed',
          color: C.warn,
        })),
      ]
      const healthCount = (data && data.ledgerProblemCount ? data.ledgerProblemCount : 0) + ((data && data.broken) || 0)
      const healthBlock = health.length === 0 ? null : h(Section, { title: label('inconsistent', '账本不一致'), hint: String(healthCount || health.length) },
        h(List, {
          items: health,
          empty: label('none', '（无）'),
          render: item => [
            badge(item.status ? label(`status.${item.status}`, item.status) : label('status.malformed', '坏行'), item.color),
            h('span', null, item.text),
          ],
        }))

      let body
      if (state.status === 'no-session') body = Empty({ text: label('noSession', '没有可读取的会话。') })
      else if (state.status === 'loading' || state.status === 'idle') body = Empty({ text: label('loading', '正在读账本…') })
      else if (state.status === 'error') body = Empty({ text: state.error })
      else if (!data.initialized) {
        const onlyBroken = (data.broken || 0) > 0
        body = h('div', { style: { display: 'grid', gap: '10px' } },
          healthBlock,
          Empty({ text: onlyBroken ? label('emptyBroken', '账本读不出任何记录，先修好上面列出的行；或用 cairn_open({reset:true}) 归档重开。') : label('empty', '这个会话还没有开场。') }),
          h('code', { style: { ...S.faint, fontSize: '11px', wordBreak: 'break-all' } }, data.ledger || ''))
      } else {
        const coverage = data.coverage || { total: 0, evidenced: 0, observed: 0, untouched: 0, entities: [] }
        const reviewItems = (data.review || []).filter(item => item.kind !== 'reference' && item.kind !== 'ledger')
        const total = Math.max(1, coverage.total)
        const gaps = data.gaps || {}
        body = h('div', { style: { display: 'grid', gap: '12px' } },
          healthBlock,
          h(Section, { title: label('coverage', '覆盖'), hint: `${coverage.evidenced} / ${coverage.total}` },
            h('div', { style: { display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: C.layer2 } },
              h('div', { style: { width: ((coverage.evidenced / total) * 100) + '%', background: C.success } }),
              h('div', { style: { width: ((coverage.observed / total) * 100) + '%', background: C.warn } }),
              h('div', { style: { flex: 1, background: C.layer2, borderLeft: `1px dashed ${C.faint}` } })),
            h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px', fontSize: '11px' } },
              h('span', { style: S.faint }, `${label('evidenced', '有证据')} ${coverage.evidenced}`),
              h('span', { style: S.faint }, `${label('observed', '有观测')} ${coverage.observed}`),
              h('span', { style: S.faint }, `${label('untouched', '未触及')} ${coverage.untouched}`),
              h('span', { style: { flex: 1 } }),
              Object.keys(FAMILY_LABEL).map(key => badge(`${label(`family.${key}`, FAMILY_LABEL[key][0])} ${(data.counts || {})[key] || 0}`, C.muted)))),
          h(Section, { title: label('frontier', '前沿') },
            h(List, {
              items: data.frontier || [],
              empty: label('none', '（无）'),
              render: (item) => [
                badge(`${item.score} ${label('score', '分')}`, item.ready ? C.success : C.warn),
                h('span', { style: { fontWeight: 500 } }, item.title),
                item.ready ? null : h('span', { style: S.faint }, `${label('notReady', '待前置')} ${(item.missingDeps || []).join(', ')}`),
                item.expectedObservation ? h('span', { style: S.faint }, `· ${item.expectedObservation}`) : null,
              ].filter(Boolean),
            })),
          h(Section, { title: label('review', '待处理'), hint: String(reviewItems.length) },
            h(List, {
              items: reviewItems.slice(0, 12),
              empty: label('none', '（无）'),
              render: (item) => {
                const fallback = REVIEW_LABEL[item.status] || [item.status, item.status]
                return [badge(label(`status.${item.status}`, fallback[0]), item.status === 'blocked' || item.status === 'malformed' ? C.error : C.muted), h('span', null, item.text)]
              },
            })),
          h(Section, { title: label('gaps', '缺口') },
            h('div', { style: { display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' } },
              h('div', null, h('div', { style: S.kvLabel }, label('assumed', '仍依赖的假设')),
                h(List, { items: gaps.assumed || [], empty: label('none', '（无）'), render: (item) => [badge(item.id, C.warn), h('span', null, item.text)] })),
              h('div', null, h('div', { style: S.kvLabel }, label('negative', '已排除')),
                h(List, { items: gaps.negative || [], empty: label('none', '（无）'), render: (item) => [badge(item.id, C.error), h('span', null, item.text)] })),
              h('div', null, h('div', { style: S.kvLabel }, label('untested', '未触及')),
                h(List, { items: gaps.untestedEntities || [], empty: label('none', '（无）'), render: (item) => [badge(item.id, C.faint), h('span', null, `${item.type || ''} ${item.value}`)] })),
              h('div', null, h('div', { style: S.kvLabel }, label('unsupported', '未定论结论')),
                h(List, { items: gaps.unsupportedClaims || [], empty: label('none', '（无）'), render: (item) => [badge(item.id, C.info), h('span', null, item.title)] })))),
        )
      }

      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }, 'data-testid': 'makeworld-ledger' },
        header,
        reportBlock,
        body)
    }

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
      }, (props) => h(LedgerPanel, { sessionId: props.sessionId, t: props.t })))
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
    return module.exports
  },
})
