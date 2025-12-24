# 与上游仓库同步指南 (Rebase 方式)

## 仓库说明

| 名称 | 地址 | 说明 |
|------|------|------|
| **origin (本地)** | `git@github.com:lofyer/AIClient-2-API.git` | 我们的 fork 仓库 |
| **upstream (上游)** | `https://github.com/justlovemaki/AIClient-2-API.git` | 原始上游仓库 |

## 初始设置（仅需一次）

```bash
# 添加上游仓库
git remote add upstream https://github.com/justlovemaki/AIClient-2-API.git

# 启用 rerere，让 git 记住冲突解决方案
git config rerere.enabled true
```

## 日常同步流程

```bash
# 1. 确保工作区干净
git status

# 2. 获取上游最新代码
git fetch upstream

# 3. 将本地提交变基到上游最新
git rebase upstream/main

# 4. 如有冲突，解决后继续
git add <conflicted-files>
git rebase --continue

# 5. 强制推送到你的 fork
git push origin main --force
```

## 冲突解决技巧

### 查看冲突文件
```bash
git status
```

### 查找冲突标记
```bash
grep -rn "<<<<<<< HEAD" .
```

### 冲突标记说明
```
<<<<<<< HEAD
你的代码
=======
上游的代码
>>>>>>> upstream/main
```

### 解决策略
- **保留你的**: 删除上游代码和标记
- **保留上游**: 删除你的代码和标记
- **合并两者**: 手动整合两边的修改

### 放弃本次 rebase
```bash
git rebase --abort
```

## 减少冲突的最佳实践

1. **频繁同步** - 每周至少同步一次
2. **小提交** - 每个功能独立提交
3. **避免修改核心文件** - 尽量扩展而非修改
4. **新功能用新文件** - 减少与上游的交集

## 本地修改注意事项

### 首页路由修改
为避免 `index.html` 合并冲突，本项目做了以下调整：
- 将当前版本的 `static/index.html` 复制为 `static/index-v2.html`
- 修改 `src/ui-manager.js` 中的 `serveStaticFiles` 函数，使 `/` 和 `/index.html` 路由指向 `index-v2.html`
- 上游的 `index.html` 可以直接合并，不会影响本项目的前端页面

**合并上游时**：直接接受上游的 `static/index.html` 变更即可，本项目使用的是 `index-v2.html`。

## 常见问题

### EDITOR 未设置
```bash
GIT_EDITOR=true git rebase --continue
```

### 查看上游地址
```bash
git remote -v
```

### 比较与上游的差异
```bash
git log upstream/main..main --oneline
```
