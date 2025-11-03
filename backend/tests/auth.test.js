const request = require('supertest');
const express = require('express');
const authRoutes = require('../src/routes/auth');
const { query } = require('../src/database/connection');

// Mock dependencies
jest.mock('../src/database/connection');
jest.mock('../src/utils/logger');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'Test123!@#',
        display_name: 'Test User',
        username: 'testuser',
        role: 'viewer'
      };

      query.mockResolvedValueOnce({ rows: [] }) // Check existing user
        .mockResolvedValueOnce({ rows: [{ id: 'user-id' }] }); // Insert user

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
    });

    it('should return error for existing email', async () => {
      const userData = {
        email: 'existing@example.com',
        password: 'Test123!@#',
        display_name: 'Test User'
      };

      query.mockResolvedValueOnce({ rows: [{ id: 'existing-user' }] });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'Test123!@#'
      };

      const hashedPassword = '$2a$10$hashedpassword';
      query.mockResolvedValueOnce({
        rows: [{
          id: 'user-id',
          email: 'test@example.com',
          password: hashedPassword,
          display_name: 'Test User',
          role: 'viewer'
        }]
      });

      // Mock bcrypt compare
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
    });

    it('should return error for invalid credentials', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
    });
  });
});

