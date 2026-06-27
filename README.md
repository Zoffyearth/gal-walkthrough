# GAL 游戏流程可视化工具

一个可以将 GAL 游戏脚本文本可视化为流程图的 Web 工具。

## 功能

- 将文本脚本转换为可视化流程图
- 支持节点拖拽和缩放
- 展示剧情分支和走向

## 使用方法

### 一键启动

双击 `一键启动.bat`

### 手动启动

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 启动预览服务器
npm run preview
```

启动后在浏览器访问 http://localhost:4173

## 技术栈

- React 18
- Vite
- ReactFlow
