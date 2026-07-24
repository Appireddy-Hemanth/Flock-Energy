# Deployment notes

This project is ready to deploy as a Node.js service.

## Quick options

### 1) Render
1. Create a new Web Service from this repository.
2. Use the included render.yaml.
3. Add the required environment variables:
   - PORTAL_EMAIL
   - PORTAL_PASSWORD
   - PORTAL_BASE_URL
4. Deploy.

### 2) Railway / Fly.io / Heroku
- Use the provided Procfile and Dockerfile.
- Set the same environment variables above.

### 3) Docker
```bash
docker build -t flock-energy-urja-api .
docker run -p 3000:3000 --env-file .env flock-energy-urja-api
```
