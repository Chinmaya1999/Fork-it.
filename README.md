# ProjectForge

Marketplace for final-year software projects: catalog, free open-source library (license-aware), paid projects, custom development, and support. MERN + TypeScript monorepo. See [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) for what is built.

## Run locally
Requires Node 20+ and a MongoDB (Atlas or local).
```bash
npm install
cp .env.example .env        # fill MONGODB_URI and JWT_SECRET (openssl rand -hex 32)
npm run build -w @projectforge/shared
npm run seed                # dev-only sample data
npm run dev                 # api :4100, web :5273
```
Some packages need install scripts (argon2, esbuild, mongodb-memory-server); with npm 11 run `npm install-scripts approve <pkg>`.

## Scripts
`npm run dev | dev:api | dev:web | build | typecheck | test | lint | seed | create-admin`

## First admin
`ADMIN_EMAIL=you@example.com ADMIN_NAME="You" npm run create-admin` and enter the password at the hidden prompt. Public registration can never create an admin.

## Admin panel
Log in at `/login` with an admin account → `/admin`. Admins manage projects (incl. README), categories, users and see the audit log. Create/reset an admin with `ADMIN_EMAIL=… npm run create-admin`. Orders, payments, tickets and custom requests will be managed here as those modules ship.

## Security notes
Secrets live only in `.env` (gitignored). Cookies are HttpOnly; state-changing requests require `X-Requested-With: projectforge`. Never commit real credentials.
