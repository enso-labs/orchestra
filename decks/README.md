# Orchestra Docs

GitHub Pages site for Orchestra documentation and presentations.

**Live:** <https://ruska-ai.github.io/orchestra/>

## Directory Structure

```
docs/
  index.html          # Redirects to slides/
  slides/             # reveal.js presentation deck
    index.html
    README.md          # Slide editing guide
```

## Local Preview

From the repository root:

```bash
npx serve docs
# or
python -m http.server 8080 --directory docs
```

Then open <http://localhost:8080>. The root `index.html` redirects to `slides/`.

## Deployment

Automatic via `.github/workflows/slides.yml`:

- **Trigger:** push to `development` when files in `docs/slides/**` change (or manual `workflow_dispatch`)
- **Action:** uploads the entire `docs/` directory as a GitHub Pages artifact
- **Concurrency:** only one deployment runs at a time

## Adding Content

### Editing slides

See [`slides/README.md`](slides/README.md) for the full editing and animation guide.

### Adding new top-level sections

1. Create a new directory under `docs/` (e.g., `docs/guides/`)
2. Add an `index.html` (or other static files) inside it
3. Update `docs/index.html` if the default landing page should change
4. Add the new path pattern to `.github/workflows/slides.yml` under `paths:` so changes trigger deployment
