# Reward Manager Platform (Next.js + MongoDB)

Two-role reward management system: **Admin** and **Agents**.

## Setup

1. Install dependencies:
   ```bash
   cd rm-platform
   npm install
   ```

2. Copy environment file and configure:
   ```bash
   copy .env.local.example .env.local
   ```
   - `MONGODB_URI` — MongoDB connection string
   - `JWT_SECRET` — random secret for sessions
   - `RM_USERNAME` / `RM_PASSWORD` — admin login

3. Start MongoDB locally, then run:
   ```bash
   npm run dev
   ```

4. Import existing JSON data (optional):
   ```bash
   curl -X POST http://localhost:3000/api/migrate -H "Cookie: rm_session=..." 
   ```
   Or login as admin and POST to `/api/migrate` from browser devtools.
   Default agent password after migration: `changeme123`

## Routes

### Admin
| Route | Description |
|-------|-------------|
| `/login` | Admin login |
| `/games` | Add/edit game winnings (75% net, 50% expected auto-calc) |
| `/report` | General & specific summaries, full history, calendar |
| `/agents` | Manage agents & SIM cards, map session IDs |
| `/available` | Available SIM cards (auto-updated on winning) |
| `/verify` | Approve/reject agent payment requests |

### Agent
| Route | Description |
|-------|-------------|
| `/agent/login` | Agent login |
| `/agent/games` | View winnings, mark as paid |
| `/agent/summary` | Personal summary |
| `/agent/numbers` | SIM card list with sorting |

## Business Rules

- **Net profit** = won profit × 75%
- **Expected to receive** = net profit × 50% (admin's half)
- Adding a winning auto-marks matching SIM (by agent + session ID) as **in use**
- Agent clicks **I Paid** → verification request → admin approves on `/verify`

## SIM Sorting

1. By session ID ascending
2. Group same session ID together, then ascending within group

Agents can mark SIM cards that share the same session ID.
