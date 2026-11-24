# dsh-makeworld

> use the less, make more.

作者：guaidao2 & coolmoon

DeepSeek Harness 的任务账本插件。它给会话一份只追加的账本：记录**你现在相信什么**、**还缺什么**，而不是又一份待办清单。

账本叫 cairn（石堆路标）：每走一步放一块石头，后来的人——和后来的你——能顺着走。工具前缀 `cairn_`、目录 `.cairn/`，跟项目名 makeworld 各叫各的。

不是模式，是能力层。账本行挂在 profile root，所有 preset 的会话都继承；没有「makeworld 模式」要进。

## 它解决什么

长任务最容易坏在两处：把假设当结论，把「碰过」当「测过」。这两个错误都不会报错，只会让最后那份总结慢慢失真。

所以账本记三样东西：每条事实带 `basis`（亲眼看到 / 推导 / 假设 / 查过没有），每条意图带 `expectedObservation`（看到什么算确认、看到什么算否掉），每条结论要么锚到证据，要么它只是猜测、进不了「已确认结论」。报告里固定有一节写缺口：还依赖哪些假设、哪些路被排除、哪些东西没碰过。

## 五个工具

| 工具 | 作用 |
| --- | --- |
| `cairn_open` | 开场：主体、目的、验收、约束。落在 `<工作目录>/.cairn/` |
| `cairn_write` | 唯一的写入口，批量。`kind` 选家族：goal / intent / fact / claim / entity / evidence / chain / plan / constraint / hint / note / template |
| `cairn_read` | 默认返回前沿与缺口；`state` / `coverage` / `review` / `report` / `ledger` / `templates` / `counterfactual` 换视图（反事实要传 `remove`） |
| `cairn_settle` | 判定：意图 done/blocked、目标 met、结论 holds/refuted、证据 retire（退役会把它唯一支撑的事实标 stale、把依赖它的结论退回 pending） |
| `cairn_export` | 产出 `report.md`、`claims.json`、`coverage.json` |

批内可以用 `alias` 加 `"$别名"` 互相引用，省一轮往返：

```json
{ "records": [
  { "kind": "entity", "alias": "mod", "type": "module", "value": "src/cache.js" },
  { "kind": "evidence", "alias": "log", "label": "测试输出", "content": "expected fresh, got stale" },
  { "kind": "fact", "detail": "第二次读返回旧值", "basis": "observed",
    "evidenceIds": ["$log"], "entityIds": ["$mod"] }
] }
```

## 账本是文件

```
<工作目录>/.cairn/
  ledger.jsonl              只追加，一行一条事件，这是唯一真相
  LEDGER.md                 人读视图，随时可由 jsonl 重建
  evidence/<sha>.txt        证据正文，按内容寻址
  report.md                 cairn_export 产出
  claims.json / coverage.json
  ledger.<时间戳>.jsonl     cairn_open(reset) 归档的旧账本，不删除
```

一行长这样：

```json
{"seq":7,"at":"2026-11-24T05:41:02.118Z","actor":"lead","op":"record.add","id":"f-2",
 "body":{"kind":"fact","basis":"observed","detail":"冷启动 210ms","evidenceIds":["e-1"]}}
```

好处都很朴素：`cat` 就能看，git 能 diff，子 agent 读文件就能共享，profile 重置也不丢。改判断靠追加新事件，旧结论永远留在账本里。

同一工作目录下的会话共用这一份账本——这也是「跨会话」最朴素的做法：新会话打开就能读到之前的信念与关系模板。注意 header 是单槽：后开的 `cairn_open` 会重写主体与目的（`openedAt` 保留），记录和约束不会丢。

想把账本当交付物就提交它；不想就把它加进 `.gitignore`。

## 三个不常见但有用的动作

**证据退役**：`cairn_settle({ref:'e-3', verdict:'retire'})`。证据作废时，只靠它支撑的事实自动变 stale，依赖它的结论退回 pending 并升 `evidenceVersion`——不用手工去翻哪条结论会被带倒。

**反事实**：`cairn_read({view:'counterfactual', remove:['e-3']})`。抽掉一条证据重放，看覆盖率塌多少、哪条结论失去支撑、出现几条悬空边。只读，不写账本。

**关系模板**：`cairn_write({records:[{kind:'template', pre:'存在未鉴权入口', action:'带同一组参数直连', observation:'返回 200 且带数据体', post:'该入口可被未授权访问'}]})`。跨目标能复用的是「前置条件 → 动作 → 观测」的结构，不是具体 payload 或版本号。`cairn_read({view:'templates'})` 列出来。

## 四条纪律

1. 没有实际观测，不要写 `observed`。查过没有、被什么挡住，写 `negative`。
2. 失败也是结果。落一条 negative 事实，不要静默丢掉。
3. 结论要么锚证据，否则它只是猜测，不能进「已确认结论」；旧的结论被推翻就用 `settle refuted`。
4. 报告要写缺口：还依赖哪些假设、哪些路被排除、哪些没碰过。

系统提示词里就是这四条加一个循环，长一点就会被跳过。

## 与灵眼的关系

它的前身是 [dsh-lingeye](https://github.com/guaidao2/dsh-lingeye)（灵眼渗透测试模式）。继承的是内核：信念四态、意图即实验、证据锚定、三档覆盖、可复核结论、可逆遗忘。换掉的是壳：35 个工具降到 5 个，九个子 agent 预设砍掉，领域词表换成通用词（asset→entity、finding→claim、retest→recheck），八页签 Web 面改成文件账本，不再要求「进入模式」。

设计取舍与诊断写在 [docs/makeworld-design.md](docs/makeworld-design.md)。

## 安装

需要 DSH `>= 0.2.2-rc.1 < 0.3.0`。

```powershell
dsh plugin --profile web add <path-to-dsh-makeworld>
```

装完重启。工具与提示词行挂在 profile root，所以任何 preset 的会话都能用；不想要账本就 `config: { promptSection: false }` 关掉提示词段，或者直接把 `makeworld-tools` 这一行 disable。

## 包里的行

认知层与平台层在同一个包里，但彼此独立，各自由人决定开不开：

| 行 | 是什么 |
| --- | --- |
| `makeworld-ledger` / `makeworld-tools` | 账本与五个工具（认知层） |
| `makeworld-acl-patch` | Windows 非系统盘工作区的沙箱变通（内置 MIT 补丁，默认开） |
| `makeworld-gitbash` | 可选 Git Bash，开启后多一个 `bash`，并拒绝对 `pwsh` 的调用（默认关）。`pwsh` 的定义仍来自 base bundle，工具列表里还看得见；要彻底去掉就在 preset 里 disable `tool-pwsh` |
| `makeworld-environment` | 只读诊断：Git Bash 状态、`dsh-auth-*` cookie 数量与请求头大小；面板走 `/makeworld/environment` |
| `makeworld-mcp` | MCP 桥，复用官方 `@deepseek-ai/dsh-mcp-client`；面板走 `/makeworld/mcp` |
| `makeworld-ui` | 网页端控制面板：环境增强（Git Bash / cookie）与 MCP 配置两块。账本本身没有界面，页签已随旧模式一起删掉 |

平台层的数据域在 0.1.0 从 `lingeye` 改名为 `makeworld`，没有做迁移：旧的 Git Bash 开关与 MCP 服务器列表需要在新面板里重填一次。账本不受影响（它不在存储域里）。

关掉任何一行，账本照常工作。反过来也一样，只有一处例外：`makeworld-gitbash` 依赖 `makeworld-environment` 的设置，关掉 environment 那行 bash 会一起消失（启动诊断里会看到它 pending，等 `makeworldEnvironment`）。

## 开发

无构建步骤：宿主半是 ESM JavaScript。

```powershell
npm test
```

账本侧 58 个测试：折叠、三档覆盖、就绪排序、报告缺口、原子批、严格 settle、证据退役级联、反事实、关系模板、悬空与错族引用、id 防伪、证据寻址、旧格式兼容，以及文件层 open → write（含 alias）→ settle → export 全流程；平台层 19 个（ACL 补丁 / Git Bash / 环境 / MCP）。

## 许可

MIT。Copyright (c) 2026 guaidao2 & coolmoon。内置的 Windows ACL 修复来自 [dsh-acl-sandbox-patch](https://github.com/masknull/dsh-acl-sandbox-patch)（MIT），Git Bash 环境增强改编自 dsh-gitbash（MIT），署名与许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
