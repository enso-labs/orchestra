import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "Orchestra Docs",
  tagline: "Steerable agent orchestration built on LangGraph",
  url: "https://docs.ruska.ai",
  baseUrl: "/",
  favicon: "img/ruska_logo_200.png",
  onBrokenLinks: "warn",
  onBrokenMarkdownLinks: "warn",
  organizationName: "ruska-ai",
  projectName: "orchestra",

  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "docs",
          sidebarPath: "./sidebars.ts",
          editUrl: "https://github.com/ruska-ai/orchestra/edit/main/docs/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: "dark",
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Orchestra",
      logo: {
        alt: "Orchestra",
        src: "img/ruska_logo_200.png",
      },
      items: [
        { type: "docSidebar", sidebarId: "docs", position: "left", label: "Docs" },
        { to: "/docs/getting-started", label: "Getting Started", position: "left" },
        { href: "https://orchestra.ruska.ai/api", label: "API", position: "left" },
        { href: "https://github.com/ruska-ai/orchestra", label: "GitHub", position: "right" },
        { href: "https://ruska.ai/blog", label: "Blog", position: "right" },
        { href: "https://ruska.ai/socials", label: "Social", position: "right" },
        { href: "https://discord.com/invite/QRfjg4YNzU", label: "Discord", position: "right" },
        {
          href: "https://join.slack.com/t/ruska-ai/shared_invite/zt-3l2lnevo6-hOe5ZeoAz~xj7CFAJk2bzg",
          label: "Slack",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            { label: "Getting Started", to: "/docs/getting-started" },
            { label: "Core Features", to: "/docs/assistants" },
            { label: "Tools & Integrations", to: "/docs/tools" },
            { label: "API", href: "https://orchestra.ruska.ai/api" },
          ],
        },
        {
          title: "Community",
          items: [
            { label: "Discord", href: "https://discord.com/invite/QRfjg4YNzU" },
            {
              label: "Slack",
              href: "https://join.slack.com/t/ruska-ai/shared_invite/zt-3l2lnevo6-hOe5ZeoAz~xj7CFAJk2bzg",
            },
            { label: "GitHub", href: "https://github.com/ruska-ai/orchestra" },
          ],
        },
        {
          title: "Company",
          items: [
            { label: "Blog", href: "https://ruska.ai/blog" },
            { label: "Socials", href: "https://ruska.ai/socials" },
            { label: "Ruska Labs", href: "https://ruska.ai" },
          ],
        },
      ],
      copyright: "Copyright \u00a9 2025 Ruska Labs. All rights reserved.",
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
