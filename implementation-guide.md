# African Data Discovery Platform

## Scalable Monorepo Implementation Plan

**Status:** Implementation-ready
**Initial dataset:** ~700 resources
**Primary database:** PostgreSQL
**ORM:** Prisma
**Local database:** PostgreSQL in Docker
**Production database:** Managed PostgreSQL, initially Supabase
**Repository architecture:** Monorepo
**Frontend applications:** Public App + Admin App
**Package manager:** pnpm
**Monorepo tooling:** Turborepo
**Framework:** Next.js + TypeScript
**UI:** Shared component package
**Styling:** Shared Tailwind/design-system package

---

# 1. Purpose of This Document

This document is the authoritative implementation plan for the African Data Discovery Platform.

The platform will provide a central catalogue where users can discover African and Africa-relevant data sources without the platform necessarily hosting the underlying datasets.

The platform's primary purpose is:

> Help users find where relevant data exists, understand what each source provides, determine how the data can be accessed, and navigate to the authoritative source.

The initial catalogue contains approximately 700 CSV records. More records will continuously be added.

The application must therefore be designed so that:

- 700 records work efficiently.
- The architecture can grow to tens or hundreds of thousands of resources.
- New metadata can be introduced without destructive database redesign.
- Multiple links can belong to a single resource.
- Links can periodically be checked for availability.
- Redirects and broken links can be detected.
- Link health history is retained.
- Administrators can repair links individually or in batches.
- CSV remains an import/export format rather than the primary datastore.
- The public and administrative applications remain independently deployable.
- Shared code is maintained in reusable monorepo packages.

---

# 2. Non-Negotiable Implementation Rules

Antigravity must follow these rules throughout implementation.

## Rule 1 — One step at a time

Implement only the current step.

After completing a step:

1. Run the required tests.
2. Verify the expected behavior.
3. Report files created/changed.
4. Report packages added.
5. Report environment variables added/changed.
6. Report test commands and results.
7. Stop.

Do NOT automatically proceed to the next step.

The developer will explicitly approve continuation.

---

## Rule 2 — Do not silently redesign the architecture

Do not replace:

- PostgreSQL
- Prisma
- pnpm
- Turborepo
- Next.js
- TypeScript

with alternative technologies without explicit approval.

---

## Rule 3 — PostgreSQL is the source of truth

The CSV file is NOT the application database.

CSV is used for:

- initial migration/import
- bulk updates
- bulk remediation
- backup/export
- interoperability

The application must read/write through PostgreSQL.

---

## Rule 4 — Prisma is the ORM

All database access should use Prisma.

Do not introduce Drizzle or another ORM.

---

## Rule 5 — Use migrations

Database schema changes must be performed through Prisma migrations.

Never solve schema changes by deleting/recreating the production database.

---

## Rule 6 — Avoid premature infrastructure

Do not introduce:

- Elasticsearch
- Kafka
- Redis
- microservices
- Kubernetes
- separate worker infrastructure

unless a later phase explicitly requires them.

PostgreSQL should handle search/filtering initially.

---

## Rule 7 — Preserve extensibility

Frequently queried/filterable properties should be typed database columns.

Additional less-structured metadata should use PostgreSQL JSONB through Prisma's `Json` type.

Do not use an EAV schema for the entire system.

---

## Rule 8 — Security is part of implementation

The link checker must be designed against SSRF.

Never blindly request arbitrary internal/private addresses.

Redirect destinations must also be validated.

---

# 3. Target Monorepo Architecture

The final repository should approximately follow:

```text
data-platform/
│
├── apps/
│   ├── public/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── public/
│   │   ├── package.json
│   │   └── ...
│   │
│   └── admin/
│       ├── app/
│       ├── components/
│       ├── lib/
│       ├── public/
│       ├── package.json
│       └── ...
│
├── packages/
│   ├── database/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── src/
│   │   └── package.json
│   │
│   ├── ui/
│   │   ├── src/
│   │   └── package.json
│   │
│   ├── styles/
│   │   ├── src/
│   │   └── package.json
│   │
│   ├── types/
│   │   ├── src/
│   │   └── package.json
│   │
│   ├── validation/
│   │   ├── src/
│   │   └── package.json
│   │
│   └── config/
│       ├── eslint/
│       ├── typescript/
│       └── package.json
│
├── scripts/
│
├── docker/
│
├── .env.example
├── .gitignore
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

The exact Next.js structure may differ depending on the selected Next.js version, but the architectural separation must remain.

---

# PHASE 0 — Project Definition and Repository Preparation

## Step 0.1 — Establish the repository and monorepo foundation

### Goal

Create the basic project structure so that the platform can contain two independent applications while sharing common code.

### Files

Create:

```text
package.json
pnpm-workspace.yaml
turbo.json
.gitignore
.env.example
README.md
apps/public/
apps/admin/
packages/
```

### Technical implementation

Use pnpm workspaces.

Example root `package.json`:

```json
{
  "name": "african-data-platform",
  "private": true,
  "packageManager": "pnpm@<approved-version>",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test"
  },
  "devDependencies": {
    "turbo": "^<approved-version>"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Packages

Install Turborepo and required workspace tooling.

Do not add application-specific dependencies at the root unless genuinely shared.

### Environment variables

At this stage only create `.env.example` placeholders if required.

Do not commit secrets.

### Testing

Run:

```bash
pnpm install
pnpm turbo --version
pnpm -r list
```

Verify that the workspace is recognized correctly.

### Acceptance criteria

- pnpm installation succeeds.
- Turborepo runs.
- Workspace packages are discoverable.
- No application-specific code is implemented yet.

STOP.

---

# Step 0.2 — Create the two Next.js applications

### Goal

Create the Public and Admin applications as independent Next.js applications inside the monorepo.

The public application will eventually be accessible to everyone.

The admin application will contain catalogue management, imports, link monitoring and remediation.

### Files

Create:

```text
apps/public/
apps/admin/
```

Each should contain a standard Next.js TypeScript application.

### Technical implementation

Use Next.js App Router.

Both applications must use:

- TypeScript
- ESLint
- App Router
- strict TypeScript
- shared workspace configuration where practical

### Expected URLs during local development

For example:

```text
Public:
http://localhost:3000

Admin:
http://localhost:3001
```

Use whichever ports are appropriate.

### Testing

Run:

```bash
pnpm dev
```

Verify:

- Public app loads.
- Admin app loads.
- Both applications run simultaneously.
- Editing one application does not break the other.

### Acceptance criteria

Two independent Next.js applications exist and run from one monorepo.

STOP.

---

# Step 0.3 — Establish shared configuration packages

### Goal

Prevent the two applications from developing separate TypeScript, ESLint and formatting conventions.

### Files

Create:

```text
packages/config/
packages/config/typescript/
packages/config/eslint/
```

Potential configuration files:

```text
packages/config/typescript/base.json
packages/config/typescript/nextjs.json
packages/config/eslint/base.js
```

### Technical implementation

Create shared TypeScript configuration extending a common strict configuration.

Important settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

Do not enable settings that create excessive friction without justification.

### Testing

Run:

```bash
pnpm typecheck
pnpm lint
```

### Acceptance criteria

Both applications consume shared configuration.

STOP.

---

# PHASE 1 — Local PostgreSQL Infrastructure

## Step 1.1 — Add PostgreSQL Docker environment

### Goal

Provide every developer with a reproducible local PostgreSQL database.

### Files

Create:

```text
docker-compose.yml
.env.example
```

### Technical implementation

Use PostgreSQL official Docker image.

Example:

```yaml
services:
  postgres:
    image: postgres:17
    container_name: african-data-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: african_data
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

Pin the major PostgreSQL version rather than using `latest`.

### Environment variables

```env
DATABASE_URL="postgresql://app:app@localhost:5432/african_data"
```

### Testing

```bash
docker compose up -d
docker compose ps
```

Then verify PostgreSQL is reachable.

### Acceptance criteria

- PostgreSQL starts successfully.
- Database survives container restart.
- Application can connect to port 5432.

STOP.

---

# PHASE 2 — Database Package and Prisma

## Step 2.1 — Create the shared database package

### Goal

Create one shared database package that both applications can eventually use.

### Files

Create:

```text
packages/database/package.json
packages/database/prisma/schema.prisma
packages/database/src/index.ts
```

### Packages

Install:

```bash
pnpm add -D prisma
pnpm add @prisma/client
```

inside the database package as appropriate.

### Environment

```env
DATABASE_URL="postgresql://app:app@localhost:5432/african_data"
```

### Technical implementation

Prisma schema should initially contain only the database generator and datasource.

Example:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Create a reusable Prisma client.

Example:

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
```

### Testing

Run Prisma validation and generation.

```bash
pnpm prisma validate
pnpm prisma generate
```

### Acceptance criteria

- Prisma connects to PostgreSQL.
- Prisma Client generates.
- Database package can be imported by workspace applications.

STOP.

---

# PHASE 3 — Core Data Model

## Step 3.1 — Create Institution model

### Goal

Avoid duplicating institution information across every resource.

For example, multiple Africa CDC resources should point to one Africa CDC institution record.

### File

Modify:

```text
packages/database/prisma/schema.prisma
```

### Model

Conceptually:

```prisma
model Institution {
  id          String   @id @default(cuid())
  name        String
  website     String?
  description String?
  type        String?
  country     String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  resources   Resource[]

  @@index([name])
}
```

Use names appropriate to the final domain model.

### Testing

Run:

```bash
pnpm prisma migrate dev --name create_institution
pnpm prisma generate
```

Verify the migration.

### Acceptance criteria

Institution records can be stored and related to resources.

STOP.

---

# Step 3.2 — Create the Resource model

### Goal

Create the primary catalogue entity.

A Resource represents something users can discover.

Examples:

- Africa CDC outbreak reports
- AfCFTA tariff information
- African inflation tracker

### File

Modify:

```text
packages/database/prisma/schema.prisma
```

### Core fields

The model should include strongly typed fields for important filtering/searching.

Suggested structure:

```prisma
model Resource {
  id               String   @id @default(cuid())
  name             String
  description      String?
  institutionId    String?

  sourceType       String?
  industry         String?
  category         String?
  countryCoverage  String?
  dataGranularity  String?
  language         String?
  accessType       String?
  updateFrequency  String?
  apiAvailable     Boolean  @default(false)
  priority         String?
  notes            String?

  metadata         Json?

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  institution      Institution? @relation(fields: [institutionId], references: [id])
  links            ResourceLink[]

  @@index([name])
  @@index([institutionId])
  @@index([industry])
  @@index([category])
  @@index([sourceType])
  @@index([accessType])
  @@index([apiAvailable])
}
```

### Important design decision

Do not put URLs directly into `Resource`.

URLs belong to `ResourceLink`.

### Testing

Create migration.

Insert one test resource through Prisma.

Verify the resource can be retrieved with its institution.

STOP.

---

# Step 3.3 — Create ResourceLink

### Goal

Allow one resource to have multiple URLs.

A resource may have:

- data link
- website
- API
- download
- documentation

### File

Modify:

```text
packages/database/prisma/schema.prisma
```

### Model

```prisma
enum LinkType {
  DATA
  WEBSITE
  API
  DOWNLOAD
  DOCUMENTATION
  OTHER
}

enum LinkHealthStatus {
  UNKNOWN
  HEALTHY
  REDIRECTED
  BROKEN
  TIMEOUT
  RATE_LIMITED
  BLOCKED
  SERVER_ERROR
}

model ResourceLink {
  id                    String           @id @default(cuid())
  resourceId            String
  url                   String
  linkType              LinkType

  status                LinkHealthStatus @default(UNKNOWN)
  httpStatus            Int?
  finalUrl              String?
  lastCheckedAt         DateTime?
  lastSuccessfulCheckAt DateTime?
  responseTimeMs        Int?
  errorMessage          String?

  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt

  resource              Resource         @relation(fields: [resourceId], references: [id], onDelete: Cascade)
  checks                LinkCheck[]

  @@index([resourceId])
  @@index([status])
  @@index([lastCheckedAt])
  @@unique([resourceId, url, linkType])
}
```

### Testing

Create:

- one resource
- website link
- data link
- API link

Verify all three coexist.

STOP.

---

# Step 3.4 — Create LinkCheck history

### Goal

Never overwrite historical link-health information.

If a URL works today but breaks next month, the platform should retain both facts.

### Model

```prisma
model LinkCheck {
  id              String           @id @default(cuid())
  linkId          String
  checkedAt       DateTime         @default(now())
  status          LinkHealthStatus
  httpStatus      Int?
  finalUrl        String?
  responseTimeMs  Int?
  errorType       String?
  errorMessage    String?

  link            ResourceLink     @relation(fields: [linkId], references: [id], onDelete: Cascade)

  @@index([linkId, checkedAt])
}
```

### Testing

Create several checks for one URL.

Verify historical records remain after another check is created.

STOP.

---

# PHASE 4 — Metadata Extensibility

## Step 4.1 — Establish JSON metadata convention

### Goal

Allow new non-core properties to be added without modifying the database schema.

### Technical implementation

Use Prisma `Json`:

```prisma
metadata Json?
```

Example:

```json
{
  "dataLicense": "Open Data",
  "geographicLevel": "Country",
  "methodologyAvailable": true,
  "requiresRegistration": false
}
```

### Rules

Metadata should NOT duplicate existing strongly typed columns.

For example, do not store:

```json
{
  "industry": "Health"
}
```

if `industry` is already a Resource column.

### Testing

Store and retrieve arbitrary metadata.

Verify nested objects and arrays survive a round trip.

STOP.

---

# Step 4.2 — Create custom field definitions

### Goal

Allow the catalogue schema to grow in a controlled way.

### Model

```prisma
enum CustomFieldType {
  TEXT
  NUMBER
  BOOLEAN
  SELECT
  MULTI_SELECT
  DATE
  URL
}

model CustomFieldDefinition {
  id          String          @id @default(cuid())
  name        String          @unique
  label       String
  description String?
  type        CustomFieldType
  filterable  Boolean         @default(false)
  searchable  Boolean         @default(false)
  required    Boolean         @default(false)
  options     Json?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
}
```

The field definitions describe how metadata should be interpreted.

### Important

Do not build a complete dynamic form builder yet.

Only establish the backend model.

STOP.

---

# PHASE 5 — Shared Domain Types and Validation

## Step 5.1 — Create shared validation package

### Goal

Ensure both applications validate catalogue data consistently.

### Package

```text
packages/validation/
```

Use Zod.

### Package

```bash
pnpm add zod --filter @repo/validation
```

### Schemas

Create schemas for:

- Resource creation
- Resource update
- Resource link creation
- Resource link update
- CSV row validation
- Batch URL update

Example:

```ts
export const resourceLinkSchema = z.object({
  resourceId: z.string(),
  url: z.string().url(),
  linkType: z.enum([
    'DATA',
    'WEBSITE',
    'API',
    'DOWNLOAD',
    'DOCUMENTATION',
    'OTHER',
  ]),
})
```

### Testing

Write unit tests for valid and invalid values.

STOP.

---

# PHASE 6 — Shared UI Foundation

## Step 6.1 — Create shared styles package

### Goal

Ensure Public and Admin applications have a consistent visual language.

### Package

```text
packages/styles/
```

Configure shared Tailwind/design tokens.

Define:

- typography
- spacing
- radius
- shadows
- layout conventions
- light/dark strategy if required

Do not overbuild a design system yet.

STOP.

---

# Step 6.2 — Create shared UI component package

### Goal

Allow both applications to reuse components rather than duplicating UI.

### Package

```text
packages/ui/
```

Initial components:

```text
Button
Input
Select
Checkbox
Badge
Card
Table
Pagination
Modal/Dialog
Dropdown
EmptyState
LoadingState
ErrorState
```

### Rule

UI components should remain domain-agnostic.

Do not put "ResourceTable" into the generic UI package.

That belongs in an application/domain package.

STOP.

---

# PHASE 7 — Database Seed and CSV Import Infrastructure

## Step 7.1 — Build CSV parser

### Goal

Read the existing 700-row CSV safely without inserting anything yet.

### Packages

Use a CSV parser such as:

```text
csv-parse
```

or an equivalent well-maintained package.

### Create

```text
packages/database/src/import/
packages/database/src/import/csv-parser.ts
```

### Requirements

The parser must:

- recognize headers
- normalize whitespace
- preserve original values
- handle quoted commas
- detect missing columns
- detect malformed rows
- report row numbers

### Testing

Test:

- valid CSV
- quoted values
- empty values
- malformed rows
- unexpected columns

STOP.

---

# Step 7.2 — Create CSV normalization layer

### Goal

Convert CSV-specific fields into the database model.

For example:

```text
"PDF, Online, Excel"
```

should become structured formats rather than one uncontrolled string.

Similarly:

```text
"English and French"
```

should be normalized.

### Important

Do not destroy the original source information during normalization.

### Testing

Create fixture rows and verify expected normalized output.

STOP.

---

# Step 7.3 — Create import validation report

### Goal

Before writing data, show exactly what will happen.

The import system should report:

```text
Total rows: 700

Valid:
612

Potential duplicates:
64

Invalid URLs:
12

Missing required values:
7

Other conflicts:
5
```

### Create

```text
packages/database/src/import/validate-import.ts
packages/database/src/import/types.ts
```

### Testing

Run against the actual CSV.

Do not write to the production database.

STOP.

---

# Step 7.4 — Implement transactional import

### Goal

Import validated CSV data into PostgreSQL safely.

### Important behavior

The import should not leave half-imported data if a fatal error occurs.

Use Prisma transactions where appropriate.

Potential flow:

```text
CSV
 ↓
Parse
 ↓
Normalize
 ↓
Validate
 ↓
Resolve Institution
 ↓
Create/Update Resource
 ↓
Create/Update Links
```

### Duplicate strategy

Do not silently create duplicates.

Potential matches should be reported.

### Testing

Test with:

- fresh database
- duplicate CSV
- partially invalid CSV
- repeated import

Verify idempotent behavior where intended.

STOP.

---

# PHASE 8 — Public Catalogue

## Step 8.1 — Create public layout

### Goal

Create the basic user-facing experience.

Routes should eventually include:

```text
/
 /resources
 /resources/[id]
 /institutions/[id]
```

### Initial homepage

Keep the first version simple:

- platform introduction
- search entry point
- popular categories
- featured resources
- navigation

STOP.

---

# Step 8.2 — Build resource listing

### Goal

Allow users to browse all available resources.

The listing must use:

- server-side pagination
- sorting
- filtering
- search

Do not load all resources into the browser.

### Suggested query parameters

```text
/resources?
q=inflation
&industry=Finance
&category=Economics
&access=Free
&api=true
&page=1
&pageSize=25
&sort=name
&direction=asc
```

### Testing

Verify:

- pagination
- sorting
- filters
- URL query persistence
- browser refresh retains filters

STOP.

---

# Step 8.3 — Implement resource detail page

### Goal

Show users enough information to decide whether a resource is useful before leaving the platform.

Display:

- resource name
- description
- institution
- industry
- category
- coverage
- granularity
- language
- access type
- update frequency
- formats
- API availability
- notes
- links
- last verified information

Example:

```text
Africa CDC — Outbreak Situation Reports

Institution:
Africa CDC

Coverage:
Africa

Industry:
Health / Epidemiology

Access:
Free

API:
No

Formats:
PDF, Online

Link status:
Verified recently
```

STOP.

---

# PHASE 9 — Public Search

## Step 9.1 — Implement PostgreSQL search

### Goal

Allow users to search resources by name and description without introducing an external search engine.

Initially use PostgreSQL capabilities.

Consider PostgreSQL full-text search or appropriately indexed `ILIKE` queries based on actual dataset size.

### Important

Do not introduce Elasticsearch yet.

### Testing

Test:

- exact search
- partial search
- case-insensitive search
- no-result search
- multi-word search

STOP.

---

# Step 9.2 — Implement filters

### Goal

Allow users to narrow the catalogue.

Initial filters:

- Industry
- Category
- Source Type
- Country/Coverage
- Data Granularity
- Language
- Access Type
- API Available
- Priority

### Important

Filters should be generated from structured data rather than parsing arbitrary strings where possible.

STOP.

---

# PHASE 10 — Admin Application Foundation

## Step 10.1 — Establish admin authentication

### Goal

Ensure only authorized administrators can manage catalogue data.

Use the authentication system selected for the project.

At minimum the admin application must have:

```text
/login
/admin
```

Unauthenticated users must not access admin routes.

### Security

Protect authentication secrets.

Do not expose server-only credentials to client-side code.

### Testing

Verify:

- logged-out users cannot access admin
- successful login works
- session persists correctly
- logout works
- protected API/server actions reject unauthorized access

STOP.

---

# Step 10.2 — Admin dashboard

### Goal

Give administrators a quick overview of catalogue health.

Initial metrics:

```text
Total Resources
Total Institutions
Total Links
Healthy Links
Broken Links
Links Needing Review
Resources Added Recently
```

Do not build advanced analytics yet.

STOP.

---

# PHASE 11 — Admin Resource Management

## Step 11.1 — Resource CRUD

### Goal

Administrators can create, view, edit and archive resources.

Operations:

```text
Create
Read
Update
Archive
```

Avoid hard deletion initially unless explicitly required.

### Why archive?

Deleting a resource can destroy useful history.

Use a future/initial status field such as:

```text
ACTIVE
ARCHIVED
```

if appropriate.

### Testing

Test complete CRUD lifecycle.

STOP.

---

# Step 11.2 — Institution management

### Goal

Allow administrators to manage institutions separately from resources.

Features:

- create
- edit
- view resources
- archive if necessary

Prevent accidental duplicate institutions where possible.

STOP.

---

# Step 11.3 — Link management

### Goal

Administrators can manage all links belonging to a resource.

Actions:

```text
Add link
Edit link
Delete/retire link
Check link
View check history
```

Display:

```text
Link Type
URL
Current Health
Last Checked
Last Successful Check
HTTP Status
```

STOP.

---

# PHASE 12 — Link Checker

## Step 12.1 — Build URL validation and SSRF protection

### Goal

Safely determine whether the server is allowed to make a request to a URL.

### Requirements

Reject:

- localhost
- loopback addresses
- private IPv4 ranges
- private IPv6 ranges
- link-local addresses
- cloud metadata endpoints
- internal hostnames where detectable

Validate:

- original URL
- every redirect destination

Only permit expected protocols such as:

```text
http
https
```

### Testing

Test against:

- public HTTP URL
- public HTTPS URL
- localhost
- private IP
- invalid URL
- redirect to private address

STOP.

---

# Step 12.2 — Implement single-link checker

### Goal

Given one URL, determine its current health.

The checker should:

1. Validate URL.
2. Make HTTP request.
3. Follow redirects within configured limits.
4. Validate every redirect destination.
5. Record HTTP status.
6. Record final URL.
7. Measure response time.
8. Classify status.
9. Store LinkCheck history.
10. Update ResourceLink's current status.

### Suggested timeout

Start with approximately:

```text
10–15 seconds
```

and make it configurable.

### Testing

Use controlled test URLs representing:

- 200
- 301
- 302
- 404
- 410
- 429
- 500
- 503
- timeout

STOP.

---

# Step 12.3 — Link status classification

### Goal

Convert technical HTTP/network results into understandable platform statuses.

Suggested classification:

```text
200–299 → HEALTHY

301/302/307/308 → REDIRECTED

404/410 → BROKEN

408 / timeout → TIMEOUT

429 → RATE_LIMITED

403 → BLOCKED

500–599 → SERVER_ERROR

other/network failures → UNKNOWN
```

Do not assume every non-200 response means permanent breakage.

STOP.

---

# Step 12.4 — Build manual "Check Now"

### Goal

Allow an administrator to immediately verify a link.

Admin UI:

```text
[Check Now]
```

Show:

```text
Checking...
↓
Healthy
HTTP 200
Response: 421ms
Checked: just now
```

Or:

```text
Broken
HTTP 404
```

STOP.

---

# PHASE 13 — Scheduled Link Monitoring

## Step 13.1 — Introduce scheduled checking

### Goal

Automatically check links periodically without requiring an administrator to click anything.

Start with a conservative schedule such as weekly.

Do not require complex infrastructure for the prototype.

Possible production approaches:

- Vercel Cron
- Supabase scheduled infrastructure
- another managed scheduler

The implementation should keep the checker itself independent of the scheduling mechanism.

### Important architecture

```text
Scheduler
   ↓
Find links due for checking
   ↓
Process links
   ↓
Store results
```

STOP.

---

# Step 13.2 — Prevent duplicate concurrent checks

### Goal

Ensure the same URL is not checked simultaneously by multiple jobs.

Implement a mechanism such as:

- database locking
- check-in-progress state
- job uniqueness

Do not rely solely on application memory.

STOP.

---

# PHASE 14 — Link Health Dashboard

## Step 14.1 — Build admin link-health overview

### Goal

Give administrators one place to understand catalogue link health.

Display:

```text
Total Links
Healthy
Redirected
Broken
Timeout
Rate Limited
Blocked
Server Error
Unknown
```

Provide filters.

STOP.

---

# Step 14.2 — Broken-link queue

### Goal

Give administrators a practical work queue.

Columns:

```text
Resource
Institution
Link
Status
HTTP Status
Last Checked
Last Successful Check
Action
```

Actions:

```text
Review
Check Again
Edit
Ignore
```

STOP.

---

# PHASE 15 — Link Remediation

## Step 15.1 — Individual URL replacement

### Goal

Allow an administrator to replace a broken URL with its new location.

Workflow:

```text
Broken URL
   ↓
[Replace URL]
   ↓
Enter new URL
   ↓
Validate URL
   ↓
Optionally check new URL
   ↓
Save
```

Do not destroy historical information unnecessarily.

Consider preserving the old URL in a history/audit record.

STOP.

---

# Step 15.2 — Redirect remediation

### Goal

Make it easy to convert a detected redirect into the current canonical URL.

Example:

```text
Old:
https://example.com/old

Detected:
301 → https://example.com/new

[Use Destination as Current URL]
```

Before saving, re-check the destination.

STOP.

---

# Step 15.3 — Batch URL replacement

### Goal

Allow administrators to repair multiple URLs efficiently.

UI:

```text
☑ Resource A
☑ Resource B
☑ Resource C

[Replace URLs]
```

Provide a structured interface rather than requiring one giant text field.

For larger operations, support CSV:

```csv
link_id,new_url
abc123,https://example.com/new-a
def456,https://example.com/new-b
```

### Requirements

Validate the entire batch before committing.

Report:

```text
Valid: 38
Invalid: 2
Duplicates: 1
```

Do not partially apply a batch silently.

STOP.

---

# PHASE 16 — Link Check History

## Step 16.1 — Resource link history

### Goal

Allow administrators to see how a link behaved over time.

Display:

```text
Date             Status        HTTP
────────────────────────────────────
20 Sep 2026      BROKEN        404
13 Sep 2026      HEALTHY      200
06 Sep 2026      HEALTHY      200
30 Aug 2026      REDIRECTED   301
```

This helps distinguish temporary outages from genuinely moved resources.

STOP.

---

# PHASE 17 — CSV Export

## Step 17.1 — Export catalogue to CSV

### Goal

Allow administrators to download catalogue data for backup, analysis and external workflows.

Export:

- resources
- institutions
- links
- relevant metadata

The export format should be documented.

### Testing

Export all records and compare against database counts.

STOP.

---

# PHASE 18 — Data Quality

## Step 18.1 — Duplicate detection

### Goal

Identify potentially duplicated resources.

Potential signals:

- same canonical URL
- same institution + similar resource name
- same data link
- normalized name similarity

Do not automatically delete duplicates.

Flag them for review.

STOP.

---

# Step 18.2 — Missing-data report

### Goal

Identify incomplete catalogue records.

Examples:

```text
Resources without institution
Resources without data link
Resources without description
Resources without category
Resources without coverage
Resources never verified
```

Provide a data-quality dashboard.

STOP.

---

# Step 18.3 — Stale-resource detection

### Goal

Identify resources whose information has not been verified recently.

Distinguish:

```text
Source data last updated
```

from:

```text
Platform link last verified
```

These are different concepts.

STOP.

---

# PHASE 19 — Auditability

## Step 19.1 — Add audit log

### Goal

Know who changed important catalogue information and what changed.

Create an audit mechanism for:

- resource edits
- link changes
- institution changes
- bulk imports
- bulk URL replacements
- archival actions

Example:

```text
User:
admin@example.com

Action:
UPDATE_RESOURCE_LINK

Old:
https://old.example.com/data

New:
https://new.example.com/data

Time:
2026-09-20 18:30
```

Do not log secrets.

STOP.

---

# PHASE 20 — Performance and Scalability

## Step 20.1 — Database indexes

### Goal

Ensure common filters remain fast as the dataset grows.

Review indexes for:

- resource name
- institution
- industry
- category
- source type
- access type
- API availability
- link status
- last checked
- foreign keys

Do not add indexes blindly.

Use actual query patterns.

STOP.

---

# Step 20.2 — Pagination and query limits

### Goal

Prevent accidental requests for the entire catalogue.

Every public/admin list endpoint must have pagination.

Use reasonable defaults, for example:

```text
pageSize = 25
maximum pageSize = 100
```

Do not allow arbitrary unlimited queries.

STOP.

---

# Step 20.3 — Query performance testing

### Goal

Ensure catalogue queries remain responsive.

Seed the development database with a larger synthetic dataset if necessary:

```text
10,000 resources
50,000 links
```

Measure:

- search
- filters
- sorting
- pagination
- link-health queries

Only introduce additional infrastructure if PostgreSQL actually becomes insufficient.

STOP.

---

# PHASE 21 — Production Configuration

## Step 21.1 — Production PostgreSQL

### Goal

Connect the deployed applications to managed PostgreSQL.

For the initial deployment, Supabase PostgreSQL may be used.

The application should only require a standard PostgreSQL connection string.

Example:

```env
DATABASE_URL="postgresql://..."
```

Do not hard-code provider-specific assumptions into the domain layer.

STOP.

---

# Step 21.2 — Environment separation

### Goal

Prevent development data and secrets from being mixed with production.

Maintain:

```text
.env.local
.env.example
production environment variables
```

Never commit:

```text
.env
.env.local
production secrets
```

STOP.

---

# PHASE 22 — Production Deployment

## Step 22.1 — Deploy Public application

### Goal

Deploy the public catalogue independently.

Verify:

- homepage
- search
- filters
- resource pages
- institution pages
- database reads
- error handling

STOP.

---

# Step 22.2 — Deploy Admin application

### Goal

Deploy the administrative application independently.

Verify:

- authentication
- resource management
- institution management
- link management
- link checking
- CSV import
- CSV export
- link health

STOP.

---

# Step 22.3 — Configure scheduled link checking

### Goal

Make automatic monitoring work in production.

Configure the selected production scheduler.

The scheduler should trigger the application's link-check processing endpoint/job.

Secure the scheduler endpoint using an appropriate secret.

Example:

```env
CRON_SECRET="..."
```

Do not expose this variable to the browser.

STOP.

---

# PHASE 23 — Initial Data Migration

## Step 23.1 — Import the real 700-row catalogue

### Goal

Move the existing CSV into the production database safely.

Process:

```text
CSV
 ↓
Validate
 ↓
Review report
 ↓
Fix source CSV if necessary
 ↓
Import into staging/development
 ↓
Verify counts
 ↓
Import production
```

Never directly experiment against production with the first import.

STOP.

---

# Step 23.2 — Verify migrated data

### Goal

Confirm that migration did not lose or distort catalogue information.

Compare:

```text
CSV rows
vs.
Resources
vs.
Institutions
vs.
Links
```

Check representative records from every category/source type.

STOP.

---

# PHASE 24 — Security Hardening

## Step 24.1 — Application security review

Check:

- authentication
- authorization
- CSRF protections where relevant
- server/client boundaries
- secret exposure
- SQL injection protections
- XSS
- URL validation
- SSRF
- rate limiting
- file upload validation
- CSV formula injection
- audit logging

### CSV formula injection

When exporting CSV, values beginning with characters such as:

```text
=
+
-
@
```

can be interpreted as formulas by spreadsheet applications.

Sanitize exported user-controlled strings appropriately.

STOP.

---

# PHASE 25 — Observability and Error Handling

## Step 25.1 — Centralized error handling

### Goal

Ensure failures are understandable without exposing sensitive information.

Implement consistent:

- application errors
- database errors
- validation errors
- link-check errors
- import errors

User-facing errors should be understandable.

Logs should contain technical details.

STOP.

---

# Step 25.2 — Operational dashboard

Track at minimum:

```text
Last successful database operation
Last scheduled link-check run
Number of links checked
Number of failures
Number of resources imported
Number of import errors
```

STOP.

---

# PHASE 26 — Final MVP Acceptance

The MVP is complete when all of the following work.

## Public application

- Browse resources
- Search resources
- Filter resources
- Sort resources
- Paginate resources
- View resource details
- View institution information
- Open source links
- See link verification status

## Admin application

- Authenticate
- View dashboard
- Manage resources
- Manage institutions
- Manage links
- Import CSV
- Export CSV
- Validate imports
- Detect potential duplicates
- Manually check links
- View link health
- View link history
- Replace individual URLs
- Batch-replace URLs
- Review redirects
- Archive resources

## Database

- PostgreSQL
- Prisma
- Prisma migrations
- Institution model
- Resource model
- ResourceLink model
- LinkCheck model
- CustomFieldDefinition model
- JSON metadata
- Appropriate indexes

## Link monitoring

- Healthy detection
- Redirect detection
- Broken detection
- Timeout detection
- Rate-limit detection
- Server-error detection
- SSRF protection
- Historical checks
- Scheduled checks

## Data operations

- CSV import
- Validation
- Preview
- Duplicate detection
- CSV export
- Batch URL updates

---

# 27. Suggested Development Order

The actual implementation order should be:

```text
PHASE 0
Monorepo
    ↓
PHASE 1
Local PostgreSQL
    ↓
PHASE 2
Prisma
    ↓
PHASE 3
Core database models
    ↓
PHASE 4
Extensible metadata
    ↓
PHASE 5
Validation
    ↓
PHASE 6
Shared UI
    ↓
PHASE 7
CSV import
    ↓
PHASE 8
Public catalogue
    ↓
PHASE 9
Search/filter
    ↓
PHASE 10
Admin authentication
    ↓
PHASE 11
Admin CRUD
    ↓
PHASE 12
Link checker
    ↓
PHASE 13
Scheduled monitoring
    ↓
PHASE 14
Link health dashboard
    ↓
PHASE 15
URL remediation
    ↓
PHASE 16
Link history
    ↓
PHASE 17
CSV export
    ↓
PHASE 18
Data quality
    ↓
PHASE 19
Audit logs
    ↓
PHASE 20
Performance
    ↓
PHASE 21
Production configuration
    ↓
PHASE 22
Deployment
    ↓
PHASE 23
Production migration
    ↓
PHASE 24
Security hardening
    ↓
PHASE 25
Observability
    ↓
PHASE 26
MVP acceptance
```

---

# 28. Required Antigravity Workflow

At the beginning of every implementation session, Antigravity must identify the current approved step.

For example:

```text
Current approved step:
Step 3.2 — Create Resource model
```

Antigravity must then:

1. Read the existing repository.
2. Read this implementation plan.
3. Inspect the current implementation state.
4. Identify only the files required for Step 3.2.
5. Implement Step 3.2.
6. Run all relevant tests.
7. Fix failures caused by Step 3.2.
8. Report the implementation.
9. Stop.

The response must contain:

```text
STEP COMPLETED:
3.2 — Create Resource model

FILES CREATED:
...

FILES MODIFIED:
...

PACKAGES ADDED:
...

ENVIRONMENT VARIABLES:
...

DATABASE CHANGES:
...

TESTS RUN:
...

TEST RESULTS:
...

MANUAL TESTING REQUIRED:
...

KNOWN ISSUES:
...

READY FOR NEXT STEP:
YES
```

Antigravity must NOT implement Step 3.3 until the developer explicitly says something such as:

```text
Approved. Proceed to Step 3.3.
```

---

# 29. Definition of Done for Every Step

A step is not complete merely because code has been written.

Every step must satisfy:

### 1. Implementation

Required functionality exists.

### 2. Type safety

```bash
pnpm typecheck
```

passes for affected packages.

### 3. Linting

```bash
pnpm lint
```

passes for affected packages.

### 4. Automated tests

Relevant tests pass.

### 5. Manual verification

Where applicable, the developer receives explicit instructions for manually testing the feature.

### 6. No unrelated changes

Avoid modifying unrelated files.

### 7. No hidden migrations

Database schema changes must have corresponding Prisma migrations.

### 8. No secrets committed

Never commit real:

- passwords
- API keys
- database URLs
- cron secrets
- authentication secrets

### 9. Documentation

Any new operational requirement should be documented.

---

# 30. Architectural Decisions That Should Not Be Changed Without Approval

The following are deliberate architectural choices:

| Decision              | Choice                         |
| --------------------- | ------------------------------ |
| Repository            | Monorepo                       |
| Workspace             | pnpm                           |
| Build orchestration   | Turborepo                      |
| Frontend              | Next.js                        |
| Language              | TypeScript                     |
| Database              | PostgreSQL                     |
| ORM                   | Prisma                         |
| Local DB              | Docker PostgreSQL              |
| Production DB         | Managed PostgreSQL             |
| Initial DB provider   | Supabase                       |
| Public app            | Separate Next.js app           |
| Admin app             | Separate Next.js app           |
| Shared UI             | Workspace package              |
| Shared styles         | Workspace package              |
| Shared DB client      | Workspace package              |
| Flexible metadata     | PostgreSQL JSONB / Prisma Json |
| URLs                  | Separate ResourceLink entity   |
| Link history          | Separate LinkCheck entity      |
| Search                | PostgreSQL initially           |
| CSV                   | Import/export only             |
| Link checking         | Background/scheduled           |
| Link replacement      | Human-approved                 |
| Link history          | Persistent                     |
| Search infrastructure | No Elasticsearch initially     |
| Queue infrastructure  | No Redis/Kafka initially       |

---

# 31. Future Features — Explicitly Out of MVP

The architecture should leave room for these, but they should NOT be implemented unless separately approved:

- AI-powered dataset discovery
- AI-generated resource descriptions
- Automatic broken-link replacement
- Web crawling
- Automatic source discovery
- User accounts for the public application
- Saved searches
- Bookmarks
- User collections
- Email notifications
- API access for external developers
- Public API
- Dataset quality scoring
- Source reputation systems
- Analytics
- Usage statistics
- Subscription/paywall features
- Elasticsearch
- Dedicated background worker infrastructure
- Multi-region deployment

---

# 32. Final Architectural Principle

The platform should be thought of as:

```text
                    ┌─────────────────────┐
                    │      USERS          │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   PUBLIC APP        │
                    │                     │
                    │ Search              │
                    │ Filter              │
                    │ Discover            │
                    │ Browse              │
                    └──────────┬──────────┘
                               │
                               │
                    ┌──────────▼──────────┐
                    │    PostgreSQL       │
                    │                     │
                    │ Institutions        │
                    │ Resources           │
                    │ Links               │
                    │ Link Checks         │
                    │ Metadata            │
                    │ Audit History       │
                    └──────────▲──────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
          ┌─────────┴────────┐   ┌────────┴─────────┐
          │   ADMIN APP      │   │ LINK MONITORING  │
          │                  │   │                  │
          │ CRUD             │   │ Scheduled checks │
          │ Import           │   │ Health detection │
          │ Export           │   │ Redirects        │
          │ Remediation      │   │ History          │
          └──────────────────┘   └──────────────────┘
```

The key principle is that **the platform is a catalogue and discovery system, not the datasets themselves**.

The catalogue therefore needs to be treated as valuable structured data in its own right, with strong data modelling, historical link information, validation, auditability and administrative tooling.

The initial 700 records are simply the starting dataset. The architecture should make it possible to grow the catalogue substantially without changing the fundamental data model.
