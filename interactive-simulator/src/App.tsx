import { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  applyEdgeChanges,
  applyNodeChanges,
  addEdge,
  MarkerType,
} from '@xyflow/react';
import type {
  Node,
  Edge,
  OnNodesChange,
  OnEdgesChange,
  Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';

type CloudProvider = 'none' | 'aws' | 'gcp' | 'azure';

const nodeDetails: Record<string, { 
  title: string; 
  notes: string; 
  realWorld: string; 
  docPath: string; 
  code?: string;
  cloud?: Record<string, { name: string; icon: string }> 
}> = {
  client: {
    title: 'Client (User Browser/App)',
    notes: 'The entry point. Initiates the "Place Order" request.',
    realWorld: 'Clients handle timeouts and retries. In modern apps, they might use GraphQL to fetch exactly what they need from multiple services via the Gateway.',
    docPath: 'frontend/architecture/frontend-architecture-guide.md',
    code: 'POST /api/v1/orders\n{ "item": "Laptop", "qty": 1 }',
    cloud: {
      aws: { name: 'Amplify / S3 + CloudFront', icon: '☁️' },
      gcp: { name: 'Firebase Hosting / GCS', icon: '☁️' },
      azure: { name: 'Static Web Apps / Blob Storage', icon: '☁️' }
    }
  },
  gateway: {
    title: 'API Gateway',
    notes: 'The "Front Door". It performs JWT validation and routes the request.',
    realWorld: 'Uses "Dynamic Routing". If the Order Service is under heavy load, the Gateway can use the Circuit Breaker to fail-fast.',
    docPath: 'reliability/circuit-breakers/README.md',
    code: 'gateway.route("/orders/**").to("lb://order-lb");',
    cloud: {
      aws: { name: 'Amazon API Gateway', icon: '🚀' },
      gcp: { name: 'Google Cloud API Gateway / Apigee', icon: '🚀' },
      azure: { name: 'Azure API Management', icon: '🚀' }
    }
  },
  'load-balancer': {
    title: 'Load Balancer',
    notes: 'Distributes incoming traffic across multiple instances.',
    realWorld: 'Common algorithms include Round Robin and Least Connections. Often a managed service in the cloud.',
    docPath: 'reliability/availability/availability-fundamentals.md',
    code: '// Round Robin Logic\nint index = requestCount++ % instances.size();',
    cloud: {
      aws: { name: 'AWS Application Load Balancer (ALB)', icon: '⚖️' },
      gcp: { name: 'GCP Cloud Load Balancing', icon: '⚖️' },
      azure: { name: 'Azure Load Balancer / App Gateway', icon: '⚖️' }
    }
  },
  'order-service': {
    title: 'Order Service (Microservice)',
    notes: 'Orchestrates the order flow.',
    realWorld: 'Stateless service scaled horizontally across multiple instances.',
    docPath: 'backend/streams-lambdas-functional.md',
    code: 'paymentClient.process(paymentInfo);',
    cloud: {
      aws: { name: 'AWS Lambda / ECS / EKS', icon: '⚙️' },
      gcp: { name: 'GCP Cloud Run / GKE', icon: '⚙️' },
      azure: { name: 'Azure Functions / AKS', icon: '⚙️' }
    }
  },
  'payment-service': {
    title: 'Payment Service (Microservice)',
    notes: 'Handles sensitive payment processing.',
    realWorld: 'Usually deployed with auto-scaling and high isolation.',
    docPath: 'security/authorization/api-security.md',
    code: 'processCharge(cardInfo);',
    cloud: {
      aws: { name: 'AWS ECS / Lambda', icon: '💳' },
      gcp: { name: 'GCP Cloud Run / Functions', icon: '💳' },
      azure: { name: 'Azure Container Apps / Functions', icon: '💳' }
    }
  },
  'inventory-service': {
    title: 'Inventory Service (Microservice)',
    notes: 'Consumes Kafka events to update stock.',
    realWorld: 'Event-driven service handling stock updates asynchronously.',
    docPath: 'monitoring/tracing/distributed-tracing.md',
    code: '@KafkaListener(topics = "order-events")',
    cloud: {
      aws: { name: 'AWS EKS / Lambda', icon: '📦' },
      gcp: { name: 'GCP GKE / Cloud Run', icon: '📦' },
      azure: { name: 'Azure AKS / Container Apps', icon: '📦' }
    }
  },
  kafka: {
    title: 'Kafka (Message Broker)',
    notes: 'The asynchronous backbone.',
    realWorld: 'Kafka enables streaming and decoupling between services.',
    docPath: 'monitoring/tracing/distributed-tracing.md',
    code: 'Topic: order-events',
    cloud: {
      aws: { name: 'Amazon MSK (Managed Streaming for Kafka)', icon: '📥' },
      gcp: { name: 'GCP Pub/Sub (or Confluent Cloud)', icon: '📥' },
      azure: { name: 'Azure Event Hubs', icon: '📥' }
    }
  },
  database: {
    title: 'Order Database',
    notes: 'Persists order data.',
    realWorld: 'Managed database with high availability and backups.',
    docPath: 'database/scaling/database-scaling.md',
    code: 'INSERT INTO orders ...',
    cloud: {
      aws: { name: 'Amazon RDS / Aurora / DynamoDB', icon: '🗄️' },
      gcp: { name: 'GCP Cloud SQL / Spanner / Firestore', icon: '🗄️' },
      azure: { name: 'Azure SQL / Cosmos DB', icon: '🗄️' }
    }
  },
  auth: {
    title: 'Auth Server',
    notes: 'Issues and validates JWT tokens.',
    realWorld: 'Centralized identity provider.',
    docPath: 'security/authentication/oauth2-jwt-guide.md',
    code: '{"sub": "user_123", "exp": 1516249022}',
    cloud: {
      aws: { name: 'Amazon Cognito', icon: '🔑' },
      gcp: { name: 'Google Cloud Identity Platform / Firebase Auth', icon: '🔑' },
      azure: { name: 'Azure AD (Entra ID) / B2C', icon: '🔑' }
    }
  },
  redis: {
    title: 'Redis (Cache)',
    notes: 'In-memory store for caching.',
    realWorld: 'Reduces latency and database load.',
    docPath: 'database/caching/caching-strategies.md',
    code: 'GET user:123',
    cloud: {
      aws: { name: 'Amazon ElastiCache', icon: '⚡' },
      gcp: { name: 'GCP Memorystore', icon: '⚡' },
      azure: { name: 'Azure Cache for Redis', icon: '⚡' }
    }
  },
  monitoring: {
    title: 'Monitoring',
    notes: 'Observability layer.',
    realWorld: 'Telemetry collection and dashboarding.',
    docPath: 'monitoring/metrics/monitoring-fundamentals.md',
    code: 'rate(http_errors_total[5m])',
    cloud: {
      aws: { name: 'Amazon CloudWatch', icon: '📈' },
      gcp: { name: 'GCP Cloud Monitoring', icon: '📈' },
      azure: { name: 'Azure Monitor', icon: '📈' }
    }
  }
};

const initialNodes: Node[] = [
  { id: 'client', data: { label: 'Client' }, position: { x: 50, y: 200 }, className: 'node-client' },
  { id: 'gateway', data: { label: 'API Gateway' }, position: { x: 250, y: 200 }, className: 'node-gateway' },
  { id: 'backend', data: { label: 'Backend' }, position: { x: 450, y: 200 }, className: 'node-service' },
  { id: 'database', data: { label: 'Database' }, position: { x: 650, y: 200 }, className: 'node-database' },
];

const initialEdges: Edge[] = [
  { id: 'e-c-g', source: 'client', target: 'gateway', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-g-b', source: 'gateway', target: 'backend', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
  { id: 'e-b-d', source: 'backend', target: 'database', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
];

function App() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedCloud, setSelectedCloud] = useState<CloudProvider>('none');
  
  // Toggles
  const [isComplexMode, setIsComplexMode] = useState(false);
  const [isScaled, setIsScaled] = useState(false);
  const [isHighTraffic, setIsHighTraffic] = useState(false);
  
  // Simulation State
  const [latency, setLatency] = useState(0);
  const [currentSpan, setCurrentSpan] = useState('Idle');
  const [traceId, setTraceId] = useState('tr-' + Math.random().toString(36).substr(2, 9));

  const onNodesChange: OnNodesChange = useCallback((chs) => setNodes((nds) => applyNodeChanges(chs, nds)), []);
  const onEdgesChange: OnEdgesChange = useCallback((chs) => setEdges((eds) => applyEdgeChanges(chs, eds)), []);
  const onConnect = useCallback((p: Connection) => setEdges((eds) => addEdge(p, eds)), []);

  const onNodeClick = (_: any, node: Node) => {
    const id = node.id.startsWith('order-service') ? 'order-service' : node.id;
    setSelectedNode(id);
  };

  const toggleComplexMode = () => {
    setIsComplexMode(!isComplexMode);
    setSelectedNode(null);
  };

  const updateArchitecture = () => {
    if (!isComplexMode) {
      setNodes(initialNodes);
      setEdges(initialEdges);
      return;
    }

    let newNodes: Node[] = [
      { id: 'client', data: { label: 'Client' }, position: { x: 50, y: 200 }, className: 'node-client' },
      { id: 'gateway', data: { label: 'API Gateway' }, position: { x: 180, y: 200 }, className: 'node-gateway' },
      { id: 'load-balancer', data: { label: 'Load Balancer' }, position: { x: 320, y: 200 }, className: 'node-lb' },
      { id: 'payment-service', data: { label: 'Payment Service' }, position: { x: 550, y: 50 }, className: 'node-service' },
      { id: 'kafka', data: { label: 'Kafka' }, position: { x: 750, y: 350 }, className: 'node-kafka' },
      { id: 'inventory-service', data: { label: 'Inventory Service' }, position: { x: 950, y: 350 }, className: 'node-service' },
      { id: 'database', data: { label: 'Order DB' }, position: { x: 750, y: 200 }, className: 'node-database' },
    ];

    let newEdges: Edge[] = [
      { id: 'e-c-g', source: 'client', target: 'gateway', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e-g-lb', source: 'gateway', target: 'load-balancer', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e-k-is', source: 'kafka', target: 'inventory-service', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
    ];

    if (isScaled) {
      newNodes.push(
        { id: 'order-service-1', data: { label: 'Order Svc (v1)' }, position: { x: 550, y: 150 }, className: 'node-service' },
        { id: 'order-service-2', data: { label: 'Order Svc (v2)' }, position: { x: 550, y: 220 }, className: 'node-service' },
        { id: 'order-service-3', data: { label: 'Order Svc (v3)' }, position: { x: 550, y: 290 }, className: 'node-service' }
      );
      
      newEdges.push(
        { id: 'e-lb-os1', source: 'load-balancer', target: 'order-service-1', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e-lb-os2', source: 'load-balancer', target: 'order-service-2', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e-lb-os3', source: 'load-balancer', target: 'order-service-3', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e-os1-ps', source: 'order-service-1', target: 'payment-service', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e-os1-db', source: 'order-service-1', target: 'database', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e-os1-k', source: 'order-service-1', target: 'kafka', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e-os2-ps', source: 'order-service-2', target: 'payment-service', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e-os2-db', source: 'order-service-2', target: 'database', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e-os2-k', source: 'order-service-2', target: 'kafka', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e-os3-ps', source: 'order-service-3', target: 'payment-service', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e-os3-db', source: 'order-service-3', target: 'database', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e-os3-k', source: 'order-service-3', target: 'kafka', animated: true, markerEnd: { type: MarkerType.ArrowClosed } }
      );
    } else {
      newNodes.push({ id: 'order-service', data: { label: 'Order Service' }, position: { x: 550, y: 200 }, className: 'node-service' });
      newEdges.push(
        { id: 'e-lb-os', source: 'load-balancer', target: 'order-service', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e-os-ps', source: 'order-service', target: 'payment-service', animated: true, label: 'Sync', markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e-os-db', source: 'order-service', target: 'database', animated: true, markerEnd: { type: MarkerType.ArrowClosed } },
        { id: 'e-os-k', source: 'order-service', target: 'kafka', animated: true, label: 'Async', markerEnd: { type: MarkerType.ArrowClosed } }
      );
    }

    if (isHighTraffic) {
        newEdges = newEdges.map(e => ({ ...e, style: { ...e.style, strokeWidth: 3, stroke: '#ef4444' } }));
    }

    setNodes(newNodes);
    setEdges(newEdges);
  };

  useEffect(() => {
    updateArchitecture();
  }, [isComplexMode, isScaled, isHighTraffic]);

  useEffect(() => {
    if (!isComplexMode) return;
    const steps = [
      { span: 'gateway:validate', lat: 15 },
      { span: 'lb:routing', lat: 25 },
      { span: 'order-service:init', lat: 50 },
      { span: 'payment-service:charge', lat: 130 },
      { span: 'order-service:persist', lat: 190 },
      { span: 'kafka:publish', lat: 220 },
    ];
    let i = 0;
    const interval = setInterval(() => {
        setCurrentSpan(steps[i].span);
        setLatency(steps[i].lat);
        if (i === steps.length - 1) setTraceId('tr-' + Math.random().toString(36).substr(2, 9));
        i = (i + 1) % steps.length;
    }, isHighTraffic ? 800 : 2000);
    return () => clearInterval(interval);
  }, [isComplexMode, isHighTraffic]);

  return (
    <div className="app-container">
      <div className="sidebar">
        <h2>System Simulator</h2>
        
        <div className="section cloud-selector">
            <h3>Cloud Provider</h3>
            <div className="cloud-chips">
                <button className={`chip ${selectedCloud === 'none' ? 'active' : ''}`} onClick={() => setSelectedCloud('none')}>Generic</button>
                <button className={`chip aws ${selectedCloud === 'aws' ? 'active' : ''}`} onClick={() => setSelectedCloud('aws')}>AWS</button>
                <button className={`chip gcp ${selectedCloud === 'gcp' ? 'active' : ''}`} onClick={() => setSelectedCloud('gcp')}>GCP</button>
                <button className={`chip azure ${selectedCloud === 'azure' ? 'active' : ''}`} onClick={() => setSelectedCloud('azure')}>Azure</button>
            </div>
        </div>

        <div className="section mode-toggle">
            <h3>Configuration</h3>
            <button className={`toggle-btn ${isComplexMode ? 'active' : ''}`} onClick={toggleComplexMode}>
                {isComplexMode ? '⚡ Robust Microservices' : '🏠 Basic Architecture'}
            </button>
        </div>

        {isComplexMode && (
            <div className="section scaling-controls">
                <h3>Scaling & Traffic</h3>
                <div className="control-group"><label><input type="checkbox" checked={isScaled} onChange={() => setIsScaled(!isScaled)} /> Enable Auto-Scaling</label></div>
                <div className="control-group traffic"><label><input type="checkbox" checked={isHighTraffic} onChange={() => setIsHighTraffic(!isHighTraffic)} /> High Traffic Mode 🔥</label></div>
            </div>
        )}

        {isComplexMode && (
            <div className="section trace-monitor">
                <h3>Live Request Trace</h3>
                <div className="trace-card">
                    <div className="trace-row"><span>Trace ID:</span> <code>{traceId}</code></div>
                    <div className="trace-row"><span>Current Span:</span> <span className="span-name">{currentSpan}</span></div>
                    <div className="trace-row"><span>Total Latency:</span> <span className="latency-val">{latency}ms</span></div>
                    <div className="latency-bar-bg"><div className="latency-bar-fill" style={{ width: `${(latency/300) * 100}%`, background: isHighTraffic ? '#ef4444' : '#38bdf8' }}></div></div>
                </div>
            </div>
        )}
        
        {selectedNode && nodeDetails[selectedNode] ? (
          <div className="detail-panel">
            <div className="detail-header">
                <h3>{nodeDetails[selectedNode].title}</h3>
                {selectedCloud !== 'none' && nodeDetails[selectedNode].cloud?.[selectedCloud] && (
                    <div className={`cloud-badge ${selectedCloud}`}>
                        {nodeDetails[selectedNode].cloud[selectedCloud].icon} {nodeDetails[selectedNode].cloud[selectedCloud].name}
                    </div>
                )}
            </div>
            
            <div className="detail-section">
                <h4>System Role</h4>
                <p>{nodeDetails[selectedNode].notes}</p>
            </div>

            <div className="detail-section highlight">
                <h4>Real-World Context</h4>
                <p>{nodeDetails[selectedNode].realWorld}</p>
            </div>

            {selectedCloud !== 'none' && nodeDetails[selectedNode].cloud?.[selectedCloud] && (
                <div className={`detail-section cloud-info ${selectedCloud}`}>
                    <h4>{selectedCloud.toUpperCase()} Service</h4>
                    <p>In {selectedCloud.toUpperCase()}, you would use <strong>{nodeDetails[selectedNode].cloud[selectedCloud].name}</strong> to implement this component.</p>
                </div>
            )}

            {nodeDetails[selectedNode].code && (
              <div className="detail-section">
                <h4>Implementation Snippet</h4>
                <pre><code>{nodeDetails[selectedNode].code}</code></pre>
              </div>
            )}

            <div className="doc-link">
                <a href={`https://github.com/jhonatanms56/system-design-playbook/blob/master/${nodeDetails[selectedNode].docPath}`} target="_blank" rel="noreferrer">
                    📖 Read Full Documentation
                </a>
            </div>

            <button className="close-btn" onClick={() => setSelectedNode(null)}>Close Details</button>
          </div>
        ) : (
          <div className="help-text">
            <p>Select a node to deep-dive into Real-World concepts.</p>
          </div>
        )}
      </div>
      <div className="flow-container">
        <div className={`cloud-banner ${selectedCloud}`}>
            {selectedCloud !== 'none' && <span>Running on <strong>{selectedCloud.toUpperCase()}</strong> Architecture</span>}
        </div>
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} onNodeClick={onNodeClick} fitView>
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export default App;
