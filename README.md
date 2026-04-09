# PromptLib · 提示词片段库

> 管理你的提示词词条，通过 @ 快速拼接高密度 AI 提示词

**在线地址：** http://172.236.230.203

---

## 核心功能

- **词库管理** — 创建带名称和详细注释的词条
- **@ 引用** — 编辑器中输入 `@词条名` 实时搜索并插入
- **双模式引用**
  - `◆ A 模式`（紫色高亮）：生成时将词条完整注释附加到文本开头
  - `◇ B 模式`（灰色）：生成时只输出 `@词条名`，不附加注释
  - 点击词条芯片可随时切换模式
- **一键生成** — 自动拼接注释 + 正文，直接复制给 AI
- **词库导入导出** — JSON 文件，换浏览器拖入即用，无需注册

## 数据说明

词库仅保存在**浏览器本地（localStorage）**，不上传任何服务器。换设备前请先导出词库文件。

## 本地开发

```bash
npm install
npm run dev
```

## Docker 部署

```bash
docker build -t promptlib:latest .
docker run -d -p 80:80 --restart always promptlib:latest
```

## 版本记录

详见 [CHANGELOG.md](./CHANGELOG.md)
