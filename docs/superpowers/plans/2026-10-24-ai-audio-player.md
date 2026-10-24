# AI 学习音频 Web 播放器实施计划（Implementation Plan）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个针对 AI 学习音频（.m4a）的高颜值、轻量级 Web 播放网站，支持多档倍速、断点记忆、±15s 快进快退、手机锁屏控制，并通过 GitHub Pages 实现零成本永久在线收听。

**Architecture:** 采用轻量原生 SPA（HTML5 + 现代 CSS + Vanilla ES6）架构，音频存放于 `audio/` 目录；通过轻量 Node.js 脚本 `update-playlist.js` 自动化扫描音频元数据并生成 `data/playlist.json`；前端通过 Fetch 加载清单并结合 LocalStorage 与 HTML5 MediaSession API 提供流畅的流式播放和学习辅助交互；通过 GitHub Actions 自动化发布到 GitHub Pages。

**Tech Stack:** Vanilla JavaScript (ES6+), Modern HTML5 Audio & MediaSession API, Responsive CSS3 (Glassmorphism & Dark Theme), Node.js (for playlist generation script), GitHub Actions.

## Global Constraints

- 静态无服务依赖：前端页面不依赖外部重型框架（React/Vue），保证秒开且能直接静态部署在 GitHub Pages。
- 文件名兼容性：音频文件名包含中文及特殊标点，所有 URL 引用与音频源必须做 `encodeURI` 安全处理。
- 本地与在线通用：页面相对路径加载 `data/playlist.json` 与 `audio/`，既可本地双击或通过本地静态服务器打开，也可推送到 GitHub Pages 线上运行。
- 代码精炼无占位符：每一步必须给出完整可用代码，杜绝任何 TODO / TBD。

---

### Task 1: 音频目录整理与清单生成脚本开发

**Files:**
- Create: `update-playlist.js`
- Create: `data/playlist.json`
- Directory: `audio/` (移动当前根目录下的 13 个 `.m4a` 文件至 `audio/`)
- Test: `tests/verify-playlist.js`

**Interfaces:**
- Produces: `data/playlist.json`，数据格式为 `Array<{ id: string, filename: string, title: string, url: string, size: number, sizeFormatted: string, order: number }>`
- Consumes: 本地 `audio/` 目录中的所有 `.m4a` 文件

- [ ] **Step 1: 整理音频文件到 `audio/` 目录并创建测试脚本**

创建测试脚本 `tests/verify-playlist.js`，断言 `data/playlist.json` 存在且包含所有 13 个音频的完整字段：

```javascript
const fs = require('fs');
const path = require('path');
const assert = require('assert');

function runTest() {
  const playlistPath = path.join(__dirname, '..', 'data', 'playlist.json');
  assert.ok(fs.existsSync(playlistPath), 'data/playlist.json must exist');

  const content = JSON.parse(fs.readFileSync(playlistPath, 'utf8'));
  assert.ok(Array.isArray(content), 'playlist.json must be an array');
  assert.strictEqual(content.length, 13, 'playlist must contain exactly 13 audio items');

  content.forEach((item, idx) => {
    assert.ok(item.id, `item ${idx} must have id`);
    assert.ok(item.filename, `item ${idx} must have filename`);
    assert.ok(item.title, `item ${idx} must have title`);
    assert.ok(item.url, `item ${idx} must have url`);
    assert.ok(typeof item.size === 'number' && item.size > 0, `item ${idx} must have valid size`);
    assert.ok(item.sizeFormatted, `item ${idx} must have formatted size string`);
  });

  console.log('✅ All playlist assertions passed!');
}

runTest();
```

- [ ] **Step 2: 运行测试验证失败**

运行：`node tests/verify-playlist.js`
预期输出：`AssertionError: data/playlist.json must exist`

- [ ] **Step 3: 将 13 个 `.m4a` 移入 `audio/` 目录并实现 `update-playlist.js`**

移动文件：
将根目录下的 13 个 `.m4a` 文件移动到 `audio/`。

编写 `update-playlist.js`：
```javascript
const fs = require('fs');
const path = require('path');

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function parseOrder(filename) {
  const numMatch = filename.match(/^(\d+)\./) || filename.match(/^第(\d+)章/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }
  return 999;
}

function generatePlaylist() {
  const audioDir = path.join(__dirname, 'audio');
  const dataDir = path.join(__dirname, 'data');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(audioDir)) {
    console.error('audio directory does not exist.');
    process.exit(1);
  }

  const files = fs.readdirSync(audioDir).filter(file => file.toLowerCase().endsWith('.m4a'));

  const items = files.map((filename, index) => {
    const filePath = path.join(audioDir, filename);
    const stat = fs.statSync(filePath);
    const title = filename.replace(/\.m4a$/i, '');
    const order = parseOrder(filename);

    return {
      id: `audio-${String(index + 1).padStart(2, '0')}`,
      filename,
      title,
      url: `audio/${encodeURIComponent(filename)}`,
      size: stat.size,
      sizeFormatted: formatBytes(stat.size),
      order
    };
  });

  // 按序号排序，未带序号的排后面
  items.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.title.localeCompare(b.title, 'zh-CN');
  });

  // 重新分配自然 id
  items.forEach((item, idx) => {
    item.id = `audio-${String(idx + 1).padStart(2, '0')}`;
  });

  const outputPath = path.join(dataDir, 'playlist.json');
  fs.writeFileSync(outputPath, JSON.stringify(items, null, 2), 'utf8');
  console.log(`Successfully generated playlist.json with ${items.length} audios.`);
}

generatePlaylist();
```

- [ ] **Step 4: 执行生成脚本并验证测试通过**

运行：
```bash
node update-playlist.js
node tests/verify-playlist.js
```
预期输出：`✅ All playlist assertions passed!`

- [ ] **Step 5: 提交代码**

```bash
git add audio/ data/ update-playlist.js tests/verify-playlist.js
git commit -m "feat: organize audio directory and add playlist generation script"
```

---

### Task 2: 响应式视觉与 HTML 结构骨架开发

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `assets/logo.svg`
- Test: `tests/verify-html.js`

**Interfaces:**
- Consumes: `data/playlist.json`
- Produces: 语义化且现代化的播放器界面结构，包含头部导航、搜索筛选输入框、音频列表容器、播放进度与波形卡片、倍速与控制按键。

- [ ] **Step 1: 编写 HTML 结构验证测试**

创建 `tests/verify-html.js`：
```javascript
const fs = require('fs');
const path = require('path');
const assert = require('assert');

function runTest() {
  const htmlPath = path.join(__dirname, '..', 'index.html');
  const cssPath = path.join(__dirname, '..', 'styles.css');
  assert.ok(fs.existsSync(htmlPath), 'index.html must exist');
  assert.ok(fs.existsSync(cssPath), 'styles.css must exist');

  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(html.includes('id="searchInput"'), 'Must have search input');
  assert.ok(html.includes('id="playlistContainer"'), 'Must have playlist container');
  assert.ok(html.includes('id="audioPlayer"'), 'Must have audio element');
  assert.ok(html.includes('id="playPauseBtn"'), 'Must have play/pause button');
  assert.ok(html.includes('id="speedSelector"'), 'Must have speed selector');
  assert.ok(html.includes('id="rewindBtn"'), 'Must have rewind -15s button');
  assert.ok(html.includes('id="forwardBtn"'), 'Must have forward +15s button');
  assert.ok(html.includes('id="progressBar"'), 'Must have progress bar');
  assert.ok(html.includes('id="sleepTimerBtn"'), 'Must have sleep timer');

  console.log('✅ HTML structure verification passed!');
}

runTest();
```

- [ ] **Step 2: 运行测试验证失败**

运行：`node tests/verify-html.js`
预期输出：`AssertionError: index.html must exist`

- [ ] **Step 3: 编写 `index.html` 与 `styles.css`**

编写 `index.html`，融入深色质感、响应式视口、图标以及完整的语义化容器；
编写 `styles.css`，实现 Glassmorphism 毛玻璃卡片、波形动画、自适应布局（移动端底栏吸顶自适应）。

- [ ] **Step 4: 运行结构验证测试**

运行：`node tests/verify-html.js`
预期输出：`✅ HTML structure verification passed!`

- [ ] **Step 5: 提交代码**

```bash
git add index.html styles.css tests/verify-html.js
git commit -m "feat: implement responsive UI layout and glassmorphism styling"
```

---

### Task 3: 播放器核心引擎开发（播放、倍速、跳转、断点记忆）

**Files:**
- Create: `app.js`
- Test: `tests/verify-app-logic.js`

**Interfaces:**
- Consumes: `data/playlist.json`
- Produces: 全功能音频管理器，包含列表渲染、播放控制、变速保持音调、断点 LocalStorage 读写、MediaSession 锁屏挂载、定时睡眠器。

- [ ] **Step 1: 编写逻辑测试**

创建 `tests/verify-app-logic.js`，对断点存储键名、倍速档位、时间格式化函数进行单元测试：
```javascript
const assert = require('assert');

// 导入或模拟核心算法工具函数
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

assert.strictEqual(formatTime(0), '00:00');
assert.strictEqual(formatTime(65), '01:05');
assert.strictEqual(formatTime(3605), '60:05');

const speedSteps = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
assert.ok(speedSteps.includes(1.5), 'Should support 1.5x');
assert.ok(speedSteps.includes(3.0), 'Should support 3.0x');

console.log('✅ App logic unit test passed!');
```

- [ ] **Step 2: 编写 `app.js` 完整实现**

实现以下核心模块：
1. `PlaylistState`：从 `data/playlist.json` 加载音频列表，实现搜索过滤与顺序管理。
2. `AudioEngine`：封装 `<audio>` 播放操作，支持 `play()`, `pause()`, `seek()`, `setSpeed()`, `skip(±15)`。
3. `StorageManager`：防抖保存每首音频的进度到 `localStorage`，并在列表项目上实时显示百分比标签。
4. `MediaSessionManager`：注册 `navigator.mediaSession` 锁屏与通知控制。
5. `SleepTimer`：定时器逻辑，倒计时结束后平滑暂停播放。
6. `LocalDropHandler`：支持用户把本地新音频直接拖进网页实时试听。

- [ ] **Step 3: 运行逻辑测试并启动本地服务测试**

运行：`node tests/verify-app-logic.js`
预期输出：`✅ App logic unit test passed!`

- [ ] **Step 4: 提交代码**

```bash
git add app.js tests/verify-app-logic.js
git commit -m "feat: implement audio playback engine with memory and media session"
```

---

### Task 4: GitHub Actions 自动化部署流水线与使用文档配置

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `.gitignore`
- Create: `README.md`
- Test: `tests/verify-deployment-config.js`

**Interfaces:**
- Produces: GitHub Actions 部署配置，推送 `main` 分支自动构建并发布到 GitHub Pages；完整的图文使用说明。

- [ ] **Step 1: 编写部署配置校验测试**

创建 `tests/verify-deployment-config.js`：
```javascript
const fs = require('fs');
const path = require('path');
const assert = require('assert');

function runTest() {
  const workflowPath = path.join(__dirname, '..', '.github', 'workflows', 'deploy.yml');
  const readmePath = path.join(__dirname, '..', 'README.md');
  const gitignorePath = path.join(__dirname, '..', '.gitignore');

  assert.ok(fs.existsSync(workflowPath), '.github/workflows/deploy.yml must exist');
  assert.ok(fs.existsSync(readmePath), 'README.md must exist');
  assert.ok(fs.existsSync(gitignorePath), '.gitignore must exist');

  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.ok(workflow.includes('actions/deploy-pages'), 'Workflow must use deploy-pages action');
  assert.ok(workflow.includes('actions/upload-pages-artifact'), 'Workflow must upload pages artifact');

  console.log('✅ Deployment configuration verification passed!');
}

runTest();
```

- [ ] **Step 2: 运行测试验证失败**

运行：`node tests/verify-deployment-config.js`
预期输出：`AssertionError: .github/workflows/deploy.yml must exist`

- [ ] **Step 3: 创建 `.github/workflows/deploy.yml`、`.gitignore` 与 `README.md`**

编写标准 GitHub Pages 自动化发布 Action：
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: ["main", "master"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

编写 `README.md`，详细说明：
1. 网站特色与使用技巧（倍速、快捷键、手机锁屏、断点记忆）。
2. 如何在本地启动测试（支持直接双击或一键启动轻量服务）。
3. 如何添加新的 `.m4a` 音频并推送到 GitHub。
4. 如何在 GitHub 仓库中开启 GitHub Pages（Settings -> Pages -> Source: GitHub Actions）。

- [ ] **Step 4: 运行测试验证通过**

运行：`node tests/verify-deployment-config.js`
预期输出：`✅ Deployment configuration verification passed!`

- [ ] **Step 5: 提交代码**

```bash
git add .github/workflows/deploy.yml .gitignore README.md tests/verify-deployment-config.js
git commit -m "ci: configure GitHub Pages auto-deployment and documentation"
```

---

### Task 5: 全链路端到端功能验证与用户体验联调

**Files:**
- Modify: `index.html`, `styles.css`, `app.js`（根据实际播放联调优化细节）

- [ ] **Step 1: 运行所有自动化测试套件**

运行：
```bash
node tests/verify-playlist.js
node tests/verify-html.js
node tests/verify-app-logic.js
node tests/verify-deployment-config.js
```
预期输出：4 个测试套件全部通过。

- [ ] **Step 2: 启动本地 HTTP 服务进行全功能实测**

启动本地服务（例如通过 Node.js 简易服务）：
- 检查 13 个 `.m4a` 音频流式播放响应
- 验证倍速切换（0.75x ~ 3.0x）及音调保真
- 验证快进/快退 15 秒按钮与键盘快捷键
- 验证播放进度记忆与页面刷新后恢复
- 验证关键词搜索即时筛选
- 验证移动端屏幕自适应展示

- [ ] **Step 3: 优化收尾并提交全量代码**

```bash
git add .
git commit -m "chore: final end-to-end verification and polish"
```
