<div align="center">

<table align="center">
  <tr>
    <td style="padding: 0; vertical-align: middle;">
      <img
        src="https://avatars.githubusercontent.com/u/139279732?s=200&v=4"
        width="60"
        height="60"
        style="border-radius: 50%; display: block;"
        alt="Ruska Logo"
      />
    </td>
    <td style="padding: 0 0 0 2px; vertical-align: middle;">
      <span style="font-weight: 600; font-style: italic; font-size: 2.4rem; line-height: 1;">
        RCHESTRA DOCS
      </span>
    </td>
  </tr>
</table>

Standalone Docusaurus site for Orchestra documentation, deployed independently on Netlify.

<a href="https://discord.com/invite/QRfjg4YNzU"><img src="https://img.shields.io/badge/Join-Discord-purple"></a>
<a href="https://orchestra.ruska.ai/api"><img src="https://img.shields.io/badge/View-API Docs-blue"></a>
<a href="https://ruska.ai/socials"><img src="https://img.shields.io/badge/Follow-Social-black"></a>
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](../LICENSE)
[![DCO](https://img.shields.io/badge/DCO-1.1-yellow)](../DCO)

</div>

## 📦 Prerequisites

-   Node.js 22
-   npm

## 📥 Install

```bash
cd docs
npm install
```

## 🧪 Local Development

```bash
npm start
```

## 🏗️ Production Build

```bash
npm run build
```

## 🚀 Netlify Deployment

Configured via `netlify.toml` at repo root.

-   Base directory: `docs`
-   Build command: `npm ci && npm run build`
-   Publish directory: `docs/build`

## 🧭 Structure

-   `docs/` - Markdown content (Docusaurus docs)
-   `src/pages/` - Custom pages (homepage)
-   `src/css/` - Theme overrides and brand styles
-   `static/` - Static assets (logos, images)

## 📝 Notes

-   Docs are hosted at `https://docs.ruska.ai`.
-   The main app redirects `/docs/*` traffic to the docs site.
