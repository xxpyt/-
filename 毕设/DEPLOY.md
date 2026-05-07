# 线上部署与域名说明

本项目是纯静态前端，目录 `simulator/` 可直接上线。

## 1. GitHub Pages（已配置自动部署）

仓库已有工作流：`.github/workflows/deploy-pages.yml`

步骤：

1. 把当前目录上传到 GitHub 仓库。
2. 默认分支使用 `main` 或 `master`。
3. 在仓库 `Settings -> Pages` 中开启 `GitHub Actions` 作为来源。
4. 推送后 Actions 自动发布 `simulator/` 目录。

域名规则：

1. 项目仓库：`https://<你的GitHub用户名>.github.io/<仓库名>/`
2. 如果仓库名是 `<用户名>.github.io`（用户主页仓库）：`https://<你的GitHub用户名>.github.io/`

## 2. Netlify（已配置）

仓库已有配置：`netlify.toml`，发布目录是 `simulator`

步骤：

1. 打开 Netlify，`Add new site -> Import an existing project`。
2. 选择你的 GitHub 仓库。
3. 构建设置会自动识别 `publish = simulator`。
4. 点击 Deploy。

域名规则：

1. 首次自动分配：`https://<随机站点名>.netlify.app`
2. 你可在 Site settings 自定义为：`https://<你设置的站点名>.netlify.app`

## 3. Vercel（可直接使用）

仓库已有配置：`vercel.json`

推荐做法：

1. 直接把 `simulator/` 文件夹拖到 Vercel 控制台部署。
2. 或导入整个仓库并将 Root Directory 设为 `simulator`。

域名规则：

1. 默认：`https://<项目名>.vercel.app`

## 4. 我建议你选哪个

如果你要“最稳定、免费、带自动更新”，优先用 GitHub Pages。

## 5. 你的预期地址（已知用户名与仓库名）

你的 GitHub 用户名是 `xxpyt`，仓库名是 `毕设`，因此项目页地址是：

`https://xxpyt.github.io/%E6%AF%95%E8%AE%BE/`

说明：

1. 浏览器中通常会自动显示为编码 URL。
2. 该地址在首次推送并完成 Pages 部署后可访问（通常 1-3 分钟）。
