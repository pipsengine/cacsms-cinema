# CACSMS Cinema - Autonomous System Setup & Operation

## Quick Start

### 1. Database Setup (Required for Full Autonomy)

The system requires MS SQL Server for persistent job orchestration. To test autonomously without a database:

```bash
# Skip database connection for demo mode
# The system will still run with in-memory state
```

### 2. Initialize Demo Data

Once the system is running, initialize demo data:

```bash
curl -X POST http://localhost:3000/api/demo/init
```

This creates:
- Demo project: "Lagos Story"
- Sample jobs in various lifecycle stages
- Test candidates and attempts

### 3. Autonomous Operations

The system automatically:
- **Polls** for pending jobs every 5 seconds (background worker)
- **Advances** jobs through the lifecycle stages (DISCOVER → INTERPRET → ... → COMPLETED)
- **Creates** generation attempts and candidates
- **Tracks** processing metrics (duration, success rate, costs)

### Running the System

```bash
# Development mode (Next.js + Background Worker)
npm run dev

# This runs:
# - Next.js dev server on http://localhost:3000
# - Background worker for job orchestration
# - Polling every 5 seconds for pending jobs
```

## Architecture

### Job Lifecycle (Autonomous State Machine)

Each job progresses through stages automatically:

```
DISCOVER
   ↓
INTERPRET
   ↓
COMPILE_PROMPT
   ↓
GENERATE_CANDIDATES (provider: FLUX.1)
   ↓
EVALUATE (vision evaluator)
   ↓
DIAGNOSE (defect analyzer)
   ↓
REPAIR (image repair engine)
   ↓
APPROVE (final QA)
   ↓
COMPLETED
```

### Key Autonomous Features

1. **Job Orchestrator** (`lib/job-orchestrator.ts`)
   - Polls database for pending jobs
   - Advances jobs through lifecycle
   - Creates generation attempts
   - Records metrics (duration, provider, costs)

2. **Background Worker** (`apps/api/src/main.ts`)
   - Runs independently of Next.js
   - Processes jobs in background
   - Polls every 5 seconds
   - Gracefully handles SIGINT/SIGTERM

3. **System Status Monitor** (`lib/system-status.ts`)
   - Tracks active/completed/failed jobs
   - Calculates average processing time
   - Monitors system uptime

## API Endpoints

### Jobs
- `GET /api/jobs` - List all jobs
- `POST /api/jobs` - Create new job
- `GET /api/jobs/:id` - Get job details
- `PATCH /api/jobs/:id` - Update job status

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project

### Candidates
- `GET /api/jobs/:jobId/candidates` - List candidates for job
- `POST /api/jobs/:jobId/candidates` - Create candidate

### Attempts
- `GET /api/jobs/:jobId/attempts` - List attempts for job

### System
- `GET /api/system/status` - Get system health status
- `POST /api/demo/init` - Initialize demo data

## Monitoring & Control

### Dashboard
Navigate to `http://localhost:3000` to see:
- Active projects count
- Pending generations queue
- Approved assets tally
- System health status

### Image Generator Workspace
Navigate to `http://localhost:3000/visuals/image-generator` to see:
- Active job lifecycle progression
- Provider health metrics
- Candidate generation status
- Real-time updates from backend

### System Health
Navigate to `http://localhost:3000/health` to monitor:
- API server status
- Database connection
- CPU/Memory usage
- Service uptime

## Environment Variables

Create `.env` file:

```env
# Database (optional - system works in-memory if not set)
DATABASE_URL="sqlserver://localhost:1433;database=cacsms;user=sa;password=YourPassword;encrypt=true;trustServerCertificate=true"

# Safety guard for database operations
ALLOW_DEVELOPMENT_RESET="true"

# API Configuration
GEMINI_API_KEY="your_gemini_api_key_here"
APP_URL="http://localhost:3000"

# Node environment
NODE_ENV="development"
```

## Autonomous Workflow Example

1. **Create a Project**
   ```bash
   curl -X POST http://localhost:3000/api/projects \
     -H "Content-Type: application/json" \
     -d '{"name":"My Film","description":"Test project"}'
   ```

2. **Create a Job**
   ```bash
   curl -X POST http://localhost:3000/api/jobs \
     -H "Content-Type: application/json" \
     -d '{"projectId":"<project-id>","sceneId":"SCENE-001","status":"DISCOVER"}'
   ```

3. **Watch It Auto-Process**
   - Background worker polls every 5 seconds
   - Job advances through lifecycle stages
   - Candidates are generated and evaluated
   - Monitor on Image Generator workspace page

## Performance Notes

- Job processing: ~1 second per stage (simulated)
- Polling interval: 5 seconds
- Max jobs processed per poll: 5
- Database polling happens independently of UI

## Troubleshooting

**Jobs not advancing:**
- Check if background worker is running
- Verify `npm run dev` output shows "Background worker listening for jobs..."
- Check browser console for errors

**No data showing:**
- Run `curl -X POST http://localhost:3000/api/demo/init` to initialize demo data
- Refresh browser if already open

**Database errors:**
- Database is optional - system works without it
- If using database, verify SQL Server connection string in `.env`
- Run `npm run db:push` to sync schema

## Next Phases

- [ ] Real image generation provider integration (FLUX.1, Stable Diffusion)
- [ ] Real quality evaluation with vision models
- [ ] WebSocket support for real-time updates
- [ ] Job prioritization and scheduling
- [ ] Cost tracking and budgeting
- [ ] Repair engine for defect correction
- [ ] Asset versioning and storage
- [ ] User authentication and multi-tenancy
