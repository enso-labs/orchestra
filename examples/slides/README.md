# Orchestra Slide Deck

Static HTML presentation built with [reveal.js](https://revealjs.com/) for showcasing Orchestra - the Open-Source AI Agent Orchestration Platform.

## Live URL

Once deployed, the slides are available at: **https://ruska-ai.github.io/orchestra/slides/**

## Local Development

### Quick Preview (No Install)

```bash
# From repository root
npx serve docs/slides

# Or with live reload
npx live-server docs/slides --port=8080
```

Then open http://localhost:8080 in your browser.

### Python Alternative

```bash
# From docs/slides directory
cd docs/slides
python -m http.server 8080
```

## Editing Slides

Edit `index.html` directly. The presentation uses reveal.js via CDN, so no build step is required.

### Slide Structure

- **Horizontal slides**: Each `<section>` at the top level is a horizontal slide
- **Vertical slides**: Nest `<section>` elements for vertical navigation (press down arrow)
- **Fragments**: Add `class="fragment"` to reveal elements step-by-step

### Key Features Used

| Feature | Usage |
|---------|-------|
| Auto-Animate | `data-auto-animate` on consecutive sections |
| Transitions | `data-transition="zoom\|slide\|fade\|convex\|concave\|none"` |
| Fragments | `class="fragment fade-up"` for step reveals |
| Backgrounds | `data-background="#color"` or gradients |
| Code Highlighting | `<pre><code data-line-numbers>` |

### Animation Cheat Sheet

**Transitions** (slide-level):
```html
<section data-transition="slide">   <!-- default -->
<section data-transition="fade">
<section data-transition="zoom">
<section data-transition="convex">
<section data-transition="concave">
<section data-transition="none">
```

**Auto-Animate** (element morphing):
```html
<section data-auto-animate>
  <div data-id="box" style="height: 50px; background: salmon;"></div>
</section>
<section data-auto-animate>
  <div data-id="box" style="height: 200px; background: blue;"></div>
</section>
```

**Fragments** (step-through elements):
```html
<p class="fragment">Appears first</p>
<p class="fragment fade-up">Slides up</p>
<p class="fragment highlight-red">Highlights red</p>
<p class="fragment fade-in-then-out">Appears then disappears</p>
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `→` / `Space` | Next slide |
| `←` | Previous slide |
| `↓` | Next vertical slide |
| `↑` | Previous vertical slide |
| `O` | Overview mode |
| `S` | Speaker notes |
| `F` | Fullscreen |
| `Esc` | Exit overview/fullscreen |
| `?` | Help |

## Deployment

Slides are automatically deployed to GitHub Pages when changes are merged to the `development` branch.

### Manual Deployment

If you need to deploy manually:

1. Go to GitHub repository **Settings** → **Pages**
2. Under "Source", select branch `development` and folder `/docs`
3. Save

The workflow `.github/workflows/slides.yml` handles automatic deployment.

## Adding New Slides

1. Edit `docs/slides/index.html`
2. Add new `<section>` elements where appropriate
3. Preview locally with `npx serve docs/slides`
4. Commit and push to trigger deployment

## Resources

- [reveal.js Documentation](https://revealjs.com/)
- [reveal.js GitHub](https://github.com/hakimel/reveal.js)
- [Auto-Animate Examples](https://revealjs.com/auto-animate/)
- [Fragments Guide](https://revealjs.com/fragments/)
