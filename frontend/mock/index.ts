export const mockConfigs = [
  {
    id: 1,
    name: "Production Server",
    description: "Standard configuration for production environment",
    version: "2.1.0",
    clientInfo: {
      name: "Acme Corporation",
      environment: "production",
      apiKey: "prod-acme-api-key-123",
      endpoints: {
        main: "https://api.acme.com/v2",
        backup: "https://backup-api.acme.com/v2"
      },
      features: {
        logging: true,
        monitoring: true,
        alerts: true
      },
      limits: {
        requestsPerMinute: 1000,
        connections: 200
      }
    }
  },
  {
    id: 2,
    name: "Development Server",
    description: "Configuration for development and testing",
    version: "1.5.2",
    clientInfo: {
      name: "Acme Corporation",
      environment: "development",
      apiKey: "dev-acme-api-key-456",
      endpoints: {
        main: "https://dev-api.acme.com/v2",
        backup: null
      },
      features: {
        logging: true,
        monitoring: false,
        alerts: false
      },
      limits: {
        requestsPerMinute: 5000,
        connections: 50
      }
    }
  },
  {
    id: 3,
    name: "Client A Config",
    description: "Custom configuration for Client A",
    version: "1.0.1",
    clientInfo: {
      name: "Client A Inc.",
      environment: "production",
      apiKey: "client-a-key-789",
      endpoints: {
        main: "https://api.clienta.com/v1",
        backup: "https://backup.clienta.com/v1"
      },
      features: {
        logging: true,
        monitoring: true,
        alerts: false
      },
      limits: {
        requestsPerMinute: 500,
        connections: 100
      }
    }
  },
  {
    id: 4,
    name: "Client B Config",
    description: "Custom configuration for Client B",
    version: "1.2.0",
    clientInfo: {
      name: "Client B Ltd.",
      environment: "staging",
      apiKey: "client-b-key-101",
      endpoints: {
        main: "https://staging-api.clientb.com/v2",
        backup: null
      },
      features: {
        logging: true,
        monitoring: true,
        alerts: true
      },
      limits: {
        requestsPerMinute: 800,
        connections: 150
      }
    }
  }
];