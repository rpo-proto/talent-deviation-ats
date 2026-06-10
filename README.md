# Talent Deviation ATS

Talent Deviation ATS is a local-first, lightweight ATS for finding exceptional candidate signal from messy hiring evidence.

The public repo contains app code, schema, import formats, and documentation. It must not contain candidate data, resumes, transcripts, internal comments, compensation data, or LLM evaluations.

## Architecture

- **Code:** public-safe Next.js + SQLite app.
- **Private runtime data:** gitignored `.local/talent.db` and `.local/artifacts/`.
- **Ingestion:** agent-assisted normalized JSON imports from Gmail, Slack, Granola, local files, and case-study reviews.
- **Operational export:** human-readable snapshots to a private folder you configure.
- **Source links:** candidate records can link back to private Google Drive folders for resumes and raw artifacts.
- **Auth:** optional Clerk protection when Clerk environment variables are present.

## V1 Scope

- Funnel view by role and stage.
- Thin intake lane before case study.
- Detailed candidate dossier from case-study stage onward.
- Evidence-event timeline with source labels and weights.
- Scorecards from humans and LLM artifact reviews.
- Pending-action surface for recent Slack/email/Granola changes.
- Exportable hiring snapshot.

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Clerk Auth

The app runs locally without Clerk keys. When deploying for a team, set these environment variables:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

With both Clerk keys present, every route is protected except `/sign-in` and `/sign-up`.

## Importing Evidence

Normalized import files are JSON. Keep private imports under `.local/imports/`.

```bash
npm run import -- .local/imports/slack-24h.json
```

See [docs/import-format.md](docs/import-format.md).
