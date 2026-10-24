# 🎧 AI 学习音频随身听 (AI Audio Learning Player)

> 专为大模型、智能体、深度学习等课程音频打造的沉浸式现代 Web 播放器。纯静态免服务器，通过 GitHub Pages 免费永久托管，支持在手机与电脑浏览器中随时随地收听！

---

## ✨ 核心特性

- 🚀 **零服务器成本**：纯原生现代化单页应用（HTML5 + 现代 CSS + Vanilla JS），依托 GitHub Pages 永久免费运行。
- ⚡ **学习专享倍速**：支持 `0.75x`、`1.0x`、`1.25x`、`1.5x`、`1.75x`、`2.0x`、`2.5x`、`3.0x` 多档微调，开启原生音调保留（加速不怪调），并自动记忆上次习惯倍速。
- 🧠 **断点续播记忆**：利用 `localStorage` 自动在本地记住每首音频上次听到的具体时分秒，列表直观显示已学进度条与百分比，切换或重开无缝续播。
- ⏪ **重点精细回顾**：专设 `-15s`（重点回听）与 `+15s`（跳过冗余）按钮，支持键盘全局快捷键。
- 📱 **锁屏与耳机控制**：完整集成 HTML5 `MediaSession API`，手机锁屏界面能显示当前章节标题、音频进度，并支持耳机按键切歌/暂停，通勤与运动收听极佳。
- 🌙 **夜间与沉浸美学**：黑曜石科技暗色护眼调性，毛玻璃磨砂卡片搭配动态音频律动频谱，赏心悦目。
- ⏰ **专注/睡眠定时**：支持设定 15/30/45/60 分钟或播完本期自动停止，睡前或番茄钟学习必备。
- 🔍 **秒级即时过滤**：顶部搜索框输入章节名、模型、技术点即时筛选。
- 📂 **本地即时试听**：未推送到 GitHub 前，直接将桌面新 `.m4a` 拖拽到网页中即可立即播放。

---

## 🛠️ 项目目录说明

```text
├── audio/                      # 存放所有 .m4a 音频文件
├── data/
│   └── playlist.json           # 自动化生成的音频播放列表清单
├── assets/
│   └── logo.svg                # 矢量 Logo 图标
├── index.html                  # 播放器单页入口
├── styles.css                  # 现代化响应式深色样式
├── app.js                      # 播放器核心引擎与事件逻辑
├── update-playlist.js          # 本地音频一键扫描与清单生成脚本
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions 自动化发布流水线
└── README.md                   # 本说明文档
```

---

## 🚀 本地快速预览

浏览器由于安全策略（CORS），读取本地 `data/playlist.json` 时建议通过轻量本地服务打开：

#### 方式一：Node.js（推荐）
```bash
npx serve .
# 打开输出的链接（如 http://localhost:3000）即可
```

#### 方式二：Python（电脑有 Python 即可）
```bash
python -m http.server 8000
# 浏览器访问 http://localhost:8000
```

---

## 📥 如何添加新的音频并同步到网站

当你桌面有了新的 `.m4a` 音频想要放进网站时，只需三步：

1. **将音频文件放入 `audio/` 目录**：
   直接复制桌面上的 `.m4a` 文件到本项目下的 `audio/` 文件夹中。

2. **更新播放列表清单**：
   在本项目根目录下运行命令：
   ```bash
   node update-playlist.js
   ```
   *该脚本会在 1 秒内自动扫描 `audio/` 目录中的所有文件，按章节数字排序，并更新 `data/playlist.json`。*

3. **推送到 GitHub**：
   ```bash
   git add .
   git commit -m "添加新学习音频"
   git push origin main
   ```
   推送后，GitHub Actions 会在 1 分钟内自动部署上线！

---

## 🌐 如何在 GitHub 上启用 GitHub Pages 免费访问

当你在 GitHub 上创建好仓库并将代码 push 上去后，开启 Pages 只需一步：

1. 打开你的 GitHub 仓库主页。
2. 点击顶部的 **Settings（设置）**。
3. 在左侧菜单中找到并点击 **Pages**。
4. 在 **Build and deployment** 下方的 **Source** 下拉菜单中，选择：
   👉 **`GitHub Actions`**（非常重要，选择此项即可直接对接我们已配置好的流水线）。
5. 保存后，每次推送代码，GitHub Actions 就会自动为你打包并发布到：
   `https://<你的GitHub用户名>.github.io/<你的仓库名>/`

---

## ⌨️ 键盘快捷键一览

| 快捷键 | 功能 |
| :--- | :--- |
| <kbd>空格</kbd> (Space) | 播放 / 暂停 |
| <kbd>←</kbd> / <kbd>→</kbd> | 后退 / 快进 5 秒 |
| <kbd>J</kbd> / <kbd>L</kbd> | 后退 / 快进 15 秒（重点回放） |
| <kbd>↑</kbd> / <kbd>↓</kbd> | 音量微调 (±10%) |
| <kbd>[</kbd> / <kbd>]</kbd> | 切换学习倍速 |
| <kbd>M</kbd> | 静音 / 恢复 |
| <kbd>N</kbd> | 下一首音频 |
| <kbd>Esc</kbd> | 关闭定时器 / 快捷键弹窗 |
