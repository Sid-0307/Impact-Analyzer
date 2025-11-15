# Impact Analyzer - Backend MVP

## Setup

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Setup TypeScript Parser

```bash
cd ts-parser
npm install
cd ..
```

### 3. Configure Environment

Create `.env` file:

```
GITHUB_TOKEN=your_github_personal_access_token
REPOS_PATH=./repos
DATABASE_URL=sqlite:///./impact_analyzer.db
```

Get GitHub token: https://github.com/settings/tokens (need `repo` scope)

### 4. Run Server

```bash
cd app
./analyzer/gradlew --project-dir ./analyzer/ bootRun &
python main.py
```

Server runs on `http://localhost:8000`

---

## API Endpoints

### 1. Onboard Repos

```bash
curl -X POST http://localhost:8000/api/onboard \
  -H "Content-Type: application/json" \
  -d '{
    "backend_repo_url": "https://github.com/spring-projects/spring-petclinic",
    "frontend_repo_url": "https://github.com/your-org/angular-frontend"
  }'
```

### 2. Simulate Webhook (Manual Testing)

```bash
curl -X POST http://localhost:8000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "action": "opened",
    "pull_request": {
      "title": "Test PR",
      "number": 1,
      "user": {"login": "testuser"}
    },
    "repository": {
      "full_name": "owner/repo"
    }
  }'
```

### 3. Get All PRs

```bash
curl http://localhost:8000/api/prs
```

### 4. Get Dependency Graph

```bash
curl http://localhost:8000/api/graph/owner/repo
```

---

## Testing Locally

Since webhooks need a public URL, you can:

1. **Use ngrok** to expose local server:

   ```bash
   ngrok http 8000
   ```

   Then set webhook URL in GitHub to: `https://your-ngrok-url.ngrok.io/api/webhook`

2. **Or manually trigger** analysis by calling `/api/webhook` with PR data

---

## Next Steps

1. Test with real Spring Boot + Angular repos
2. Add frontend Angular dashboard
3. Deploy to cloud (Render/Railway/Heroku)
