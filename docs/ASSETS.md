# BlockStrike 地图资产管线

本次升级把「程序化几何体直接渲染」替换为「GLB 视觉层 + 原碰撞/导航层分离」的架构，
在不改动 FPS 玩法、出生点、碰撞、射线和 Bot 导航的前提下，用更精致的模型替换场景外观。

## 架构

- `src/world/Maps.ts` / `MapKit.ts` 仍然是唯一的玩法事实来源：碰撞体（`solids`）、出生点（`spawns`）、
  Bot 路线（`routes`）和 `floorAt` 全部保持不变。
- `src/world/Environment.ts` 用 `GLTFLoader` 异步加载 `/assets/maps/<mapId>.glb`，加载成功后隐藏
  `ArenaMap.group`（旧程序化网格）；加载失败则自动回退到旧几何，不影响可玩性。
- `src/world/SurfaceLibrary.ts` 在浏览器里生成可复用的 Canvas PBR 贴图（Base Color + Roughness），
  按 GLB 材质名分配；不依赖 Blender 节点或本机绝对路径。
- 碰撞模型与渲染模型完全分离：GLB 只含视觉网格，物理依旧使用 `ArenaMap.solids` 的简化 AABB。

## 资产生成

```sh
npm run build:maps
```

`tools/build-map-glb.mjs` 用 Node + three.js `GLTFExporter` 无头生成 GLB，输出到
`public/assets/maps/`。当前已生成：

- `public/assets/maps/blockyard.glb`（BLOCKYARD，19 个网格，约 9.4k 三角形，685 KB）

Blender 等价脚本见 `tools/blockyard_bpy.py`（当前环境未安装 Blender，因此 `.blend` 与
bpy 导出结果未在本机执行，脚本按与 `Maps.ts` 相同的坐标书写，供本地 Blender 复现）。

## 当前状态

- 已完成：BLOCKYARD 从建模管线到浏览器加载的完整闭环，生产构建通过，地图碰撞/导航验收通过。
- 待完成：其余 9 张地图（DUNE RIDGE、HARBORLINE、SUBWAY DEPOT、VERTICAL CITY、GLACIER OUTPOST、
  ARENA PIT、FACTORY FLOOR、JUNGLE TEMPLE、OFFSHORE RIG）沿用同一管线逐张生成 GLB 并接入。

## 验证

```sh
npm run build
node tests/maps.mjs   # 十张地图的碰撞/导航确定性验收
node tools/shot.mjs   # 生成 test-results/blockyard-glb.png 实机截图
```
