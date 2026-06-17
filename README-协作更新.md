# 项目协作更新说明

本文档用于说明：当你的工作伙伴拉下项目、修改并推送到远端仓库后，lxy 本机应该如何安全更新。

默认仓库：

```bash
git@github.com:lxyyouknow/bagminigame.git
```

## 最常用更新流程

如果你本地没有未提交改动，平时直接执行下面这套：

```bash
cd /Users/lxy/MiniGameWork/backpack-mini-game
git status
git pull --rebase
npm install
npm run build
```

说明：

- `git status`：先确认本地是否干净。
- `git pull --rebase`：拉取伙伴最新提交，并把你本地提交排在后面，提交历史更干净。
- `npm install`：如果对方改了依赖，顺手同步。
- `npm run build`：确认拉下来的版本至少能正常构建。

如果只是日常同步，优先记住这一套就够了。

## 场景 1：本地没有改动

如果 `git status` 显示工作区干净：

```bash
git pull --rebase
```

拉完后建议再执行：

```bash
npm install
npm run build
```

如果你还想顺手本地启动看看：

```bash
npm run dev
```

或者直接双击根目录启动脚本。

## 场景 2：本地已经改了代码，而且这些改动要保留

先把你自己的改动提交，再更新远端：

```bash
git add -A
git commit -m "你的修改说明"
git pull --rebase
```

如果远端和你改的是不同内容，通常会自动完成。

如果有冲突，处理方式见后面的“冲突处理”。

## 场景 3：本地改动还不想提交，但又想先更新远端

可以先把当前改动临时收起来：

```bash
git stash
git pull --rebase
git stash pop
```

说明：

- `git stash`：临时保存当前未提交改动。
- `git stash pop`：把刚才临时存起来的改动再恢复回来。

如果 `stash pop` 后有冲突，也按后面的“冲突处理”来。

## 场景 4：本地改动只是临时测试，不需要保留

如果你确认本地改动都不要了，可以先丢弃再更新：

```bash
git reset --hard HEAD
git pull --rebase
```

注意：

- 这条命令会直接丢掉你当前所有未提交改动。
- 执行前一定先确认没有要保留的内容。

## 冲突处理

如果执行 `git pull --rebase` 后出现冲突：

1. 先看哪些文件冲突了：

```bash
git status
```

2. 打开冲突文件，处理冲突标记：

```text
<<<<<<< HEAD
本地内容
=======
远端内容
>>>>>>> xxxxx
```

处理方式通常是：

- 保留本地版本
- 保留远端版本
- 或者把两边内容合并成最终正确版本

3. 改完后标记已解决：

```bash
git add 冲突文件
```

4. 继续 rebase：

```bash
git rebase --continue
```

5. 如果还有下一个冲突，就继续重复上面的步骤。

如果你不想继续这次更新流程，可以取消：

```bash
git rebase --abort
```

## 更新后建议检查

伙伴推完代码后，你本地更新完成，建议至少做下面这些检查：

```bash
npm install
npm run build
```

如果这轮改动涉及存档、广告、埋点、生命周期、UI 布局，建议再执行：

```bash
npm run test:save
npm run test:analytics
npm run test:ad
npm run test:lifecycle
npm run test:ui-layout
```

如果这轮改动涉及启动链路、Loading、主界面或战斗流程，建议再实际打开游戏验证一次：

```bash
npm run dev
```

然后浏览器访问实际输出端口对应的 `game.html`，不要想当然写死 `5173`。

## 推荐日常习惯

推荐你以后每次开工前先执行：

```bash
cd /Users/lxy/MiniGameWork/backpack-mini-game
git status
git pull --rebase
```

这样可以减少下面这些问题：

- 你在旧代码上继续改，后面更容易冲突。
- 你以为自己看到的是最新版本，其实伙伴已经推了新逻辑。
- 启动脚本、数据表、测试脚本、资源配置已经变了，但你本地还没同步。

## 不要踩的坑

- 不要在有重要未提交改动时直接执行 `git reset --hard HEAD`。
- 不要习惯性用 `git pull` 不看结果，最好看一眼有没有冲突、有没有新依赖。
- 不要只拉代码不验证，至少跑一次 `npm run build`。
- 如果启动脚本打印的新端口不是 `5173`，浏览器和手机都要访问新端口。
- 如果更新后卡在 Loading，优先按项目里的 [AGENTS.md](/Users/lxy/MiniGameWork/backpack-mini-game/AGENTS.md) 里“Loading 卡住排查约定”处理。

## 一套最省心的记忆版

平时最常用就记住这 4 行：

```bash
cd /Users/lxy/MiniGameWork/backpack-mini-game
git status
git pull --rebase
npm run build
```

如果本地有改动不想提交，就先：

```bash
git stash
git pull --rebase
git stash pop
```

这份说明的目标不是覆盖所有 Git 场景，而是保证你和伙伴日常协作时，能快速、稳定地把项目同步到最新版本。
