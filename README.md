<div align="center">

# BlockStrike

**原创低多边形快节奏浏览器 FPS**

十张地图 · 单机 / 8 人联机 · 随机补给 · 六把武器 · 中英双语

<img src="docs/menu.png" width="860" alt="BlockStrike 主菜单">

![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-r180-000000?logo=three.js&logoColor=white)
![external 3D assets](https://img.shields.io/badge/external%203D%20assets-0-2ea44f)

[在线试玩](https://blockstrike-eight.vercel.app/) ｜ [快速开始](#快速开始) ｜ [操作](#操作) ｜ [地图](#地图) ｜ [武器升级](#武器升级) ｜ [联机](#联机) ｜ [工程结构](#工程结构) ｜ [English](README-EN.md)

</div>

---

## 简介

BlockStrike 是一个跑在浏览器里的快节奏第一人称射击游戏，用 Vite + TypeScript + Three.js 写成。地形、角色、枪械、粒子和音效全部由代码生成——仓库根目录那十张 PNG 只是武器库里用来展示涂装的外观图，游戏内的 3D 内容全部来自程序化几何体、canvas 贴图与 Web Audio 合成，没有引入任何外部 3D 模型或音频素材。

玩法是 **Free For All**：单机挑战七个 Bot，或创建最多 8 人的联机房间，与朋友进行五分钟自由混战。地图随机刷新弹夹和血包，走近自动拾取。

联机入口在大厅底部，支持 8 位房间码和邀请链接，房主负责地图、时钟与全部伤害判定，客机只预测自己的移动与视角。Vercel 保持 Vite 静态部署即可；默认使用 PeerJS 公共信令和 WebRTC，严格网络可能需要 TURN 中继。联机对局不结算本地武器经验，房主需保持页面开启。部署、使用及测试说明见 [联机与补给指南](docs/ONLINE.md)。

界面支持中英文切换：大厅右上角的 **中文 · EN** 随时可切，暂停后进入设置也能改，选择保存在本地，首次访问跟随浏览器语言。

<p align="center">
  <img src="docs/gameplay.png" width="48%" alt="对局画面">
  <img src="docs/armory.png" width="48%" alt="武器库">
</p>

## 快速开始

需要 **Node.js 20.19+ 或 22.12+**（建议 22 / 24）。

```sh
npm install
npm run dev
```

打开终端输出的本地地址，点击 **PLAY** 开始。游戏面向桌面键盘与鼠标，推荐使用 Chrome / Edge。

> 鼠标锁定与声音需要你先点击页面才会激活；按 <kbd>Esc</kbd> 会释放鼠标并暂停。

生产构建与本地预览：

```sh
npm run build
npm run preview
```

## 操作

| 操作 | 按键 |
| --- | --- |
| 移动 / 瞄准 | <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / 鼠标 |
| 跳跃 / 连跳 | <kbd>Space</kbd>（可按住） |
| 冲刺 / 蹲下 | <kbd>Shift</kbd> / <kbd>Ctrl</kbd> |
| 开火 / 瞄准或开镜 | 鼠标左键 / 右键 |
| 近战轻击 / 重击 | 鼠标左键 / 右键 |
| 换弹 | <kbd>R</kbd> |
| 主武器 / 手枪 / 刀 | <kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd> |
| 切换武器 | 滚轮 |
| 复制邀请链接 | 对局中点击屏幕上的房间码 |
| 记分板 | 按住 <kbd>Tab</kbd> |
| 暂停 | <kbd>Esc</kbd> |

## 地图

大厅右侧可以挑图，也可以选 **RANDOM**（每局从十张里随机抽一张），选择会保存在本地。十张地图的地形、配色、天空、雾效、出生点与立体路线全部独立生成，不是同一张图挪几个方块：

| 编号 | 地图 | 主题 | 立体结构 |
| --- | --- | --- | --- |
| 01 | BLOCKYARD | 货运堆场 | 仓库屋顶、天桥、集装箱叠层、地下通道 |
| 02 | DUNE RIDGE | 沙漠峡谷 | 沙丘、干河床、岩壁高台、钻井架、瞭望塔 |
| 03 | HARBORLINE | 集装箱港口 | 两侧码头、浅水港池、龙门吊横跨、货船甲板 |
| 04 | SUBWAY DEPOT | 地下车站 | 下沉站台、列车顶、检修沟、两条天桥 |
| 05 | VERTICAL CITY | 屋顶都市 | 街道、五米天台、十三米高空连廊环 |
| 06 | GLACIER OUTPOST | 冰原前哨 | 冰裂缝、三座冰桥、碉堡屋顶、雷达站平台 |
| 07 | ARENA PIT | 下沉竞技场 | 坑底、两层看台、四角塔楼 |
| 08 | FACTORY FLOOR | 重工车间 | 厂房、机器列、两层检修栈桥、储罐区 |
| 09 | JUNGLE TEMPLE | 丛林神庙 | 四层金字塔、树冠平台、绳索栈道、水池 |
| 10 | OFFSHORE RIG | 海上钻井平台 | 主甲板、钻井台、直升机坪、攀回甲板的救生梯 |

<details>
<summary><b>点开看十张地图的实机截图</b></summary>

<br>

| | |
| --- | --- |
| <img src="docs/maps/blockyard.png" width="100%" alt="BLOCKYARD"><br>**01 BLOCKYARD** 货运堆场 | <img src="docs/maps/duneridge.png" width="100%" alt="DUNE RIDGE"><br>**02 DUNE RIDGE** 沙漠峡谷 |
| <img src="docs/maps/harborline.png" width="100%" alt="HARBORLINE"><br>**03 HARBORLINE** 集装箱港口 | <img src="docs/maps/subway.png" width="100%" alt="SUBWAY DEPOT"><br>**04 SUBWAY DEPOT** 地下车站 |
| <img src="docs/maps/vertical.png" width="100%" alt="VERTICAL CITY"><br>**05 VERTICAL CITY** 屋顶都市 | <img src="docs/maps/glacier.png" width="100%" alt="GLACIER OUTPOST"><br>**06 GLACIER OUTPOST** 冰原前哨 |
| <img src="docs/maps/arena.png" width="100%" alt="ARENA PIT"><br>**07 ARENA PIT** 下沉竞技场 | <img src="docs/maps/factory.png" width="100%" alt="FACTORY FLOOR"><br>**08 FACTORY FLOOR** 重工车间 |
| <img src="docs/maps/temple.png" width="100%" alt="JUNGLE TEMPLE"><br>**09 JUNGLE TEMPLE** 丛林神庙 | <img src="docs/maps/oilrig.png" width="100%" alt="OFFSHORE RIG"><br>**10 OFFSHORE RIG** 海上钻井平台 |

</details>

每张地图都带一套自动校验（见 `tests/maps.mjs`）：出生点不卡墙、间距足够、落地不会掉出世界；导航图连通；**每一条立体路线都用真实碰撞代码从起点走到终点**；七个 Bot 会在该地图上实际跑图。

## 武器升级

主菜单与武器库都能看到武器等级。每把武器最高 **LV 10**，从 0 开始：

| 等级 | 0 → 1 | 1 → 2 | 2 → 3 | … | 9 → 10 |
| --- | --- | --- | --- | --- | --- |
| 需要经验 | 100 | 160 | 220 | 每级 +60 | 640 |

经验只在整局结束结算：装进比赛的那把主武器拿 `40 + 每击杀 6 点`（拿到第一再 +20），所以一局十杀正好 100 点，也就是升一级；手枪与匕首按各自击杀数给经验。

等级会解锁涂装：M4A4 ASIMOV 需要步枪 LV 2，蝴蝶刀渐变 / M9 红宝石 / 蝴蝶刀绿宝石 / 爪子刀绿宝石 分别需要匕首 LV 1 / 3 / 5 / 7，没解锁的外观在武器库里显示为锁定。等级与地图选择都保存在本地。

## 武器模型

全部 29 把武器的 GLB 都是本项目**从零建模**的：参考图只用于校准轮廓、比例与配色分区，没有任何 Valve / CS2 原始模型、Source 2 网格或第三方游戏资产被下载或提取，也没有把参考 PNG 贴在平面上充当模型。

```bash
npm run build:references   # 扫描参考图，重建 tools/blender/reference_manifest.json
npm run build:weapons      # 建模 -> 校验 -> 渲染 -> 轮廓比对 -> 导出 GLB
npm run publish:weapons    # 把 GLB 与清单发布到 public/，并生成武器注册表
npm run verify             # 发布 + 构建 + 全部测试
```

单把武器：

```bash
npm run build:weapon -- --weapon ak-47
```

Blender 会自动探测（`BLENDER_PATH` → `PATH` → `C:\Program Files\Blender Foundation\Blender*`），找不到时会列出所有尝试过的路径。已在 Blender 5.2 验证。

流水线细节、坐标约定、材质库、多边形预算与轮廓自检循环见 [tools/blender/README.md](tools/blender/README.md)。

## 近战

匕首是纯粹的白刃武器，没有投掷、丢弃或任何远程形态：切出刀子后只有两种动作。

| 动作 | 输入 | 伤害 | 背刺 | 命中帧 |
| --- | --- | --- | --- | --- |
| 轻击 | 鼠标左键（可按住连挥） | 45 | 90 | 挥砍 0.16s 后 |
| 重击 | 鼠标右键 | 90 | 180 | 挥砍 0.34s 后 |

切刀是一段完整的出刀动画（约 0.75s），刀刃从画面下方翻上来：经典匕首与 M9 直刀是单次开刃，蝴蝶刀与爪子刀会转刀。出刀期间不能攻击，所以切刀有真实的代价。重击的刀刃更长，轻击够不到的距离重击能够到。

伤害在挥砍的命中帧结算，因此挥空、被反打或被拉开距离都可能发生。从目标背后命中判定为背刺，命中标记、伤害数字与音效都会切换成背刺样式。匕首不消耗弹药，近战命中同样会解除自己的出生保护。

## 比赛

Free For All：单机是 1 位玩家 + 7 个 Bot，联机最多 8 人，一局 5 分钟，击杀 +1 分，3 秒后安全点重生。单机里各 Bot 互相敌对，也会攻击玩家，暂停时整场比赛冻结。

## 联机

联机是好友房间模式，没有账号、匹配和房主迁移：创建房间后把 8 位房间码（字符取自 A-Z 与 2-9）或邀请链接发给朋友，邀请链接会自动打开联机面板并预填房间码。房间最多 8 人，不填充机器人，房主离开即关闭房间。

房主持有唯一的对局权威：地图、时钟、血量、弹药、命中、近战、道具、复活和计分都由房主判定并同步，客机只预测自己的移动与视角，位置偏差过大时会被拉回。房主浏览器必须保持开启，建议把标签页留在前台，后台标签页可能被浏览器限速或休眠。

暂停菜单只暂停自己的输入，联机对局继续；房主可在结算后再开一局，其他玩家等待房主；返回大厅即离开房间。联机对局不发放本地武器经验。

默认使用 [PeerJS 公共信令](https://peerjs.com/client/getting-started) 建立 WebRTC DataChannel，连接建立后对局数据在玩家与房主之间直接传输，不需要额外服务端保存房间状态。公司网络、运营商 NAT 或防火墙可能需要 TURN 中继，可用 `VITE_PEER_*` 与 `VITE_ICE_SERVERS` 指定自建信令或中继，完整流程见 [联机与补给指南](docs/ONLINE.md)。

## 随机补给

每张地图固定刷 5 份弹夹和 5 个血包，点位取自导航图连通、人物能站立且不卡墙的位置，并尽量彼此分开。

| 道具 | 效果 | 刷新 |
| --- | --- | --- |
| 血包 | 回复最多 35 HP，上限 100 HP | 20 秒后换新位置 |
| 弹夹 | 主武器与手枪各补一个弹匣容量的备弹，不超过各自备弹上限，不会直接填入当前弹匣 | 15 秒后换新位置 |

走近自动拾取，不需要按键，隔着墙不能拾取；满血或所有备弹都已满时不会消耗对应道具。单机机器人也会拾取，联机由房主决定唯一的拾取者并同步给所有玩家。

## 工程结构

| 目录 | 职责 |
| --- | --- |
| `src/core` | 游戏循环、输入、设置与系统协调 |
| `src/player` | 快速移动、连跳限速、蹲伏与第一人称相机 |
| `src/weapons` | 武器配置、弹药与换弹、武器栏、GLB 资产加载与程序化回退模型 |
| `tools/blender` | 武器建模流水线：参考图分析、几何生成、PBR 材质、预览渲染、校验与 GLB 导出 |
| `src/bots` | 七种 AI 状态、A* 路径、地面及高架导航图 |
| `src/world` | `MapKit` 地形工具、十张地图定义、AABB 碰撞与安全出生点 |
| `src/game` | 命中分区、FFA 规则、计时和排名（`GameMode` 接口可扩展其他模式） |
| `src/network` | 房间信令、房主权威的对局同步与客机移动预测 |
| `src/world/PickupManager.ts` | 随机补给点位、拾取判定与刷新 |
| `src/core/Progress.ts` | 武器等级、经验曲线与涂装解锁 |
| `src/core/I18n.ts` | 中英文字符串表与语言切换 |
| `src/ui` | 主菜单、配装、设置、HUD、暂停、记分板与结算 |
| `src/effects` / `src/audio` | 有上限的实例化粒子池，以及合成的枪声、脚步与切刀音效 |

## 开发与验证

`npm test` 在本地开发服务器运行时执行浏览器验收（`world` + `smoke` + `melee` + `maps` + `progress` + 武器资产流水线）。其中 `tests/weapon-assets.mjs` 直接校验 Blender 产出的真实 glTF 二进制：glTF 魔数与长度、网格数与材质数、每个材质是否带 PBR 金属度/粗糙度、是否包含 `Muzzle` 与 `ViewmodelAnchor` 锚点、可动画部件（弹匣 / 扳机 / 枪机 / 刀刃 / 刀柄轴）是否独立拆分、三角形数是否与清单一致，并确认每把武器指向各自独立的 GLB 而不是共用一个通用步枪。另有四个单独运行的脚本：`npm run test:pickups` 校验十张地图的补给点位与拾取规则，`npm run test:audio` 在 `OfflineAudioContext` 中检查合成枪声，`npm run test:capture` 覆盖鼠标锁定兼容模式，`npm run test:online` 会自行拉起本地信令服务器与独立 Vite（5174 / 9001 端口），用两个真实浏览器上下文通过 WebRTC 跑完整联机流程，不依赖公网信令。默认使用 Windows 安装的 Chrome，可通过 `CHROME_PATH` 指定浏览器路径。测试固定以英文界面运行（Playwright locale 固定为 `en-US`），因为部分断言直接匹配英文 HUD 文案。测试使用软件 WebGL，性能结果不代表真实 GPU 帧率。结果和截图写入 `test-results/`，其中 `map-*.png` 是十张地图的实机截图。

<details>
<summary><b>验收脚本具体检查什么</b></summary>

<br>

开发模式向 `window.__game` 暴露游戏实例供集成验证；生产构建不暴露该入口。

验收脚本会真实点击菜单、发送键鼠事件，检查武器伤害、换弹、命中倍率、暂停、重生和结算。武器测试使用受控靶位；Bot 实战与完整 300 秒比赛使用加速模拟推进，仍运行正式的 AI、碰撞、射击和计分代码。脚本也检查两座楼梯，以及 Bot 从楼梯经屋顶、桥到塔楼的路径。

比赛会等待控制方式就绪后才开始计时。`npm run test:capture` 检查捕捉拒绝、旧式错误事件、API 缺失、无响应和延迟返回，以及取消请求、兼容操作和恢复。正常鼠标锁定仍由 `npm test` 验证。

</details>

<details>
<summary><b>鼠标锁定失败时的兼容模式</b></summary>

<br>

鼠标锁定失败时（部分内置浏览器不支持，或 Chromium 短时间请求限流），游戏自动启用兼容鼠标模式：移动鼠标瞄准，靠近画面边缘或按方向键持续转向，左键射击、右键开镜、WASD 移动。鼠标离开窗口或按 ESC 时暂停；RESUME 继续兼容模式，不重复失败的请求。

要获得不受窗口边界限制的 FPS 鼠标体验，请将游戏地址复制到独立 Chrome / Edge 中打开。

</details>

## 已知限制

联机是好友房间模式：没有专用服务器、账号匹配、房主迁移或竞技反作弊，房主浏览器必须保持开启，公共信令不可达的网络需要自备 TURN 中继，联机对局也不结算本地武器经验。小地图、其他模式和移动端触控尚未实现。Graphics Low 关闭阴影并限制像素比；实际帧率取决于设备与浏览器，未对低配置硬件作 60 FPS 保证。

## 部署

项目是纯静态站点，构建产物在 `dist/`，可以托管到任意静态服务。

**Vercel**：在 [vercel.com/new](https://vercel.com/new) 导入本仓库即可，无需任何配置——Vercel 会自动识别 Vite，构建命令 `npm run build`，输出目录 `dist`。之后每次推送到 `main` 都会自动重新部署。

需要在 Vercel 上更换信令或加 TURN 时，在 Project → Settings → Environment Variables 配置 `VITE_PEER_HOST`、`VITE_PEER_PORT`、`VITE_PEER_PATH`、`VITE_PEER_SECURE` 与 `VITE_ICE_SERVERS`，改完重新部署。这些变量会打包进公开的浏览器代码，不要放服务管理密钥。

**其他平台**：`npm run build` 后把 `dist/` 整个目录传上去即可，不需要 Node 运行时。

> 需要注意：Vercel 官方说明其在中国大陆没有服务器或 CDN 节点，`*.vercel.app` 域名在大陆可能被阻断或限速。若要面向大陆用户，建议绑定自定义域名，或改用境内 / 香港的托管。
