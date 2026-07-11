# 🎯 OneToTen

**Live site:** [https://domrany64.github.io/OneToTen/](https://domrany64.github.io/OneToTen/)

A personal media review website where you rate and review everything you play, read, and watch — on a simple 0–10 scale.

## Features

- **Multi-media support** — Review video games, board games, books (read or audiobooks), movies, and TV shows
- **0–10 scoring** — Simple, consistent rating scale across all media types with color-coded badges
- **Bilingual reviews** — Write reviews in English or Persian (RTL) with a language toggle
- **Multiple external links** — Attach links to popular databases per review, drag-and-drop reorderable:
  - 🎬 Movies & TV: [IMDb](https://imdb.com), [TVDB](https://thetvdb.com)
  - 🎲 Board Games: [BoardGameGeek](https://boardgamegeek.com)
  - 🎮 Video Games: [Steam](https://store.steampowered.com), [Epic Games](https://store.epicgames.com), [GOG](https://gog.com), [Ubisoft](https://store.ubi.com), [Xbox](https://xbox.com), [PlayStation](https://store.playstation.com), [IGDB](https://igdb.com)
  - 📚 Books: [Goodreads](https://goodreads.com), [OpenLibrary](https://openlibrary.org)
  - 🌐 All: [Wikipedia](https://wikipedia.org)
- **Type-specific metadata** — Director/actors for movies, seasons/episodes/show status for TV, developer/platform for games, author/narrator for books, designer/player count for board games
- **Year with Shamsi ↔ Gregorian conversion** — Auto-detects calendar type, supports year ranges (e.g. 2021-2024) for TV shows
- **Context-specific statuses** — Completed/In Progress/Dropped/Avoid for most types; Playing/Abandoned/Avoid for board games
- **TV show production status** — Track whether a show is Ongoing, Completed, or Canceled (separate from your watching status)
- **Shareable reviews** — Each review has a unique URL you can share with friends
- **Advanced filtering** — Sidebar with sort, score range, status, year range, searchable tag/creator combobox filters
- **Context-aware creator filter** — Shows Director/Actor for movies, Developer for games, Author/Narrator for books, Designer for board games
- **Real-time sync** — Firebase Realtime Database keeps everything in sync
- **Authentication** — Firebase Auth protects write operations (login required to add/edit/delete)
- **Automated backups** — Weekly GitHub Actions workflow backs up the database with AES-256-CBC encryption (requires `FIREBASE_SA_KEY` and `BACKUP_PASSWORD` repo secrets)
- **IMDb import tool** — Bulk import ratings from IMDb CSV export
- **BGG import tool** — Bulk import board game collection from BoardGameGeek CSV export
- **Playnite import tool** — Bulk import game library from Playnite CSV export
- **Metadata auto-fetch** — Search TMDB (movies/TV), RAWG (games), or Open Library (books) by title; auto-fills year, director, actors, poster, and more
- **Multi-user support** — Each account stores reviews separately; shared links work across users
- **Bulk operations** — Select multiple reviews to bulk modify or delete
- **Responsive** — Works on desktop, tablet, and mobile with adaptive sidebar layout

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS (single-page app, no build tools, ES modules)
- **Database:** Firebase Realtime Database (modular SDK v12.15.0)
- **Auth:** Firebase Email/Password Authentication
- **Hosting:** GitHub Pages
- **CI:** GitHub Actions (weekly DB backup)

## Tools

- **Helpers page:** [/helpers/](https://domrany64.github.io/OneToTen/helpers/) — Index of all helper tools
- **Import IMDb:** [/import-imdb.html](https://domrany64.github.io/OneToTen/import-imdb.html) — Bulk import your IMDb ratings via CSV export
- **Import BGG:** [/import-bgg.html](https://domrany64.github.io/OneToTen/import-bgg.html) — Bulk import your BoardGameGeek collection via CSV
- **Import Playnite:** [/import-playnite.html](https://domrany64.github.io/OneToTen/import-playnite.html) — Bulk import your Playnite game library via CSV
- **Cleanup Imports:** [/cleanup-import.html](https://domrany64.github.io/OneToTen/cleanup-import.html) — Remove bad bulk imports
- **Migrate Users:** [/migrate-users.html](https://domrany64.github.io/OneToTen/migrate-users.html) — One-time migration to per-user data structure

## License

MIT License — see [LICENSE](LICENSE) for details.

## GitHub Actions Backup Setup

The weekly encrypted backup requires 2 repository secrets and one Google Cloud API to be enabled.

### 1. Enable the IAM Credentials API
Visit this URL and click **Enable** (free, one-time — use your OneToTen Firebase project):
`https://console.developers.google.com/apis/api/iamcredentials.googleapis.com/overview?project=one-to-ten-92b88`

### 2. Generate a Firebase service account key
1. Go to [console.firebase.google.com](https://console.firebase.google.com) → your **OneToTen** project
2. Click ⚙️ → **Project settings** → **Service accounts** tab
3. Click **"Generate new private key"** → confirm → a JSON file downloads
4. Open the JSON file and copy its **entire contents**

### 3. Add repository secrets
Go to: **GitHub → OneToTen repo → Settings → Secrets and variables → Actions → Repository secrets → New repository secret**

| Secret name | Value |
|---|---|
| `FIREBASE_SA_KEY` | Entire contents of the service account JSON key file |
| `BACKUP_PASSWORD` | Any password you choose — required to decrypt backups later |

### 4. Run the workflow
Go to **Actions → Backup Firebase DB (Encrypted) → Run workflow** to test.

Backups are stored as AES-256-CBC encrypted `.enc` files in `backups/` — unreadable without your `BACKUP_PASSWORD`. Runs automatically every Sunday at 3 AM UTC. Keeps last 10 backups.

### Verify / decrypt a backup
```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 \
  -in backups/backup_YYYYMMDD_HHMMSS.json.enc \
  -out /tmp/backup_test.json \
  -pass pass:"YOUR_BACKUP_PASSWORD"

# Confirm valid JSON
python3 -m json.tool /tmp/backup_test.json > /dev/null && echo "OK"
```
