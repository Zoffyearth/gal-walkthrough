import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { parseGuide } from './parser';
import { applyLayout } from './layout';
import CustomNode from './CustomNode';

const nodeTypes = { custom: CustomNode };

const DEFAULT_TEXT = `【末莉】

转过身去
【存档１】
自己处理(CG回收)
【从存档１开始】
寻求安慰
再做一次
追出去
妄想
比试
救助
婉转地蒙混过去
想好好地珍惜
打个招呼
只好答应下来
相信自己
饭桌下面
拜托
不是
我想帮助你……
现在没有
赞成
帮她垫上枕头
封印这方法
２０～２４
听取其愿望
帮忙寻找
笨蛋
是啊
真纯大小姐
强势干涉
ＹＥＳ
让末莉先走
知道了
摸屁股
先洗澡
戒指
保持绅士风度
道歉
处理伤口
……抱歉
出手相助
劝她吃
去
询问一下
找借口
安慰
抱着
陪她玩
放慢步伐
死缠烂打
寻求安慰
謝罪
让她戴点什么东西遮阳
站在原地
玩
送给某人
去看看情况
送行
当然是真的
使用那张王牌
安慰她一下
【存档２】
在意末莉
打招呼
开个玩笑
自己去送
打招呼
体罚春花
询问准
ＹＥＳ
移动到屋顶
变成守财奴了
询问
肯定
去追
传授
【存档３】
将其偷走
闻闻气味
原地观望
去接春花
不去在意
稍后支付
向末莉搭话
【存档４】
去找
拜托

【末莉 ＥＮＤ】
【春花】

【从存档２开始】
在意青叶
打招呼
一本正经
自己去送
打招呼
体罚春花
询问准
ＹＥＳ
就这么劝说她
变成守财奴了
算了
否定
【存档５】
追出去
算了
将其偷走
不闻
原地观望
去接春花
不去在意
稍后支付
向末莉搭话
去找
拜托
告诉准
询问春花的意向
认真说明
为了和你母亲见面

【春花 ＥＮＤ】

【准】

【从存档４开始】
回家
拒绝
告诉准
询问末莉的意向
认真说明

【准 ＥＮＤ】

【青叶】

【从存档５开始】
向青叶问话
算了
查看余额
不闻
帮忙
悠闲度日
鸟会……
稍后支付
担心青叶
回家
拒绝
不告诉准
询问末莉的意向
认真说明

【青叶 ＥＮＤ】

【真纯】

【从存档３开始】
查看余额
不闻
帮忙
去接春花
不去在意
马上支付
向末莉搭话
回家
拒绝
不告诉准
询问末莉的意向
认真说明

【真纯 ＥＮＤ】`;

export default function App() {
  const [text, setText] = useState(DEFAULT_TEXT);

  const { nodes: rawNodes, edges: rawEdges } = useMemo(() => {
    try {
      return parseGuide(text);
    } catch {
      return { nodes: [], edges: [] };
    }
  }, [text]);

  const layoutedNodes = useMemo(() => {
    return applyLayout(rawNodes, rawEdges);
  }, [rawNodes, rawEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rawEdges);

  const prevNodesKey = useRef('');

  useEffect(() => {
    const key = layoutedNodes.map((n) => n.id).join(',');
    if (key !== prevNodesKey.current) {
      prevNodesKey.current = key;
      setNodes(layoutedNodes);
    }
  }, [layoutedNodes, setNodes]);

  useEffect(() => {
    setEdges(rawEdges);
  }, [rawEdges, setEdges]);

  const handleTextChange = useCallback((e) => {
    setText(e.target.value);
  }, []);

  return (
    <div className="app-container">
      <div className="left-panel">
        <div className="panel-header">
          <h2>攻略编辑器</h2>
          <span className="hint">
            支持：【路线名】|【存档N】/saveN/◆セーブN |【从存档N开始】/从saveN开始 |【XXX END】/——进入XX线
          </span>
        </div>
        <textarea
          className="editor"
          value={text}
          onChange={handleTextChange}
          spellCheck={false}
          placeholder="在此输入或粘贴攻略文本..."
        />
      </div>

      <div className="right-panel">
        <div className="panel-header">
          <h2>路线可视化</h2>
          <span className="hint">💾=存档 | 虚线=回档 | 彩色=路线标题 | 红/金/灰=结局</span>
        </div>
        <div className="flow-container">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.1}
            maxZoom={2}
            defaultEdgeOptions={{
              type: 'default',
            }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#e8e8e8" gap={20} />
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                const t = n.data?.nodeType;
                if (t === 'route') return n.data?.color || '#e74c3c';
                if (t === 'save') return '#5b8def';
                if (t === 'ending') return n.data?.color || '#e74c3c';
                return '#bdc3c7';
              }}
              maskColor="rgba(0,0,0,0.08)"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
