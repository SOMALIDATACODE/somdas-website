# CMS redesign

The `/admin` workspace now uses six navigation entries: Dashboard, Pages, Posts,
Analytics, Users and Settings. Dashboard is a table with review filters, with no
metric cards. Pages expands into the existing website pages. Contact messages
live inside Contact. A remembered light/dark control is always in the top bar.

## Section editing

All eight homepage sections and every existing configurable program/About
section use an inline accordion with Save Draft, Cancel Changes, saved draft
Preview, Change Status and Publish Now. Homepage text, images, link destinations,
focus descriptions and CTA labels are editable while untouched template markup
retains its original appearance. Partners and homepage featured posts stay
inside their homepage sections. Fields attach images through the existing
verified image upload API. Unsaved navigation presents save/discard/stay.

Each section has an independent draft and history. Server-side allowed paths
prevent a section payload from replacing the whole site. Saving invalidates QA;
publishing requires Draft -> QA -> Ready on the exact saved revision. Atomic D1
batches enforce both draft and live revision checks. Other section publications
are preserved. A change to the same live section blocks a stale publication.
History retains both previous live content and draft versions; restoration
creates a draft. Start from current live version reconciles a stale workspace
without removing its history. Draft preview is owner-only and non-cacheable.

## Data safety and production capabilities

The migrations add `section_drafts`, `section_history`, `cms_users`,
`cms_activity`, `cms_settings` and anonymous `analytics_events`; they do not
delete or rewrite live content, legacy workspace snapshots, members or media.
The old `/editor` remains owner-only with its existing direct-live behavior.
Old whole-site workspace endpoints remain available for recovery.

Posts support private creation, independent review/publication and recoverable
Trash. Moving to Trash removes the live record and any homepage feature pick
atomically. Restoring returns the post to Draft, requiring QA before publication.
There is no permanent-delete control.

Role enforcement happens on the server as well as in the interface. The owner
is an immutable Super Admin. Super Admins can add Admins and Editors, change
roles, manage every section's visibility, publish, schedule and enable
Maintenance Mode. Admins can add or suspend Editors, edit pages, approve and
publish content, and change the daily Partners and Community visibility
switches. Editors see only Posts, can create posts and edit posts they own or
have been assigned, and can submit exact saved revisions to QA. They cannot
approve, publish, edit pages or change site settings. Suspended accounts lose
access immediately. The Users view includes first-login state and a filterable
activity trail; Editors can read Editor activity while Admins can read all CMS
activity.

Scheduling stores an approved revision and publication time in D1. Due work is
processed by the worker scheduled handler and is also checked on public HTML and
CMS requests. A conflict or missing media cancels the schedule safely, returns
the item to Draft and records the reason. Maintenance Mode returns a deliberate
503 page to public visitors while leaving the owner able to inspect the site.

Analytics is collected from successful public page views only. It stores path,
day, referrer host, device class and a SHA-256 hash of a random first-party
visitor identifier; it does not store IP addresses or raw visitor IDs. The
dashboard offers 7, 30 and 90 day views, unique visitors, page views, top pages,
referrers and device mix. Data older than 400 days is removed automatically.
