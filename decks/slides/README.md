# Orchestra Slide Deck

Static HTML presentation built with [reveal.js](https://revealjs.com/) for showcasing Orchestra - the Open-Source AI Agent Orchestration Platform.

## Live URL

Once deployed, the slides are available at: **https://mifunedev.github.io/orchestra/slides/**

## Local Development

### Quick Preview (No Install)

```bash
# From repository root
npx serve decks/slides

# Or with live reload
npx live-server decks/slides --port=8080
```

Then open http://localhost:8080 in your browser.

### Python Alternative

```bash
# From decks/slides directory
cd decks/slides
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

Slides are automatically deployed by `.github/workflows/slides.yml` when changes under `decks/slides/` are merged to the `development` branch. GitHub Pages must use **Build and deployment → Source: GitHub Actions**; the legacy branch source (`development` + `/docs`) is deprecated because the repository no longer has a root `docs/` directory.

### Manual Deployment

If you need to deploy manually, run the **Deploy Slides to GitHub Pages** workflow from the Actions tab. Do not switch Pages back to a branch source.

## Adding New Slides

1. Edit `decks/slides/index.html`
2. Add new `<section>` elements where appropriate
3. Preview locally with `npx serve decks/slides`
4. Commit and push to trigger deployment

## Resources

- [reveal.js Documentation](https://revealjs.com/)
- [reveal.js GitHub](https://github.com/hakimel/reveal.js)
- [Auto-Animate Examples](https://revealjs.com/auto-animate/)
- [Fragments Guide](https://revealjs.com/fragments/)
