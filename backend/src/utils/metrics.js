const client = require('prom-client');

// Create a Registry to register the metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// HTTP Request Metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// Database Metrics
const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

const dbQueryTotal = new client.Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['query_type', 'status']
});

// WebSocket Metrics
const websocketConnections = new client.Gauge({
  name: 'websocket_connections_total',
  help: 'Current number of WebSocket connections'
});

const websocketMessagesTotal = new client.Counter({
  name: 'websocket_messages_total',
  help: 'Total number of WebSocket messages',
  labelNames: ['event_type']
});

// Streaming Metrics
const activeStreams = new client.Gauge({
  name: 'active_streams_total',
  help: 'Current number of active streams'
});

const streamViewers = new client.Gauge({
  name: 'stream_viewers_total',
  help: 'Current number of stream viewers',
  labelNames: ['stream_id']
});

// KYC Metrics
const kycSubmissionsTotal = new client.Counter({
  name: 'kyc_submissions_total',
  help: 'Total number of KYC submissions',
  labelNames: ['status']
});

// Moderation Metrics
const contentReportsTotal = new client.Counter({
  name: 'content_reports_total',
  help: 'Total number of content reports',
  labelNames: ['status', 'reason']
});

// Payment Metrics
const paymentsTotal = new client.Counter({
  name: 'payments_total',
  help: 'Total number of payments',
  labelNames: ['type', 'status']
});

const paymentAmount = new client.Histogram({
  name: 'payment_amount',
  help: 'Payment amounts',
  labelNames: ['type'],
  buckets: [10, 50, 100, 500, 1000, 5000, 10000]
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(dbQueryDuration);
register.registerMetric(dbQueryTotal);
register.registerMetric(websocketConnections);
register.registerMetric(websocketMessagesTotal);
register.registerMetric(activeStreams);
register.registerMetric(streamViewers);
register.registerMetric(kycSubmissionsTotal);
register.registerMetric(contentReportsTotal);
register.registerMetric(paymentsTotal);
register.registerMetric(paymentAmount);

// Middleware to track HTTP requests
function trackRequest(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    
    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode },
      duration
    );
    
    httpRequestTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode
    });
  });
  
  next();
}

// Export metrics endpoint handler
async function metricsHandler(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error.message);
  }
}

module.exports = {
  register,
  httpRequestDuration,
  httpRequestTotal,
  dbQueryDuration,
  dbQueryTotal,
  websocketConnections,
  websocketMessagesTotal,
  activeStreams,
  streamViewers,
  kycSubmissionsTotal,
  contentReportsTotal,
  paymentsTotal,
  paymentAmount,
  trackRequest,
  metricsHandler
};

