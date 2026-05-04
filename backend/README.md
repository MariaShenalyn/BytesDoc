# BytesDoc Backend

Express + Supabase API for BytesDoc.

## Setup

1. Install deps:

```
cd backend
npm install
```

2. Copy `.env.example` to `.env` and fill in the Supabase keys (get them from the Supabase project settings → API):

```
PORT=4000
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
CORS_ORIGIN=http://localhost:3000
```

3. Run dev server:

```
npm run dev
```

Server runs on `http://localhost:4000`. Test it:

```
curl http://localhost:4000/api/health
```

Should return `{"ok":true,"service":"bytesdoc-backend"}`.

## Database setup (Supabase)

In the Supabase SQL editor, run:

```sql
create table public.roles (
  id smallserial primary key,
  role_name text unique not null check (role_name in ('chief_minister','secretary','finance_minister','member'))
);

insert into public.roles (role_name) values
  ('chief_minister'),
  ('secretary'),
  ('finance_minister'),
  ('member');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  role_id smallint not null references public.roles(id),
  created_at timestamptz default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('Proposals','Permits','Budgets','Reports','Financial Records')),
  event text not null,
  administration text not null,
  uploaded_by uuid not null references public.users(id),
  upload_date timestamptz default now(),
  file_path text not null,
  is_archived boolean default false,
  is_locked boolean default false,
  file_type text not null check (file_type in ('pdf','docx'))
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  action text not null check (action in ('upload','download','view','archive','login')),
  document_id uuid references public.documents(id),
  timestamp timestamptz default now()
);
```

Then create a private Storage bucket called `documents` (Storage → New bucket → uncheck Public).

After the schema is in place, create a user in **Authentication → Users → Add user**, then in the SQL editor insert the matching profile row so the API can find them:

```sql
insert into public.users (id, email, name, role_id)
values (
  '<uuid from auth.users>',
  'admin@bytes.com',
  'Admin Name',
  (select id from public.roles where role_name = 'chief_minister')
);
```

## Auth model

Frontend signs in with Supabase Auth and gets a JWT. Frontend sends `Authorization: Bearer <jwt>` to this API. The `requireAuth` middleware verifies the JWT with Supabase and looks up the user's role from the `users` table.

## Folder structure

```
backend/
├── src/
│   ├── index.ts                 # entry point
│   ├── config/supabase.ts       # supabase clients (admin + public)
│   ├── lib/
│   │   ├── activityLog.ts       # fire-and-forget logActivity helper
│   │   └── storage.ts           # uploadFile / createSignedUrl / deleteFile
│   ├── middleware/
│   │   ├── auth.ts              # requireAuth, requireRole
│   │   └── error.ts             # central error handler
│   ├── routes/
│   │   ├── health.ts            # GET /api/health
│   │   ├── auth.ts              # login, logout, me
│   │   └── documents.ts         # documents CRUD + storage
│   └── types/index.ts           # shared types (mirrors frontend)
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Endpoints

### Built

| Method | Path | Auth | Roles | Notes |
|---|---|---|---|---|
| GET    | `/api/health`                  | no  | —                                                  | sanity check |
| POST   | `/api/auth/login`              | no  | —                                                  | `{ email, password }` → `{ user, token }` |
| POST   | `/api/auth/logout`             | yes | any                                                | client drops token |
| GET    | `/api/auth/me`                 | yes | any                                                | current user profile |
| GET    | `/api/documents`               | yes | any (filtered by role)                             | query: `category`, `administration`, `archived`, `q` |
| GET    | `/api/documents/:id`           | yes | any (filtered by role)                             | logs `view` |
| POST   | `/api/documents`               | yes | chief_minister, secretary, finance_minister        | multipart `file` + metadata; logs `upload`; 10 MB cap |
| PUT    | `/api/documents/:id`           | yes | uploader OR chief_minister                         | edit metadata; 409 if archived/locked |
| DELETE | `/api/documents/:id`           | yes | uploader OR chief_minister                         | hard delete (DB + storage); 409 if archived |
| GET    | `/api/documents/:id/download`  | yes | any (filtered by role)                             | returns 60s signed URL; logs `download` |

### Planned

- `POST /api/documents/:id/archive` + bulk archive by administration term — `feature/backend-documents-archive`
- `GET|POST /api/users`, `PUT /api/users/:id/role` — `feature/backend-users`
- `GET /api/activity-logs`, `GET /api/activity-logs/export` — `feature/backend-activity-logs`

### Role-based document visibility

- `chief_minister`, `member` — see all categories
- `secretary` — excludes `Budgets`, `Financial Records`
- `finance_minister` — only `Budgets`, `Financial Records`, `Reports`
