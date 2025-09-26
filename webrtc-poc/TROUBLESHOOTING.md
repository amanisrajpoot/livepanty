# Troubleshooting Guide

## Common Issues and Solutions

### 1. WebRTC Connection Issues

#### Problem: "Failed to connect to stream" or "WebRTC connection failed"
**Solutions:**
- Check if TURN server is running: `docker-compose ps coturn`
- Verify TURN server configuration in `turnserver.conf`
- Check firewall settings - ensure ports 40000-49999 are open
- Test TURN server connectivity:
  ```bash
  # Install turnutils
  sudo apt-get install coturn-utils
  
  # Test TURN server
  turnutils_stunclient localhost:3478
  ```

#### Problem: "Camera/microphone access denied"
**Solutions:**
- Ensure you're using HTTPS in production (required for camera access)
- Check browser permissions for camera/microphone
- Try refreshing the page and granting permissions again
- Test with different browsers (Chrome, Firefox, Safari)

### 2. Socket.IO Connection Issues

#### Problem: "Socket connection failed" or "Authentication failed"
**Solutions:**
- Check if signaling server is running: `curl http://localhost:3001/health`
- Verify JWT token is valid and not expired
- Check CORS settings in signaling server
- Ensure Redis is running: `docker-compose ps redis`

#### Problem: "Room not found" or "Stream not found"
**Solutions:**
- Verify stream exists in database
- Check if user has permission to join the stream
- Ensure stream status is 'live' or 'starting'
- Check stream ID in URL is correct

### 3. Database Issues

#### Problem: "Database connection failed"
**Solutions:**
- Check if PostgreSQL is running: `docker-compose ps postgres`
- Verify database credentials in `.env` file
- Check database logs: `docker-compose logs postgres`
- Ensure database schema is loaded correctly

#### Problem: "User not found" or authentication issues
**Solutions:**
- Check if user exists in database
- Verify password hashing is working correctly
- Check JWT secret is consistent across services
- Clear browser storage and try logging in again

### 4. Media Issues

#### Problem: "No video/audio" or poor quality
**Solutions:**
- Check camera/microphone permissions
- Verify media constraints in code
- Test with different devices/browsers
- Check network bandwidth and latency
- Monitor CPU usage during streaming

#### Problem: "High CPU usage" or performance issues
**Solutions:**
- Reduce video resolution in media constraints
- Limit number of concurrent streams
- Check for memory leaks in browser
- Monitor system resources
- Consider using hardware acceleration

### 5. Infrastructure Issues

#### Problem: Docker containers not starting
**Solutions:**
- Check Docker is running: `docker --version`
- Check available disk space: `df -h`
- Check port conflicts: `netstat -tulpn | grep :3000`
- Restart Docker service if needed
- Check container logs: `docker-compose logs [service]`

#### Problem: High memory usage
**Solutions:**
- Monitor container memory usage: `docker stats`
- Adjust worker limits in docker-compose.yml
- Check for memory leaks in application code
- Restart services periodically
- Consider scaling horizontally

### 6. Network Issues

#### Problem: "Connection timeout" or slow loading
**Solutions:**
- Check network connectivity
- Verify DNS resolution
- Check if services are binding to correct interfaces
- Monitor network latency
- Check for proxy/firewall interference

#### Problem: "CORS errors" in browser console
**Solutions:**
- Check CORS configuration in all services
- Verify CLIENT_URL in environment variables
- Ensure all services use same origin policy
- Check for mixed content (HTTP/HTTPS) issues

## Debugging Commands

### Check Service Status
```bash
# Check all containers
docker-compose ps

# Check specific service logs
docker-compose logs signaling-server
docker-compose logs sfu-server
docker-compose logs web-client

# Check service health
curl http://localhost:3001/health  # Signaling server
curl http://localhost:3002/health  # SFU server
```

### Database Debugging
```bash
# Connect to database
docker-compose exec postgres psql -U livepanty -d livepanty

# Check tables
\dt

# Check users
SELECT * FROM users LIMIT 5;

# Check streams
SELECT * FROM streams LIMIT 5;
```

### Network Debugging
```bash
# Check open ports
netstat -tulpn | grep :3000
netstat -tulpn | grep :3478

# Test TURN server
turnutils_stunclient localhost:3478

# Check Redis connection
docker-compose exec redis redis-cli ping
```

### Performance Monitoring
```bash
# Monitor container resources
docker stats

# Check system resources
htop
iostat -x 1

# Monitor network traffic
iftop
```

## Performance Optimization

### 1. WebRTC Optimization
- Use appropriate codec settings
- Implement adaptive bitrate
- Optimize frame rate and resolution
- Use hardware acceleration when available

### 2. SFU Optimization
- Scale workers based on CPU cores
- Implement proper load balancing
- Monitor memory usage per room
- Clean up inactive rooms

### 3. Database Optimization
- Use connection pooling
- Implement proper indexing
- Monitor query performance
- Use read replicas for scaling

### 4. Network Optimization
- Use CDN for static assets
- Implement proper caching
- Optimize payload sizes
- Use compression

## Production Considerations

### 1. Security
- Use HTTPS everywhere
- Implement proper authentication
- Use secure TURN servers
- Monitor for suspicious activity

### 2. Scalability
- Implement horizontal scaling
- Use load balancers
- Monitor resource usage
- Implement auto-scaling

### 3. Monitoring
- Set up logging aggregation
- Implement health checks
- Monitor key metrics
- Set up alerts

### 4. Backup and Recovery
- Regular database backups
- Container image backups
- Configuration backups
- Disaster recovery plan

## Getting Help

### 1. Check Logs
- Application logs: `docker-compose logs [service]`
- System logs: `journalctl -u docker`
- Browser console: F12 → Console tab

### 2. Common Resources
- [mediasoup Documentation](https://mediasoup.org/documentation/)
- [WebRTC Documentation](https://webrtc.org/getting-started/)
- [Socket.IO Documentation](https://socket.io/docs/)

### 3. Community Support
- GitHub Issues
- Discord Server
- Stack Overflow

### 4. Professional Support
- Contact the development team
- Consider hiring WebRTC specialists
- Use managed services for complex deployments

## Emergency Procedures

### 1. Service Recovery
```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart signaling-server

# Full reset (WARNING: loses data)
docker-compose down -v
docker-compose up -d
```

### 2. Data Recovery
```bash
# Backup database
docker-compose exec postgres pg_dump -U livepanty livepanty > backup.sql

# Restore database
docker-compose exec -T postgres psql -U livepanty -d livepanty < backup.sql
```

### 3. Security Incident Response
- Isolate affected services
- Check logs for suspicious activity
- Rotate secrets and certificates
- Notify users if necessary
- Document incident for future prevention
