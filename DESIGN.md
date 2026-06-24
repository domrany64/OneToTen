# OneToTen — Design Document

## Overview

OneToTen is a single-page personal review app for tracking and rating media across five categories: video games, board games, books, movies, and TV shows. It uses Firebase Realtime Database for storage and GitHub Pages for hosting.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              GitHub Pages (Static)           │
│  ┌────────┐  ┌──────────┐  ┌────────────┐  │
│  │  HTML  │  │   CSS    │  │     JS     │  │
│  └────────┘  └──────────┘  └─────┬──────┘  │
│                                   │         │
└───────────────────────────────────┼─────────┘
                                    │ REST / SDK
                              ┌─────▼─────┐
                              │  Firebase  │
                              │ Realtime DB│
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
  "reviewEn": "English review text (optional)",
  "reviewFa": "متن بررسی فارسی (optional)",
  "externalUrl": "https://imdb.com/title/tt1234567",
  "externalSource": "imdb | tvdb | bgg | igdb | steam | goodreads | openlibrary | other",
  "imageUrl": "https://...",
  "dateReviewed": "2026-06-24",
  "dateConsumed": "2026-06-20",
  "status": "completed | in-progress | dropped",
  "tags": ["sci-fi", "co-op"],
  "createdAt": 1719187200000,
  "updatedAt": 1719187200000
}
```

### Firebase Structure

```
/reviews
  /<review-id>
    { ...review object }
```

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
| `#/review/:id` | Single review (shareable) |
| `#/add` | Add new review form |
| `#/edit/:id` | Edit existing review |

---

## UI Layout

### Header
- Site title "OneToTen"
- Navigation tabs for media categories
- Add Review button

### Main Content Area
- **List View:** Grid/cards showing reviews with title, score badge, type icon, and thumbnail
- **Single Review View:** Full review with score, text (bilingual), external link, metadata
- **Form View:** Add/edit form with fields for all review properties

### Score Display
- Large circular badge showing score (1–10)
- Color-coded: 1-3 red, 4-5 orange, 6-7 yellow, 8-9 green, 10 gold

---

## UI Components

### Review Card (List View)
```
┌─────────────────────────────┐
│  [Thumbnail/Icon]           │
│  Title              [8/10]  │
│  🎬 Movie · 2026-06-20     │
│  ★★★★★★★★☆☆               │
└─────────────────────────────┘
```

### Single Review View (Shareable)
```
┌─────────────────────────────────────────┐
│  ← Back                                 │
│                                         │
│  [Large Thumbnail]                      │
│                                         │
│  Title                         [8/10]   │
│  🎬 Movie · Watched: Jun 20, 2026      │
│                                         │
│  ─── English ───                        │
│  Review text in English...              │
│                                         │
│  ─── فارسی ───                          │
│  متن بررسی فارسی...                     │
│                                         │
│  🔗 View on IMDb                        │
│  Tags: sci-fi, thriller                 │
│                                         │
│  [Edit] [Delete] [Share Link]           │
└─────────────────────────────────────────┘
```

---

## External Link Sources

| Media Type | Supported Sources | URL Pattern |
|-----------|-------------------|-------------|
| Movie | IMDb | `https://imdb.com/title/tt*` |
| TV Show | IMDb, TVDB | `https://thetvdb.com/series/*` |
| Board Game | BoardGameGeek | `https://boardgamegeek.com/boardgame/*` |
| Video Game | IGDB, Steam | `https://store.steampowered.com/app/*` |
| Book | Goodreads, OpenLibrary | `https://goodreads.com/book/show/*` |

---

## Bilingual Support

- Reviews can have English text, Persian text, or both
- Persian text is displayed RTL with appropriate font (Vazirmatn)
- The UI itself is in English, but review content supports both languages
- Language toggle on review cards if both are present

---

## Sharing

- Each review has a unique Firebase key used in the URL hash
- Sharing = copying the URL `https://site.url/#/review/<id>`
- The shared view is read-only and shows all review details
- A "Copy Link" button generates the shareable URL

---

## Filtering & Sorting

- Filter by media type (tabs)
- Filter by score range
- Filter by status (completed, in-progress, dropped)
- Sort by: date reviewed, date consumed, score, title
- Search by title (client-side)

---

## Design Tokens

| Token | Value |
|-------|-------|
| Primary color | `#6366f1` (indigo) |
| Background | `#0f172a` (dark slate) |
| Surface | `#1e293b` |
| Text | `#f8fafc` |
| Score 1-3 | `#ef4444` (red) |
| Score 4-5 | `#f97316` (orange) |
| Score 6-7 | `#eab308` (yellow) |
| Score 8-9 | `#22c55e` (green) |
| Score 10 | `#fbbf24` (gold) |
| Font (English) | Inter, system-ui |
| Font (Persian) | Vazirmatn |

---

## Responsive Breakpoints

- Mobile: < 640px (1 column, stacked cards)
- Tablet: 640–1024px (2 columns)
- Desktop: > 1024px (3 columns)

---

## Future Enhancements (Out of Scope for V1)

- Image upload / auto-fetch from external APIs
- User authentication (multi-user support)
- Import/export reviews as JSON
- Statistics dashboard (avg score by type, reviews per month)
- Dark/light theme toggle
