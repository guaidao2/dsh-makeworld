# legacy/

`dsh-lingeye` 0.6.1 的渗透测试层，原样留着做参考，**不挂载、不随包发布**。

- `src/commander.js` / `worker.js` / `retest.js` / `instructions.js`：35 个 `ly_*` 工具、worker 与 retest 协议。
- `presets/lingeye.patch.yml`：九个 agent 预设。
- `tests/compat.test.js` / `mcp.test.js` / `project.test.js`：读的是上面这些文件，路径仍写 `../src/`，`npm test` 不跑它们，直接跑会 ENOENT。
  其中 `compat.test.js` 还断言 `legacy/src/pwsh-gate.js` 存在——那个文件已经随「不再挂载 pwsh gate」一起删了，所以它连修都不用修。
  留着是为了保留「旧版长什么样」的可执行证据，不是可运行的对照。

平台层（Git Bash / MCP / 环境诊断 / ACL 补丁）没有搬进 legacy：那些代码仍在 `src/`，测试也在 `tests/` 里正常跑。

要复活某个旧工具：把它从 `legacy/src` 移回 `src/`，按当时平台层的服务名（现在是 `makeworldPlatform`）改 `inject`，再在 `cordis.patch.yml` 里加一行。注意旧工具的 `ly_*` 全都依赖 `makeworldStore` 里那些已经删掉的方法（engagement / intent / finding 等），真要复活得连 store 一起恢复。
