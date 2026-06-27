/**
 * 基于 routeId 的泳道布局算法
 *
 * 核心思路：
 * 1. 拓扑排序 → 每节点分配 layer（X 坐标）
 * 2. 节点按 routeId 分组 → 每条路线独占一个 Y 泳道
 * 3. 同路线同 layer 的节点按创建顺序垂直排列
 * 4. 跨路线的边（读档虚线 / 共享存档分叉）自然形成跨泳道连线
 */

const H_SPACING = 240;       // layer 间水平间距（增大以拉开边）
const ROUTE_V_GAP = 200;     // 路线泳道之间的垂直间距
const INTRA_V_SPACING = 75;  // 同路线同层节点之间的垂直间距
const LAYER_OFFSET_Y = 50;   // 全局顶部偏移
const H_STAGGER = 45;        // 同层节点水平交错量，避免边完全重合

/**
 * 将 nodes 按 routeId 分组
 * 返回 Map<routeId, node[]>，并按首次出现顺序排序
 */
function groupByRoute(nodes) {
  const map = new Map();
  for (const n of nodes) {
    const rid = n.data.routeId || '__noroute__';
    if (!map.has(rid)) map.set(rid, []);
    map.get(rid).push(n);
  }
  return map;
}

/**
 * 为每条路线分配一个泳道 Y 偏移
 * 排序规则：按路线中最小 layer 排序（layer 小 → 排上面）
 */
function assignRouteBaseY(routeNodes, layerMap) {
  const entries = [];
  for (const [rid, rnodes] of routeNodes) {
    let minLayer = Infinity;
    for (const n of rnodes) {
      const l = layerMap.get(n.id) || 0;
      if (l < minLayer) minLayer = l;
    }
    entries.push({ rid, rnodes, minLayer });
  }
  // 按最小 layer 排序
  entries.sort((a, b) => a.minLayer - b.minLayer);

  const routeBaseY = new Map();
  entries.forEach((e, i) => {
    routeBaseY.set(e.rid, i * ROUTE_V_GAP);
  });
  return routeBaseY;
}

export function applyLayout(nodes, edges) {
  if (nodes.length === 0) return nodes;

  // ---- 1) 构建邻接关系 ----
  const successors = new Map();
  const predecessors = new Map();
  for (const n of nodes) {
    successors.set(n.id, []);
    predecessors.set(n.id, []);
  }
  for (const e of edges) {
    successors.get(e.source)?.push(e.target);
    predecessors.get(e.target)?.push(e.source);
  }

  // ---- 2) 拓扑排序分配 layer ----
  const layer = new Map();

  // 源节点：无入边
  for (const n of nodes) {
    if ((predecessors.get(n.id) || []).length === 0) {
      layer.set(n.id, 0);
    }
  }

  // 迭代传播：layer(n) = max(layer(pred)) + 1
  let changed = true;
  let iter = 0;
  while (changed && iter < nodes.length * 3) {
    changed = false;
    iter++;
    for (const n of nodes) {
      const preds = predecessors.get(n.id) || [];
      if (preds.length === 0) continue;
      let maxPred = -1;
      for (const p of preds) {
        const pl = layer.get(p);
        if (pl !== undefined && pl > maxPred) maxPred = pl;
      }
      if (maxPred >= 0) {
        const newLayer = maxPred + 1;
        if (!layer.has(n.id) || layer.get(n.id) < newLayer) {
          layer.set(n.id, newLayer);
          changed = true;
        }
      }
    }
  }

  // 兜底
  for (const n of nodes) {
    if (!layer.has(n.id)) layer.set(n.id, 0);
  }

  // ---- 3) 路线分组 & 分配泳道 Y ----
  const routeGroups = groupByRoute(nodes);
  const routeBaseY = assignRouteBaseY(routeGroups, layer);

  // ---- 4) 同路线内，同 layer 节点排序 ----
  // 用 (layer, routeId) 分组
  const layerRouteMap = new Map(); // key: `${layer}|${routeId}` → node[]
  for (const n of nodes) {
    const l = layer.get(n.id) || 0;
    const rid = n.data.routeId || '__noroute__';
    const key = `${l}|${rid}`;
    if (!layerRouteMap.has(key)) layerRouteMap.set(key, []);
    layerRouteMap.get(key).push(n);
  }

  // 每组内按 node id 后缀数字排序（近似创建顺序）
  for (const [, group] of layerRouteMap) {
    group.sort((a, b) => {
      const na = parseInt(a.id.replace('node_', ''), 10);
      const nb = parseInt(b.id.replace('node_', ''), 10);
      return na - nb;
    });
  }

  // ---- 5) 计算每个节点的 Y 偏移 ----
  // 首先统计每个 (layer, routeId) 组中每个节点的位置
  const groupPos = new Map(); // key: `${layer}|${routeId}` → Map<nodeId, posIndex>
  for (const [key, group] of layerRouteMap) {
    const pos = new Map();
    group.forEach((n, idx) => pos.set(n.id, idx));
    groupPos.set(key, pos);
  }

  function getOffsetInLayer(node) {
    const l = layer.get(node.id) || 0;
    const rid = node.data.routeId || '__noroute__';
    const key = `${l}|${rid}`;
    const pos = groupPos.get(key);
    return pos ? (pos.get(node.id) || 0) : 0;
  }

  // ---- 6) 分配最终 (x, y) ----
  // 统计每层的节点总数，用于计算水平交错
  const layerNodeCount = new Map(); // layer → 总节点数
  for (const n of nodes) {
    const l = layer.get(n.id) || 0;
    layerNodeCount.set(l, (layerNodeCount.get(l) || 0) + 1);
  }
  // 按路线顺序给每层节点编号，交错排列
  const layerIndexMap = new Map(); // nodeId → 该层中序号
  const layerCounters = new Map();
  for (const n of nodes) {
    const l = layer.get(n.id) || 0;
    const idx = layerCounters.get(l) || 0;
    layerCounters.set(l, idx + 1);
    layerIndexMap.set(n.id, idx);
  }

  const positionedNodes = nodes.map((n) => {
    const l = layer.get(n.id) || 0;
    const rid = n.data.routeId || '__noroute__';
    const baseY = routeBaseY.get(rid) || 0;
    const offset = getOffsetInLayer(n);

    // 水平交错：同层中不同位置的节点稍微错开 X，避免边路径完全重合
    const totalInLayer = layerNodeCount.get(l) || 1;
    const idxInLayer = layerIndexMap.get(n.id) || 0;
    const staggerX = totalInLayer > 1
      ? (idxInLayer - (totalInLayer - 1) / 2) * H_STAGGER
      : 0;

    return {
      ...n,
      position: {
        x: l * H_SPACING + 50 + staggerX,
        y: LAYER_OFFSET_Y + baseY + offset * INTRA_V_SPACING,
      },
    };
  });

  // ---- 7) 同路线同层去重叠 ----
  const finalGroups = new Map();
  for (const n of positionedNodes) {
    const l = layer.get(n.id) || 0;
    const rid = n.data.routeId || '__noroute__';
    const key = `${l}|${rid}`;
    if (!finalGroups.has(key)) finalGroups.set(key, []);
    finalGroups.get(key).push(n);
  }

  for (const [, group] of finalGroups) {
    group.sort((a, b) => a.position.y - b.position.y);
    for (let i = 1; i < group.length; i++) {
      const prevBottom = group[i - 1].position.y + 70;
      if (group[i].position.y < prevBottom) {
        group[i].position.y = prevBottom;
      }
    }
  }

  return positionedNodes;
}
