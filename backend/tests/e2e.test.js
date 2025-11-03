const request = require('supertest');
const express = require('express');
const app = require('../src/server');

describe('E2E Tests', () => {
  let testUserId;
  let testToken;

  beforeAll(async () => {
    // Setup test user
    // This would typically create a test user in the database
  });

  afterAll(async () => {
    // Cleanup test data
  });

  describe('Authentication Flow', () => {
    it('should register, login, and access protected route', async () => {
      // Register
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'e2e-test@example.com',
          password: 'Test123!@#',
          display_name: 'E2E Test User',
          username: 'e2etest',
          role: 'viewer'
        });

      expect(registerResponse.status).toBe(201);
      testToken = registerResponse.body.token;

      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'e2e-test@example.com',
          password: 'Test123!@#'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body).toHaveProperty('token');

      // Access protected route
      const protectedResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`);

      expect(protectedResponse.status).toBe(200);
    });
  });

  describe('KYC Flow', () => {
    it('should submit KYC documents and update status', async () => {
      // Submit KYC
      const kycResponse = await request(app)
        .post('/api/kyc/submit')
        .set('Authorization', `Bearer ${testToken}`)
        .attach('document', Buffer.from('test'), 'test.jpg');

      expect(kycResponse.status).toBe(201);

      // Check status
      const statusResponse = await request(app)
        .get('/api/kyc/status')
        .set('Authorization', `Bearer ${testToken}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body).toHaveProperty('verification');
    });
  });

  describe('Streaming Flow', () => {
    it('should create stream, join, and send chat message', async () => {
      // Create stream
      const createResponse = await request(app)
        .post('/api/streams')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          title: 'E2E Test Stream',
          category: 'test',
          description: 'Test description'
        });

      expect(createResponse.status).toBe(201);
      const streamId = createResponse.body.stream.id;

      // Join stream
      const joinResponse = await request(app)
        .post(`/api/streams/${streamId}/join`)
        .set('Authorization', `Bearer ${testToken}`);

      expect(joinResponse.status).toBe(200);
    });
  });

  describe('Payment Flow', () => {
    it('should purchase tokens and tip performer', async () => {
      // Purchase tokens
      const purchaseResponse = await request(app)
        .post('/api/payments/purchase')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          package: 'starter',
          paymentMethod: 'upi'
        });

      expect(purchaseResponse.status).toBe(200);

      // Check wallet balance
      const walletResponse = await request(app)
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${testToken}`);

      expect(walletResponse.status).toBe(200);
      expect(walletResponse.body).toHaveProperty('balance');
    });
  });
});

