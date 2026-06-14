# Orchestra Decks

GitHub Pages site for Orchestra presentations and slide decks.

**Live:** <https://mifunedev.github.io/orchestra/>

## Directory Structure

```
decks/
  index.html          # Redirects to slides/
  slides/             # reveal.js presentation deck
    index.html
    README.md          # Slide editing guide
```

## Local Preview

From the repository root:

```bash
npx serve decks
# or
python -m http.server 8080 --directory decks
```

Then open <http://localhost:8080>. The root `index.html` redirects to `slides/`.

## Deployment

Automatic via `.github/workflows/slides.yml`:

- **Trigger:** push to `development` when files in `decks/slides/**` change (or manual `workflow_dispatch`)
- **Action:** uploads the entire `decks/` directory as a GitHub Pages artifact
- **Pages source:** GitHub Actions. Do not configure the legacy branch source (`development` + `/docs`); the repository has no root `docs/` directory.
- **Concurrency:** only one deployment runs at a time

## Adding Content

### Editing slides

See [`slides/README.md`](slides/README.md) for the full editing and animation guide.

### Adding new top-level sections

1. Create a new directory under `decks/` (e.g., `decks/guides/`)
2. Add an `index.html` (or other static files) inside it
3. Update `decks/index.html` if the default landing page should change
4. Add the new path pattern to `.github/workflows/slides.yml` under `paths:` so changes trigger deployment
