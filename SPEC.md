# Gym App — Product Specification

Single-tenant gym management platform for **one gym**. Members and trainers use a shared mobile app; owners and managers use an admin portal. Optional modules (e.g. payments) are enabled via feature toggles in admin settings.

---

## Product scope

- **Not multi-tenant** — one database, one deployment, one Stripe account (when payments are enabled).
- **Multiple locations** (optional later) — one business with several branches, not separate gym customers.
- **Feature toggles** — admin enables or disables modules; API enforces flags server-side; clients hide UI for disabled modules.

---

## Surfaces (apps)

| Surface | Path | Users | Purpose |
|---------|------|--------|---------|
| **Member app** | `app/` (Flutter) | Members and trainers | Book classes, appointments, activity log, profile; trainers see schedule and clients (role-based UI) |
| **Admin app** | `admin/` (Flutter) | Owners, managers | Members, schedule, staff, settings, feature toggles, reports |
| **API** | `backend/` (Node.js) | All clients | REST API, auth, feature-flag enforcement |
| **Marketing website** | TBD (optional, Phase 4) | Public | Hours, pricing, contact, sign-up CTA |

**Decision:** Two Flutter applications (`app/`, `admin/`) plus a Node.js backend (`backend/`).

---

## User roles

| Role | Capabilities |
|------|----------------|
| **Member** | Book classes/appointments, activity log, profile, payments (if module on) |
| **Trainer** | View/manage own schedule, clients, session notes, attendance |
| **Admin** | Full admin portal; optional limited mobile access |

Admins may also exist as staff records linked to the same `User` model.

---

## Feature modules

### Core (always on)

- Authentication (email/phone; social optional later)
- Users and roles (member, trainer, admin)
- **Classes** — templates, sessions, capacity, waitlist
- **Bookings** — member ↔ class session (booked, attended, cancelled, no-show)
- **Trainers** — profiles, specialties, linked to classes and appointments
- **Appointments** — 1:1 with trainers, availability rules
- **Activity log** — workout sessions (structured exercises/sets or simple notes)
- Notifications (push + in-app)
- Admin: members, schedule, staff, app settings

### Toggleable (per gym via `app_settings`)

| Module key | Description | Depends on |
|------------|-------------|------------|
| `payments` | Subscriptions, class packs, drop-in fees, wallet | — |
| `membership_tiers` | Monthly plans, freeze, renewals | `payments` |
| `check_in` | QR/NFC door check-in | Often `membership_tiers` or manual member status |
| `retail_pos` | Merch / supplements at desk | `payments` |
| `nutrition` | Meal plans, macros (optional trainer assignment) | — |
| `challenges` | Leaderboards, gym challenges | Activity log |
| `multi_location` | Several branches under one gym | — |
| `advanced_analytics` | Revenue, retention, exports | `payments` (for revenue) |
| `white_label` | Custom logo, colors, app theming | — |

**Payments toggle:** When off, no payment provider keys required; payment routes return disabled; wallet and billing UI hidden.

### Feature-flag flow

1. Admin toggles module in settings → stored in `app_settings.feature_flags` (JSON or columns).
2. API middleware / policies check flags per route group (e.g. `/payments/*` requires `payments`).
3. Mobile and admin clients fetch flags at login; hide navigation and screens for disabled modules.
4. Background jobs skip work for disabled modules.

---

## Database (MongoDB)

- **Driver / ODM:** Mongoose in `backend/`
- **Connection:** `MONGODB_URI` (default `mongodb://127.0.0.1:27017/gym-app`)
- **Collections** map to the models below (e.g. `users`, `classSessions`, `appSettings`)

Embedded documents and references (`ObjectId`) are used where it fits; exact schemas live in `backend/src/models/` as they are implemented.

---

## Data models

### Settings

- **AppSettings** — gym name, branding, timezone, currency, `feature_flags` (JSON)

### People

- **User** — auth identity, profile, `role` (member | trainer | admin)
- **Trainer** — extends trainer users: bio, certifications, specialties (1:1 with user where role is trainer)
- **AuditLog** — admin/system events (who did what, when). *Not* workout activity.

### Scheduling

- **ClassTemplate** — recurring definition (e.g. “HIIT Monday 18:00”)
- **ClassSession** — instance: time, capacity, trainer, room/location
- **Booking** — user ↔ class session, status, timestamps
- **Appointment** — 1:1 slot: member, trainer, start/end, status
- **Availability** — trainer weekly rules + exceptions (blocks, holidays)

### Activity

- **ActivityLog** — member workout session: date, notes, optional structured data
- **Exercise** / **Set** (optional) — structured logging: exercise name, reps, weight

### Locations (optional module: `multi_location`)

- **Location** — name, address, hours; sessions and appointments may reference a location

### Payments (module: `payments`)

- **Wallet** — member balance (if using prepaid / credits)
- **LedgerEntry** — credits and debits against wallet
- **MembershipPlan** — tier name, price, billing interval
- **Subscription** — member ↔ plan, status, provider subscription id
- **Payment** / **Invoice** — amount, status, Stripe (or provider) ids

---

## Architecture (high level)

```
app/ (Flutter) ──────┐
                     ├──► backend/ (Node.js) ──► MongoDB
admin/ (Flutter) ────┘              └──► app_settings.feature_flags
                                    └──► Stripe (when payments on)
```

- **Source of truth for toggles:** database `AppSettings`, not client-only flags.
- **Single Stripe account** for the gym when payments are enabled (no Connect / per-tenant billing).

### Suggested stack

| Layer | Choice | Notes |
|-------|--------|--------|
| Member / trainer app | Flutter (`app/`) | Role-based UI for member vs trainer |
| Admin app | Flutter (`admin/`) | Desktop/web/mobile targets as needed |
| API | Node.js (`backend/`) | Express + Mongoose; MongoDB |
| Database | MongoDB | Single database; collections per model (see below) |
| Auth | Backend + MongoDB | |
| Payments | Stripe | Subscriptions + one-off when module enabled |

---

## API conventions (outline)

- Auth: register, login, refresh, password reset
- Users: profile CRUD; admin list/filter members and staff
- Classes: templates, sessions, bookings (with waitlist)
- Appointments: availability, book, cancel, trainer calendar
- Activity: log CRUD for current member; trainer read where permitted
- Settings: public feature flags for clients; admin read/write `AppSettings`
- Payments (gated): plans, subscribe, wallet, webhooks — only if `payments` enabled
- Audit: admin-only `AuditLog` list

---

## Delivery phases

### Phase 1 — MVP

- Auth, roles, user profiles
- Class templates, sessions, booking (capacity)
- Trainer profiles linked to sessions
- Basic activity log
- Admin CRUD: members, schedule, settings
- Push notifications (basic)

### Phase 2 — Operations

- Appointments and trainer availability
- Waitlist, attendance / no-show
- Audit log for admin actions
- Email templates (optional)

### Phase 3 — Monetization (toggle: `payments`)

- Stripe integration, webhooks
- Membership plans and subscriptions
- Wallet / ledger (if needed)
- Member “My membership” and billing history in app

### Phase 4 — Growth (optional modules)

- Check-in (`check_in`)
- Challenges (`challenges`)
- Multi-location (`multi_location`)
- Marketing website
- Advanced analytics (`advanced_analytics`)

---

## Open decisions

Record choices here as they are made:

- [ ] **Locations:** single site only at launch, or `multi_location` in schema from day one?
- [ ] **Payments at launch:** Phase 1 without payments, or enable `payments` in MVP?
- [ ] **Admin on mobile:** admin-only on web, or some admin actions on mobile?
- [ ] **Offline:** cache schedule / queue check-ins for poor gym Wi‑Fi?
- [ ] **Compliance:** GDPR / health data retention policy for activity logs

---

## Naming note

- **ActivityLog** — member workouts
- **AuditLog** — admin and system audit trail (avoid overloading “activity log”)
