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
  Node,
} from '@xyflow/react';
import { useFlowContext } from '@/context/FlowContext';
 
import '@xyflow/react/dist/style.css';
import { createJsonThread } from '@/services/threadService';

// Define the data structure being passed between nodes
interface AppointmentData {
  customerName: string;
  email: string;
  phone: string;
  requestedDate: string;
}

// Define node data types with index signature to satisfy Record<string, unknown>
interface NodeData {
  label: string;
  [key: string]: unknown;
}

// Node-specific data types
interface WebhookNodeData extends NodeData {
  function: () => any;
}

interface AppointmentSetterNodeData extends NodeData {
  function: (data: AppointmentData) => void;
}
 
// const initialNodes = [
//   { 
//     id: '1', 
//     position: { x: 150, y: 100 }, 
//     data: { 
//       label: 'Webhook Trigger',
//       function: () => {
//         // Create sample appointment data
//         const appointmentData = {
//           query: "What is the weather in Tokyo?",
//           system: "You are a helpful assistant that can answer questions about the weather.",
//           tools: [],
//           mcp: {
//             "enso-mcp": {
//               "url": "https://mcp.enso.sh/sse",
//               "transport": "sse"
//             }
//           }
//         };
//         console.log('Webhook Trigger activated, sending data:', appointmentData);
//         return appointmentData;
//       }
//     }
//   },
//   { 
//     id: '2', 
//     position: { x: 150, y: 200 }, 
//     data: { 
//       label: 'Appointment Setter',
//       function: (data: AppointmentData) => {
//         console.log('Appointment Setter received data:', data);
//         console.log(`Setting appointment for ${data.customerName} on ${data.requestedDate}`);
//       }
//     }
//   },
// ];

const initialNodes = [
  { 
    id: '1', 
    position: { x: 150, y: 100 }, 
    data: { 
      label: 'Webhook Trigger',
      function: () => {
        // Create sample appointment data
        const appointmentData = {
          query: "What is the weather in Tokyo?",
          system: "You are a helpful assistant that can answer questions about the weather.",
          tools: [],
          mcp: {
            "enso-mcp": {
              "url": "https://mcp.enso.sh/sse",
              "transport": "sse"
            }
          }
        };
        console.log('Webhook Trigger activated, sending data:', appointmentData);
        return appointmentData;
      }
    }
  },
  { 
    id: '2', 
    position: { x: 150, y: 200 }, 
    data: { 
      label: 'Appointment Setter',
      function: async (data: any) => {
        const response = await createJsonThread(data);
        console.log('Appointment Setter received data:', response);
      }
    }
  },
];

const initialEdges = [
  { id: 'e1-1', source: '1', target: '2', data: { label: 'appointment data' } },
];
 
export default function App() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { setNode } = useFlowContext();
 
  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge({ ...params, data: { label: 'New Connection' } }, eds)),
    [setEdges],
  );

  // Handle node clicks to update the FlowContext
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setNode(node);
  }, [setNode]);

  // Simplified function to simulate data flow
  const simulateFlow = useCallback(() => {
    // Get the first node (Webhook Trigger)
    const webhookNode = nodes.find(n => n.id === '1');
    if (!webhookNode) {
      console.error('Webhook Trigger node not found');
      return;
    }

    const webhookData = webhookNode.data as WebhookNodeData;
    if (!webhookData.function) {
      console.error('Webhook node missing function');
      return;
    }

    // Execute the webhook function to get data
    console.log('Starting flow simulation...');
    const data = webhookData.function();
    
    // Find the target node (Appointment Setter)
    const appointmentSetterNode = nodes.find(n => n.id === '2');
    if (!appointmentSetterNode) {
      console.error('Appointment Setter node not found');
      return;
    }
    
    const appointmentSetterData = appointmentSetterNode.data as AppointmentSetterNodeData;
    if (!appointmentSetterData.function) {
      console.error('Appointment Setter node missing function');
      return;
    }
    
    // Log the edge traversal
    console.log('Sending data through edge: Webhook Trigger → Appointment Setter');
    
    // Add a small delay to visualize the flow
    setTimeout(() => {
      // Pass the data to the appointment setter
      appointmentSetterData.function(data);
    }, 500);
  }, [nodes]);

  // Button to trigger the simulation
  const NodeControls = () => (
    <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 4 }}>
      <button 
        onClick={simulateFlow} 
        style={{ 
          padding: '8px 16px', 
          background: '#1a192b', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Simulate Data Transfer
      </button>
    </div>
  );
 
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <NodeControls />
      </ReactFlow>
    </div>
  );
}