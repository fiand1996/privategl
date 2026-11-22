# Running & Environment Configuration

This guide details environment variable configuration, local setup, and Docker deployment for **Private Gallery**.

---

## ⚙️ Environment Variables

Private Gallery is configured using environment variables defined in a `.env` file at the root of the project.

| Variable                | Type              | Default               | Description                                                                                        |
| :---------------------- | :---------------- | :-------------------- | :------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`           | String (Required) | —                     | Secret key used by NextAuth.js to encrypt session tokens. Generate with `openssl rand -base64 32`. |
| `GALLERY_DATABASE_PATH` | Path              | `data/gallery.sqlite` | Custom file path for the SQLite database.                                                          |
| `PORT`                  | Number            | `3000`                | Port on which the Next.js production server listens.                                               |

---

## 💻 Local Development Setup

### 1. Prerequisites

Ensure you have the following installed on your host machine:

- **Node.js** (v20+)
- **pnpm** (`npm install -g pnpm`)

### 2. Clone & Install

```bash
git clone https://github.com/fiand1996/privategl.git
cd privategl
pnpm install
```

### 3. Environment Configuration

Create a `.env` file in the project root:

```env
AUTH_SECRET="your-super-secret-key-here"
```

### 4. Database Setup & Migrations

Initialize and run database migrations:

```bash
pnpm db:migrate
```

### 5. Start Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🐳 Docker Deployment

### Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: "3.8"

services:
  privategl:
    image: ghcr.io/fiand1996/privategl:latest
    container_name: privategl
    ports:
      - "3000:3000"
    environment:
      - AUTH_SECRET=your-secure-random-secret-key
    volumes:
      - ./data:/app/data
      - /path/to/your/local/photos:/media/photos
    restart: unless-stopped
```

Deploy the container:

```bash
docker compose up -d
```
