# OneToTen — Design Document

## Overview

OneToTen is a single-page personal review app for tracking and rating media across five categories: video games, board games, books, movies, and TV shows. It uses Firebase Realtime Database for storage, Firebase Auth for write protection, and GitHub Pages for hosting.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              GitHub Pages (Static)           │
│  ┌────────┐  ┌──────────┐  ┌────────────┐  │
│  │  HTML  │  │   CSS    │  │  JS (ESM)  │  │
│  └────────┘  └──────────┘  └─────┬──────┘  │
│                                   │         │
└───────────────────────────────────┼─────────┘
                                    │ Firebase SDK (modular v12.15.0)
                              ┌─────▼─────┐
                              │  Firebase  │
                              │ Realtime DB│
                              │ + Auth     │
                              └───────────┘
```

## Data Model

### Review Object

```json
{
  "id": "auto-generated-firebase-key",
  "type": "movie | tvshow | videogame | boardgame | book",
  "title": "The Title",
  "score": 8,
  "review": "Review text (single field, English or Persian)",
  "reviewLang": "en | fa",
  "externalLinks": [
    { "url": "https://imdb.com/title/tt1234567", "source": "imdb" },
    { "url": "https://en.wikipedia.org/wiki/...", "source": "wikipedia" }
  ],
  "imageUrl": "https://...",
  "dateConsumed": "2026-06-20",
  "status": "completed | in-progress | dropped | playing | abandoned | avoid",
  "tags": ["sci-fi", "co-op"],
  "meta": {
    "director": "Christopher Nolan",
    "actors": "Leonardo DiCaprio, Tom Hardy",
    "year": "2010",
    "studio": "Warner Bros"
  },
  "createdAt": 1719187200000
}
```

### Type-Specific Meta Fields

| Type | Fields |
|------|--------|
| Movie | director, actors, year, studio |
| TV Show | creator, actors, year (range: "2021-2024"), network, showStatus (Ongoing/Completed/Canceled), seasons, episodes, lastWatched |
| Video Game | developer, year, platform |
| Board Game | designer, year, playerCount |
| Book | author, year, translator, format, narrator, publisher |

### Status Options by Type

| Type | Available Statuses |
|------|-------------------|
| Movie, TV Show, Video Game, Book | Completed, In Progress, Dropped, Avoid |
| Board Game | Playing, Abandoned, Avoid |

### Firebase Structure

```
/reviews
  /<uid>
    /<review-id>
      { ...review object }
```

Each user's reviews are stored under their Firebase Auth UID. Shared links include the UID: `#/review/{uid}/{id}`.

---

## URL Routing (Hash-based)

| Route | View |
|-------|------|
| `#/` or `#/all` | All reviews (default, sorted by date) |
| `#/movies` | Movies only |
| `#/tvshows` | TV Shows only |
| `#/videogames` | Video Games only |
| `#/boardgames` | Board Games only |
| `#/books` | Books only |
| `#/review/:uid/:id` | Single review (shareable, cross-user) |
| `#/add` | Add new review form |
| `#/edit/:id` | Edit existing review |

---

## UI Layout

### Header
- Site title "OneToTen"
- Navigation tabs for media categories
- Add Review button (visible when logged in)
- Login/Logout button

### Main Content Area (with Sidebar)
- **Sidebar (left):** Sort, score filter, status filter, year range (from/to), searchable tag combobox, context-specific creator/author/director filter
- **List View:** Grid/cards showing reviews with title, score badge, type icon, and thumbnail
- **Single Review View:** Full review with score, text, ordered metadata (2-column grid), external links, tags
- **Form View:** Add/edit form with type-specific fields, multiple external links (drag-to-reorder), year calendar toggle

### Score Display
- Circular badge showing score (0–10)
- Color-coded: 0 dark gray with border, 1-3 red, 4-5 orange, 6-7 yellow, 8-9 green, 10 green gradient with glow

---

## External Link Sources (Context-Specific)

| Media Type | Available Sources |
|-----------|-------------------|
| Movie | IMDb, Wikipedia |
| TV Show | IMDb, TVDB, Wikipedia |
| Video Game | Steam, Epic Games, GOG, Ubisoft, Xbox, PlayStation, IGDB, Wikipedia |
| Board Game | BoardGameGeek, Wikipedia |
| Book | Goodreads, OpenLibrary, Wikipedia |

Links are stored as an ordered array and can be reordered via drag-and-drop in the edit form. Source is auto-detected from URL when possible.

---

## Filtering & Sorting

### Sidebar Filters
- **Sort:** Newest First, Highest Score, Lowest Score, Title A–Z, Date Consumed
- **Score:** All, 10⭐, 8–9, 6–7, 4–5, 1–3
- **Status:** All statuses including type-specific ones (Playing, Abandoned, Avoid)
- **Year range:** From / To number inputs
- **Tag:** Searchable combobox (type to filter, dropdown with matching options)
- **Creator:** Context-specific searchable combobox — hidden on "All" page, shows:
  - Movies/TV: Director / Actor
  - Video Games: Developer
  - Board Games: Designer
  - Books: Author / Narrator

### Search
- Client-side search across title, tags, and meta field values
- 600ms debounce on input to avoid re-rendering on every keystroke

---

## Bilingual Support

- Single review text field with language toggle (English / Persian)
- Persian text is displayed RTL with Vazirmatn font
- UI is in English, review content supports both languages

---

## Year & Calendar Support

- Year fields show calendar type indicator: ☀️ شمسی or 📅 AD
- Auto-detects: year < 1500 = Shamsi, ≥ 1500 = Gregorian
- 🔄 toggle button converts between calendars
- TV shows support year ranges (e.g. "2021-2024" or "2021-" for ongoing)
- View mode shows both calendars (e.g. "2021-2024 📅 AD (1400-1403 شمسی)")

---

## Authentication & Multi-User

- Firebase Email/Password authentication
- Login modal in the app header
- When logged out: read-only (can browse, view, share)
- When logged in: Add Review button visible, Edit/Delete buttons on reviews
- Each user's reviews stored at `/reviews/{uid}/`
- DB rules: `.read: true` at `/reviews`, `.write` restricted to `auth.uid === $uid`
- Shared links include UID so anyone can view any user's reviews read-only

---

## Modal Behavior

- Clicking outside the modal does NOT close it (prevents accidental data loss)
- Must use X button or Cancel to close

---

## Automated Backups

- GitHub Actions workflow runs weekly (Sunday 3AM UTC) or manually via `workflow_dispatch`
- Authenticates via Firebase service account (`FIREBASE_SA_KEY` repo secret)
- Downloads full DB via REST API with OAuth2 Bearer token
- Encrypts with AES-256-CBC (PBKDF2, 100k iterations) using `BACKUP_PASSWORD` repo secret
- Stores as `.enc` files in `/backups/` — unreadable without the password
- Retains last 10 backups

**Setup:** See WalletWatch README for step-by-step — same process (enable IAM Credentials API, generate service account key, add 2 repo secrets).

---

## IMDb Import Tool

- Standalone page (`import-imdb.html`)
- Upload IMDb ratings CSV export
- Parses all ratings, maps types (movie/TV), scores as-is
- Imports with: status=completed, genres as tags, directors as meta, IMDb link
- Skips duplicates by title match
- Shows preview, progress bar, and detailed log

---

## Metadata Auto-Fetch

When adding a review, users can search by title to auto-fill metadata from external APIs:

| Media Type | API | Data Fetched |
|-----------|-----|-------------|
| Movie | TMDB (The Movie Database) | Year, director, actors, studio, poster |
| TV Show | TMDB | Year range, creator, actors, network, seasons, episodes, status, poster |
| Video Game | RAWG | Year, developer, platform, cover image |
| Book | Open Library | Year, author, cover image |

### Flow
1. User selects type and enters title
2. Clicks 🔍 or presses Enter → searches the appropriate API
3. Results shown in dropdown with thumbnail, title, year
4. User selects a result → detailed API call fetches full metadata
5. Form fields auto-populate (user can still edit before saving)

### API Keys
- TMDB: Free tier, 1M requests/month
- RAWG: Free tier, 20,000 requests/month
- Open Library: Free, no key required

---

## BGG Import Tool

- Standalone page (`import-bgg.html`)
- Upload BGG collection CSV export (from BGG profile → Collection → Export)
- Maps fields: objectname → title, rating → score (falls back to community average rounded), yearpublished → year, min/maxplayers → playerCount
- Option to import only rated games or all owned games
- Configurable default score for unrated games
- Skips duplicates by title match
- Adds BGG link as external link

---

## Bulk Operations

- Select multiple reviews via checkboxes (hold-to-enter bulk mode on mobile)
- Bulk modify: change type, status, or tags for all selected reviews
- Bulk delete: remove all selected reviews with confirmation
- Selection count shown in floating action bar

---

## Design Tokens

| Token | Value |
|-------|-------|
| Primary color | `#6366f1` (indigo) |
| Background | `#0f172a` (dark slate) |
| Surface | `#1e293b` |
| Text | `#f8fafc` |
| Score 0 | `#374151` (dark gray + border) |
| Score 1-3 | `#ef4444` (red) |
| Score 4-5 | `#f97316` (orange) |
| Score 6-7 | `#eab308` (yellow) |
| Score 8-9 | `#22c55e` (green) |
| Score 10 | Green gradient + glow |
| Font (English) | Inter, system-ui |
| Font (Persian) | Vazirmatn |

---

## Responsive Breakpoints

- Mobile: < 640px (1 column, sidebar collapses to horizontal, meta list single column)
- Tablet: 640–1024px (2 columns)
- Desktop: > 1024px (3 columns, sticky sidebar)

---

## Future Enhancements

- Image auto-fetch from external APIs
- Statistics dashboard (avg score by type, reviews per month)
- Dark/light theme toggle
- Import/export reviews as JSON
- Bulk edit operations
