const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3001;

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    message: 'LivePanty Backend Server is running!',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /health - Health check',
      'GET /api/test - Test endpoint',
      'POST /api/auth/register - User registration',
      'POST /api/auth/login - User login'
    ]
  });
});

// Mock auth endpoints for testing
app.post('/api/auth/register', (req, res) => {
  const { email, password, display_name } = req.body;
  
  if (!email || !password || !display_name) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Email, password, and display_name are required'
    });
  }

  res.status(201).json({
    message: 'Registration endpoint ready (mock)',
    user: {
      id: 'mock-user-id',
      email: email,
      display_name: display_name,
      role: 'viewer',
      status: 'pending_verification'
    },
    note: 'Database not connected - this is a mock response'
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Email and password are required'
    });
  }

  res.json({
    message: 'Login endpoint ready (mock)',
    access_token: 'mock-jwt-token',
    user: {
      id: 'mock-user-id',
      email: email,
      display_name: 'Test User',
      role: 'viewer',
      status: 'active'
    },
    note: 'Database not connected - this is a mock response'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Endpoint not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 LivePanty Backend Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
  console.log(`🔗 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⚠️  Note: Running in mock mode without database`);
});

module.exports = app;
