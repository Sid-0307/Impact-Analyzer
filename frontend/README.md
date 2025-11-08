# Impact Analyzer - Angular Frontend

## Setup

### 1. Install Angular CLI (if not installed)

```bash
npm install -g @angular/cli@17
```

### 2. Create Project

```bash
ng new impact-analyzer-frontend --routing --style=scss --standalone
cd impact-analyzer-frontend
```

### 3. Install Dependencies

```bash
npm install @angular/material @angular/cdk vis-network vis-data
```

### 4. Copy All Files

Copy all the provided component files into your `src/app/` directory following the structure:

```
src/app/
├── components/
│   ├── pr-list/
│   ├── pr-detail/
│   ├── dependency-graph/
│   └── onboard/
├── services/
│   └── api.service.ts
├── models/
│   └── types.ts
├── app.component.ts
├── app.config.ts
└── app.routes.ts
```

### 5. Run Development Server

```bash
ng serve
```

Navigate to `http://localhost:4200`

---

## Features

### 1. **PR List Dashboard** (`/`)

- View all analyzed PRs
- Risk level badges (LOW/MEDIUM/HIGH/CRITICAL)
- Click to view details
- Link to GitHub comments

### 2. **PR Detail View** (`/pr/:id`)

- Full impact analysis breakdown
- Changed files
- Backend affected files
- Frontend affected files
- Tests to update
- Tabbed interface

### 3. **Dependency Graph** (`/graph`)

- Interactive vis.js graph
- Color-coded nodes by type
- Zoom/pan controls
- Click nodes for details
- Repository selector

### 4. **Onboard Repos** (`/onboard`)

- Form to submit repo URLs
- Real-time onboarding status
- Success metrics display

---

## Architecture

```
Angular 17 (Standalone Components)
├── Material Design UI
├── vis.js for graph visualization
├── HttpClient for API calls
└── Reactive forms & routing
```

---

## API Integration

Make sure your FastAPI backend is running on `http://localhost:8000`

The frontend calls:

- `GET /api/repos` - List repositories
- `GET /api/prs` - List pull requests
- `GET /api/graph?repo_name=X` - Get dependency graph
- `POST /api/onboard` - Onboard new repos

---

## Customization

### Change Backend URL

Edit `src/app/services/api.service.ts`:

```typescript
private baseUrl = 'http://your-backend-url/api';
```

### Theme Colors

Edit `src/styles.scss` to change Material theme.

---

## Production Build

```bash
ng build --configuration production
```

Output in `dist/` directory - deploy to any static host (Netlify, Vercel, GitHub Pages).
