# NodeServer — 前端自动部署工具

基于 Node.js + SSH 的前端静态资源一键部署脚本：本地压缩 → SSH 连接服务器 → 上传 zip → 远端解压并替换发布目录。

---

## 功能概览

| 步骤 | 说明 |
|------|------|
| 1. 本地压缩 | 将前端打包产物（如 `dist`）压缩为 `dist.zip` |
| 2. SSH 连接 | 通过账号密码或私钥连接远端服务器 |
| 3. 处理旧版本 | 可选备份到同目录，或临时移到 `/tmp` |
| 4. 上传文件 | 将 zip 上传到远端部署目录 |
| 5. 解压替换 | 解压 → 重命名为发布目录 → 删除远端 zip |
| 6. 清理本地 | 删除本地生成的 `dist.zip` |

---

## 项目结构

```
nodeserver/
├── index.js                 # 入口：串联压缩、连接、上传、解压、清理
├── config.js                # 部署配置（SSH、路径、开关）
├── module/
│   ├── compressFile.js      # 本地目录压缩为 zip（archiver）
│   ├── ssh.js               # SSH 连接（node-ssh）
│   ├── uploadFIle.js        # 上传 zip，并处理远端旧发布目录
│   ├── handleCommand.js     # 远端执行 Shell 命令
│   └── handleTime.js        # 生成备份目录用的时间戳
└── README.md
```

### 模块职责说明

- **`index.js`**：主流程。按顺序执行压缩 → 连接 → 上传 → `unzip` → `mv dist` 为发布目录 → 删除远端 zip → 删除本地 zip。
- **`config.js`**：所有可配置项集中在此，修改后即可适配不同项目/服务器。
- **`compressFile.js`**：用 `archiver` 把 `targetDir` 打成 zip，包内根文件夹固定名为 `dist`（与后续 `mv dist` 对应）。
- **`ssh.js`**：创建 `NodeSSH` 实例并导出 `connectServe` / `ssh`。
- **`uploadFIle.js`**：上传前根据 `openBackUp` 处理旧发布目录，再 `putFile` 上传。
- **`handleCommand.js`**：在指定远端目录执行命令；有 `stderr` 则报错并退出。
- **`handleTime.js`**：生成形如 `2026-11-18_17:25:30` 的时间字符串，用于备份目录后缀。

---

## 环境要求

### 本地

- Node.js（建议 14+）
- 已安装依赖（见下方）
- 前端项目已完成打包，产物目录存在（如 `dist`）

### 远端服务器

- 支持 SSH 登录（密码或私钥）
- 已安装解压工具，否则解压会失败：

```bash
# CentOS / RHEL
yum install -y unzip zip

# Ubuntu / Debian
apt-get install -y unzip zip
```

- 部署目录（如 `/data/`）存在，且 SSH 用户对该目录有写权限

---

## 安装依赖

在本项目根目录执行：

```bash
npm init -y
npm install archiver@5.3.0 node-ssh@11.1.1 --save
```

> 说明：原 README 中的 `inquirer` 用于多配置交互选择，**当前代码未接入**，如需多环境选择可后续自行扩展。

---

## 配置说明（`config.js`）

```js
const config = {
  name: 'prod',                    // 环境标识（当前仅作备注）
  ssh: {
    host: '',                      // 服务器 IP 或域名（必填）
    port: 22,                      // SSH 端口
    username: 'root',              // SSH 用户名
    password: '',                  // 登录密码（与私钥二选一）
    // privateKey: 'E:/id_rsa',    // SSH 私钥路径（不用时请保持注释）
    passphrase: ''                 // 私钥解密口令（无则留空）
  },
  targetDir: 'D:/workLee/oa-mgr/dist', // 本地待压缩目录（前端打包产物）
  targetFile: 'dist.zip',              // 生成的 zip 文件名
  openCompress: true,                  // 是否本地压缩；false 则需事先准备好 zip
  openBackUp: false,                   // 是否在远端同目录备份旧版本
  deployDir: '/data/',                 // 远端上传/解压目录（建议以 / 结尾）
  releaseDir: 'wwwroot'                // 最终发布目录名（相对 deployDir）
}

module.exports = config
```

### 配置项对照

| 字段 | 类型 | 说明 |
|------|------|------|
| `ssh.host` | string | 服务器地址，必填 |
| `ssh.port` | number | 默认 `22` |
| `ssh.username` | string | SSH 用户名 |
| `ssh.password` | string | 密码登录时填写 |
| `ssh.privateKey` | string | 私钥路径；启用时注释掉或清空 `password` |
| `ssh.passphrase` | string | 私钥口令，无则 `''` |
| `targetDir` | string | 本地打包目录绝对/相对路径 |
| `targetFile` | string | 本地与远端使用的 zip 文件名 |
| `openCompress` | boolean | `true`：部署前自动压缩 `targetDir` |
| `openBackUp` | boolean | `true`：旧发布目录改名为 `wwwroot_时间戳` 留在 `deployDir`；`false`：挪到 `/tmp/wwwroot_时间戳` |
| `deployDir` | string | 远端工作目录，zip 上传到此 |
| `releaseDir` | string | 解压后 `dist` 会被重命名为此名 |

### 路径关系示意

假设配置为：

- 本地：`targetDir = D:/xxx/dist`
- 远端：`deployDir = /data/`，`releaseDir = wwwroot`

则最终结果为：

```
本地:  D:/xxx/dist  →  压缩为  nodeserver/dist.zip  →  上传

远端:  /data/dist.zip
        ↓ unzip
       /data/dist/
        ↓ mv dist wwwroot
       /data/wwwroot/     ← 线上访问的静态资源目录
```

**重要：** 压缩时包内文件夹固定叫 `dist`，`index.js` 里执行的是 `mv dist wwwroot`。若改了压缩内层目录名，必须同步改 `index.js` 中的 `mv` 命令。

---

## 使用步骤

### 1. 填写 `config.js`

至少配置好：

1. `ssh.host` / `username` / `password`（或 `privateKey`）
2. `targetDir`（指向前端项目打包后的 `dist`）
3. `deployDir`、`releaseDir`

### 2. 先打包前端项目

在业务前端仓库中执行，例如：

```bash
npm run build
```

确认 `targetDir` 指向的目录已生成。

### 3. 执行部署

在本项目（`nodeserver`）根目录运行：

```bash
node index.js
```

### 4. 观察控制台输出

正常流程大致为：

```
1-正在压缩文件...
2-压缩完成！共计 x.xxxMB
3-xxx.xxx.xxx.xxx 连接成功
提醒：未开启远端备份!          # 或「已开启远端备份!」
4-开始文件上传
5-文件上传完成
unzip dist.zip 执行完成！
mv dist wwwroot 执行完成！
rm -f dist.zip 执行完成！
6.删除本地dist文件成功
```

若某步失败，会打印「部署过程出现异常！」及错误信息。

---

## 部署流程（代码执行顺序）

```
main()
  ├─ openCompress === true ?
  │     └─ compressFile(targetDir → dist.zip)     // 包内根目录名为 dist
  ├─ connectServe(ssh)                            // SSH 连接
  ├─ uploadFile()
  │     ├─ handleSourceFile()                     // 处理旧 wwwroot
  │     │     ├─ openBackUp=true  → mv 到 同目录_时间戳
  │     │     └─ openBackUp=false → mv 到 /tmp/_时间戳
  │     └─ putFile(本地 zip → deployDir/targetFile)
  ├─ unzip dist.zip                               // 得到 deployDir/dist
  ├─ mv dist releaseDir                           // 如 mv dist wwwroot
  ├─ rm -f dist.zip                               // 删远端 zip
  └─ 删除本地 dist.zip 并 process.exit()
```

---

## 常见问题

### 1. 解压失败 / `unzip: command not found`

服务器未安装 unzip：

```bash
yum install -y unzip zip
# 或
apt-get install -y unzip zip
```

### 2. `mv dist xxx` 失败

压缩包内根目录必须叫 `dist`（由 `compressFile.js` 的 `archive.directory(targetDir, 'dist')` 决定）。不要随意改名，或改名后同步修改 `index.js` 中的 `mv` 命令。

### 3. SSH 连接失败

- 检查 `host`、`port`、账号密码是否正确
- 云服务器安全组是否放行 22 端口
- 使用私钥时确认路径正确，且 `privateKey` 已取消注释

### 4. 上传失败 / 权限不足

确认 SSH 用户对 `deployDir` 有写权限，目录已存在：

```bash
mkdir -p /data
chown -R 你的用户:你的用户 /data
```

### 5. Windows 下模块找不到 `uploadFile`

仓库中文件名为 `uploadFIle.js`（字母 **I** 大写）。Windows 多数情况下不区分大小写可运行；在 Linux/macOS 上可能报错。若跨平台部署本脚本，建议将文件名与 `require('./module/uploadFile')` 统一为同一大小写。

### 6. 未开启备份时旧文件去哪了？

`openBackUp: false` 时，旧的 `releaseDir` 会移动到 `/tmp/releaseDir_时间戳`，不会永久删除，但 `/tmp` 可能被系统定期清理。需要长期保留历史版本时请设 `openBackUp: true`。

---

## 安全与运维建议

1. **不要把真实密码、私钥提交到 Git**；可将 `config.js` 加入 `.gitignore`，或拆出 `config.local.js`。
2. 生产环境优先使用 **SSH 私钥**，并限制该账号权限（避免直接用 root）。
3. `openBackUp: true` 时注意磁盘占用，定期清理 `deployDir` 下带时间戳的备份目录。
4. 部署账号建议仅拥有发布目录写权限，不要开放无关系统路径。

---

## 可选扩展（当前未实现）

原文档提到的 `inquirer` 可用于多环境选择（如 `dev` / `test` / `prod`）。当前项目只有一份 `config.js`。若需要，可：

1. `npm i inquirer --save`
2. 将配置改为数组或分文件（`config.dev.js` / `config.prod.js`）
3. 在 `index.js` 启动时用 inquirer 让用户选择环境后再执行 `main()`

另外，`index.js` 中的 `removeLocalDir()` 用于删除前端项目本地 `dist` 文件夹，目前被注释，需要时可在清理本地 zip 后取消注释调用。

---

## 快速开始清单

- [ ] 安装 Node.js
- [ ] `npm install archiver@5.3.0 node-ssh@11.1.1`
- [ ] 配置 `config.js` 中的 SSH 与路径
- [ ] 服务器安装 `unzip` / `zip`
- [ ] 前端项目执行 `npm run build`
- [ ] 在本目录执行 `node index.js`
- [ ] 确认远端 `deployDir/releaseDir` 内容已更新
