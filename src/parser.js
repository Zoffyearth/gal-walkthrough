// 路线配色方案
const ROUTE_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#9b59b6',
  '#e67e22', '#1abc9c', '#f39c12', '#e91e63',
  '#00bcd4', '#ff5722', '#795548', '#607d8b',
];

let nodeIdCounter = 0;
let routeIdCounter = 0;

function nextNodeId() { return `node_${++nodeIdCounter}`; }
function nextRouteId() { return `route_${++routeIdCounter}`; }
function resetCounters() { nodeIdCounter = 0; routeIdCounter = 0; }

// ---- 全角数字/字母 -> 半角 ----
function toHalfwidth(s) {
  return s.replace(/[！-～]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
  );
}

// ---- 匹配函数 (输入已半角化) ----

function matchSave(line) {
  let m;
  m = line.match(/^◆セーブ(\d+)$/);
  if (m) return { saveId: 'SAVE_' + parseInt(m[1], 10), label: 'セーブ' + m[1] };
  m = line.match(/^【SAVE\s*(\d+)】$/i);
  if (m) return { saveId: 'SAVE_' + parseInt(m[1], 10), label: 'SAVE ' + m[1] };
  m = line.match(/^save\s*(\d+)$/i);
  if (m) return { saveId: 'SAVE_' + parseInt(m[1], 10), label: 'Save ' + m[1] };
  m = line.match(/^【?存档(\d+)】?$/);
  if (m) return { saveId: 'SAVE_' + parseInt(m[1], 10), label: '存档' + m[1] };
  return null;
}

function matchLoad(line) {
  let m;
  m = line.match(/^读取【?存档(\d+)】?$/);
  if (m) return 'SAVE_' + parseInt(m[1], 10);
  m = line.match(/^◆セーブ(\d+)から$/);
  if (m) return 'SAVE_' + parseInt(m[1], 10);
  m = line.match(/^SAVE\s*(\d+)\s*[开開]/i);
  if (m) return 'SAVE_' + parseInt(m[1], 10);
  m = line.match(/^[从從]save\s*(\d+)\s*[开開始]/i);
  if (m) return 'SAVE_' + parseInt(m[1], 10);
  // 【从存档N开始】/ 从存档N开始
  m = line.match(/^【?[从從]存档(\d+)[开開始]】?$/);
  if (m) return 'SAVE_' + parseInt(m[1], 10);
  return null;
}

function matchEnding(line) {
  let m;

  // Bad End / True End / Normal End
  m = line.match(/^(Bad End|True End|Normal End)$/i);
  if (m) {
    const raw = m[1];
    return { label: raw, endingType: /true/i.test(raw) ? 'true' : /normal/i.test(raw) ? 'normal' : 'bad' };
  }

  // TRUE END
  if (/^TRUE\s*END$/i.test(line)) return { label: line, endingType: 'true' };

  // XXX END / XXX END 后缀 (如 "克丽丝 END翔一")
  m = line.match(/^(.+?)\s*(END)(.*)$/i);
  if (m && m[1].length > 0 && m[1].length < 20) {
    if (!/^\d+$/.test(m[1])) {
      return { label: m[1] + ' END', endingType: /true/i.test(m[1]) ? 'true' : 'bad' };
    }
  }

  // 【XXX END】/【XXX ＥＮＤ】
  m = line.match(/^【(.+?)\s*END\s*】$/i);
  if (m) return { label: m[1] + ' END', endingType: 'normal' };

  // 纯 END
  if (/^END$/i.test(line)) return { label: line, endingType: 'normal' };

  // ——进入XXX线
  m = line.match(/^——进入(.+线)$/);
  if (m) return { label: m[1], endingType: 'normal' };

  // 回収後終了 / 回收后结束
  if (/回[収收]後?終/.test(line)) return { label: '回收终了', endingType: 'normal' };

  return null;
}

function isDateLine(line) {
  return /^[■◆]?\d{1,2}[\/月]\d{1,2}[日]?/.test(line);
}

function isNoteLine(line) {
  if (/^[注※]/.test(line)) return true;
  if (/^标有/.test(line)) return true;
  if (/^★号选项/.test(line)) return true;
  if (/^特定END后/.test(line)) return true;
  if (/^游戏结束/.test(line)) return true;
  if (/^\d+周目以降/.test(line)) return true;
  if (/^上記END後/.test(line)) return true;
  if (/通关上述/.test(line)) return true;
  if (/以上全部/.test(line)) return true;
  if (/CG回收/.test(line)) return true;
  if (/^※/.test(line)) return true;
  if (/随机出现/.test(line)) return true;
  if (/不出现的情况/.test(line)) return true;
  if (/进行S\/L/.test(line)) return true;
  return false;
}

function isSeparator(line) {
  return /^[─━═－\-—]{3,}$/.test(line);
}

function isStartMarker(line) {
  return line === '从头开始' ||
         line === '是' ||
         /^[・·]Prologue$/.test(line) ||
         /^最初から/.test(line) ||
         /^[・·]Prologueから開始/.test(line);
}

// ---- 主解析 ----

export function parseGuide(text) {
  resetCounters();
  const rawLines = text.split('\n');

  const nodes = [];
  const edges = [];
  const saveMap = {};
  let currentNode = null;
  let currentRouteId = null;
  let pendingRouteTitle = true;
  let routeTitleMaxLen = 12; // 自适应: 结局后=12, 读档后=4

  function addNode(type, label, extra = {}) {
    const id = nextNodeId();
    const node = {
      id,
      type: 'custom',
      data: { label, nodeType: type, routeId: currentRouteId, ...extra },
      position: { x: 0, y: 0 },
    };
    nodes.push(node);
    return node;
  }

  // 获取当前路线的颜色（用于给边着色）
  function getCurrentRouteColor() {
    if (currentRouteId !== null && routeIdCounter > 0) {
      return ROUTE_COLORS[(routeIdCounter - 1) % ROUTE_COLORS.length];
    }
    return '#666';
  }

  function addEdge(sourceId, targetId, dashed = false) {
    if (sourceId === targetId) return;
    const dup = edges.find((e) => e.source === sourceId && e.target === targetId);
    if (dup) return;
    const routeColor = getCurrentRouteColor();
    edges.push({
      id: `e_${sourceId}_${targetId}_${edges.length}`,
      source: sourceId,
      target: targetId,
      type: 'default',        // 贝塞尔曲线 — 不同 Y 偏移自然产生不同弧度，避免重叠
      animated: dashed,
      style: dashed
        ? { stroke: routeColor, strokeWidth: 1.5, strokeDasharray: '6 5', opacity: 0.6 }
        : { stroke: routeColor, strokeWidth: 2, opacity: 0.85 },
    });
  }

  function startNewRoute(name) {
    currentRouteId = nextRouteId();
    const color = ROUTE_COLORS[(routeIdCounter - 1) % ROUTE_COLORS.length];
    const routeNode = addNode('route', name, { color, routeId: currentRouteId });
    currentNode = routeNode;
    pendingRouteTitle = false;
  }

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i].trim();
    if (rawLine === '') continue;

    const line = toHalfwidth(rawLine);

    // 分隔线
    if (isSeparator(line)) {
      pendingRouteTitle = true;
      routeTitleMaxLen = 12;
      continue;
    }

    // 注释/说明
    if (isNoteLine(line)) {
      if (/CG回收/.test(line)) {
        pendingRouteTitle = true;
        routeTitleMaxLen = 12;
      }
      continue;
    }

    // 开始标记
    if (isStartMarker(line)) continue;

    // ==== 模式匹配 ====

    // 1) 读档
    const loadId = matchLoad(line);
    if (loadId) {
      const targetNode = saveMap[loadId];
      if (targetNode && currentNode && !pendingRouteTitle) {
        addEdge(currentNode.id, targetNode.id, true);
      }
      currentNode = targetNode || currentNode;
      if (pendingRouteTitle) routeTitleMaxLen = 4; // 收紧阈值
      continue;
    }

    // 2) 存档
    const saveMatch = matchSave(line);
    if (saveMatch) {
      const { saveId, label } = saveMatch;
      let saveNode = saveMap[saveId];
      if (!saveNode) {
        saveNode = addNode('save', label);
        saveMap[saveId] = saveNode;
      }
      if (currentNode && currentNode.id !== saveNode.id) {
        addEdge(currentNode.id, saveNode.id);
      }
      currentNode = saveNode;
      continue;
    }

    // 3) 结局
    const endingMatch = matchEnding(line);
    if (endingMatch) {
      let color;
      if (endingMatch.endingType === 'true') color = '#f1c40f';
      else if (endingMatch.endingType === 'bad') color = '#e74c3c';
      else color = '#95a5a6';

      const endingNode = addNode('ending', endingMatch.label, { color, endingType: endingMatch.endingType });
      if (currentNode && currentNode.id !== endingNode.id) {
        addEdge(currentNode.id, endingNode.id);
      }
      currentNode = endingNode;
      pendingRouteTitle = true;
      routeTitleMaxLen = 12;
      continue;
    }

    // 4) 【显式路线】
    const bracketRoute = line.match(/^【(.+?)】$/);
    if (bracketRoute) {
      startNewRoute(bracketRoute[1]);
      continue;
    }

    // 5) 日期
    if (isDateLine(line)) {
      const dn = addNode('plot', line);
      if (currentNode && currentNode.id !== dn.id) {
        addEdge(currentNode.id, dn.id);
      }
      currentNode = dn;
      continue;
    }

    // 6) 期待路线标题
    if (pendingRouteTitle) {
      const looksLikeRouteName =
        line.length <= routeTitleMaxLen &&
        !/[⇒●★◆■○（）\(\)→、。!?　]/.test(line) &&
        !/^(自宅|自宅)$/.test(line);

      if (looksLikeRouteName) {
        startNewRoute(line);
      } else {
        const pn = addNode('plot', line);
        if (currentNode && currentNode.id !== pn.id) {
          addEdge(currentNode.id, pn.id);
        }
        currentNode = pn;
      }
      continue;
    }

    // 7) 普通剧情
    const plotNode = addNode('plot', line);
    if (currentNode && currentNode.id !== plotNode.id) {
      addEdge(currentNode.id, plotNode.id);
    }
    currentNode = plotNode;
  }

  return { nodes, edges, saveMap };
}
