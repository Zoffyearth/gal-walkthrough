import { Handle, Position } from 'reactflow';

const nodeStyles = {
  route: {
    minWidth: 140,
    padding: '14px 20px',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    textAlign: 'center',
    boxShadow: '0 3px 10px rgba(0,0,0,0.18)',
  },
  save: {
    minWidth: 100,
    padding: '10px 16px',
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    backgroundColor: '#5b8def',
    color: '#fff',
    textAlign: 'center',
    boxShadow: '0 2px 6px rgba(91,141,239,0.35)',
  },
  plot: {
    minWidth: 90,
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    backgroundColor: '#ecf0f1',
    color: '#2c3e50',
    textAlign: 'center',
    border: '1px solid #bdc3c7',
  },
  ending: {
    minWidth: 110,
    padding: '12px 18px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    textAlign: 'center',
    boxShadow: '0 3px 8px rgba(0,0,0,0.22)',
  },
};

export default function CustomNode({ data }) {
  const { label, nodeType, color } = data;

  // route node
  if (nodeType === 'route') {
    return (
      <div style={{ ...nodeStyles.route, backgroundColor: color || '#e74c3c' }}>
        <Handle type="target" position={Position.Left} style={{ background: '#555' }} />
        <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 2 }}>路线</div>
        <div>{label}</div>
        <Handle type="source" position={Position.Right} style={{ background: '#555' }} />
      </div>
    );
  }

  // save node
  if (nodeType === 'save') {
    return (
      <div style={nodeStyles.save}>
        <Handle type="target" position={Position.Left} style={{ background: '#3b6fd4' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <span>💾</span>
          <span>{label}</span>
        </div>
        <Handle type="source" position={Position.Right} style={{ background: '#3b6fd4' }} />
      </div>
    );
  }

  // ending node
  if (nodeType === 'ending') {
    const bgColor = color || '#e74c3c';
    return (
      <div style={{ ...nodeStyles.ending, backgroundColor: bgColor }}>
        <Handle type="target" position={Position.Left} style={{ background: '#555' }} />
        <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 2 }}>结局</div>
        <div>{label}</div>
      </div>
    );
  }

  // plot node (default)
  return (
    <div style={nodeStyles.plot}>
      <Handle type="target" position={Position.Left} style={{ background: '#7f8c8d' }} />
      <div>{label}</div>
      <Handle type="source" position={Position.Right} style={{ background: '#7f8c8d' }} />
    </div>
  );
}
