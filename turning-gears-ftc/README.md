# TURNING GEARS FTC SCOUTING

A phone-first React + Vite web app backed by Supabase. This is a starter MVP: shared team access, anonymous device sessions, scout roster, match submissions, and basic team averages.

## What is included
- Phone-friendly dark interface; can be installed to a phone home screen after deployment.
- No individual scout accounts. Each device uses an anonymous Supabase session.
- Team access code, plus a separate optional coordinator code.
- Any team member can self-register a scout name; names are shared across devices.
- Coordinator can deactivate scout names.
- Match scouting with 1–5 ratings and notes.
- Shared submissions and simple team averages.
- Supabase Row Level Security policies. The service-role key stays only in the Edge Function, never in browser code.

## Important status
This project is source code, not a deployed live app yet. It will not share data until a Supabase project is created, the SQL is run, the Edge Function is deployed, and the frontend environment variables are configured. The first MVP does not yet include pit scouting screens, match schedule import, offline submission queue, or alliance prediction.

## 1. Create a free Supabase project
1. Create a project at https://supabase.com.
2. Save the database password somewhere safe.
3. In Project Settings → API, copy the Project URL and the publishable key (or legacy anon key).
4. In Project Settings → API Keys / JWT settings, locate the service-role key. Keep it private; only use it as an Edge Function secret.

## 2. Create the database
1. Open the Supabase project → SQL Editor → New query.
2. Paste all of `supabase/schema.sql`.
3. Run it.
This creates the team, membership, scout roster, match records, pit records, and row-level security policies.

## 3. Enable self-registration for scout names
After running `supabase/schema.sql`, open SQL Editor → New query, paste all of `supabase/enable-self-registration.sql`, and click Run. This allows joined team members to add their own names and prevents case-insensitive duplicates. It does not delete existing data.

## 4. Configure anonymous sign-in
In Supabase → Authentication → Providers / Sign In, enable **Anonymous Sign-Ins**. This is what lets scouts use the app without personal accounts.

## 5. Deploy the Edge Function
Install the Supabase CLI, sign in, and link the project:
```bash
npm install
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase secrets set TEAM_ACCESS_CODE="choose-a-long-team-code" COORDINATOR_ACCESS_CODE="choose-a-different-coordinator-code"
npx supabase functions deploy join-team
```
The Edge Function receives Supabase's `SUPABASE_URL` and service-role secret automatically in the hosted environment. Do not expose the service-role key in `.env` or frontend code.
The team code is shared with scouts. The coordinator code is only given to the person managing the roster.

## 6. Configure and run the app
```bash
cp .env.example .env
```
Put your Supabase Project URL and publishable/anon key in `.env`:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```
Then:
```bash
npm install
npm run dev
```
Open the local address Vite prints. To build for deployment:
```bash
npm run build
```
The production site is generated in `dist/`.

## 7. Deploy the frontend free
A straightforward option is GitHub Pages or another static host with a free tier. Set the two `VITE_` environment variables in the host's build settings. Build command: `npm run build`; output directory: `dist`.
For GitHub Pages, configure the repository's Pages workflow/build deployment and make sure the site base path matches the repository name if it is not hosted at the root domain.

## Coordinator first use
1. Open the deployed app.
2. Enter the team access code and coordinator code.
3. Open Roster and add scout names.
4. Scouts open the same link, enter only the team access code, then select an existing name or add their own on Dashboard. Their selected name is remembered on that device.
5. Each phone's anonymous session persists in that browser. If browser storage is cleared, they re-enter the code.

## Data and privacy notes
- Anyone who has the team access code can join as a scout; do not post it publicly.
- The coordinator code grants roster-management rights. Keep it private.
- Anonymous sessions are browser/device based, not proof of a person's identity. Scouts choose their name from the roster, so the app cannot verify who physically submitted a record.
- The app currently permits team members to read team scouting data and submit new records. No one can delete records from the UI.
- Back up/export and a more detailed coordinator audit screen should be added before treating this as a mission-critical event system.

## Suggested next build steps
1. Add pit scouting UI and richer mechanism/capability fields.
2. Add event, schedule, match and alliance selection tools.
3. Add offline queue + sync retry for venues with unreliable Wi-Fi.
4. Add CSV export and data backup.
5. Add observed partner compatibility and predicted pair analysis.
