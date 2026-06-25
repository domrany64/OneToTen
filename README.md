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
- **Automated backups** — Weekly GitHub Actions workflow backs up the database
- **IMDb import tool** — Bulk import ratings from IMDb CSV export
- **Responsive** — Works on desktop, tablet, and mobile with adaptive sidebar layout

## Tech Stack

- **Frontend:** Vanilla HTML/CSS/JS (single-page app, no build tools, ES modules)
- **Database:** Firebase Realtime Database (modular SDK v12.15.0)
- **Auth:** Firebase Email/Password Authentication
- **Hosting:** GitHub Pages
- **CI:** GitHub Actions (weekly DB backup)

## Tools

- **Import IMDb:** [/import-imdb.html](https://domrany64.github.io/OneToTen/import-imdb.html) — Bulk import your IMDb ratings via CSV export

## License

MIT License — see [LICENSE](LICENSE) for details.
