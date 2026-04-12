type EventHandler = (data: Record<string, unknown>) => void;

class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();
  private eventLog: Array<{ topic: string; data: Record<string, unknown>; timestamp: string }> = [];

  subscribe(topic: string, handler: EventHandler) {
    const existing = this.handlers.get(topic) || [];
    existing.push(handler);
    this.handlers.set(topic, existing);
    return () => {
      const handlers = this.handlers.get(topic) || [];
      this.handlers.set(topic, handlers.filter(h => h !== handler));
    };
  }

  publish(topic: string, data: Record<string, unknown>) {
    this.eventLog.push({ topic, data, timestamp: new Date().toISOString() });
    if (this.eventLog.length > 1000) this.eventLog.shift();

    const handlers = this.handlers.get(topic) || [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (err) {
        console.error(`Event handler error for topic ${topic}:`, err);
      }
    }
  }

  getRecentEvents(limit = 50) {
    return this.eventLog.slice(-limit);
  }
}

export const eventBus = new EventBus();

// Kafka-compatible topic names from PRD
export const TOPICS = {
  TEST_SCENARIO_CREATED: 'test.scenario.created',
  DEFECT_CLASSIFIED: 'defect.classified',
  REPORT_GENERATED: 'report.generated',
  QUALITY_GATE_EVALUATED: 'quality.gate.evaluated',
  PIPELINE_VALIDATED: 'pipeline.validated',
  IAC_REVIEWED: 'iac.reviewed',
  PERF_SCRIPT_GENERATED: 'perf.script.generated',
  SECURITY_SCANNED: 'security.scanned',
} as const;
