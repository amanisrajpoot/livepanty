# Live Streaming Tipping Platform - Project Context & Requirements

## Project Overview
Building a secure, scalable live-streaming platform where performers (hosts) broadcast video, viewers watch, and viewers tip virtual tokens in real time.

## Core Goals & Priorities
- **Real-time, low-latency streaming** (WebRTC/SFU or HLS for many viewers)
- **Micro-payments / token economy** with immediate on-screen reactions and reliable payout flows
- **Age verification, KYC, anti-exploitation & privacy** (non-negotiable)
- **Robust moderation**: automated detection + human review + reporting + takedown processes
- **Privacy-first defaults**: local processing + opt-in for retention, user consent for cloud processing

## MVP Features
- Performer signup + KYC onboarding
- Viewer signup + wallet + buy tokens (card / alternative processors)
- Live stream sessions (performer → SFU → viewer) with real-time token tipping widget
- Chat + emotes + private tip messages
- Basic moderation dashboard for content & payments
- Payout requests & accounting for performers

## High-Level Architecture
```
Clients (Browsers / Mobile apps)
⇅ Signaling WS / REST API (auth + metadata)
⇅ TURN/STUN (for WebRTC traversal)
⇅ SFU (mediasoup / Janus / LiveKit / proprietary) — media plane
⇅ CDN (for recorded / low-latency HLS fallback)
⇅ Backend services (k8s):
  - API Gateway (auth, throttling)
  - User & Session Service (Postgres)
  - Payments Service (PCI-compliant gateway integration)
  - Token Ledger / Accounting Service (Postgres + ledger)
  - KYC & Document Storage (S3, encrypted)
  - Moderation Service (ML + ingest + human queue)
  - Notifications Service (FCM/APNs / web push)
  - Worker queue (Redis + Celery / Sidekiq) for async tasks
  - Admin & Performer portals
⇅ Observability (Prometheus / Grafana / Sentry) + Logs (ELK / Loki)
```

## Streaming Stack Decision
**Real-time WebRTC via SFU (Recommended)**
- Components: Signaling server (WS), SFU (mediasoup, Janus, Jitsi-SFU, LiveKit), TURN servers (coturn), STUN
- Pros: Sub-300ms latency; ideal for interactive tipping and direct chat
- Cons: More infra; SFU instances scale with concurrent publish/subscriptions; TURN costs for NAT traversal

## Token Economy Design
**Token Model**: Virtual tokens (non-crypto), user buys tokens with real currency; tokens are burned on tip, recorded in ledger; performer balance credited in site currency.

**Key Rules**:
- Tokens are site-issued virtual currency (not blockchain token)
- Conversion rates: clearly declared (e.g., 100 tokens = $1)
- Fees: platform fee (e.g., 30%) deducted on tip conversion
- Payout timeline: weekly payouts after withdrawal request & KYC verification
- Refund policy: tokens generally non-refundable; specify exceptions for fraud

## Core Services & Responsibilities
1. **Auth Service**: Registration, login, JWT management
2. **User Service**: Profile management, preferences
3. **KYC & Documents Service**: Age verification, document storage
4. **Stream Service**: Signaling, session management
5. **Tip/Token Service**: Wallet, payments, ledger
6. **Moderation Service**: Automated detection, human review
7. **Notifications Service**: Push notifications, email
8. **Admin Service**: User management, KYC approval, payouts

## Database Schema (Core Tables)
- `users`: User accounts and profiles
- `wallets`: Token balances and reserved amounts
- `ledger`: Immutable transaction history
- `streams`: Stream sessions and metadata
- `tips`: Individual tip transactions
- `kyc`: Age verification and document status
- `payouts`: Payout requests and processing
- `reports`: User reports and moderation cases
- `sessions`: Authentication sessions
- `audit_logs`: Security and compliance logging

## Security & Compliance Requirements
**Legal/Policy**:
- Strict age verification: no minors
- Terms of Service & Acceptable Use
- Records for law enforcement
- Payment/merchant compliance for adult content

**Technical Security**:
- PCI compliance: hosted payment pages or tokenization
- Encryption: TLS everywhere, server-side encryption for attachments
- Secrets & keys: use vault (HashiCorp/AWS Secrets Manager)
- Rate limits & bot detection
- DDOS protection: CDNs + WAF
- Access controls: RBAC for admin panels with 2FA
- Data minimization & retention policies

## Moderation & Safety
- **Realtime automated detection**: ML models for nudity detection, toxicity detection in chats
- **Human moderation**: Fast-action queue, escalation procedures
- **Reporting UX**: One-click reporting with evidence preservation
- **Proactive policies**: Consent for recording, safety education

## Deployment & Scaling
**Infrastructure**:
- Kubernetes (EKS/GKE/AKS) for microservices
- Managed Postgres (RDS/Cloud SQL) with read replicas
- Redis for rate-limiting and session caches
- S3 for recordings & KYC docs (encrypted)
- Message queue for event-driven tasks
- CDN for HLS/recorded assets
- TURN servers: self-host coturn or managed providers

## MVP Roadmap (12-14 weeks)
- **Sprint 0**: Planning and requirements
- **Sprint 1**: Basic web app & auth
- **Sprint 2**: Token wallet & payment integration
- **Sprint 3**: Streaming signup + WebRTC POC
- **Sprint 4**: Ledger + tip accounting full cycle
- **Sprint 5**: KYC flow integration
- **Sprint 6**: Moderation pipeline
- **Sprint 7**: Recordings & HLS fallback
- **Sprint 8**: Security hardening
- **Sprint 9**: Beta rollout
- **Sprint 10**: Launch preparation

## Technology Stack Recommendations
- **Frontend**: React + TypeScript, mobile-friendly responsive UI
- **Backend**: Node.js/Express or FastAPI + WebSockets
- **SFU**: mediasoup or LiveKit for WebRTC SFU
- **Database**: Postgres (ACID) + Redis for caching
- **Storage**: S3 with server-side encryption
- **Queue**: Redis streams / Bull / Celery
- **Hosting**: Kubernetes with autoscaling
- **Monitoring**: Prometheus + Grafana + Sentry + ELK

## Risk Mitigation
- Payment processors for adult content: work with specialist processors
- Legal risks: strict KYC + manual verification + law enforcement cooperation
- Reputation & store limits: prepare non-store distribution
- High bandwidth costs: plan for CDN & peering agreements

## Deliverables Status
1. ✅ Project context documentation
2. 🔄 Postgres SQL schema (DDL) for core tables
3. ⏳ REST API contract (OpenAPI/Swagger v3)
4. ⏳ WebRTC POC implementation guide
5. ⏳ Compliance checklist + legal documents

## Next Steps
Choose one deliverable to implement:
1. Generate Postgres SQL schema (DDL) for tables
2. Draft REST API contract (OpenAPI/Swagger v3)
3. Produce WebRTC POC implementation guide
4. Create compliance checklist + legal document templates
