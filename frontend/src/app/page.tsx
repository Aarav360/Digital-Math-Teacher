"use client";

import Link from "next/link";
import { useEffect, useRef, useCallback } from "react";
import Plasma from "@/components/plasma";
import ShinyText from "@/components/ShinyText";

export default function LandingPage() {
  const revealRefs = useRef<HTMLDivElement[]>([]);

  const handleSmoothScroll = useCallback((e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
          }
        });
      },
      { threshold: 0.15 }
    );
    revealRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const addRevealRef = (el: HTMLDivElement | null) => {
    if (el && !revealRefs.current.includes(el)) {
      revealRefs.current.push(el);
    }
  };

  return (
    <div className="landing-page min-h-screen bg-card antialiased scroll-smooth">
      {/* Plasma background */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ opacity: 0.15 }}>
        <Plasma
          color="var(--primary)"
          speed={0.6}
          direction="forward"
          scale={1.1}
          opacity={0.8}
          mouseInteractive={false}
        />
      </div>

      {/* Noise overlay */}
      <div className="landing-noise" />

      {/* Background orbs */}
      <div className="relative z-10">
      <div className="landing-orb landing-orb-1" />
      <div className="landing-orb landing-orb-2" />
      <div className="landing-orb landing-orb-3" />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 landing-nav">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--blue-600)] to-[var(--indigo-600)] flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground font-bold text-sm">&sum;</span>
            </div>
            <span className="font-semibold text-lg tracking-tight text-[var(--neutral-900)]">
              Digital Math Teacher
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" onClick={(e) => handleSmoothScroll(e, "features")} className="landing-nav-link text-sm">Features</a>
            <a href="#how-it-works" onClick={(e) => handleSmoothScroll(e, "how-it-works")} className="landing-nav-link text-sm">How it Works</a>
            <a href="#about" onClick={(e) => handleSmoothScroll(e, "about")} className="landing-nav-link text-sm">About</a>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/auth" className="landing-btn-secondary px-4 py-2 rounded-full text-sm font-medium hidden sm:block">
              Sign In
            </Link>
            <Link href="/app" className="landing-btn-primary px-5 py-2 rounded-full text-sm font-medium">
              Try Now
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden landing-grid-bg">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center relative z-10">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--blue-50)] border border-[var(--blue-100)] text-xs font-medium text-[var(--blue-600)]">
              <span className="landing-status-dot" />
              AI-Powered Learning
            </div>

            <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight">
              <ShinyText
                text={'A clean space for\nmessy thinking —\nand smart feedback.'}
                className="whitespace-pre-line"
                speed={2.5}
                color="var(--neutral-700)"
                shineColor="var(--neutral-50)"
                spread={120}
                direction="left"
                playCount={2}
              />
            </h1>

            <p className="text-lg text-[var(--neutral-600)] max-w-lg leading-relaxed">
              Solve math problems on a digital whiteboard. Get step-by-step AI feedback that understands your handwritten work, from Algebra 1 to Calculus 3.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link
                href="/app"
                className="landing-btn-primary px-8 py-4 rounded-full font-medium flex items-center gap-2 group"
              >
                Try without signing in
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                href="/auth"
                className="landing-btn-secondary px-8 py-4 rounded-full font-medium flex items-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Sign in with Google
              </Link>
            </div>

            <div className="flex items-center gap-6 text-sm text-[var(--neutral-500)] pt-4">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--green-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--green-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Free for students
              </div>
            </div>
          </div>

          {/* Right Content - Whiteboard Mockup */}
          <div className="relative lg:h-[600px] flex items-center justify-center">
            <div className="landing-whiteboard w-full max-w-lg rounded-2xl p-6 relative overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-[var(--neutral-100)]">
                <div className="w-8 h-8 rounded-lg bg-[var(--neutral-50)] flex items-center justify-center text-[var(--neutral-600)]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <div className="w-8 h-8 rounded-lg bg-[var(--neutral-50)] flex items-center justify-center text-[var(--neutral-600)]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-2 text-xs text-[var(--neutral-400)]">
                  <span className="w-2 h-2 rounded-full bg-[var(--green-500)]" />
                  Connected
                </div>
              </div>

              {/* Problem */}
              <div className="mb-6">
                <div className="text-xs text-[var(--neutral-400)] mb-1 uppercase tracking-wider font-medium">Problem</div>
                <div className="text-lg font-medium text-[var(--neutral-800)]">Solve for x: 2x&sup2; + 4x &minus; 6 = 0</div>
              </div>

              {/* Handwritten Steps */}
              <div className="space-y-4 font-mono text-lg">
                <div className="flex items-start gap-3 opacity-80">
                  <span className="text-[var(--neutral-400)]">1.</span>
                  <div className="text-[var(--blue-600)]">x&sup2; + 2x &minus; 3 = 0</div>
                </div>
                <div className="flex items-start gap-3 opacity-80">
                  <span className="text-[var(--neutral-400)]">2.</span>
                  <div className="text-[var(--blue-600)]">(x + 3)(x &minus; 1) = 0</div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-[var(--neutral-400)]">3.</span>
                  <div className="flex items-center gap-2 text-[var(--blue-600)]">
                    x = &minus;3 or x = 1
                    <span className="text-[var(--green-600)] text-sm font-medium bg-[var(--green-50)] px-2 py-0.5 rounded-full font-sans">&check; Correct</span>
                  </div>
                </div>
              </div>

              {/* AI Feedback Panel */}
              <div className="mt-6 landing-glass rounded-xl p-4 border border-[var(--blue-100)] shadow-lg">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--blue-100)] flex items-center justify-center shrink-0">
                    <span className="text-[var(--blue-600)] text-xs font-bold">AI</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[var(--blue-900)] mb-1">Step 3 Verified</div>
                    <div className="text-xs text-[var(--neutral-600)]">Great job factoring! Both solutions satisfy the original equation.</div>
                  </div>
                </div>
              </div>

              {/* Grid overlay */}
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(var(--grid-line) 1px, var(--grid-line-transparent) 1px),linear-gradient(90deg, var(--grid-line) 1px, var(--grid-line-transparent) 1px)", backgroundSize: "20px 20px" }} />
            </div>

            {/* Decorative blurs */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-[var(--blue-400-20)] rounded-full blur-2xl" />
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-[var(--indigo-400-20)] rounded-full blur-2xl" />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <svg className="w-6 h-6 text-[var(--neutral-300)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-32 relative bg-[var(--neutral-50-50)]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20 landing-reveal" ref={addRevealRef}>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-[var(--neutral-900)]">How it works</h2>
            <p className="text-[var(--neutral-500)] max-w-2xl mx-auto text-lg">Three simple steps to smarter math practice</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="landing-step-card rounded-2xl p-8 landing-reveal" ref={addRevealRef}>
              <div className="w-12 h-12 rounded-xl bg-[var(--blue-50)] flex items-center justify-center mb-6 border border-[var(--blue-100)]">
                <span className="text-2xl font-bold text-[var(--blue-600)]">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-[var(--neutral-900)]">Write by Hand</h3>
              <p className="text-[var(--neutral-600)] leading-relaxed">
                Use your stylus or mouse to write math naturally on the digital whiteboard. Just like paper, but smarter.
              </p>
              <div className="mt-6 pt-6 border-t border-[var(--neutral-100)]">
                <div className="flex items-center gap-2 text-sm text-[var(--neutral-500)]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Pen, eraser, text tools
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="landing-step-card rounded-2xl p-8 landing-reveal" ref={addRevealRef}>
              <div className="w-12 h-12 rounded-xl bg-[var(--indigo-50)] flex items-center justify-center mb-6 border border-[var(--indigo-100)]">
                <span className="text-2xl font-bold text-[var(--indigo-600)]">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-[var(--neutral-900)]">Get AI Feedback</h3>
              <p className="text-[var(--neutral-600)] leading-relaxed">
                The AI reads each step, checks your reasoning, and identifies exactly where things go off track.
              </p>
              <div className="mt-6 pt-6 border-t border-[var(--neutral-100)]">
                <div className="flex items-center gap-2 text-sm text-[var(--neutral-500)]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Instant step analysis
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="landing-step-card rounded-2xl p-8 landing-reveal" ref={addRevealRef}>
              <div className="w-12 h-12 rounded-xl bg-[var(--cyan-50)] flex items-center justify-center mb-6 border border-[var(--cyan-100)]">
                <span className="text-2xl font-bold text-[var(--cyan-600)]">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-[var(--neutral-900)]">Chat &amp; Learn</h3>
              <p className="text-[var(--neutral-600)] leading-relaxed">
                Ask questions, get hints, or request full explanations. Your personal tutor adapts to your learning style.
              </p>
              <div className="mt-6 pt-6 border-t border-[var(--neutral-100)]">
                <div className="flex items-center gap-2 text-sm text-[var(--neutral-500)]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  24/7 tutoring chat
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--transparent)] via-[var(--blue-50-30)] to-[var(--transparent)]" />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center mb-24">
            <div className="landing-reveal" ref={addRevealRef}>
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-[var(--neutral-900)]">
                Understands your <br />
                <span className="landing-text-gradient">handwritten math</span>
              </h2>
              <p className="text-[var(--neutral-600)] text-lg mb-8 leading-relaxed">
                Our AI recognizes handwritten equations, diagrams, and step-by-step work. It doesn&apos;t just see ink&mdash;it understands mathematical reasoning.
              </p>
              <ul className="space-y-4">
                {[
                  "Recognizes equations, fractions, and symbols",
                  "Follows your logic step by step",
                  "Catches sign errors and algebra slips",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-[var(--green-100)] flex items-center justify-center shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-[var(--green-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-[var(--neutral-700)]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative landing-reveal" ref={addRevealRef}>
              <div className="bg-card rounded-2xl p-8 border border-[var(--neutral-200)] shadow-xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 rounded-full bg-[var(--blue-100)] flex items-center justify-center">
                    <svg className="w-5 h-5 text-[var(--blue-600)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-[var(--neutral-900)]">Step 2 Analysis</div>
                    <div className="text-sm text-[var(--neutral-500)]">Algebra 2 &bull; Quadratic Equations</div>
                  </div>
                </div>
                <div className="space-y-3 font-mono text-sm">
                  <div className="p-3 rounded-lg bg-[var(--red-50)] border border-[var(--red-100)] text-[var(--red-700)]">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span className="font-semibold">Sign Error Detected</span>
                    </div>
                    <div className="text-[var(--red-600-70)] text-xs">When moving -6 to the right side, it should become +6, not -6.</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--blue-50)] border border-[var(--blue-100)] text-[var(--blue-700)]">
                    <div className="text-xs text-[var(--blue-600-70)]">Try: Add 6 to both sides first, then divide by 2.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: "M13 10V3L4 14h7v7l9-11h-7z", title: "Instant Feedback", desc: "Real-time analysis as you work. No waiting, no delays.", bgClass: "bg-[var(--blue-50)]", textClass: "text-[var(--blue-600)]" },
              { icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", title: "Algebra 1 to Calc 3", desc: "Comprehensive coverage from middle school to college math.", bgClass: "bg-[var(--indigo-50)]", textClass: "text-[var(--indigo-600)]" },
              { icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z", title: "Smart Tutor Chat", desc: "Ask questions naturally. Get hints, not just answers.", bgClass: "bg-[var(--cyan-50)]", textClass: "text-[var(--cyan-600)]" },
              { icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z", title: "Privacy First", desc: "Your work is private. No public sharing of your data.", bgClass: "bg-[var(--green-50)]", textClass: "text-[var(--green-600)]" },
            ].map((feature, i) => (
              <div key={i} className="landing-feature-card rounded-2xl p-6 landing-reveal" ref={addRevealRef}>
                <div className={`w-10 h-10 rounded-xl ${feature.bgClass} flex items-center justify-center mb-4 ${feature.textClass}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon} />
                  </svg>
                </div>
                <h3 className="font-semibold mb-2 text-[var(--neutral-900)]">{feature.title}</h3>
                <p className="text-sm text-[var(--neutral-600)]">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Target Audience */}
      <section className="py-32 relative bg-[var(--neutral-50-50)]">
        <div className="max-w-5xl mx-auto px-6 text-center landing-reveal" ref={addRevealRef}>
          <h2 className="text-3xl md:text-5xl font-bold mb-12 text-[var(--neutral-900)]">Who it&apos;s for</h2>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { label: "6th\u20138th Grade", borderClass: "border-[var(--blue-100)]", textClass: "text-[var(--blue-700)]" },
              { label: "High School Math", borderClass: "border-[var(--indigo-100)]", textClass: "text-[var(--indigo-600)]" },
              { label: "Intro College Math", borderClass: "border-[var(--cyan-100)]", textClass: "text-[var(--cyan-600)]" },
              { label: "Self-Study", borderClass: "border-[var(--green-100)]", textClass: "text-[var(--green-700)]" },
              { label: "Classroom Demos", borderClass: "border-[var(--amber-100)]", textClass: "text-[var(--amber-700)]" },
            ].map((item, i) => (
              <div key={i} className={`px-6 py-3 rounded-full bg-card border ${item.borderClass} ${item.textClass} font-medium shadow-sm`}>
                {item.label}
              </div>
            ))}
          </div>
          <p className="mt-8 text-[var(--neutral-500)]">Designed for students who want to understand the &ldquo;why&rdquo; behind every step.</p>
        </div>
      </section>

      {/* What It's Not */}
      <section id="about" className="py-32 relative">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-card rounded-3xl p-8 md:p-12 border border-[var(--neutral-200)] shadow-xl landing-reveal" ref={addRevealRef}>
            <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center text-[var(--neutral-900)]">What you should know</h2>
            <div className="space-y-6">
              {[
                {
                  title: "This is a practice tutor, not a grader",
                  desc: "Use it to learn, not to cheat. The goal is understanding, not just correct answers.",
                  bgColor: "bg-[var(--amber-50)]",
                  textColor: "text-[var(--amber-600)]",
                  borderColor: "border-[var(--amber-100)]",
                  icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
                },
                {
                  title: "Saves your work (if you want)",
                  desc: "History is optional. Guest sessions are temporary by default.",
                  bgColor: "bg-[var(--blue-50)]",
                  textColor: "text-[var(--blue-600)]",
                  borderColor: "border-[var(--blue-100)]",
                  icon: "M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2",
                },
                {
                  title: "AI can make mistakes",
                  desc: "Always double-check critical work. Think critically about every suggestion.",
                  bgColor: "bg-[var(--red-50)]",
                  textColor: "text-[var(--red-600)]",
                  borderColor: "border-[var(--red-100)]",
                  icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
                },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full ${item.bgColor} flex items-center justify-center shrink-0 ${item.textColor} ${item.borderColor} border`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 text-[var(--neutral-900)]">{item.title}</h3>
                    <p className="text-sm text-[var(--neutral-600)]">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative overflow-hidden bg-[var(--neutral-50)]">
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--blue-100-50)] to-[var(--transparent)]" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10 landing-reveal" ref={addRevealRef}>
          <h2 className="text-4xl md:text-6xl font-bold mb-6 text-[var(--neutral-900)]">Ready to start learning?</h2>
          <p className="text-xl text-[var(--neutral-600)] mb-12">No sign-up required to try. Jump in and solve your first problem in seconds.</p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/app" className="landing-btn-primary px-8 py-4 rounded-full font-medium text-lg">
              Try without signing in
            </Link>
            <Link href="/auth" className="landing-btn-secondary px-8 py-4 rounded-full font-medium text-lg">
              Sign in with Google
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--neutral-200)] py-12 bg-card">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-[var(--blue-600)] to-[var(--indigo-600)] flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">&sum;</span>
              </div>
              <span className="font-semibold text-[var(--neutral-900)]">Digital Math Teacher</span>
            </div>

            <div className="flex gap-8 text-sm text-[var(--neutral-500)]">
              <Link href="/about" className="hover:text-[var(--neutral-900)] transition-colors">About / Help</Link>
              <Link href="/privacy" className="hover:text-[var(--neutral-900)] transition-colors">Privacy</Link>
              <Link href="/contact" className="hover:text-[var(--neutral-900)] transition-colors">Contact</Link>
            </div>

            <div className="text-sm text-[var(--neutral-400)]">
              &copy; 2026 Digital Math Teacher
            </div>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
}
