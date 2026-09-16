# SOMDAS website and CMS

This repository contains the public SOMDAS website and its role-based content management system. The production CMS is available at `/admin`; `/editor` redirects there.

## Main capabilities

- Public SOMDAS pages, programs, community posts, member accounts and contact form.
- Role-based CMS for Super Admins, Admins and Editors.
- Email and password sign-in followed by a six-digit email OTP.
- CMS password-reset emails with role-restricted reset controls.
- D1-backed content, authentication, workflow, analytics and audit history.
- R2-backed image and file uploads.

## CMS content workflow

- Sign in at `/admin/login` using the CMS email and password, then enter the email OTP.
- Sections: switch whole homepage sections on or off. Hidden sections leave no empty space.
- Partners: add confirmed partners, upload logos, edit the heading/introduction, and move partners up or down. Partners start empty and hidden.
- Activities: add a title, summary, story, date, location and category. Upload up to 20 JPEG/PNG/WebP photos (8 MB each), edit captions, and select a cover.
- Choose Draft to keep a story private. Choose Published to make it available to visitors after saving. HUMC and Indaba are prepared as drafts with supplied photos; their full stories still need to be written.
- Homepage picks: select up to three published events and set their order. Remaining events are available on `/activities`, with category filters and pagination.
- Publish approved content from the CMS. Content changes stored in D1 do not require a code redeployment.
- If another tab saved a newer revision, download your unsaved copy, reload and merge changes manually. The editor protects against overwriting the newer version.

## Implementation

The existing design remains in `content/home.html` and `public/`. A Cloudflare Worker renders homepage visibility and public activity pages. The React editor uses the bundled Shadcn components. Structured content is stored in D1; new uploads in R2, with metadata in D1. Theme preferences alone use browser storage.

CMS authorization uses secure server-side sessions and role checks. Platform identity headers alone do not grant CMS access.

Drizzle schema migrations in `drizzle/` are schema-only and must remain append-only after publication. Runtime updates use prepared D1 statements with revision checks. Draft media is served only to the owner until referenced by published content. Story text is escaped rather than treated as HTML.

## Commands

Install with `npm ci`. `npm run build` creates the Cloudflare Worker and assets, `npm test` builds and runs the automated test suite, and `npx tsc --noEmit` checks TypeScript.

The Worker expects these production bindings:

- `DB`: Cloudflare D1 database.
- `BUCKET`: Cloudflare R2 bucket.

Copy `.env.example` to a local ignored environment file for development. Configure `CMS_AUTH_SECRET`, `AUTH_OTP_SECRET`, `RESEND_API_KEY` and `AUTH_EMAIL_FROM` as encrypted production secrets; never commit their real values.

This version requires the hosted Worker, D1 and R2; opening an HTML file alone does not run the editor.

## About page

The `/about` page has seven independently controlled sections. Use the **About page** editor tab to switch sections on/off and edit their content. Vision and Mission are separate sections. Team profiles support photos, names, roles, biographies, image descriptions, LinkedIn, visibility and reordering. Team starts empty; only profiles explicitly switched on are shown, with two horizontal cards per row on desktop. Old saved homepage documents receive the About defaults on read without replacing any homepage content; no database schema migration is needed.

## SODI introduction

`/programs/sodi` contains seven editor-managed sections; `/sodi` redirects there. The SODI page editor controls visibility, text, planned categories and external category URLs. The platform remains marked in development until a valid HTTPS URL is entered and availability is enabled. The hero catalog artwork is extracted from the supplied design; each program navigation card uses its own generated dashboard illustration in the same pale-blue style. SVG connection lines and surrounding copy are native page elements. Program numbers are permanent; sibling introduction routes exist for the four linked programs. Existing homepage/About data is retained when adding SODI defaults.
