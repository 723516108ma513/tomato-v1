# Tomato Companion

一款 Windows 本地优先的番茄钟、任务管理与 AI 学习伙伴。最终交付物是 Tauri 桌面程序和 NSIS 安装包，不依赖网页服务器运行。

## 当前已实现

- 可调整时长的专注、短休息、长休息计时器
- 基于目标时间戳的计时恢复，避免窗口切换或系统休眠造成漂移
- 本地任务创建、完成、删除、番茄估算与进度回写
- 项目组：把一个长期学习目标组织为一组番茄任务，并显示项目完成进度
- AI 结构化拆解：生成后可逐项勾选、修改任务名称/番茄数/优先级
- AI 任务可新建项目、合并到已有项目，或不归项目直接导入任务列表
- 动态番茄罐：每次完成专注会新增一颗带落入动画的番茄
- 今日、本周、本月番茄数、专注时长、活跃天数和分布图
- 内置模型目录：DeepSeek、OpenAI、通义千问、Claude、Gemini、Ollama
- 用户选择服务商、输入 API Key 和具体模型 ID；端点与请求格式由 Rust 后端封装
- 学习伙伴姓名与四种初始风格：温柔陪伴、行动教练、理性导师、元气同伴
- AI 回复支持安全的标题、列表、引用、粗体和代码块格式
- 学习伙伴可在完成若干番茄后主动询问学习情况，默认每 2 颗触发且可关闭或调频
- Rust 底层身份提示词、最近 30 条消息窗口、滚动摘要与最多 12 条长期记忆注入
- 每新增 24 条消息触发记忆压缩，提取最多 12 条稳定偏好、长期目标或学习模式
- 记忆明确排除密钥、密码、联系方式、证件与健康隐私，并支持用户逐条删除
- SQLite 保存任务、番茄、对话、摘要、伙伴设置与记忆
- API Key 只保存到 Windows Credential Manager，不进入数据库或前端状态

## 安装与运行

生成的 Windows 安装包：

```text
D:\tomato\src-tauri\target\release\bundle\nsis\Tomato Companion_0.2.0_x64-setup.exe
```

无需安装的原生程序：

```text
D:\tomato\src-tauri\target\release\tomato-companion.exe
```

当前安装包没有商业代码签名证书，Windows SmartScreen 可能显示“未知发布者”。正式公开分发前应购买代码签名证书并加入 CI 签名流程。

## 本地数据位置

应用数据默认位于：

```text
%APPDATA%\com.tomato.companion\tomato-companion.db
```

WebView2 运行数据位于：

```text
%LOCALAPPDATA%\com.tomato.companion\
```

API Key 由 Windows Credential Manager 管理，服务名为 `Tomato Companion`。

## 开发与验证

```powershell
npm install
npm run dev
npm run test
npm run build
npm run tauri:dev
npm run tauri:build
```

首次 Rust 构建会下载依赖。项目内 `.cargo/config.toml` 使用 RsProxy 稀疏镜像，以改善中国大陆网络环境下 crates.io 的连接稳定性。

## 架构说明

详细模块、数据表、AI 适配与记忆生命周期见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 下一阶段建议

- AI 对话 SSE 流式输出与取消请求
- AI 结构化学习计划，可一键转成多条任务
- 系统托盘、专注结束通知、开机启动与单实例
- 数据导出、备份、恢复与一键完全删除
- 自动更新、崩溃恢复和签名发布流水线
