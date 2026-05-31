src/store/applicationStore.js    ← Full CRUD + CSV export + status history
src/pages/TrackerPage.jsx        ← Complete kanban + drawer + modal (500+ lines)

What's built — feature by feature:
Kanban Board — 5 columns: Saved → Applied → Interview → Offer → Rejected. Each column has a header with a live count badge, colored per status. Cards are native HTML5 draggable — grab any card, drop into any column. The target column highlights with a faint color wash on drag-over. Empty columns show a dashed drop zone.
Card design — Company name + role, domain/seniority/location tags, ATS and Human score chips if a resume is linked (green if passed threshold, amber if not), overdue next-action warning in red with clock icon, applied date, and a row of quick-move buttons at the bottom (one per other status — click to move without dragging). Delete button appears on hover.
Detail Drawer — slides in from the right when you click a card. Three tabs:

Details — inline click-to-edit fields: notes, applied date, interview date, next action, next action date, contact name, contact email, salary range. All saved to IndexedDB on Enter or ✓. Must-have skills shown from the job snapshot.
Resume — ATS/Human score blocks, pass/fail verdict, all tailored resume versions for that job listed with their scores.
Log — timeline of every status change and action with timestamps, latest at top.

Add Modal — click ADD JOB, search your stored jobs, toggle between "not yet tracked" and all jobs. Select a tailored resume version to link (optional — shows scores). One click adds it to the Saved column.
Stats bar — always visible at top: Total, Applied, Interview, Offer, Rejected counts, and a live Conversion Rate (interviews + offers ÷ applied).
CSV Export — one click exports all applications with Company, Role, Status, Applied Date, ATS Score, Human Score, Notes, URL.
Auto-behaviors — moving a card to Applied auto-sets the applied date if not already set. Every status move gets logged to the activity timeline automatically.

To run:
cd job-seeker-os
npm install
npm run dev