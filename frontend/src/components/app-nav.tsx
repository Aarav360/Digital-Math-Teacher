"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useCallback } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import { Home, Library, Settings, History, HelpCircle } from "lucide-react";

const navItems = [
  { href: "/app", label: "Home", icon: Home },
  { href: "/problems", label: "Problems", icon: Library },
  { href: "/history", label: "History", icon: History },
  { href: "/about", label: "Help", icon: HelpCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

const EASE = "power3.out";

export function AppNav() {
  const pathname = usePathname();
  const circleRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const tlRefs = useRef<(gsap.core.Timeline | null)[]>([]);
  const activeTweenRefs = useRef<(gsap.core.Tween | null)[]>([]);
  const pillRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const activeIndex = navItems.findIndex(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  const layout = useCallback(() => {
    circleRefs.current.forEach((circle, i) => {
      if (!circle) return;
      const pill = pillRefs.current[i];
      if (!pill) return;

      const rect = pill.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      // Calculate circle radius so it covers the entire pill when scaled
      const R = (w * w / 4 + h * h) / (2 * h);
      const D = Math.ceil(2 * R) + 2;
      const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - w * w / 4))) + 1;
      const originY = D - delta;

      circle.style.width = `${D}px`;
      circle.style.height = `${D}px`;
      circle.style.bottom = `-${delta}px`;

      gsap.set(circle, {
        xPercent: -50,
        scale: 0,
        transformOrigin: `50% ${originY}px`,
      });

      const label = pill.querySelector<HTMLSpanElement>(".nav-pill-label");
      const hoverLabel = pill.querySelector<HTMLSpanElement>(".nav-pill-label-hover");

      if (label) gsap.set(label, { y: 0 });
      if (hoverLabel) gsap.set(hoverLabel, { y: h + 12, opacity: 0 });

      // Kill old timeline and build fresh
      tlRefs.current[i]?.kill();
      const tl = gsap.timeline({ paused: true });

      tl.to(circle, {
        scale: 1.2,
        xPercent: -50,
        duration: 2,
        ease: EASE,
        overwrite: "auto",
      }, 0);

      if (label) {
        tl.to(label, {
          y: -(h + 8),
          duration: 2,
          ease: EASE,
          overwrite: "auto",
        }, 0);
      }

      if (hoverLabel) {
        gsap.set(hoverLabel, { y: Math.ceil(h + 100), opacity: 0 });
        tl.to(hoverLabel, {
          y: 0,
          opacity: 1,
          duration: 2,
          ease: EASE,
          overwrite: "auto",
        }, 0);
      }

      tlRefs.current[i] = tl;
    });
  }, []);

  useEffect(() => {
    // Small delay so DOM has rendered and dimensions are correct
    const raf = requestAnimationFrame(() => layout());

    const onResize = () => layout();
    window.addEventListener("resize", onResize);

    if (document.fonts?.ready) {
      document.fonts.ready.then(layout).catch(() => {});
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      tlRefs.current.forEach((tl) => tl?.kill());
      activeTweenRefs.current.forEach((tw) => tw?.kill());
    };
  }, [layout]);

  const handleEnter = (i: number) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(tl.duration(), {
      duration: 0.3,
      ease: EASE,
      overwrite: "auto",
    });
  };

  const handleLeave = (i: number) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(0, {
      duration: 0.2,
      ease: EASE,
      overwrite: "auto",
    });
  };

  return (
    <header className="h-14 border-b border-border bg-white/80 backdrop-blur-xl flex items-center px-6 shrink-0 z-50">
      {/* Logo - untouched */}
      <Link href="/app" className="flex items-center gap-2 mr-8">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-white font-bold text-sm">M</span>
        </div>
        <span className="font-semibold text-foreground text-sm">MathTeacher</span>
      </Link>

      {/* Nav items with GSAP pill animation: left group, spacer, right group (Help, Settings) */}
      <nav className="flex items-center gap-1 flex-1 min-w-0">
        {navItems.slice(0, 3).map((item, i) => {
          const isActive = activeIndex === i;
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={(el) => { pillRefs.current[i] = el; }}
              onMouseEnter={() => handleEnter(i)}
              onMouseLeave={() => handleLeave(i)}
              className={cn(
                "nav-pill",
                isActive && "nav-pill-active"
              )}
            >
              <span
                ref={(el) => { circleRefs.current[i] = el; }}
                className="nav-pill-circle"
                aria-hidden="true"
              />
              <item.icon className="nav-pill-icon" />
              <span className="nav-pill-label-stack">
                <span className="nav-pill-label">{item.label}</span>
                <span className="nav-pill-label-hover" aria-hidden="true">
                  {item.label}
                </span>
              </span>
            </Link>
          );
        })}
        <div className="flex-1 min-w-4" aria-hidden="true" />
        {navItems.slice(3, 5).map((item, i) => {
          const idx = i + 3;
          const isActive = activeIndex === idx;
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={(el) => { pillRefs.current[idx] = el; }}
              onMouseEnter={() => handleEnter(idx)}
              onMouseLeave={() => handleLeave(idx)}
              className={cn(
                "nav-pill",
                isActive && "nav-pill-active"
              )}
            >
              <span
                ref={(el) => { circleRefs.current[idx] = el; }}
                className="nav-pill-circle"
                aria-hidden="true"
              />
              <item.icon className="nav-pill-icon" />
              <span className="nav-pill-label-stack">
                <span className="nav-pill-label">{item.label}</span>
                <span className="nav-pill-label-hover" aria-hidden="true">
                  {item.label}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
