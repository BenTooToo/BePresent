# Be Present

Web: https://bentootoo.com/BePresent/

## Windows 桌面版

运行 `release/Be-Present-0.3.1-Windows.exe`。桌面版自带时钟页面，可离线使用。

- 自定义 → **窗口置顶**：让时钟保持在其他普通窗口上方。
- 自定义 → **关闭后在后台运行**：默认开启；点击窗口关闭按钮后隐藏到系统托盘，单击托盘图标恢复窗口。
- 右键托盘图标可打开窗口、切换置顶、切换后台运行或彻底退出。
- 关闭后台运行后，点击窗口关闭按钮会退出程序。两个选项会自动保存。
- 后台运行不包含开机自启动；网页版与浏览器安装的 PWA 不提供置顶和托盘功能。
- 首次语言跟随系统/浏览器语言，支持中文、英语、法语，其他语言使用英语；手动选择会保存。

开发：`npm ci`，然后 `npm run desktop`。

验证：`npm run test:desktop`。

构建 Windows x64 便携版：`npm run desktop:build`，生成文件位于 `release/`。

GitHub Pages 继续发布仓库中的网页；桌面可执行文件需单独分发。
