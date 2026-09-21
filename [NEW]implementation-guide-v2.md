# African Data Discovery Platform

## Implementation Guide v2

### Revision

This version supersedes the corresponding sections of the previous implementation guide.

The following architectural decisions are now fixed:

- Monorepo: pnpm + Turborepo
- Applications:
  - `apps/public`
  - `apps/admin`

- Framework: Next.js 16
- Language: TypeScript
- Styling: Tailwind CSS 4
- Database: PostgreSQL
- Local database: Docker PostgreSQL
- Production database: Prisma Postgres
- ORM: Prisma ORM
- Prisma runtime connection: Prisma Postgres serverless driver
- Authentication: Auth.js / NextAuth
- Validation: Zod
- CSV: import/export mechanism, NOT database
- Search: PostgreSQL initially
- Link monitoring: background/scheduled batched jobs
- Link checking runtime: Node.js runtime, not Edge
- Link checker: SSRF-protected
- URL checks: HEAD first + bounded GET fallback
- Per-host concurrency limiting
- Historical link-check records
- Human-approved URL replacement
- Resource lifecycle status from initial schema

---

# GLOBAL IMPLEMENTATION RULE

The developer will approve each step individually.

Antigravity MUST:

1. Implement only the current step.
2. Run the required automated tests.
3. Perform the requested manual verification.
4. Report all files changed.
5. Report packages added.
6. Report environment changes.
7. Report database migrations.
8. Report test results.
9. STOP.

Antigravity must NOT continue to the next step until explicitly instructed.

Example:

> Approved. Proceed to Step 12.2.

---

# PHASE 0 — MONOREPO FOUNDATION

## Step 0.1 — Create monorepo

### Goal

Create the project foundation containing two independent applications and shared packages.

### Structure

```text
apps/
  public/
  admin/

packages/
  database/
  ui/
  styles/
  types/
  validation/
  config/
```

Use:

- pnpm
- Turborepo
- TypeScript

### Versions

Use current stable versions compatible with Next.js 16.

Do not use Next.js 14 or 15 merely for conservatism.

Next.js 16 is stable and is the current major release.

### Testing

```bash
pnpm install
pnpm turbo --version
pnpm -r list
```

STOP.

---

# Step 0.2 — Create Next.js 16 applications

### Goal

Create separate public and administrative applications.

### Applications

```text
apps/public
apps/admin
```

Both use:

- Next.js 16
- React 19
- TypeScript
- App Router
- ESLint
- Tailwind CSS 4

Next.js 16 requires Node.js 20.9 or newer.

Use a compatible Node.js LTS version, preferably Node 22 LTS if supported by the selected deployment environment.

### Testing

Run both applications simultaneously.

Example:

```text
Public → http://localhost:3000
Admin  → http://localhost:3001
```

STOP.

---

# Step 0.3 — Configure Tailwind CSS 4

### Goal

Establish one consistent styling system shared by both applications.

Use Tailwind CSS 4.

The current Tailwind documentation provides a direct Next.js setup using:

```bash
tailwindcss
@tailwindcss/postcss
postcss
```

and:

```css
@import 'tailwindcss';
```

Do NOT use Tailwind 3 configuration such as:

```text
tailwind.config.js
@tailwind base;
@tailwind components;
@tailwind utilities;
```

unless a specific compatibility requirement is discovered.

### Testing

Verify:

- Tailwind classes compile.
- Shared UI package styles are visible in both apps.
- Production build succeeds.

```bash
pnpm build
```

STOP.

---

# Step 0.4 — Shared configuration packages

Create:

```text
packages/config/
```

Include shared:

- TypeScript configuration
- ESLint configuration
- formatting conventions where appropriate

Use strict TypeScript.

Testing:

```bash
pnpm typecheck
pnpm lint
```

STOP.

---

# PHASE 1 — LOCAL POSTGRESQL

## Step 1.1 — Docker PostgreSQL

### Goal

Provide reproducible local PostgreSQL development.

Create:

```text
docker-compose.yml
```

Use a pinned PostgreSQL major version.

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

### Environment

```env
DATABASE_URL="postgresql://app:app@localhost:5432/african_data"
```

### Testing

```bash
docker compose up -d
docker compose ps
```

Verify the database is accessible.

STOP.

---

# PHASE 2 — PRISMA

## Step 2.1 — Create database package

### Goal

Centralize database access so both applications use the same database package.

Create:

```text
packages/database/
```

Install Prisma ORM.

Use the current Prisma version compatible with the project.

### Important Prisma Postgres decision

Production will use **Prisma Postgres**.

We will use the **Prisma Postgres serverless driver** rather than Prisma Accelerate.

Prisma's current documentation states that the serverless driver connects to Prisma Postgres through HTTP/WebSockets and can be used with Prisma ORM through `@prisma/adapter-ppg`.

This avoids introducing a separate `DIRECT_URL` environment variable for this architecture.

### Packages

```bash
pnpm add @prisma/client @prisma/adapter-ppg
pnpm add -D prisma
```

### Prisma configuration

The exact Prisma 7 configuration should follow the currently installed Prisma version.

For Prisma Postgres serverless-driver usage, the runtime connection will ultimately use:

```env
DATABASE_URL="postgres://..."
```

No `DIRECT_URL` should be introduced unless a future Prisma version/runtime requirement explicitly makes it necessary.

### Important

Do NOT use:

```text
@prisma/extension-accelerate
```

for this project.

Prisma currently states that Prisma Accelerate is being retired on December 1, 2026.

### Testing

Run:

```bash
pnpm prisma validate
pnpm prisma generate
```

STOP.

---

# PHASE 3 — DATABASE SCHEMA

## Step 3.1 — Institution

Create:

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

STOP.

---

# Step 3.2 — Resource

### Goal

Create the central catalogue entity.

### Important addition

Resource lifecycle status must be included from the beginning.

```prisma
enum ResourceStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}
```

Resource:

```prisma
model Resource {
  id               String         @id @default(cuid())
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
  apiAvailable     Boolean        @default(false)
  priority         String?

  notes            String?
  metadata         Json?

  status           ResourceStatus @default(DRAFT)

  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  institution      Institution?   @relation(
    fields: [institutionId],
    references: [id]
  )

  links            ResourceLink[]

  @@index([name])
  @@index([institutionId])
  @@index([industry])
  @@index([category])
  @@index([sourceType])
  @@index([accessType])
  @@index([apiAvailable])
  @@index([status])
}
```

### Why DRAFT?

Newly imported records should not necessarily become publicly visible immediately.

The eventual workflow can be:

```text
CSV Import
   ↓
DRAFT
   ↓
Admin review
   ↓
ACTIVE
```

### Testing

Create migration.

Create:

- DRAFT resource
- ACTIVE resource
- ARCHIVED resource

Verify status persistence.

STOP.

---

# Step 3.3 — ResourceLink

### Goal

Separate resources from their URLs.

One resource can have multiple URLs.

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
```

```prisma
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

  resource              Resource         @relation(
    fields: [resourceId],
    references: [id],
    onDelete: Cascade
  )

  checks                LinkCheck[]

  @@index([resourceId])
  @@index([status])
  @@index([lastCheckedAt])
}
```

### URL uniqueness

Do NOT rely solely on:

```prisma
@@unique([resourceId, url, linkType])
```

because URL strings can differ while referring to the same logical URL.

URL normalization must happen before persistence.

### Testing

Verify multiple link types can belong to one resource.

STOP.

---

# Step 3.4 — LinkCheck history

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

  link            ResourceLink     @relation(
    fields: [linkId],
    references: [id],
    onDelete: Cascade
  )

  @@index([linkId, checkedAt])
}
```

### Goal

Every check creates a historical record.

Never overwrite previous LinkCheck records.

STOP.

---

# PHASE 4 — URL NORMALIZATION

## Step 4.1 — URL normalization

### Goal

Prevent accidental duplicates caused by trivial URL formatting differences.

Create:

```text
packages/validation/src/url.ts
```

The normalization layer should:

- trim whitespace
- validate URL syntax
- normalize hostname casing
- normalize obvious trailing slash differences where safe
- remove accidental whitespace
- normalize protocol casing
- preserve meaningful path/query/case information

### Important

Do NOT blindly lowercase the entire URL.

This can corrupt case-sensitive paths:

```text
/Data/Report
```

versus:

```text
/data/report
```

may be different resources.

### Important

Do NOT automatically remove query parameters.

Some data portals depend on them.

### Testing

Test:

```text
https://example.com
https://example.com/
HTTPS://EXAMPLE.COM
https://example.com/data
https://example.com/Data
https://example.com/data?id=123
```

Verify normalization does not incorrectly collapse distinct URLs.

STOP.

---

# PHASE 5 — VALIDATION AND METADATA

Implement the original validation and JSON metadata phases, with these requirements:

- Zod for validation.
- Typed columns for commonly filtered fields.
- `metadata Json` for extensibility.
- Custom field definitions for future dynamic metadata.

No EAV model.

STOP after each individual implementation step.

---

# PHASE 6 — SHARED UI

Use Tailwind CSS 4.

Create shared:

```text
packages/ui
packages/styles
```

The generic UI package should contain components such as:

- Button
- Input
- Select
- Badge
- Card
- Table
- Dialog
- Pagination
- EmptyState
- LoadingState
- ErrorState

Do not put catalogue-specific components in the generic UI package.

STOP after each implementation step.

---

# PHASE 7 — CSV DEVELOPMENT FIXTURE AND IMPORT

## Step 7.1 — Sample CSV fixture

### Goal

Allow Antigravity to understand the actual CSV format without making the development system dependent on the real 700-row dataset.

The developer will provide a small sample containing several representative rows.

The sample CSV is for:

- schema discovery
- parser development
- normalization development
- validation testing
- UI development
- automated tests

It must NOT become the database seed.

### Location

Recommended:

```text
fixtures/sample-data-sources.csv
```

or:

```text
packages/database/fixtures/sample-data-sources.csv
```

### Important

The actual 700+ row production dataset will NOT be committed as the development database seed.

It will eventually be uploaded through:

```text
Admin App
   ↓
CSV Import
   ↓
Validation
   ↓
Preview
   ↓
Admin approval
   ↓
Database
```

### Testing

The sample CSV should be used in automated parser tests.

STOP.

---

# Step 7.2 — CSV parser

Parse:

- exact headers
- quoted values
- commas inside values
- empty fields
- malformed records
- unexpected columns

Every parsing error must contain a row number.

STOP.

---

# Step 7.3 — CSV normalization

Normalize fields such as:

```text
Available Formats
Language
Country / Coverage
API Available
Access Type
Priority
```

Do not assume that the sample contains every possible value.

The normalization layer should therefore be defensive and report unknown values rather than silently changing them.

STOP.

---

# Step 7.4 — Import preview

The import system must first produce a report.

Example:

```text
700 rows

Valid: 612
Potential duplicates: 64
Invalid URLs: 12
Missing fields: 7
Unknown values: 5
```

No database writes occur during preview.

STOP.

---

# Step 7.5 — Admin CSV upload

### Goal

Allow the administrator to upload the actual dataset through the Admin application.

The upload process:

```text
Upload CSV
   ↓
Parse
   ↓
Validate
   ↓
Normalize
   ↓
Duplicate detection
   ↓
Preview
   ↓
Admin confirmation
   ↓
Import
```

### Security

Validate:

- file type
- file size
- encoding
- row count
- malformed CSV
- malicious content

CSV content must not be trusted.

STOP.

---

# PHASE 8 — PUBLIC APPLICATION

Implement the public catalogue as originally specified:

```text
/
 /resources
 /resources/[id]
 /institutions/[id]
```

Use server-side pagination and filtering.

Never fetch all catalogue records to the browser.

STOP after each step.

---

# PHASE 9 — SEARCH AND FILTERING

Use PostgreSQL initially.

Implement:

- search
- pagination
- sorting
- industry filter
- category filter
- country/coverage filter
- source type
- access type
- API availability
- language
- data granularity

Do not introduce Elasticsearch.

STOP after each step.

---

# PHASE 10 — ADMIN AUTHENTICATION

## Step 10.1 — Auth.js / NextAuth

### Goal

Protect the Admin application so only authenticated administrators can access administrative functionality.

Use Auth.js / NextAuth.

Current Auth.js documentation supports Next.js integration with:

```ts
import NextAuth from 'next-auth'
```

and the modern `auth.ts`/`proxy.ts` pattern.

### Architecture

Authentication should belong to the Admin application.

The Public application should not depend on admin authentication.

### Required routes

```text
/admin/login
/admin
```

### Requirements

Protect:

- admin pages
- server actions
- route handlers
- database mutations

Do not rely solely on hiding UI elements.

### Testing

Verify:

- unauthenticated request → rejected
- authenticated admin → allowed
- logout → protected resources unavailable
- direct URL access is protected

STOP.

---

# PHASE 11 — ADMIN CRUD

Implement:

- Resource CRUD
- Institution management
- Resource link management
- Draft/Active/Archived lifecycle

New resources created manually should default to:

```text
DRAFT
```

Only explicitly published/activated resources should appear in the public catalogue.

STOP after each step.

---

# PHASE 12 — LINK CHECKER SECURITY AND IMPLEMENTATION

This phase is significantly revised.

---

## Step 12.1 — Link checker must use Node.js runtime

### Goal

Ensure the checker can use low-level networking controls.

Do NOT run the link checker on an Edge runtime.

The checker must run in a Node.js runtime.

Reason:

The SSRF protection requires control over DNS resolution/socket connection behavior.

---

# Step 12.2 — SSRF protection

### Goal

Prevent the platform from becoming a proxy for requests to private/internal infrastructure.

The checker must reject destinations resolving to:

```text
127.0.0.0/8
10.0.0.0/8
172.16.0.0/12
192.168.0.0/16
169.254.0.0/16
::1
fc00::/7
fe80::/10
```

and equivalent private/link-local ranges.

Also reject known cloud metadata destinations.

Only:

```text
http:
https:
```

are permitted.

---

# Step 12.3 — Defend against DNS rebinding / TOCTOU

### Goal

Prevent this unsafe sequence:

```text
DNS check
   ↓
"Public IP — safe"
   ↓
fetch(url)
   ↓
DNS changes
   ↓
Request goes to 127.0.0.1
```

A separate pre-resolution followed by ordinary `fetch()` is NOT sufficient.

### Required architecture

Use Node.js `undici`/dispatcher or Node HTTP/HTTPS mechanisms with a custom DNS lookup mechanism.

The actual socket connection must validate the resolved destination IP before sending request headers.

Conceptually:

```text
URL
 ↓
Resolve hostname
 ↓
Validate IP
 ↓
Open connection
 ↓
Validate actual resolved socket destination
 ↓
Send HTTP request
```

The implementation must also validate every redirect destination.

### Important

Do not implement a simplistic:

```ts
await dns.lookup(hostname)
await fetch(url)
```

as the security mechanism.

That remains vulnerable to TOCTOU/DNS rebinding.

### Testing

Create tests for:

- localhost
- private IPv4
- private IPv6
- link-local
- metadata endpoint
- public domain
- redirect from public → private
- DNS rebinding simulation where practical

STOP.

---

# Step 12.4 — Redirect security

### Goal

Prevent a safe initial URL from redirecting to an unsafe destination.

For every redirect:

```text
Original URL
 ↓
Redirect destination
 ↓
Resolve destination
 ↓
SSRF validation
 ↓
Only then connect
```

Maximum redirects:

```text
5
```

or another conservative configurable limit.

Do not follow unlimited redirects.

STOP.

---

# Step 12.5 — HEAD-first link checking

### Goal

Avoid downloading large datasets unnecessarily while still supporting institutional websites that reject HEAD.

First attempt:

```http
HEAD /resource
```

If the server returns:

```text
403
405
```

or the HEAD request fails in a way suggesting the endpoint does not support HEAD:

fall back to:

```http
GET
```

### GET requirements

The GET must be bounded.

Do not download entire files.

Read only enough data to establish that the resource is accessible.

For example:

```text
first ~1 KB
```

or use an appropriate HTTP range request where supported.

### Important

A server returning:

```text
200
```

to HEAD is not enough to prove GET works in every case.

The checker should classify the result based on the actual response semantics.

### Testing

Test:

- HEAD 200
- HEAD 403 → GET
- HEAD 405 → GET
- HEAD timeout
- GET 200
- large file
- redirecting resource

STOP.

---

# Step 12.6 — Per-host concurrency limiting

### Goal

Avoid hammering government/institutional servers.

Example:

```text
statssa.gov.za
   ├── Resource A
   ├── Resource B
   ├── Resource C
   ├── Resource D
   └── Resource E
```

Do not check all five simultaneously.

Start with:

```text
MAX_CONCURRENT_PER_HOST = 1
```

Allow this to become configurable later.

Different hosts may be checked concurrently.

Example:

```text
statssa.gov.za → 1 active
worldbank.org  → 1 active
africacdc.org  → 1 active
```

This provides global concurrency without excessive per-domain load.

### Testing

Create multiple links pointing to the same host.

Verify only the configured number execute simultaneously.

STOP.

---

# Step 12.7 — Link status classification

Use:

```text
2xx → HEALTHY

301/302/307/308 → REDIRECTED

404/410 → BROKEN

408 / timeout → TIMEOUT

429 → RATE_LIMITED

403 → BLOCKED

500–599 → SERVER_ERROR
```

Do not classify temporary 500/503 responses as permanently broken.

STOP.

---

# PHASE 13 — SCHEDULED LINK MONITORING

## Step 13.1 — Batched scheduled checking

### Goal

Avoid serverless execution timeouts.

Never attempt to check every link in one cron invocation.

Start with:

```text
25–50 links per invocation
```

The batch size must be configurable.

Example:

```env
LINK_CHECK_BATCH_SIZE=25
```

---

# Step 13.2 — Determine links due for checking

A link is eligible if:

```text
lastCheckedAt IS NULL
```

or:

```text
lastCheckedAt <= now - CHECK_INTERVAL
```

Use an indexed query.

Do not load every link into application memory.

---

# Step 13.3 — Atomic job claiming

### Goal

Prevent two concurrent scheduled jobs from checking the same links.

Use PostgreSQL row locking.

Preferred conceptual pattern:

```sql
SELECT id
FROM "ResourceLink"
WHERE ...
ORDER BY "lastCheckedAt" NULLS FIRST
FOR UPDATE SKIP LOCKED
LIMIT 25;
```

Then mark the selected rows as claimed.

An explicit claim state is preferable to overloading `UNKNOWN` as a lock marker.

Add fields such as:

```prisma
checkLockedUntil DateTime?
checkLockToken   String?
```

Potentially:

```prisma
checkAttemptedAt DateTime?
```

### Why?

This allows:

```text
Worker A → claims links 1–25
Worker B → skips 1–25 and claims 26–50
```

If Worker A crashes, the lock eventually expires.

### Important

Do NOT use a simplistic:

```sql
UPDATE ... LIMIT 25
```

unless the exact PostgreSQL semantics and race behavior are correctly implemented.

Use a transaction with `FOR UPDATE SKIP LOCKED` or an equivalent atomic claiming mechanism.

STOP.

---

# Step 13.4 — Process claimed batch

### Goal

Process only the links claimed by the current worker.

For each link:

```text
Claimed
 ↓
Check URL
 ↓
Record LinkCheck
 ↓
Update ResourceLink
 ↓
Release claim
```

If checking fails unexpectedly:

```text
Record failure
 ↓
Release claim
```

Do not leave links permanently locked.

Use a lock expiration as a safety mechanism.

STOP.

---

# Step 13.5 — Scheduled endpoint security

If using a cron HTTP endpoint:

```text
/api/internal/link-check
```

protect it using:

```env
CRON_SECRET="..."
```

The secret must remain server-side.

The endpoint must reject requests without valid authorization.

STOP.

---

# PHASE 14 — LINK HEALTH DASHBOARD

Build:

```text
Healthy
Redirected
Broken
Timeout
Rate Limited
Blocked
Server Error
Unknown
```

with filters and pagination.

Do not display thousands of records at once.

STOP after each step.

---

# PHASE 15 — LINK REMEDIATION

## Step 15.1 — Individual replacement

Workflow:

```text
Broken URL
 ↓
Replace
 ↓
Enter new URL
 ↓
Normalize
 ↓
Validate
 ↓
Check
 ↓
Save
```

The old URL must not disappear from history.

Create an audit record.

STOP.

---

# Step 15.2 — Redirect replacement

If:

```text
OLD → 301 → NEW
```

show:

```text
Detected destination:
NEW

[Use Destination]
```

Before saving:

1. Validate NEW.
2. SSRF-check NEW.
3. Check NEW.
4. Save only if appropriate.

STOP.

---

# Step 15.3 — Batch replacement

Support:

```text
Select multiple links
 ↓
Upload replacement CSV
 ↓
Validate
 ↓
Preview
 ↓
Confirm
 ↓
Apply transactionally
```

CSV:

```csv
link_id,new_url
abc123,https://example.com/new
def456,https://example.com/another
```

Do not silently partially apply invalid batches.

STOP.

---

# PHASE 16 — LINK HISTORY

Show historical checks:

```text
Date          Status       HTTP
--------------------------------
20 Sep        BROKEN       404
13 Sep        HEALTHY      200
06 Sep        HEALTHY      200
30 Aug        REDIRECTED   301
```

Also display:

- response time
- final URL
- error type
- error message

STOP.

---

# PHASE 17 — CSV EXPORT

Export catalogue information.

Ensure spreadsheet formula injection is handled.

Values beginning with:

```text
=
+
-
@
```

must not become unintended spreadsheet formulas when opened in spreadsheet software.

STOP.

---

# PHASE 18 — DATA QUALITY

Implement:

- duplicate detection
- missing-field reports
- stale verification reports
- resources without links
- resources without institutions
- resources never checked

Potential duplicates should be flagged, not automatically deleted.

STOP after each step.

---

# PHASE 19 — AUDIT LOG

Track important administrative actions.

At minimum:

```text
CREATE_RESOURCE
UPDATE_RESOURCE
ARCHIVE_RESOURCE
CREATE_LINK
UPDATE_LINK
REPLACE_LINK
BULK_REPLACE_LINKS
CSV_IMPORT
RESOURCE_STATUS_CHANGE
```

Store:

- actor
- action
- entity
- entity ID
- timestamp
- relevant before/after values

Never store passwords, authentication tokens or other secrets.

STOP.

---

# PHASE 20 — PERFORMANCE

Test with synthetic data:

```text
10,000 resources
50,000 links
```

Measure:

- resource search
- filtering
- pagination
- sorting
- link-health queries
- admin tables

Only introduce Elasticsearch/Redis/etc. if PostgreSQL is demonstrably insufficient.

STOP.

---

# PHASE 21 — PRISMA POSTGRES PRODUCTION

### Goal

Deploy the database using Prisma Postgres.

### Environment

The project should use:

```env
DATABASE_URL="..."
```

The implementation should use the Prisma Postgres serverless driver.

Do NOT introduce:

```env
DIRECT_URL
```

unless a future architectural decision explicitly requires it.

Prisma's current serverless-driver documentation supports using the Prisma Postgres connection string directly with `@prisma/adapter-ppg`.

### Important distinction

This is different from the conventional pooled TCP architecture.

If the project later switches to:

```text
@prisma/adapter-pg
```

with pooled TCP connections, then Prisma's current recommended architecture uses a separate direct connection for CLI/migrations.

For this project, we deliberately choose the serverless-driver approach to keep the connection model simple.

STOP.

---

# PHASE 22 — PRODUCTION DEPLOYMENT

## Step 22.1 — Public application

Deploy separately.

Verify:

- search
- filtering
- resource details
- institution pages
- links
- production database

STOP.

---

# Step 22.2 — Admin application

Deploy separately.

Verify:

- authentication
- CRUD
- CSV upload
- CSV preview
- CSV import
- link management
- link checking

STOP.

---

# Step 22.3 — Scheduled monitoring

Configure production scheduler.

The scheduler must invoke only a small batch.

For example:

```text
Every 5 minutes
    ↓
Claim up to 25 links
    ↓
Process
    ↓
Exit
```

The scheduler should not attempt to process the entire catalogue.

This makes the system compatible with serverless execution limits.

STOP.

---

# PHASE 23 — PRODUCTION CSV IMPORT

### Goal

Populate the production database from the actual 700+ row CSV through the Admin application.

The sample CSV is NOT used.

The process is:

```text
Admin uploads real CSV
        ↓
Parse
        ↓
Validate
        ↓
Normalize
        ↓
Duplicate detection
        ↓
Preview
        ↓
Admin approval
        ↓
Import as DRAFT
        ↓
Admin review
        ↓
Activate resources
```

### Important

There must be no requirement to place the full CSV in the repository.

The production dataset belongs in the Admin import workflow.

STOP.

---

# PHASE 24 — SECURITY HARDENING

Perform a dedicated security review covering:

### Authentication

- session security
- authorization
- admin route protection
- server action protection

### CSV

- file size
- file type
- malformed content
- formula injection
- encoding

### Link checker

- SSRF
- DNS rebinding
- redirect validation
- private IP blocking
- metadata endpoint blocking
- timeout
- request size
- response size
- per-host rate limiting

### Database

- parameterized queries through Prisma
- least-privilege credentials
- secrets management

STOP.

---

# PHASE 25 — OBSERVABILITY

Track:

```text
Last successful import
Last link-check batch
Links checked
Healthy links
Broken links
Redirected links
Timeouts
Rate-limited links
Import errors
```

Also record errors in a structured way.

STOP.

---

# PHASE 26 — MVP ACCEPTANCE

The MVP is complete when:

## Public

- Users can search.
- Users can filter.
- Users can sort.
- Users can paginate.
- Users can view resources.
- Users can view institutions.
- Users can open source links.
- Users can see link verification information.

## Admin

- Admin authentication works.
- Resources can be managed.
- Institutions can be managed.
- Links can be managed.
- CSV can be uploaded.
- CSV can be validated.
- CSV can be previewed.
- CSV can be imported.
- CSV can be exported.
- Link health can be monitored.
- Individual links can be repaired.
- Multiple links can be repaired.
- Link history can be viewed.
- Resources can be drafted/activated/archived.

## Link monitoring

- HEAD-first checking works.
- GET fallback works.
- GET is bounded.
- Redirects are followed safely.
- Redirect targets are SSRF-checked.
- DNS rebinding protections are implemented.
- Private IPs are blocked.
- Per-host concurrency is limited.
- Checks are persisted historically.
- Scheduled batches are atomic/idempotent.

## Database

- PostgreSQL works locally.
- Prisma migrations work.
- Prisma Postgres works in production.
- No destructive migration is required to add future metadata.
- Resource status exists.
- JSON metadata exists.
- Link history exists.

---

# FINAL ANTIGRAVITY IMPLEMENTATION PROTOCOL

Before implementing any step, Antigravity must determine:

```text
What is the currently approved step?
```

It must inspect:

1. Existing repository.
2. Existing implementation.
3. This implementation guide.
4. Existing migrations.
5. Existing tests.

Then it implements ONLY that step.

At completion, report:

```text
STEP:
<step number and name>

GOAL:
<what was achieved>

FILES CREATED:
<list>

FILES MODIFIED:
<list>

PACKAGES ADDED:
<list>

ENVIRONMENT VARIABLES:
<list>

DATABASE CHANGES:
<list>

SECURITY CONSIDERATIONS:
<list>

TESTS RUN:
<commands>

TEST RESULTS:
<results>

MANUAL TESTING:
<instructions>

KNOWN ISSUES:
<list>

READY FOR APPROVAL:
YES
```

Then STOP.

No subsequent step may be implemented until the developer explicitly approves it.
