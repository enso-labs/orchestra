import { useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
} from '@xyflow/react';
 
import '@xyflow/react/dist/style.css';
 
const initialNodes = [
  { id: '1', position: { x: 150, y: 100 }, data: { label: 'Webhook Trigger' } },
  { id: '2', position: { x: 150, y: 200 }, data: { label: 'Appointment Setter' } },
  { id: '3', position: { x: 50, y: 300 }, data: { label: 'Lead Qualifier' } },
  { id: '4', position: { x: 250, y: 300 }, data: { label: 'Appointment Confirmation' } },
];
const initialEdges = [
  { id: 'e1-1', source: '1', target: '2' },
  { id: 'e1-2', source: '2', target: '3' },
  { id: 'e2-3', source: '2', target: '4' },
  
];
 
export default function App() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
 
  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );
 
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}