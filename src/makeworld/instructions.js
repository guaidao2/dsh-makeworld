/**
 * The one prompt section this plugin adds.
 *
 * Short on purpose: the previous version of this plugin shipped nine presets
 * and a long protocol, and models still skipped the discipline. Four rules and
 * one loop fit in a screen, so they survive a long session and a compaction.
 *
 * @module dsh-makeworld/instructions
 */

/** Prompt section name contributed by the tools row. */
export const LEDGER_SECTION = 'makeworld:ledger'

/** Section order: next to the tool-guidance band. */
export const SECTION_ORDER = 2410

export const LEDGER_PROTOCOL = `当任务跨多轮、有多个待验证的假设、或者要交给别人复核时，用账本（工作目录下的 .cairn/）记信念与缺口。一次性改动、单次问答不要开场。

【四条纪律】
1. 事实不是真相，是信念。写事实必须给 basis：observed（亲眼看到）/ inferred（推导）/ assumed（没验证的假设）/ negative（查过，没有或被挡住，要写清查了哪条路）。没有实际观测就不要写 observed。
2. 意图是实验，不是待办。写清 expectedObservation：看到什么算确认、看到什么算否掉；能分开几个假设就写进 decides。失败也是结果，落 negative 事实，不要静默丢掉。
3. 结论（claim）要么锚到证据，否则它只是猜测，不要写进「已确认结论」；旧的结论被推翻就用 settle refuted，别改历史。
4. 报告要写缺口：还依赖哪些假设、哪些路被排除、哪些东西没碰过。没发现不等于不存在。

【循环】
0. 值得记账就先 cairn_open：写清主体、目的、验收标准与约束。它决定报告标题，别省。
1. cairn_read（默认 next）：看前沿与缺口，挑一条最能改变判断的实验，而不是平铺覆盖。
2. cairn_write 记实体与意图，然后去执行。观测写成事实并附证据；批内可以用 alias，后面的记录用 "$名字" 引用前面建立的 id。
3. cairn_settle 收口：意图 done 或 blocked，目标 met，结论 holds 或 refuted（会额外留一条复核记录，原结论不被改写）。
4. 用户要交付物时才 cairn_export；没这个需求就别往仓库里写文件。

【边界】
- 待办仍用 todo_write，跨轮继续仍用 create_goal。账本不替代它们，也不重造调度。
- 账本只追加：改判断用新的 settle 或新事实，不要改写历史。
- 账本是给人看的：LEDGER.md 要能独立读懂，别写只有你自己知道的缩写。
- 路径是 <工作目录>/.cairn/；cairn_open 与 cairn_read 都会回显绝对路径。`
