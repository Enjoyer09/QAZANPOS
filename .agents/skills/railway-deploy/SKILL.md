---
name: railway-deploy
description: "Manage Railway deployments, environment variables, logs, database provisioning, and continuous deployment for QAZANPOS. Use this skill when deploying to Railway, linking projects, checking build/deploy logs, setting Railway environment variables, or diagnosing cloud deployment issues."
license: MIT
metadata:
  author: antigravity-community
  version: "1.0.0"
---

# Railway Deployment & Management Skill

This skill enables the agent to interact directly with Railway cloud infrastructure via the authenticated `railway` CLI and configuration files.

## Prerequisites
- Railway CLI installed (`/usr/local/bin/railway`).
- User authenticated (`railway whoami`).

## Key Workflows

### 1. Linking Project
To connect this local repository to an existing Railway project:
```bash
railway link
```
Or initialize a new project:
```bash
railway init
```

### 2. Managing Environment Variables
Check active environment variables:
```bash
railway variables
```
Set environment variables:
```bash
railway variables set PORT=3000 NODE_ENV=production
```

### 3. Deploying and Inspecting Builds
Trigger a deployment from local source:
```bash
railway up --detach
```
View deployment and application logs:
```bash
railway logs
```
Check status:
```bash
railway status
```

### 4. Running Database / Migrations in Cloud Context
Execute commands inside the Railway container environment:
```bash
railway run npm run db:push --workspace=server
```
