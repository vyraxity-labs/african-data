# African Data Discovery Platform

A scalable data-source discovery platform for African and Africa-relevant datasets, built as a TypeScript monorepo with Next.js 16, Tailwind CSS 4, PostgreSQL, and Prisma ORM.

## Repository Architecture

```text
african-data/
├── apps/
│   ├── public/       # Public discovery catalogue
│   └── admin/        # Administrative portal (CRUD, import/export, link health)
├── packages/
│   ├── database/     # Prisma schema, migrations, database client
│   ├── ui/           # Reusable generic UI components
│   ├── styles/       # Shared Tailwind CSS 4 styles
│   ├── types/        # Shared domain types
│   ├── validation/   # Zod validation & URL normalization schemas
│   └── config/       # Shared TypeScript & ESLint configurations
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Prerequisites

- Node.js >= 20.9 (Node 22 LTS recommended)
- pnpm >= 10 (v11 installed)
- Docker & Docker Compose (for local PostgreSQL)

## Getting Started

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start local PostgreSQL:
   ```bash
   docker compose up -d
   ```

3. Run development servers:
   ```bash
   pnpm dev
   ```
