import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";

const HomePage = () => {
  return (
    <Layout
      title="Orchestra Docs"
      description="Steer agents to precision with Orchestra documentation."
    >
      <header className="hero-orchestra">
        <div className="hero-orchestra__inner">
          <div>
            <div className="hero-badge">Open-Source · Apache 2.0</div>
            <h1 className="hero-title">Steer Agents to Precision.</h1>
            <p className="hero-tagline">
              Orchestra gives you flexible agent orchestration with guided
              autonomy. Define guardrails, adjust behavior in real-time, and
              ship reliable systems with MCP and A2A support.
            </p>
            <div className="hero-actions">
              <Link className="hero-button hero-button--primary" to="/docs/getting-started">
                Get Started
              </Link>
              <a
                className="hero-button hero-button--secondary"
                href="https://github.com/ruska-ai/orchestra"
                target="_blank"
                rel="noreferrer"
              >
                Star on GitHub
              </a>
            </div>
            <div className="hero-trust">
              <span>Open-Source (Apache 2.0)</span>
              <span>Self-Host or Cloud</span>
              <span>Built on LangGraph</span>
            </div>
          </div>
          <div className="hero-card">
            <h3>Docs Quickstart</h3>
            <ul>
              <li>Configure your first assistant</li>
              <li>Connect MCP + A2A tools</li>
              <li>Ship production-safe guardrails</li>
              <li>Explore the API surface</li>
            </ul>
          </div>
        </div>
      </header>
      <main>
        <section className="section-grid">
          <div className="section-card">
            <h4>Assistants</h4>
            <p>Design reusable agent profiles with tools, models, and policies.</p>
            <Link to="/docs/assistants">Explore assistants →</Link>
          </div>
          <div className="section-card">
            <h4>Threads</h4>
            <p>Capture context-rich conversations and manage stateful workflows.</p>
            <Link to="/docs/threads">Explore threads →</Link>
          </div>
          <div className="section-card">
            <h4>Tools & Integrations</h4>
            <p>Wire MCP servers, A2A agents, and search tools into every run.</p>
            <Link to="/docs/tools">Explore tools →</Link>
          </div>
        </section>
      </main>
    </Layout>
  );
};

export default HomePage;
