export type Metrics = {
  timestamp: string;
  metrics: {
    temp: number;
    pressure: number;
    vibration: number;
  };
  network_traffic: string;
  traffic_volume: number;
  status: 'SECURE' | 'CRITICAL';
  anomaly_score: number;
  log_entry: string;
};

export type LogEntry = {
  id: string;
  timestamp: string;
  sourceIp: string;
  payload: string;
  status: 'SECURE' | 'CRITICAL';
};
