# Valid Tree Service Operations — Final Production Setup

This project is the permanent foundation for `operations.validtreeservice.com`.

It includes:

- Supabase staff authentication and role-based access
- customers, estimates, contracts, jobs, crews, tasks, invoices, photos, and settings
- branded contract printing/PDF
- private remote signing links at `/sign/<token>`
- onsite tablet signing
- AI-assisted contract drafting and follow-up analysis through a secure Edge Function
- demo mode for safe testing before production data is entered

## Important boundaries

The application code and database are included. Three services require your own account credentials before their live features can send data outside the portal:

1. OpenAI API for live AI
2. an email/SMS provider for automatic delivery
3. a payment provider for online card/ACH payments

The app will run without those three integrations. Signature links can be copied and texted manually immediately.

---

# PHASE 1 — Create the permanent Supabase project

1. In Supabase, create a new project named `valid-tree-operations`.
2. Save the database password somewhere secure.
3. Wait for the project to finish provisioning.
4. Open **SQL Editor → New query**.
5. In VS Code open:

```text
supabase/migrations/001_valid_tree_operations.sql
```

6. Press `Ctrl+A`, then `Ctrl+C`.
7. Paste it into the empty Supabase SQL Editor.
8. Confirm the first line says:

```sql
-- Valid Tree Service Operations Platform — production schema
```

9. Click **Run** once.
10. A successful run should say `Success. No rows returned`.

Do not paste this into the old `valid-tree-contracts` database. This release is designed for the new clean production project.

---

# PHASE 2 — Create the owner account

1. In Supabase open **Authentication → Users**.
2. Choose **Add user → Create new user**.
3. Enter your owner email and a strong password.
4. Leave email auto-confirmed if Supabase offers that option.
5. You do not need to manually insert a profile. The first person who signs in becomes the owner through the protected `bootstrap_owner` database function.

Only the first account can bootstrap itself. Additional staff must later be added to `profiles` with the correct owner ID and role.

---

# PHASE 3 — Connect the website to Supabase

1. In the new Supabase project open **Project Settings → API Keys**.
2. Copy the project URL and publishable key.
3. In the project root, duplicate `.env.example` and rename the copy to `.env`.
4. Fill it in:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_PUBLIC_SITE_URL=https://operations.validtreeservice.com
```

The publishable key is meant for browser use with Row Level Security. Never put a Supabase secret/service-role key, OpenAI key, email key, or Stripe secret in this file.

---

# PHASE 4 — Test locally

In VS Code Terminal, from this project folder:

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL shown by Vite, normally `http://localhost:5173`.

Test in this order:

1. Sign in with the new owner account.
2. Create one test customer.
3. Create an estimate.
4. Create a contract.
5. Click **Copy sign link**.
6. Open the link in a private/incognito browser window.
7. Sign with a mouse, finger, or stylus.
8. Return to the portal and refresh. The contract should be marked signed.
9. Create a job and assign it to a crew.
10. Open Tablet Mode and verify the job workflow.

The **Open demo workspace** button uses browser-only sample data. Demo records are never sent to Supabase.

---

# PHASE 5 — Configure Supabase Auth URLs

In Supabase open **Authentication → URL Configuration**.

Set:

```text
Site URL:
https://operations.validtreeservice.com
```

Add redirect URLs:

```text
https://operations.validtreeservice.com/**
http://localhost:5173/**
```

Use the exact production hostname for the Site URL.

---

# PHASE 6 — Enable live Valid AI

## Easy dashboard method

1. In Supabase open **Edge Functions**.
2. Deploy a new function named `ai-assistant`.
3. Replace its code with:

```text
supabase/functions/ai-assistant/index.ts
```

4. Deploy it.
5. Open **Edge Function Secrets** and add:

```text
OPENAI_API_KEY = your OpenAI API key
OPENAI_MODEL = gpt-5-mini
```

The key stays on Supabase's server. It never enters the React website.

## CLI method

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set OPENAI_API_KEY=YOUR_KEY OPENAI_MODEL=gpt-5-mini
npx supabase functions deploy ai-assistant
npx supabase functions deploy send-signature-link
```

Also set:

```text
PUBLIC_SITE_URL=https://operations.validtreeservice.com
```

The included `send-signature-link` function currently creates the correct message and URL. Add Resend/Postmark and Twilio credentials when you choose providers. Until then, use **Copy sign link** and send it through your normal business text/email.

---

# PHASE 7 — Build the production website

Run:

```powershell
npm.cmd run build
```

Vite creates:

```text
dist/
```

Upload the `dist` folder to your existing host, or deploy the repository through Cloudflare Pages.

Recommended Cloudflare Pages settings:

```text
Framework preset: Vite
Build command: npm run build
Build output directory: dist
Node version: current supported LTS
```

Add these production environment variables in the host dashboard:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_PUBLIC_SITE_URL=https://operations.validtreeservice.com
```

`public/_redirects` is already included so routes such as `/sign/<token>` continue to work when opened directly.

---

# PHASE 8 — Change the domain to operations.validtreeservice.com

Do not remove `contract.validtreeservice.com` until the new domain works.

For Cloudflare Pages:

1. Deploy the project and confirm the generated `*.pages.dev` address works.
2. Open **Workers & Pages → your project → Custom domains**.
3. Choose **Set up a domain**.
4. Enter:

```text
operations.validtreeservice.com
```

5. Complete activation. If `validtreeservice.com` DNS is already managed by Cloudflare, it normally creates the required CNAME automatically.
6. Wait for the domain to show **Active** and test login plus one signing link.
7. Update Supabase Auth URL Configuration as described above.
8. After everything is confirmed, redirect `contract.validtreeservice.com` to `https://operations.validtreeservice.com` with a permanent `301`, preserving the path and query string. This keeps any old bookmarks useful.

---

# PHASE 9 — Staff and multiple crews

The database supports roles:

- `owner`: everything
- `office`: customers, paperwork, scheduling, invoices
- `foreman`: field jobs, completion information, and photos
- `crew`: limited field/photo access

Create additional Auth users first. Then add each person to `profiles` using the owner's UUID as `owner_id`:

```sql
insert into public.profiles (id, owner_id, full_name, role, phone)
values (
  'NEW-STAFF-AUTH-USER-ID',
  'OWNER-AUTH-USER-ID',
  'Employee Name',
  'foreman',
  '(713) 555-0000'
);
```

Change `foreman` to `office` or `crew` as needed.

---

# Before using real customer signatures

- Replace placeholder company phone/address in Settings.
- Have a Texas attorney review your contract terms and electronic-consent language.
- Test signing on the actual tablets and phones your crews use.
- Establish a database backup routine.
- Add a privacy policy and internal access policy.
- Do not treat a drawn signature image alone as the entire evidence record; retain the contract token, consent text, timestamp, signer details, and audit log, which this schema records.
