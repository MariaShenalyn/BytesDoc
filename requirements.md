Frontend Requirements – BytesDoc (Web‑Based Document Management System)

Build the complete frontend for BytesDoc using Next.js (App Router), TypeScript, Tailwind CSS.
Modern, professional design – navy blue accent (#0A2647 or similar).
Dark / light mode toggle. Fully responsive.
Use mock data (local JSON or mock API) – no real backend needed for now.
Strictly follow the SRS – do not add features not mentioned in the file (no real‑time co‑editing, no external integrations, no automated workflows, no mobile app).

Pages & Roles
Landing Page (public)
Hero: “BytesDoc – Centralized Document Management for BYTES Student Council”

Navy blue gradient, CTA “Login” (goes to login page)

Brief feature highlights: secure upload, role‑based access, archiving, activity logs

Footer: mock contact, “© BYTES Student Council”

Login Page
Email + password fields, “Login” button

Role‑based redirect after mock login (choose role from dropdown or separate buttons for demo)

Mock credentials:

Chief Minister (admin@bytes.com)
pass:chiefadmin123

Secretary (secretary@bytes.com)

Minister of Finance (finance@bytes.com)

Member (member@bytes.com – view only)


Architecture: One Reusable Layout, Separate Role Pages
Shared layout component – components/layout/DashboardLayout.tsx
Contains: sidebar, navbar, theme toggle, responsive container.
Accepts children and activeTab (for highlighting).

Role pages (each imports the shared layout and reusable components):

app/dashboard/admin/page.tsx

app/dashboard/secretary/page.tsx

app/dashboard/finance/page.tsx

app/dashboard/member/page.tsx

No conditional rendering inside the layout – only the page content differs by passing different props to reusable components.

Reusable document component – DocumentTable accepts props:
documents, canUpload, canEdit, canDelete, canArchive, onUpload, onEdit, onDelete, onArchive, onDownload, onView

Same for other components – ArchiveList, UserTable, ActivityLogTable – each role page imports them and passes the appropriate permissions.

Role Pages – What Each Imports
Admin Page (/dashboard/admin)
Imports: DashboardLayout, DocumentTable, ArchiveList, UserTable, ActivityLogTable

Passes: canUpload={true}, canEdit={true}, canDelete={true}, canArchive={true}, showBulkArchive={true}

Shows Users and Activity Logs tabs.

Secretary Page (/dashboard/secretary)
Imports: DashboardLayout, DocumentTable, ArchiveList

Passes: canUpload={true}, canEdit={(doc) => doc.uploadedBy === currentUser.id}, canDelete={(doc) => doc.uploadedBy === currentUser.id}, canArchive={false}

Documents filtered to exclude finance categories (Budgets, Financial Records).

Finance Page (/dashboard/finance)
Imports: DashboardLayout, DocumentTable, ArchiveList

Passes: canUpload={true}, canEdit={false}, canDelete={false}, canArchive={false}

Documents filtered to only finance categories.

Member Page (/dashboard/member)
Imports: DashboardLayout, DocumentTable, ArchiveList

Passes: canUpload={false}, canEdit={false}, canDelete={false}, canArchive={false}

Shows all non‑restricted documents (same as secretary but no write actions).

Routing & Auth
Login page (/login) – after mock login, redirect to:

admin → /dashboard/admin

secretary → /dashboard/secretary

finance_minister → /dashboard/finance

member → /dashboard/member

Protected routes: middleware checks role from store and redirects if accessing wrong role page.

Sidebar navigation links change based on role (admin sees Users, Logs; others don’t).



Role‑Based Panels (all after login)
1. Chief Minister (Admin) Panel
Navbar tabs: Dashboard, Documents, Archive, Users, Activity Logs

Dashboard
Summary cards: Total Documents, Active Docs, Archived Docs, Recent Uploads (last 7 days)

Bar chart: Documents per category (Proposals, Permits, Budgets, Reports)

Line chart: Uploads over time (last 6 months)

Table: 5 most recent documents (Title, Category, Uploader, Date, Download button)

Quick download from table

Documents
Search bar (title/keywords)

Filter chips: All, Proposals, Permits, Budgets, Reports, Archived

Table columns: Title, Category, Event, Administration, Uploaded By, Date, Actions (Download, View, Edit, Delete)

Upload button (opens modal): Title, file upload, Category dropdown, Event dropdown, Administration dropdown (mock data)

For archived documents (is_archived = true) – actions only Download/View, no Edit/Delete

“Archive/Lock” action on each row (non‑archived only) – converts to read‑only, sets is_archived = true, is_locked = true

Archive
List of archived documents (read‑only PDF, locked)

Bulk selection by Administration term (checkbox per doc)

“Bulk Archive Past Term” button – archives all documents of selected administration term

Each archived doc shows: Title, Category, Administration, Archived Date, View button

Users
Table: Email, Full Name, Role, Created At

Role change dropdown per user (chief_minister, secretary, finance_minister, member)

Invite New User button (modal: Email, Full Name, Role) – adds to mock data

No delete user

Activity Logs
Table: User, Action (upload, download, view, archive, login), Document, Timestamp

Filters: by User, by Action, date range picker

Export to CSV button (downloads current filtered logs)

2. Secretary Panel (Authorized Member)
Navbar tabs: Dashboard, Documents, Archive

Dashboard
Same as admin but limited to own department? SRS says secretaries handle general files. Show summary cards: My Uploads, Total Docs (accessible), Archived count

Bar chart: docs per category (only categories they can access)

Recent documents table (last 5 documents they have access to)

Documents
Same table as admin, but only documents they can view (based on role – secretary sees general event docs, not finance records)

Actions: Download, View (no Edit/Delete unless they uploaded? SRS says secretaries upload but no mention of edit/delete others. Implement: can delete/edit only their own uploaded documents)

Upload button (same modal) – can upload proposals, permits, reports

Archive
Read‑only list of archived documents (view only, cannot modify or bulk archive)

3. Minister of Finance Panel
Navbar tabs: Dashboard, Documents, Archive

Dashboard
Cards: Total Financial Documents, Budget Reports, Expense Records

Charts: financial docs by category

Recent financial docs table

Documents
Only documents with Category = “Budgets” or “Financial Records” or “Reports” (finance‑related)

Actions: Download, View (no Edit/Delete – SRS gives limited access)

Upload button – can upload financial records, budgets

Archive
Read‑only list of archived financial documents (view only)

4. Member Panel (View Only)
Navbar tabs: Dashboard, Documents, Archive

Dashboard
Cards: Total accessible docs, Archived docs

Recent documents table (view only)

Documents
All documents (except those restricted by role? SRS says unauthorized members view and read only. Show all non‑archived docs that are not locked? Actually members can view but not upload/modify. Show full list of documents they are allowed to see – same as secretary but no upload/delete buttons)

Actions: Download, View (no Edit, Delete, Upload)

Archive
Read‑only list of all archived documents (view only)

Common Components (all panels)
Document Viewer Modal – for View action: show file metadata and a mock PDF preview (iframe or placeholder)

Download – triggers download of mock file (e.g., sample.pdf)

Edit Document Modal – allows changing Title, Category, Event, Administration (if not locked/archived and user has permission)

Delete – soft delete? SRS doesn’t specify hard delete. Implement: remove from list (confirm modal). Archived documents cannot be deleted.

Search & Filter – persist across tables, client‑side filtering using mock data.

Mock Data Structure
Users – id, email, fullName, role, createdAt

Documents – id, title, category, event, administration, uploadedBy (userId), uploadDate, filePath (mock), is_archived, is_locked, fileType (pdf/docx)

Categories – Proposals, Permits, Budgets, Reports, Financial Records

Events – “Freshmen Orientation”, “Election 2025”, “Foundation Day”

Administrations – “2024-2025”, “2025-2026”

ActivityLogs – id, userId, action, documentId, timestamp

Pre‑populate at least 10 documents, 5 users (one per role), 15 activity logs.

Technical Requirements
Next.js 14+ with App Router

TypeScript – strict typing

Tailwind CSS – custom navy blue theme (primary: #0A2647, accent: #1E3A5F, light/dark variants)

Dark mode – using next-themes

Charts – Recharts or Chart.js

Icons – Lucide React or Heroicons

State management – React Context or Zustand (for mock data & auth)

No external API calls – all mock data in lib/mockData.ts

Responsive – mobile sidebar (hamburger menu), tables horizontal scroll on small screens

Authentication Mock
Simple context provider with login(email, password) – match email to mock user, set role

useAuth hook – provides user, role, logout

Protected routes: redirect to login if not authenticated

Role‑based route guarding: /admin/*, /secretary/*, /finance/*, /member/* (or use one dynamic dashboard that renders components based on role)



11. References (AI Documentation Guide)
To ensure AI agents generate accurate, working code, use the official documentation below. Always reference these sources when implementing each technology.

Technology	Version	Documentation URL	Key Notes
Next.js	15.x (App Router)	https://nextjs.org/docs	Use App Router, Server Components, and client components where needed. Supports React 19 features.
TypeScript	5.x	https://www.typescriptlang.org/docs/	Use strict type checking. Leverage cheat sheets for everyday syntax.
Tailwind CSS	v4 (with Vite)	https://tailwindcss.com/docs	Install tailwindcss and @tailwindcss/vite. Add @import "tailwindcss"; to your CSS file.
Recharts	3.8.1	https://recharts.org/en-US/api	Composable charting library built on React components with SVG elements and D3 submodules.
Zustand	latest	https://zustand.docs.pmnd.rs/	Small, fast, scalable state management. Store is a hook; no providers needed. Use create to define store.
Lucide React	v1	https://lucide.dev/guide/packages/lucide-react	Tree-shakable, TypeScript‑supported icon components. Customizable via props.
next-themes	latest	https://github.com/pacocoursey/next-themes	Perfect dark mode in 2 lines. Supports Next.js 13 appDir. Use ThemeProvider in app/layout.tsx.
Implementation Notes for AI
Next.js App Router: All pages and layouts should follow the app/ directory structure. Use "use client" directive for client components (themes, charts, interactive tables).

Tailwind CSS v4: After installing, import Tailwind in your global CSS file with @import "tailwindcss";.

Zustand Store: Create a store per domain (e.g., useDocumentStore, useAuthStore). No context providers needed.

next-themes: Wrap ThemeProvider in app/layout.tsx with suppressHydrationWarning on the <html> element.

TypeScript: Define interfaces for all mock data (User, Document, ActivityLog, etc.). Use strict type checking.

Required Package.json Dependencies
json
{
  "dependencies": {
    "next": "15.x",
    "react": "19.x",
    "react-dom": "19.x",
    "typescript": "5.x",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "recharts": "^3.8.1",
    "zustand": "^5.0.0",
    "lucide-react": "^0.500.0",
    "next-themes": "^0.4.6"
  }
}
Folder Structure Reference
text
bytesdoc/
├── app/
│   ├── layout.tsx          # Root layout with ThemeProvider
│   ├── page.tsx            # Landing page
│   ├── login/
│   │   └── page.tsx        # Login page
│   └── dashboard/
│       └── [role]/
│           └── page.tsx    # Role‑based dashboard
├── components/
│   ├── ui/                 # Reusable buttons, modals, tables
│   ├── charts/             # Recharts components
│   └── layout/             # Header, sidebar, theme toggle
├── lib/
│   ├── mockData.ts         # Mock users, documents, logs
│   └── stores/             # Zustand stores
├── styles/
│   └── globals.css         # Tailwind import
└── types/                  # TypeScript interfaces