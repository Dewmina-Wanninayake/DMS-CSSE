# DMS-CSSE — Smart Disaster Early-Warning and Emergency Coordination System (SE3070 Assignment 02)

Standards and ownership are in the team plan (shared privately). Module notes: `docs/modules/`. API contracts: `docs/api/`.

## Setup

```
npm install
copy .env.example .env        # set JWT_SECRET (>= 16 chars)
npm run db:migrate
npm run db:seed               # development users/data; password = SEED_DEFAULT_PASSWORD
npm run dev                   # API :4000, client :5173
```

Seeded logins (`@dms.lk`): analyst, director, officer, approver, joint, teamlead, shelter, regional, citizen, volunteer.

## Quality gates

```
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
npm run test:coverage -w server -- --coverage.include='src/modules/<module>/**'
```

Requires Node ≥ 22.9.
