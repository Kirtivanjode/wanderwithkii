
# Wander With Ki

A full‑stack travel blog & discovery app built with **Angular 17** (standalone components) on the frontend and a **Node.js + Express** REST API backed by **PostgreSQL**. It lets visitors explore destinations, foods and adventures, read blog posts, like and comment, and curate personal bucket lists & wishlists. An admin flow allows creating posts and managing content.

**Live (Frontend):** https://wanderwithki.vercel.app/  
**API Base URL (Production):** `https://wanderwithki.onrender.com/api`

> _This README mixes user‑friendly feature overviews with developer setup and API details. No screenshots included per request._

---

## ✨ Features

- **Content browsing**
  - Blog posts with author, date, cover/logo images and like counts
  - Comments with per‑post threads
  - Destinations, Foods, Adventures, and a Homepage “sections” feed
- **User tools**
  - Wishlist per user (heart/favorite items)
  - Bucket List create/update/delete
  - View posts you liked and your comment history
- **Admin**
  - Admin login endpoint
  - Create posts with optional logo & cover image upload
  - Manage foods, adventures and homepage sections
- **Maps & UI**
  - Angular Material, Font Awesome, Bootstrap Icons
  - Leaflet maps (`@asymmetrik/ngx-leaflet`, `leaflet`)
  - Carousel support (`ngx-owl-carousel-o`)

---

## 🧰 Tech Stack

**Frontend**
- Angular 17 (standalone, `@angular/*` 17.x)
- Angular Material, Leaflet, Owl Carousel
- RxJS, Zone.js

**Backend**
- Node.js + Express
- PostgreSQL (`pg` pool)
- Multer (memory) for uploads → stored as `BYTEA` in DB and served from `/api/images/:id`
- Auth helpers: `bcrypt`/`bcryptjs`, `jsonwebtoken` (admin login endpoint in place)
- CORS, body‑parser
> Note: `mongoose` and `mssql` are present in `package.json` but the active database is **PostgreSQL** via `pg`.

---

## 📁 Monorepo Structure

```
/backend
  app.js           # Express app & routes
  server.js        # HTTP server bootstrap
  db.js            # PostgreSQL Pool (use env vars in production)
  package.json
/frontend
  angular.json
  src/app          # standalone components, guards, services, models
  package.json
README.md
```

---

## ⚙️ Local Development

### 1) Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+

### 2) Environment Variables

Create `backend/.env` and **do not commit it**. Prefer a single `DATABASE_URL`, or the individual PG variables:

```bash
# backend/.env
PORT=3000
# Option A: single URL
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require

# Option B: individual settings (used by pg.Pool if you wire them in db.js)
PGHOST=HOST
PGPORT=5432
PGDATABASE=DBNAME
PGUSER=USER
PGPASSWORD=PASSWORD

# Auth
JWT_SECRET=change-me
```

> The repo currently contains a hard‑coded pool in `backend/db.js`. For production, switch to environment variables and **do not commit secrets**.

**Recommended `backend/db.js` (example):**
```js
// db.js
const {{ Pool }} = require("pg");
const connectionString = process.env.DATABASE_URL;
const pool = connectionString
  ? new Pool({{ connectionString, ssl: {{ rejectUnauthorized: false }} }})
  : new Pool({{
      host: process.env.PGHOST || "localhost",
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || "wanderwithki",
      user: process.env.PGUSER || "postgres",
      password: process.env.PGPASSWORD || "",
      ssl: process.env.PGSSL === "true" ? {{ rejectUnauthorized: false }} : false,
    }});
module.exports = pool;
```

### 3) Install & Run

**Backend**
```bash
cd backend
npm install
npm run start   # runs server.js (http on PORT, default 3000)
# API at http://localhost:3000/api
```

**Frontend (Angular)**
```bash
cd frontend
npm install
npm run start   # or: npx ng serve
# App at http://localhost:4200
```

> The Angular app targets the production API by default:  
> `baseUrl = 'https://wanderwithki.onrender.com/api'` (see `src/app/services/blog.service.ts`).  
> For local development, you can temporarily change `baseUrl` to `http://localhost:3000/api` or introduce Angular environments.

---

## 🗄️ Database

The API expects a PostgreSQL database with tables for posts, comments, likes, wishlist, bucket list, foods, adventures, images and homepage sections. Images are stored as binary in a table and streamed from `/api/images/:id`.

> If you need ready‑to‑run `CREATE TABLE` statements, add an issue and we can include a full `init.sql` with indexes and FKs.

---

## 🔌 REST API (Summary)

Base URL: `/api`

```
POST   /admin                         # admin login
POST   /auth                          # user login (placeholder)

# Images
GET    /images/:id                    # stream image (Content-Type set dynamically)

# Posts
GET    /posts                         # list posts (+commentCount, likes)
GET    /posts/:id                     # single post
DELETE /posts/:id                     # delete post
POST   /posts/:id/like                # like/unlike toggle

# Comments
GET    /comments/:postId              # comments for a post
POST   /comments                      # add comment
DELETE /comments/:id                  # delete comment

# Bucket List
GET    /bucketlist                    # list items (optionally by ?user=)
POST   /bucketlist                    # add
PUT    /bucketlist/:id                # update
DELETE /bucketlist/:id                # delete

# Food Items
GET    /fooditems
POST   /fooditems
PUT    /fooditems/:id
DELETE /fooditems/:id

# Adventures
GET    /adventures
POST   /adventures
PUT    /adventures/:id
DELETE /adventures/:id

# Home Sections
GET    /home
POST   /home
PUT    /home/:id
DELETE /home/:id

# User‑centric
GET    /wishlist/:username
GET    /liked-posts/:username
GET    /user-comments/:username
```

> See `backend/app.js` for request/response shapes and additional details (e.g., image upload via `multer.memoryStorage()` and `BYTEA` inserts wrapped in transactions).

---

## 🚀 Deployment

**Frontend:** Vercel
- Build command: `npm run build`
- Output directory: Angular default (`dist/…`)

**Backend:** Render/Any Node host
- Start command: `node server.js`
- `PORT` provided by host
- Set environment variables (`DATABASE_URL` or PG* vars, `JWT_SECRET`)
- Enable SSL for managed Postgres (Render/Neon/Heroku): `ssl: {{ rejectUnauthorized: false }}`

**CORS**
- CORS is enabled in `app.js` (`app.use(cors())`). Ensure your frontend origin is allowed if you lock CORS down in production.

---

## 🧪 Development Tips

- Use **Angular environments** to switch API baseUrl without editing services.
- Consider moving binary images out of the DB to object storage (e.g., Cloudinary/S3) if the dataset grows.
- Add input validation and rate limiting for public endpoints.
- Replace placeholder `/api/auth` with real user auth if you plan non‑admin features.

---

## 🤝 Contributing

Issues and PRs are welcome. Please discuss major changes via an issue first.

1. Fork the repo
2. Create a branch: `git checkout -b feature/amazing-feature`
3. Commit: `git commit -m "feat: add amazing feature"`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📜 License

Specify a license you prefer (e.g., MIT). If none is specified, “All rights reserved” applies by default.

---

## 📬 Contact

**Author:** @Kirtivanjode  
**Live:** https://wanderwithki.vercel.app/

Have questions or want a tailored `init.sql` for PostgreSQL? Open an issue or reach out.
