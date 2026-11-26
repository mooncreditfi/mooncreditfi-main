import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Menu,
  X,
  Play,
  ShieldCheck,
  ChartNoAxesCombined,
  Handshake,
  Fingerprint,
  Globe2,
  LockKeyhole,
  FileCheck2,
  CircleAlert,
  Network,
} from "lucide-react";
import { SiSolana } from "react-icons/si";
import aboutVideo from "@/assets/gif.mp4";
import { Button } from "@/components/ui/button";
import { WalletConnectButton } from "@/components/wallet/wallet-connect";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MoonCreditDialog, type Panel } from "@/components/mooncredit-dialog";
import {
  navigation,
  features,
  steps,
  securityPrinciples,
  faqs,
} from "@/components/mooncredit-content";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MoonCreditFi — Trust Before Capital" },
      {
        name: "description",
        content: "Mudarabah business financing for African entrepreneurs and investors.",
      },
      { property: "og:title", content: "MoonCreditFi — Trust Before Capital" },
      {
        property: "og:description",
        content: "Reputation-based business financing, starting in Ghana.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Brand() {
  return (
    <span className="brand">
      <span className="brand-symbol">
        <img src="/favicon.png" alt="" width="34" height="34" />
      </span>
      <span>
        MoonCredit<em>Fi</em>
      </span>
    </span>
  );
}
function SolanaMark() {
  return <SiSolana className="solana-mark" aria-hidden="true" />;
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="eyebrow">
      <span className="gold-text">✦</span>
      {children}
    </div>
  );
}

function Index() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("home");
  const [panel, setPanel] = useState<Panel | null>(null);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) document.documentElement.classList.add("motion-ready");
    const reveals = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            reveals.unobserve(entry.target);
          }
        }),
      { threshold: 0.08 },
    );
    document.querySelectorAll(".reveal").forEach((el) => reveals.observe(el));
    const sections = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        }),
      { rootMargin: "-15% 0px -65% 0px" },
    );
    navigation.forEach(([, id]) => {
      const el = document.getElementById(id);
      if (el) sections.observe(el);
    });
    return () => {
      window.removeEventListener("scroll", onScroll);
      reveals.disconnect();
      sections.disconnect();
      document.documentElement.classList.remove("motion-ready");
    };
  }, []);
  return (
    <div className="page-wrap">
      <header className={`site-header ${scrolled || menuOpen ? "scrolled" : ""}`}>
        <div className="container-wide header-row">
          <a href="#home" aria-label="MoonCreditFi home" className="min-w-0">
            <Brand />
          </a>
          <nav className="header-links" aria-label="Main navigation">
            {navigation.map(([label, id]) => (
              <a
                href={`#${id}`}
                key={id}
                className={active === id ? "active" : ""}
                aria-current={active === id ? "location" : undefined}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="header-actions shrink-0">
            <WalletConnectButton showBalance />
            <Button
              variant="ghost"
              size="icon"
              className="mobile-toggle"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMenuOpen((s) => !s)}
            >
              {menuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
        {menuOpen && (
          <nav id="mobile-navigation" className="mobile-menu" aria-label="Mobile navigation">
            {navigation.map(([label, id]) => (
              <a href={`#${id}`} key={id} onClick={() => setMenuOpen(false)}>
                {label}
              </a>
            ))}
          </nav>
        )}
      </header>
      <main>
        <section className="hero" id="home">
          <div className="container-wide hero-grid">
            <div className="hero-copy">
              <h1>
                Decentralized
                <br />
                <span className="gold-text">Business Financing on Solana</span>
              </h1>
              <p className="hero-description">
                Connecting African businesses with ethical investors through transparent profit
                sharing.
              </p>
              <div className="hero-buttons">
                <Button asChild variant="gold">
                  <Link to="/opportunities">
                    Explore Opportunities
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="quiet">
                  <a href="#how-it-works">
                    <ArrowDown className="text-gold" />
                    How It Works
                  </a>
                </Button>
              </div>
              <div className="hero-credentials">
                <div className="credential">
                  <SolanaMark />
                  <span>
                    Built on<strong>Solana</strong>
                  </span>
                </div>
                <div className="credential">
                  <ShieldCheck />
                  <span>
                    Reputation<strong>Signals</strong>
                  </span>
                </div>
                <div className="credential">
                  <ChartNoAxesCombined />
                  <span>
                    Transparent<strong>Terms</strong>
                  </span>
                </div>
              </div>
            </div>
            <div className="hero-visual">
              <img
                className="hero-art"
                src="/mooncredit-finance.svg"
                width="1672"
                height="941"
                fetchPriority="high"
                alt="Illustrative violet finance dashboard, gold Solana-inspired coins and a glowing architectural crescent"
              />
              <div className="visual-panel">
                <Handshake />
              </div>
            </div>
          </div>
        </section>
        <div className="principle-band">
          <div className="container-wide principle-row">
            <p className="principle-intro">
              A new foundation
              <br />
              for business finance
            </p>
            <div className="principle-item">
              <Fingerprint />
              Reputation first
            </div>
            <div className="principle-item">
              <Handshake />
              Ethical by design
            </div>
            <div className="principle-item">
              <Network />
              Transparent on-chain
            </div>
            <div className="principle-item">
              <Globe2 />
              Rooted in Africa. Built for the world.
            </div>
          </div>
        </div>
        <section id="about" className="section">
          <div className="container-wide about-grid">
            <div className="about-copy reveal">
              <Eyebrow>About</Eyebrow>
              <h2 className="section-heading">
                Finance Built
                <br />
                Around <span className="gold-text">Trust.</span>
              </h2>
              <p className="section-description">
                Businesses need suitable capital. Investors need clear information.
              </p>
              <p className="section-description">
                MoonCreditFi brings business context and Mudarabah profit sharing together, starting
                in Ghana.
              </p>
              <a href="#how-it-works" className="text-link">
                See how it works
                <ArrowRight size={15} />
              </a>
            </div>
            <div className="about-video-wrap reveal">
              <video
                className="about-video"
                autoPlay
                controls
                loop
                muted
                playsInline
                preload="metadata"
                aria-label="MoonCreditFi reputation and funding overview"
              >
                <source src={aboutVideo} type="video/mp4" />
                Your browser does not support video playback.
              </video>
            </div>
          </div>
        </section>
        <section id="features" className="section features-section">
          <div className="container-wide">
            <div className="section-top reveal">
              <div>
                <Eyebrow>Platform</Eyebrow>
                <h2 className="section-heading">
                  Shared <span className="gold-text">Opportunity.</span>
                </h2>
              </div>
              <p className="section-description">
                Business context, transparent terms and shared outcomes.
              </p>
            </div>
            <div className="feature-grid">
              {features.map((feature, i) => (
                <article className="feature-card reveal" key={feature.title}>
                  <div className="icon-tile">
                    <feature.icon />
                  </div>
                  <span className="feature-number">0{i + 1}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="how-it-works" className="section">
          <div className="container-wide">
            <div className="center-heading reveal">
              <Eyebrow>How it works</Eyebrow>
              <h2 className="section-heading">
                From Trust to <span className="gold-text">Capital.</span>
              </h2>
              <p className="section-description">
                A clear path from proposal review to informed funding and on-chain activity.
              </p>
            </div>
            <div className="steps">
              {steps.map((step, i) => (
                <article key={step.title} className="step reveal">
                  <span className="step-number">0{i + 1}</span>
                  <h3>{step.title}</h3>
                  <span className="step-actor">{step.actor}</span>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>
            <div className="steps-footer reveal">
              <p className="steps-note">
                This flow reflects current Devnet capabilities. Returns are not guaranteed.
              </p>
              <div className="steps-actions">
                <Button asChild variant="gold">
                  <Link to="/opportunities">
                    Explore Opportunities
                    <ArrowRight />
                  </Link>
                </Button>
                <Button variant="quiet" onClick={() => setPanel("demo")}>
                  <Play className="text-gold" />
                  Guided walkthrough
                </Button>
              </div>
            </div>
          </div>
        </section>
        <section id="security" className="section security-section">
          <div className="container-wide">
            <div className="security-grid">
              <div className="reveal">
                <Eyebrow>Security & transparency</Eyebrow>
                <h2 className="section-heading">
                  Trust Should Be
                  <br />
                  <span className="gold-text">Verifiable.</span>
                </h2>
                <p className="section-description">
                  Designed for accountable records, reviews and settlements.
                </p>
                <div className="security-list">
                  {securityPrinciples.map((item) => (
                    <div className="security-item" key={item.text}>
                      <item.icon />
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div
                className="security-art reveal"
                aria-label="Illustration of intended platform security principles"
              >
                <div className="security-rings">
                  <ShieldCheck className="security-shield" />
                </div>
                <div className="security-label first">
                  <Network />
                  Verifiable records
                </div>
                <div className="security-label second">
                  <FileCheck2 />
                  Documented settlements
                </div>
                <div className="security-label third">
                  <LockKeyhole />
                  Controlled access
                </div>
              </div>
            </div>
          </div>
        </section>
        <section id="ecosystem" className="section">
          <div className="container-wide">
            <div className="center-heading reveal">
              <Eyebrow>Technology</Eyebrow>
              <h2 className="section-heading">
                Built on Open <span className="gold-text">Foundations.</span>
              </h2>
            </div>
            <div className="ecosystem-grid">
              <article className="ecosystem-card reveal">
                <h3 className="ecosystem-title">
                  <SolanaMark />
                  Solana
                </h3>
                <p>Planned for transparent pool records.</p>
              </article>
              <article className="ecosystem-card reveal">
                <h3 className="ecosystem-title">
                  <ShieldCheck />
                  CredLayer
                </h3>
                <p>Planned reputation context for decisions.</p>
              </article>
              <article className="ecosystem-card reveal">
                <h3 className="ecosystem-title">
                  <Network />
                  Supabase
                </h3>
                <p>Application data and document storage.</p>
              </article>
            </div>
          </div>
        </section>
        <section id="faq" className="section faq-section">
          <div className="container-wide faq-grid">
            <div className="reveal">
              <Eyebrow>FAQ</Eyebrow>
              <h2 className="section-heading">
                Good Questions.
                <br />
                <span className="gold-text">Clear Answers.</span>
              </h2>
              <p className="section-description">The essentials before you take part.</p>
              <Button variant="nav" className="mt-6 text-link" onClick={() => setPanel("contact")}>
                Ask a question
                <ArrowUpRight size={15} />
              </Button>
            </div>
            <Accordion type="single" collapsible className="reveal">
              {faqs.map((faq, i) => (
                <AccordionItem value={`faq-${i}`} key={faq.question}>
                  <AccordionTrigger className="faq-question">{faq.question}</AccordionTrigger>
                  <AccordionContent className="faq-answer">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
        <section className="final-cta">
          <div className="container-wide cta-row reveal">
            <div>
              <Eyebrow>Start with trust</Eyebrow>
              <h2>
                Unlock <span className="gold-text">Opportunity.</span>
              </h2>
              <p>Explore the MoonCreditFi journey.</p>
            </div>
            <div className="cta-actions">
              <Button asChild variant="gold">
                <Link to="/opportunities">
                  Explore Opportunities
                  <ArrowRight />
                </Link>
              </Button>
              <Button variant="quiet" onClick={() => setPanel("entrepreneur")}>
                For Entrepreneurs
                <ArrowUpRight />
              </Button>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="container-wide">
          <div className="footer-grid">
            <div className="footer-brand">
              <a href="#home" aria-label="MoonCreditFi home">
                <Brand />
              </a>
              <p className="footer-description">
                Ethical finance. Earned trust. Shared opportunity.
                <br />
                Reputation-based Mudarabah financing on Solana, starting in Africa.
              </p>
            </div>
            <div className="footer-column">
              <h3>Platform</h3>
              <a href="#features">Features</a>
              <a href="#how-it-works">How It Works</a>
              <Button asChild variant="nav">
                <Link to="/opportunities">Opportunities</Link>
              </Button>
            </div>
            <div className="footer-column">
              <h3>MoonCreditFi</h3>
              <a href="#about">About</a>
              <a href="#security">Security</a>
              <a href="#faq">FAQ</a>
              <Button variant="nav" onClick={() => setPanel("contact")}>
                Contact
              </Button>
            </div>
            <div className="footer-column">
              <h3>Legal</h3>
              <Button variant="nav" onClick={() => setPanel("privacy")}>
                Privacy Policy
              </Button>
              <Button variant="nav" onClick={() => setPanel("terms")}>
                Terms of Service
              </Button>
            </div>
          </div>
          <div className="footer-bottom">
            <span>
              © 2026 MoonCreditFi. All rights reserved. · Returns aren't guaranteed; capital is at
              risk.
            </span>
            <span>
              <Globe2 />
              Made for Africa. Open to the world.
            </span>
          </div>
        </div>
      </footer>
      <MoonCreditDialog panel={panel} onClose={() => setPanel(null)} />
    </div>
  );
}
