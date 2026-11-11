"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { ArrowRight, CaretDown } from "@phosphor-icons/react";
import { PROGRAMMES, programmeHref } from "./programme-data";
import { ASSESSMENT_URL, Wordmark } from "./ui";
import LoginSheet, { openLogin } from "./LoginSheet";
import s from "./Nav.module.css";

// "#" links scroll to a homepage section; "/" links are pages of their own
const LINKS = [
  { href: "/programmes", label: "Programmes" },
  { href: "#how", label: "How it works" },
  { href: "#measures", label: "What we measure" },
  { href: "/doctors", label: "Doctors" },
  { href: "#pricing", label: "Pricing" },
];
const hrefOf = (h: string, base: string) => (h.startsWith("#") ? base + h : h);

/** `home`: on the landing page links scroll to sections; elsewhere they go back to them. */
export default function Nav({ home = true }: { home?: boolean }) {
  const base = home ? "" : "/";
  const path = usePathname() ?? "";
  // the free tools, guides and editorial pages all sit under the one "Free tools" link
  const onTools = ["/tools", "/guides", "/editorial-standards"].some((p) => path.startsWith(p));
  // the page link this page belongs to, if any: /programmes/pcos sits under Programmes
  const onPage = LINKS.find((l) => l.href.startsWith("/") && path.startsWith(l.href))?.href ?? null;
  const [prog, setProg] = useState(false);
  const progRef = useRef<HTMLDivElement>(null);
  const progBtn = useRef<HTMLButtonElement>(null);
  const closeT = useRef<number>(0);
  const [open, setOpen] = useState(false);
  const [dock, setDock] = useState(false);
  // phones: the nav pill slides away while you read down the page and returns on any scroll up,
  // so the page is not framed between two fixed bars
  const [tuck, setTuck] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(max-width: 1023px)");
    let last = scrollY;
    let raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = scrollY;
        const d = y - last;
        if (!mq.matches || y < innerHeight * 0.6) {
          setTuck(false);
          last = y;
        } else if (Math.abs(d) > 10) {
          setTuck(d > 0);
          last = y;
        }
      });
    };
    addEventListener("scroll", on, { passive: true });
    return () => {
      removeEventListener("scroll", on);
      cancelAnimationFrame(raf);
    };
  }, []);
  const [current, setCurrent] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLElement>(null);
  const lampRef = useRef<HTMLSpanElement>(null);

  // Desktop: one soft plate slides to whichever link is hovered, and
  // rests on the section being read.
  const moveLamp = (a: HTMLElement | null) => {
    const lamp = lampRef.current;
    if (!lamp) return;
    if (!a) {
      lamp.style.opacity = "0";
      return;
    }
    const first = lamp.style.opacity !== "1";
    lamp.style.transition = first ? "none" : "";
    lamp.style.transform = `translateX(${a.offsetLeft}px)`;
    lamp.style.width = `${a.offsetWidth}px`;
    if (first) void lamp.offsetWidth;
    lamp.style.transition = "";
    lamp.style.opacity = "1";
  };
  const restLamp = () =>
    moveLamp(
      onTools
        ? (linksRef.current?.querySelector<HTMLElement>('a[href="/tools"]') ?? null)
        : onPage
          ? (linksRef.current?.querySelector<HTMLElement>(`[data-href="${onPage}"]`) ?? null)
          : current
          ? (linksRef.current?.querySelector<HTMLElement>(`[data-href="${current}"]`) ?? null)
          : null,
    );

  useEffect(() => {
    const ids = LINKS.filter((l) => l.href.startsWith("#")).map((l) => l.href.slice(1));
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) seen.set(e.target.id, e.isIntersecting);
        const on = ids.filter((id) => seen.get(id));
        setCurrent(on.length ? `#${on[on.length - 1]}` : null);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    restLamp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Mobile action bar: visible once the hero has scrolled away, hidden
  // while the check, pricing or the footer is on screen, where the
  // same action is already in view.
  useEffect(() => {
    // a page that cannot take a booking yet (a coming-soon programme) never shows the booking dock
    if (document.querySelector("[data-no-dock]")) return;
    // the homepage hero, or on inner pages the page's own head band
    const hero = document.getElementById("top") ?? document.querySelector("main > :first-child");
    const hides = document.querySelectorAll("#check, #pricing, #foot, [data-dock-hide]");
    const state = { past: false, hide: new Set<Element>() };
    const sync = () => setDock(state.past && state.hide.size === 0);
    const heroIo = new IntersectionObserver(([e]) => {
      state.past = !e.isIntersecting;
      sync();
    }, { rootMargin: "0px 0px -20% 0px" });
    // any pixel of these on screen hides the dock, so it never sits on top of them
    const hideIo = new IntersectionObserver((es) => {
      for (const e of es) {
        if (e.isIntersecting) state.hide.add(e.target);
        else state.hide.delete(e.target);
      }
      sync();
    });
    if (hero) heroIo.observe(hero);
    hides.forEach((el) => hideIo.observe(el));
    return () => {
      heroIo.disconnect();
      hideIo.disconnect();
    };
  }, []);

  // If the visible area ends above the layout viewport (iOS toolbars), lift the dock by the difference.
  const dockRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const fit = () => {
      const gap = Math.max(0, Math.round(document.documentElement.clientHeight - (vv.offsetTop + vv.height)));
      dockRef.current?.style.setProperty("--vv-gap", `${vv.scale > 1.01 ? 0 : gap}px`);
    };
    fit();
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    window.addEventListener("resize", fit);
    return () => {
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
      window.removeEventListener("resize", fit);
    };
  }, []);

  // the programmes panel: Escape or a click elsewhere closes it, and focus returns to its button
  useEffect(() => {
    if (!prog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setProg(false);
      progBtn.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!progRef.current?.contains(e.target as Node)) setProg(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [prog]);
  // a mouse opens it on hover, with a short grace period so a diagonal move to the panel never drops it
  const hoverOpen = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(closeT.current);
    setProg(true);
  };
  const hoverClose = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    closeT.current = window.setTimeout(() => setProg(false), 180);
  };

  const burgerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    const lenis = (window as unknown as { __lenis?: { stop(): void; start(): void } }).__lenis;
    const behind = [document.querySelector("main"), document.getElementById("foot")];
    document.documentElement.style.overflow = open ? "hidden" : "";
    behind.forEach((el) => el?.toggleAttribute("inert", open));
    if (open) {
      lenis?.stop();
      menuRef.current?.querySelector<HTMLElement>("a")?.focus();
    } else {
      lenis?.start();
      if (wasOpen.current) burgerRef.current?.focus();
    }
    wasOpen.current = open;

    // keep Tab inside the menu and the bar above it while open
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "Escape") return setOpen(false);
      if (e.key !== "Tab") return;
      const nodes = [burgerRef.current, ...Array.from(menuRef.current?.querySelectorAll<HTMLElement>("a") ?? [])].filter(
        Boolean,
      ) as HTMLElement[];
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className={s.bar} data-open={open} data-tuck={tuck && !open && !prog}>
        <div className={s.inner}>
          <a href={home ? "#top" : "/"} className={s.brand} aria-label="inrange home" onClick={() => setOpen(false)}>
            <Wordmark sting height={34} />
          </a>
          <nav ref={linksRef} className={s.links} aria-label="Primary" onPointerLeave={restLamp}>
            <span ref={lampRef} className={s.lamp} aria-hidden="true" />
            {LINKS.map((l) =>
              l.href === "/programmes" ? (
                <div
                  key={l.href}
                  ref={progRef}
                  className={s.prog}
                  data-href={l.href}
                  onPointerEnter={hoverOpen}
                  onPointerLeave={hoverClose}
                  onBlur={(e) => {
                    // keyboard focus leaving the menu closes it
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setProg(false);
                  }}
                >
                  <button
                    ref={progBtn}
                    type="button"
                    className={s.progBtn}
                    aria-expanded={prog}
                    aria-controls="programmes-menu"
                    aria-current={onPage === l.href ? "page" : undefined}
                    // a mouse has already opened it on hover, so its click keeps it open; touch and keys toggle
                    onClick={(e) => ((e.nativeEvent as PointerEvent).pointerType === "mouse" ? setProg(true) : setProg((v) => !v))}
                    onPointerEnter={(e) => moveLamp(e.currentTarget.parentElement)}
                    onFocus={(e) => moveLamp(e.currentTarget.parentElement)}
                    onBlur={restLamp}
                  >
                    {l.label}
                    <CaretDown size={12} weight="bold" aria-hidden="true" />
                  </button>
                  <div id="programmes-menu" className={s.panel} data-open={prog} inert={!prog}>
                    <ul className={s.panelList}>
                      {PROGRAMMES.map((p) => (
                        <li key={p.key}>
                          <a href={programmeHref(p)} className={s.panelItem} onClick={() => setProg(false)}>
                            <span className={s.panelPhoto}>
                              <Image src={p.img} alt="" fill sizes="132px" style={{ objectPosition: p.focus }} />
                            </span>
                            <span className={s.panelName}>{p.name}</span>
                            <span className={s.panelState} data-live={p.live || undefined}>
                              {p.live ? "Open now" : "Coming soon"}
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                    <div className={s.panelFoot}>
                      <a href="/programmes" onClick={() => setProg(false)}>
                        All programmes
                        <ArrowRight size={14} aria-hidden="true" />
                      </a>
                      <a href={hrefOf("#pricing", base)} onClick={() => setProg(false)}>
                        Pricing
                        <ArrowRight size={14} aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <a
                  key={l.href}
                  href={hrefOf(l.href, base)}
                  data-href={l.href}
                  aria-current={current === l.href ? "location" : onPage === l.href ? "page" : undefined}
                  onPointerEnter={(e) => moveLamp(e.currentTarget)}
                  onFocus={(e) => moveLamp(e.currentTarget)}
                  onBlur={restLamp}
                >
                  {l.label}
                </a>
              ),
            )}
            <a
              href="/tools"
              aria-current={onTools ? "page" : undefined}
              onPointerEnter={(e) => moveLamp(e.currentTarget)}
              onFocus={(e) => moveLamp(e.currentTarget)}
              onBlur={restLamp}
            >
              Free tools
            </a>
          </nav>
          {/* the team's sign-in sheet (LoginSheet): mobile number, then a code */}
          <button
            type="button"
            className={s.account}
            onClick={() => {
              setOpen(false);
              openLogin();
            }}
          >
            Sign in
          </button>
          <a href={ASSESSMENT_URL} className={s.cta}>
            Book consultation
          </a>
          <button
            ref={burgerRef}
            className={s.burger}
            aria-expanded={open}
            aria-controls="menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
          </button>
        </div>
      </header>

      <div
        id="menu"
        ref={menuRef}
        className={s.menu}
        data-open={open}
        aria-hidden={!open}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <nav className={s.menuLinks} aria-label="Menu">
          {LINKS.map((l, i) => (
            <Fragment key={l.href}>
              <a href={hrefOf(l.href, base)} style={{ "--i": i } as React.CSSProperties} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}>
                {l.label}
              </a>
              {/* the four programmes as small photo cards, straight under their heading (hidden on short screens) */}
              {l.href === "/programmes" && (
                <ul className={s.menuProgs} style={{ "--i": i } as React.CSSProperties}>
                  {PROGRAMMES.map((p) => (
                    <li key={p.key}>
                      <a href={programmeHref(p)} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}>
                        <span className={s.menuPhoto}>
                          <Image src={p.img} alt="" fill sizes="80px" style={{ objectPosition: p.focus }} />
                        </span>
                        <span className={s.menuProgName}>{p.short}</span>
                        <span className={s.panelState} data-live={p.live || undefined}>
                          {p.live ? "Open now" : "Coming soon"}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Fragment>
          ))}
          <a href="/tools" style={{ "--i": LINKS.length } as React.CSSProperties} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}>
            Free tools
          </a>
        </nav>
        <div className={s.menuFoot} style={{ "--i": LINKS.length + 1 } as React.CSSProperties}>
          <a href={ASSESSMENT_URL} className="btn btn--signal" onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}>
            <span>Book consultation</span>
            <span className="well" aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          </a>
          <button
            type="button"
            className={s.menuSignIn}
            onClick={() => {
              setOpen(false);
              openLogin();
            }}
            tabIndex={open ? 0 : -1}
          >
            Already with us? Sign in
          </button>
          <p>Doctor-led care for weight and blood sugar. Consultations by video, anywhere in India.</p>
        </div>
      </div>

      <div ref={dockRef} className={s.dock} data-show={dock && !open} aria-hidden={!dock}>
        <p>
          <strong>30 minutes, by video</strong> With a doctor
        </p>
        <a href={ASSESSMENT_URL} className="btn btn--signal" tabIndex={dock ? 0 : -1}>
          <span>Book consultation</span>
          <span className="well" aria-hidden="true">
            <ArrowRight size={18} />
          </span>
        </a>
      </div>
      <LoginSheet />
    </>
  );
}
