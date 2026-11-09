// "use client";

// import {
//   CSSProperties,
//   FormEvent,
//   useEffect,
//   useRef,
//   useState,
//   ChangeEvent,
// } from "react";
// import { useRouter } from "next/navigation";
// import { ArrowRight, X } from "@phosphor-icons/react";
// import { ASSESSMENT_URL, Wordmark } from "./ui";
// import s from "./Nav.module.css";

// /*
// |--------------------------------------------------------------------------
// | Navigation Links
// |--------------------------------------------------------------------------
// */

// const LINKS = [
//   { href: "#how", label: "How it works" },
//   { href: "#measures", label: "What we measure" },
//   { href: "#pricing", label: "Pricing" },
//   { href: "#questions", label: "Questions" },
// ];

// /*
// |--------------------------------------------------------------------------
// | API Configuration
// |--------------------------------------------------------------------------
// */

// const API_BASE_URL = "https://mediapi.unios.in";

// /*
// |--------------------------------------------------------------------------
// | Authentication API Endpoints
// |--------------------------------------------------------------------------
// */

// const AUTH_ENDPOINTS = {
//   SEND_OTP: `${API_BASE_URL}/api/auth/send-otp`,
//   VERIFY_OTP: `${API_BASE_URL}/api/auth/verify-otp`,
// };

// /*
// |--------------------------------------------------------------------------
// | Authentication Steps
// |--------------------------------------------------------------------------
// */

// type AuthStep = "mobile" | "otp";

// /*
// |--------------------------------------------------------------------------
// | Navigation Component
// |--------------------------------------------------------------------------
// */

// export default function Nav() {
//   const router = useRouter();

//   /*
//   |--------------------------------------------------------------------------
//   | Existing Navbar State
//   |--------------------------------------------------------------------------
//   */

//   const [open, setOpen] = useState(false);
//   const [dock, setDock] = useState(false);
//   const [current, setCurrent] = useState<string | null>(null);

//   /*
//   |--------------------------------------------------------------------------
//   | Login State
//   |--------------------------------------------------------------------------
//   */

//   const [loginOpen, setLoginOpen] = useState(false);
//   const [authStep, setAuthStep] =
//     useState<AuthStep>("mobile");

//   const [mobile, setMobile] = useState("");
//   const [otp, setOtp] = useState("");

//   const [authLoading, setAuthLoading] =
//     useState(false);

//   const [authError, setAuthError] =
//     useState("");

//   const [authMessage, setAuthMessage] =
//     useState("");

//   /*
//   |--------------------------------------------------------------------------
//   | Existing Navbar Refs
//   |--------------------------------------------------------------------------
//   */

//   const menuRef =
//     useRef<HTMLDivElement>(null);

//   const linksRef =
//     useRef<HTMLElement>(null);

//   const lampRef =
//     useRef<HTMLSpanElement>(null);

//   const dockRef =
//     useRef<HTMLDivElement>(null);

//   const burgerRef =
//     useRef<HTMLButtonElement>(null);

//   const wasOpen =
//     useRef(false);

//   /*
//   |--------------------------------------------------------------------------
//   | Login Modal Refs
//   |--------------------------------------------------------------------------
//   */

//   const loginMobileInputRef =
//     useRef<HTMLInputElement>(null);

//   const loginOtpInputRef =
//     useRef<HTMLInputElement>(null);

//   /*
//   |--------------------------------------------------------------------------
//   | Desktop Navigation Lamp
//   |--------------------------------------------------------------------------
//   */

//   const moveLamp = (
//     element: HTMLElement | null
//   ) => {
//     const lamp = lampRef.current;

//     if (!lamp) return;

//     if (!element) {
//       lamp.style.opacity = "0";
//       return;
//     }

//     const first =
//       lamp.style.opacity !== "1";

//     lamp.style.transition = first
//       ? "none"
//       : "";

//     lamp.style.transform =
//       `translateX(${element.offsetLeft}px)`;

//     lamp.style.width =
//       `${element.offsetWidth}px`;

//     if (first) {
//       void lamp.offsetWidth;
//     }

//     lamp.style.transition = "";
//     lamp.style.opacity = "1";
//   };

//   const restLamp = () =>
//     moveLamp(
//       current
//         ? linksRef.current?.querySelector<HTMLElement>(
//             `a[href="${current}"]`
//           ) ?? null
//         : null
//     );

//   /*
//   |--------------------------------------------------------------------------
//   | Active Section Detection
//   |--------------------------------------------------------------------------
//   */

//   useEffect(() => {
//     const ids = LINKS.map(
//       (link) => link.href.slice(1)
//     );

//     const seen =
//       new Map<string, boolean>();

//     const observer =
//       new IntersectionObserver(
//         (entries) => {
//           for (const entry of entries) {
//             seen.set(
//               entry.target.id,
//               entry.isIntersecting
//             );
//           }

//           const active = ids.filter(
//             (id) => seen.get(id)
//           );

//           setCurrent(
//             active.length
//               ? `#${active[active.length - 1]}`
//               : null
//           );
//         },
//         {
//           rootMargin:
//             "-40% 0px -55% 0px",
//         }
//       );

//     ids.forEach((id) => {
//       const element =
//         document.getElementById(id);

//       if (element) {
//         observer.observe(element);
//       }
//     });

//     return () => {
//       observer.disconnect();
//     };
//   }, []);

//   /*
//   |--------------------------------------------------------------------------
//   | Update Navigation Lamp
//   |--------------------------------------------------------------------------
//   */

//   useEffect(() => {
//     restLamp();

//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [current]);

//   /*
//   |--------------------------------------------------------------------------
//   | Mobile Action Dock
//   |--------------------------------------------------------------------------
//   */

//   useEffect(() => {
//     const hero =
//       document.getElementById("top");

//     const check =
//       document.getElementById("check");

//     const pricing =
//       document.getElementById("pricing");

//     const footer =
//       document.getElementById("foot");

//     const state = {
//       past: false,
//       hide: new Set<Element>(),
//     };

//     const sync = () => {
//       setDock(
//         state.past &&
//           state.hide.size === 0
//       );
//     };

//     const heroObserver =
//       new IntersectionObserver(
//         ([entry]) => {
//           state.past =
//             !entry.isIntersecting;

//           sync();
//         },
//         {
//           rootMargin:
//             "0px 0px -20% 0px",
//         }
//       );

//     const hideObserver =
//       new IntersectionObserver(
//         (entries) => {
//           for (const entry of entries) {
//             if (entry.isIntersecting) {
//               state.hide.add(
//                 entry.target
//               );
//             } else {
//               state.hide.delete(
//                 entry.target
//               );
//             }
//           }

//           sync();
//         }
//       );

//     if (hero) {
//       heroObserver.observe(hero);
//     }

//     [check, pricing, footer].forEach(
//       (element) => {
//         if (element) {
//           hideObserver.observe(element);
//         }
//       }
//     );

//     return () => {
//       heroObserver.disconnect();
//       hideObserver.disconnect();
//     };
//   }, []);

//   /*
//   |--------------------------------------------------------------------------
//   | Mobile Visual Viewport Handling
//   |--------------------------------------------------------------------------
//   */

//   useEffect(() => {
//     const visualViewport =
//       window.visualViewport;

//     if (!visualViewport) return;

//     const fit = () => {
//       const gap = Math.max(
//         0,
//         Math.round(
//           document.documentElement
//             .clientHeight -
//             (
//               visualViewport.offsetTop +
//               visualViewport.height
//             )
//         )
//       );

//       dockRef.current?.style.setProperty(
//         "--vv-gap",
//         `${
//           visualViewport.scale > 1.01
//             ? 0
//             : gap
//         }px`
//       );
//     };

//     fit();

//     visualViewport.addEventListener(
//       "resize",
//       fit
//     );

//     visualViewport.addEventListener(
//       "scroll",
//       fit
//     );

//     window.addEventListener(
//       "resize",
//       fit
//     );

//     return () => {
//       visualViewport.removeEventListener(
//         "resize",
//         fit
//       );

//       visualViewport.removeEventListener(
//         "scroll",
//         fit
//       );

//       window.removeEventListener(
//         "resize",
//         fit
//       );
//     };
//   }, []);

//   /*
//   |--------------------------------------------------------------------------
//   | Mobile Menu Accessibility
//   |--------------------------------------------------------------------------
//   */

//   useEffect(() => {
//     const lenis = (
//       window as unknown as {
//         __lenis?: {
//           stop(): void;
//           start(): void;
//         };
//       }
//     ).__lenis;

//     const behind = [
//       document.querySelector("main"),
//       document.getElementById("foot"),
//     ];

//     document.documentElement.style.overflow =
//       open ? "hidden" : "";

//     behind.forEach((element) => {
//       element?.toggleAttribute(
//         "inert",
//         open
//       );
//     });

//     if (open) {
//       lenis?.stop();

//       menuRef.current
//         ?.querySelector<HTMLElement>("a")
//         ?.focus();
//     } else {
//       lenis?.start();

//       if (wasOpen.current) {
//         burgerRef.current?.focus();
//       }
//     }

//     wasOpen.current = open;

//     const handleKeyDown = (
//       event: KeyboardEvent
//     ) => {
//       if (!open) return;

//       if (event.key === "Escape") {
//         setOpen(false);
//         return;
//       }

//       if (event.key !== "Tab") return;

//       const nodes = [
//         burgerRef.current,
//         ...Array.from(
//           menuRef.current?.querySelectorAll<HTMLElement>(
//             "a"
//           ) ?? []
//         ),
//       ].filter(
//         Boolean
//       ) as HTMLElement[];

//       const first = nodes[0];
//       const last =
//         nodes[nodes.length - 1];

//       if (
//         event.shiftKey &&
//         document.activeElement === first
//       ) {
//         event.preventDefault();
//         last?.focus();
//       } else if (
//         !event.shiftKey &&
//         document.activeElement === last
//       ) {
//         event.preventDefault();
//         first?.focus();
//       }
//     };

//     window.addEventListener(
//       "keydown",
//       handleKeyDown
//     );

//     return () => {
//       window.removeEventListener(
//         "keydown",
//         handleKeyDown
//       );
//     };
//   }, [open]);

//   /*
//   |--------------------------------------------------------------------------
//   | Login Modal Scroll Lock
//   |--------------------------------------------------------------------------
//   */

//   useEffect(() => {
//     if (!loginOpen) return;

//     const previousOverflow =
//       document.documentElement.style
//         .overflow;

//     document.documentElement.style.overflow =
//       "hidden";

//     return () => {
//       document.documentElement.style.overflow =
//         previousOverflow;
//     };
//   }, [loginOpen]);

//   /*
//   |--------------------------------------------------------------------------
//   | Login Modal Auto Focus
//   |--------------------------------------------------------------------------
//   */

//   useEffect(() => {
//     if (!loginOpen) return;

//     const timer = window.setTimeout(
//       () => {
//         if (authStep === "mobile") {
//           loginMobileInputRef.current?.focus();
//         }

//         if (authStep === "otp") {
//           loginOtpInputRef.current?.focus();
//         }
//       },
//       100
//     );

//     return () => {
//       window.clearTimeout(timer);
//     };
//   }, [loginOpen, authStep]);

//   /*
//   |--------------------------------------------------------------------------
//   | Open Login
//   |--------------------------------------------------------------------------
//   */

//   const openLogin = () => {
//     setOpen(false);

//     setAuthStep("mobile");
//     setMobile("");
//     setOtp("");

//     setAuthError("");
//     setAuthMessage("");

//     setLoginOpen(true);
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Close Login
//   |--------------------------------------------------------------------------
//   */

//   const closeLogin = () => {
//     if (authLoading) return;

//     setLoginOpen(false);

//     setAuthStep("mobile");
//     setMobile("");
//     setOtp("");

//     setAuthError("");
//     setAuthMessage("");
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Mobile Number Input
//   |--------------------------------------------------------------------------
//   */

//   const handleMobileChange = (
//     event: ChangeEvent<HTMLInputElement>
//   ) => {
//     const value =
//       event.target.value
//         .replace(/\D/g, "")
//         .slice(0, 10);

//     setMobile(value);

//     if (authError) {
//       setAuthError("");
//     }
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | OTP Input
//   |--------------------------------------------------------------------------
//   */

//   const handleOtpChange = (
//     event: ChangeEvent<HTMLInputElement>
//   ) => {
//     const value =
//       event.target.value
//         .replace(/\D/g, "")
//         .slice(0, 4);

//     setOtp(value);

//     if (authError) {
//       setAuthError("");
//     }
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Safely Parse API Response
//   |--------------------------------------------------------------------------
//   |
//   | This prevents:
//   | Unexpected token '<', "<!DOCTYPE..."
//   |
//   | when backend/proxy returns HTML instead of JSON.
//   |
//   */

//   const parseApiResponse = async (
//     response: Response
//   ) => {
//     const raw =
//       await response.text();

//     if (!raw) {
//       return {};
//     }

//     try {
//       return JSON.parse(raw);
//     } catch {
//       console.error(
//         "API returned non-JSON response:",
//         raw
//       );

//       throw new Error(
//         `Backend returned an invalid response. Status: ${response.status}`
//       );
//     }
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Send OTP
//   |--------------------------------------------------------------------------
//   */

//   const handleSendOtp = async (
//     event?: FormEvent<HTMLFormElement>
//   ) => {
//     event?.preventDefault();

//     setAuthError("");
//     setAuthMessage("");

//     /*
//     | Validate mobile number
//     */

//     if (mobile.length !== 10) {
//       setAuthError(
//         "Please enter a valid 10-digit mobile number."
//       );

//       return;
//     }

//     try {
//       setAuthLoading(true);

//       /*
//       | Call backend Send OTP API
//       */

//       const response =
//         await fetch(
//           AUTH_ENDPOINTS.SEND_OTP,
//           {
//             method: "POST",

//             headers: {
//               "Content-Type":
//                 "application/json",
//             },

//             body: JSON.stringify({
//               mobile,
//             }),
//           }
//         );

//       const data =
//         await parseApiResponse(
//           response
//         );

//       console.log(
//         "SEND OTP RESPONSE:",
//         data
//       );

//       if (!response.ok) {
//         throw new Error(
//           data?.message ||
//             data?.error ||
//             "Unable to send OTP. Please try again."
//         );
//       }

//       /*
//       | Move to OTP screen
//       */

//       setAuthStep("otp");

//       setAuthMessage(
//         data?.message ||
//           `OTP has been sent to +91 ${mobile}`
//       );
//     } catch (error) {
//       console.error(
//         "Send OTP error:",
//         error
//       );

//       setAuthError(
//         error instanceof Error
//           ? error.message
//           : "Unable to send OTP. Please try again."
//       );
//     } finally {
//       setAuthLoading(false);
//     }
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Verify OTP
//   |--------------------------------------------------------------------------
//   |
//   | Backend response structure:
//   |
//   | {
//   |   success: true,
//   |   data: {
//   |     accessToken: "...",
//   |     refreshToken: "...",
//   |     nextScreen: "ONBOARDING"
//   |   },
//   |   message: "Login successful",
//   |   error: null
//   | }
//   |
//   */

//   const handleVerifyOtp = async (
//     event?: FormEvent<HTMLFormElement>
//   ) => {
//     event?.preventDefault();

//     setAuthError("");
//     setAuthMessage("");

//     /*
//     | Validate OTP
//     */

//     if (otp.length !== 4) {
//       setAuthError(
//         "Please enter the 4-digit OTP."
//       );

//       return;
//     }

//     try {
//       setAuthLoading(true);

//       /*
//       | Call backend Verify OTP API
//       */

//       const response =
//         await fetch(
//           AUTH_ENDPOINTS.VERIFY_OTP,
//           {
//             method: "POST",

//             headers: {
//               "Content-Type":
//                 "application/json",
//             },

//             body: JSON.stringify({
//               mobile,
//               otp,
//             }),
//           }
//         );

//       /*
//       | Safely parse backend response
//       */

//       const data =
//         await parseApiResponse(
//           response
//         );

//       console.log(
//         "OTP VERIFY RESPONSE:",
//         data
//       );

//       /*
//       | Check API status
//       */

//       if (!response.ok) {
//         throw new Error(
//           data?.message ||
//             data?.error ||
//             data?.data?.message ||
//             "Invalid OTP. Please try again."
//         );
//       }

//       /*
//       |--------------------------------------------------------------------------
//       | Get Authentication Data
//       |--------------------------------------------------------------------------
//       |
//       | IMPORTANT:
//       | Backend returns token inside:
//       |
//       | data.data.accessToken
//       |
//       */

//       const accessToken =
//         data?.data?.accessToken ||
//         data?.data?.access_token ||
//         data?.accessToken ||
//         data?.access_token ||
//         data?.token ||
//         data?.authToken;

//       const refreshToken =
//         data?.data?.refreshToken ||
//         data?.data?.refresh_token ||
//         data?.refreshToken ||
//         data?.refresh_token;

//       /*
//       |--------------------------------------------------------------------------
//       | Verify Access Token
//       |--------------------------------------------------------------------------
//       */

//       if (!accessToken) {
//         console.error(
//           "OTP verification succeeded but no access token was found:",
//           data
//         );

//         throw new Error(
//           "Login succeeded, but the authentication token was not returned by the backend."
//         );
//       }

//       /*
//       |--------------------------------------------------------------------------
//       | Save Access Token
//       |--------------------------------------------------------------------------
//       */

//       localStorage.setItem(
//         "inrange_auth_token",
//         accessToken
//       );

//       /*
//       |--------------------------------------------------------------------------
//       | Save Refresh Token
//       |--------------------------------------------------------------------------
//       */

//       if (refreshToken) {
//         localStorage.setItem(
//           "inrange_refresh_token",
//           refreshToken
//         );
//       }

//       /*
//       |--------------------------------------------------------------------------
//       | Save Mobile Number
//       |--------------------------------------------------------------------------
//       */

//       localStorage.setItem(
//         "inrange_onboarding_mobile",
//         mobile
//       );

//       /*
//       |--------------------------------------------------------------------------
//       | Save Complete Authentication Response
//       |--------------------------------------------------------------------------
//       |
//       | This can be useful on dashboard/onboarding later.
//       |
//       */

//       localStorage.setItem(
//         "inrange_auth_response",
//         JSON.stringify(data)
//       );

//       /*
//       |--------------------------------------------------------------------------
//       | Save User Information
//       |--------------------------------------------------------------------------
//       */

//       if (data?.user) {
//         localStorage.setItem(
//           "inrange_user",
//           JSON.stringify(data.user)
//         );
//       }

//       if (data?.data?.user) {
//         localStorage.setItem(
//           "inrange_user",
//           JSON.stringify(data.data.user)
//         );
//       }

//       /*
//       |--------------------------------------------------------------------------
//       | Save Customer Information
//       |--------------------------------------------------------------------------
//       */

//       if (data?.customer) {
//         localStorage.setItem(
//           "inrange_customer",
//           JSON.stringify(
//             data.customer
//           )
//         );
//       }

//       if (data?.data?.customer) {
//         localStorage.setItem(
//           "inrange_customer",
//           JSON.stringify(
//             data.data.customer
//           )
//         );
//       }

//       /*
//       |--------------------------------------------------------------------------
//       | Save Next Screen
//       |--------------------------------------------------------------------------
//       */

//       const nextScreen =
//         data?.data?.nextScreen ||
//         data?.nextScreen ||
//         "";

//       localStorage.setItem(
//         "inrange_next_screen",
//         nextScreen
//       );

//       /*
//       |--------------------------------------------------------------------------
//       | Debug Confirmation
//       |--------------------------------------------------------------------------
//       */

//       console.log(
//         "Access token saved successfully."
//       );

//       console.log(
//         "Next screen:",
//         nextScreen
//       );

//       /*
//       |--------------------------------------------------------------------------
//       | Close Login Modal
//       |--------------------------------------------------------------------------
//       */

//       setLoginOpen(false);
//       setAuthStep("mobile");
//       setOtp("");
//       setAuthError("");
//       setAuthMessage("");

//       /*
//       |--------------------------------------------------------------------------
//       | Redirect To Onboarding
//       |--------------------------------------------------------------------------
//       |
//       | Backend is returning:
//       |
//       | nextScreen: "ONBOARDING"
//       |
//       | We intentionally redirect to /onboarding.
//       |
//       */

//       // router.replace("/onboarding");

//       const normalizedNextScreen = String(nextScreen)
//   .trim()
//   .toUpperCase();

// if (normalizedNextScreen === "ONBOARDING") {
//   router.replace("/onboarding");
// } else {
//   router.replace("/dashboard");
// }

//       /*
//       | Clear local mobile state after navigation starts.
//       */

//       setMobile("");
//     } catch (error) {
//       console.error(
//         "OTP verification error:",
//         error
//       );

//       setAuthError(
//         error instanceof Error
//           ? error.message
//           : "OTP verification failed. Please try again."
//       );
//     } finally {
//       setAuthLoading(false);
//     }
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Resend OTP
//   |--------------------------------------------------------------------------
//   */

//   const handleResendOtp = async () => {
//     setOtp("");
//     setAuthError("");
//     setAuthMessage("");

//     await handleSendOtp();
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Back To Mobile
//   |--------------------------------------------------------------------------
//   */

//   const handleBackToMobile = () => {
//     if (authLoading) return;

//     setAuthStep("mobile");
//     setOtp("");

//     setAuthError("");
//     setAuthMessage("");
//   };

//   /*
//   |--------------------------------------------------------------------------
//   | Render
//   |--------------------------------------------------------------------------
//   */

//   return (
//     <>
//       {/* =========================================================
//           MAIN NAVBAR
//           ========================================================= */}

//       <header
//         className={s.bar}
//         data-open={open}
//       >
//         <div className={s.inner}>

//           {/* =====================================================
//               BRAND
//               ===================================================== */}

//           <a
//             href="#top"
//             className={s.brand}
//             aria-label="InRange home"
//             onClick={() =>
//               setOpen(false)
//             }
//           >
//             <Wordmark
//               sting
//               height={34}
//             />
//           </a>

//           {/* =====================================================
//               DESKTOP NAVIGATION
//               ===================================================== */}

//           <nav
//             ref={linksRef}
//             className={s.links}
//             aria-label="Primary"
//             onPointerLeave={restLamp}
//           >
//             <span
//               ref={lampRef}
//               className={s.lamp}
//               aria-hidden="true"
//             />

//             {LINKS.map((link) => (
//               <a
//                 key={link.href}
//                 href={link.href}
//                 aria-current={
//                   current === link.href
//                     ? "location"
//                     : undefined
//                 }
//                 onPointerEnter={(event) =>
//                   moveLamp(
//                     event.currentTarget
//                   )
//                 }
//                 onFocus={(event) =>
//                   moveLamp(
//                     event.currentTarget
//                   )
//                 }
//                 onBlur={restLamp}
//               >
//                 {link.label}
//               </a>
//             ))}
//           </nav>

//           {/* =====================================================
//               DESKTOP ACTIONS
//               ===================================================== */}

//           <div
//             className={s.desktopActions}
//           >
//             <button
//               type="button"
//               className={s.loginButton}
//               onClick={openLogin}
//             >
//               Login
//             </button>

//             <a
//               href={ASSESSMENT_URL}
//               className={s.cta}
//             >
//               Start free check
//             </a>
//           </div>

//           {/* =====================================================
//               MOBILE MENU BUTTON
//               ===================================================== */}

//           <button
//             ref={burgerRef}
//             className={s.burger}
//             aria-expanded={open}
//             aria-controls="menu"
//             aria-label={
//               open
//                 ? "Close menu"
//                 : "Open menu"
//             }
//             onClick={() =>
//               setOpen((value) => !value)
//             }
//           >
//             <span />
//             <span />
//           </button>
//         </div>
//       </header>

//       {/* =========================================================
//           MOBILE MENU
//           ========================================================= */}

//       <div
//         id="menu"
//         ref={menuRef}
//         className={s.menu}
//         data-open={open}
//         aria-hidden={!open}
//         role="dialog"
//         aria-modal="true"
//         aria-label="Menu"
//       >
//         <nav
//           className={s.menuLinks}
//           aria-label="Menu"
//         >
//           {LINKS.map((link, index) => (
//             <a
//               key={link.href}
//               href={link.href}
//               style={
//                 {
//                   "--i": index,
//                 } as CSSProperties
//               }
//               onClick={() =>
//                 setOpen(false)
//               }
//               tabIndex={open ? 0 : -1}
//             >
//               {link.label}
//             </a>
//           ))}
//         </nav>

//         <div
//           className={s.menuFoot}
//           style={
//             {
//               "--i": LINKS.length,
//             } as CSSProperties
//           }
//         >
//           {/* =====================================================
//               MOBILE LOGIN
//               ===================================================== */}

//           <button
//             type="button"
//             className={s.mobileLoginButton}
//             onClick={openLogin}
//             tabIndex={open ? 0 : -1}
//           >
//             Login
//           </button>

//           {/* =====================================================
//               START FREE CHECK
//               ===================================================== */}

//           <a
//             href={ASSESSMENT_URL}
//             className="btn btn--mint"
//             onClick={() =>
//               setOpen(false)
//             }
//             tabIndex={open ? 0 : -1}
//           >
//             <span>
//               Start free check
//             </span>

//             <span
//               className="well"
//               aria-hidden="true"
//             >
//               <ArrowRight size={18} />
//             </span>
//           </a>

//           <p>
//             Doctor-led care for weight and
//             blood sugar. Consultations by
//             video, anywhere in India.
//           </p>
//         </div>
//       </div>

//       {/* =========================================================
//           MOBILE ACTION DOCK
//           ========================================================= */}

//       <div
//         ref={dockRef}
//         className={s.dock}
//         data-show={
//           dock && !open
//         }
//         aria-hidden={!dock}
//       >
//         <p>
//           <strong>
//             Two minutes, free
//           </strong>{" "}
//           Reviewed by a doctor
//         </p>

//         <a
//           href={ASSESSMENT_URL}
//           className="btn btn--mint"
//           tabIndex={
//             dock ? 0 : -1
//           }
//         >
//           <span>
//             Start free check
//           </span>

//           <span
//             className="well"
//             aria-hidden="true"
//           >
//             <ArrowRight size={18} />
//           </span>
//         </a>
//       </div>

//       {/* =========================================================
//           LOGIN / OTP MODAL
//           ========================================================= */}

//       {loginOpen && (
//         <div
//           className={s.authOverlay}
//           role="presentation"
//           onMouseDown={(event) => {
//             if (
//               event.target ===
//               event.currentTarget
//             ) {
//               closeLogin();
//             }
//           }}
//         >
//           <div
//             className={s.authModal}
//             role="dialog"
//             aria-modal="true"
//             aria-labelledby="auth-title"
//           >
//             {/* ===================================================
//                 CLOSE BUTTON
//                 =================================================== */}

//             <button
//               type="button"
//               className={s.authClose}
//               aria-label="Close login"
//               onClick={closeLogin}
//               disabled={authLoading}
//             >
//               <X size={22} />
//             </button>

//             {/* ===================================================
//                 HEADER
//                 =================================================== */}

//             <div
//               className={s.authHeader}
//             >
//               <h2 id="auth-title">
//                 {authStep === "mobile"
//                   ? "Login or sign up"
//                   : "Enter your OTP"}
//               </h2>

//               <p>
//                 {authStep === "mobile"
//                   ? "Enter your mobile number to continue."
//                   : `We sent a 4-digit OTP to +91 ${mobile}`}
//               </p>
//             </div>

//             {/* ===================================================
//                 MOBILE NUMBER STEP
//                 =================================================== */}

//             {authStep === "mobile" && (
//               <form
//                 className={s.authForm}
//                 onSubmit={handleSendOtp}
//               >
//                 <label
//                   htmlFor="login-mobile"
//                   className={s.authLabel}
//                 >
//                   Mobile number
//                 </label>

//                 <div
//                   className={
//                     s.mobileInputWrapper
//                   }
//                 >
//                   <span>
//                     +91
//                   </span>

//                   <input
//                     ref={
//                       loginMobileInputRef
//                     }
//                     id="login-mobile"
//                     type="tel"
//                     inputMode="numeric"
//                     autoComplete="tel"
//                     placeholder="9876543210"
//                     value={mobile}
//                     onChange={
//                       handleMobileChange
//                     }
//                     maxLength={10}
//                     disabled={authLoading}
//                     className={
//                       s.authInput
//                     }
//                   />
//                 </div>

//                 {/* Error */}

//                 {authError && (
//                   <p
//                     className={
//                       s.authError
//                     }
//                   >
//                     {authError}
//                   </p>
//                 )}

//                 {/* Send OTP */}

//                 <button
//                   type="submit"
//                   className={
//                     s.authPrimaryButton
//                   }
//                   disabled={
//                     authLoading ||
//                     mobile.length !== 10
//                   }
//                 >
//                   {authLoading
//                     ? "Sending OTP..."
//                     : "Send OTP"}
//                 </button>

//                 <p
//                   className={
//                     s.authTerms
//                   }
//                 >
//                   By continuing, you agree to
//                   our terms and privacy policy.
//                 </p>
//               </form>
//             )}

//             {/* ===================================================
//                 OTP STEP
//                 =================================================== */}

//             {authStep === "otp" && (
//               <form
//                 className={s.authForm}
//                 onSubmit={
//                   handleVerifyOtp
//                 }
//               >
//                 <label
//                   htmlFor="login-otp"
//                   className={s.authLabel}
//                 >
//                   Enter OTP
//                 </label>

//                 <input
//                   ref={
//                     loginOtpInputRef
//                   }
//                   id="login-otp"
//                   type="text"
//                   inputMode="numeric"
//                   autoComplete="one-time-code"
//                   placeholder="0000"
//                   value={otp}
//                   onChange={
//                     handleOtpChange
//                   }
//                   maxLength={4}
//                   disabled={authLoading}
//                   className={`${s.authInput} ${s.otpInput}`}
//                 />

//                 {/* Success Message */}

//                 {authMessage && (
//                   <p
//                     className={
//                       s.authSuccess
//                     }
//                   >
//                     {authMessage}
//                   </p>
//                 )}

//                 {/* Error Message */}

//                 {authError && (
//                   <p
//                     className={
//                       s.authError
//                     }
//                   >
//                     {authError}
//                   </p>
//                 )}

//                 {/* Verify OTP */}

//                 <button
//                   type="submit"
//                   className={
//                     s.authPrimaryButton
//                   }
//                   disabled={
//                     authLoading ||
//                     otp.length !== 4
//                   }
//                 >
//                   {authLoading
//                     ? "Verifying..."
//                     : "Verify & Continue"}
//                 </button>

//                 {/* OTP Actions */}

//                 <div
//                   className={
//                     s.otpActions
//                   }
//                 >
//                   <button
//                     type="button"
//                     onClick={
//                       handleBackToMobile
//                     }
//                     disabled={
//                       authLoading
//                     }
//                   >
//                     Change number
//                   </button>

//                   <button
//                     type="button"
//                     onClick={
//                       handleResendOtp
//                     }
//                     disabled={
//                       authLoading
//                     }
//                   >
//                     Resend OTP
//                   </button>
//                 </div>
//               </form>
//             )}
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

//======>

"use client";

import {
  CSSProperties,
  FormEvent,
  useEffect,
  useRef,
  useState,
  ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, X } from "@phosphor-icons/react";
import { ASSESSMENT_URL, Wordmark } from "./ui";
import s from "./Nav.module.css";
import { AUTH_ENDPOINTS } from "@/config/env";
import { homePathFor, saveSession } from "@/lib/session/authSession";
import App from "next/app";
import Pricing from "./Pricing";


/** Opens the sign-in modal from anywhere on the landing page (Hero and Footer buttons). */
const OPEN_LOGIN_EVENT = "inrange:open-login";
export function openLogin() {
  window.dispatchEvent(new Event(OPEN_LOGIN_EVENT));
}

/*
|--------------------------------------------------------------------------
| Navigation Links
|--------------------------------------------------------------------------
*/

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#measures", label: "What we measure" },
  { href: "#pricing", label: "Pricing" },
  { href: "#questions", label: "Questions" },
];

/*
|--------------------------------------------------------------------------
| Authentication Steps
|--------------------------------------------------------------------------
*/

type AuthStep = "mobile" | "otp";

/*
|--------------------------------------------------------------------------
| Navigation Component
|--------------------------------------------------------------------------
*/

export default function Nav() {
  const router = useRouter();

  /*
  |--------------------------------------------------------------------------
  | Existing Navbar State
  |--------------------------------------------------------------------------
  */

  const [open, setOpen] = useState(false);
  const [dock, setDock] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);

  /*
  |--------------------------------------------------------------------------
  | Login State
  |--------------------------------------------------------------------------
  */

  const [loginOpen, setLoginOpen] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>("mobile");

  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  /*
  |--------------------------------------------------------------------------
  | Existing Navbar Refs
  |--------------------------------------------------------------------------
  */

  const menuRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLElement>(null);
  const lampRef = useRef<HTMLSpanElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  /*
  |--------------------------------------------------------------------------
  | Login Modal Refs
  |--------------------------------------------------------------------------
  */

  const loginMobileInputRef = useRef<HTMLInputElement>(null);
  const loginOtpInputRef = useRef<HTMLInputElement>(null);

  /*
  |--------------------------------------------------------------------------
  | Desktop Navigation Lamp
  |--------------------------------------------------------------------------
  */

  const moveLamp = (element: HTMLElement | null) => {
    const lamp = lampRef.current;

    if (!lamp) return;

    if (!element) {
      lamp.style.opacity = "0";
      return;
    }

    const first = lamp.style.opacity !== "1";

    lamp.style.transition = first ? "none" : "";
    lamp.style.transform = `translateX(${element.offsetLeft}px)`;
    lamp.style.width = `${element.offsetWidth}px`;

    if (first) {
      void lamp.offsetWidth;
    }

    lamp.style.transition = "";
    lamp.style.opacity = "1";
  };

  const restLamp = () =>
    moveLamp(
      current
        ? (linksRef.current?.querySelector<HTMLElement>(
            `a[href="${current}"]`,
          ) ?? null)
        : null,
    );

  /*
  |--------------------------------------------------------------------------
  | Active Section Detection
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const ids = LINKS.map((link) => link.href.slice(1));
    const seen = new Map<string, boolean>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          seen.set(entry.target.id, entry.isIntersecting);
        }

        const active = ids.filter((id) => seen.get(id));
        setCurrent(active.length ? `#${active[active.length - 1]}` : null);
      },
      {
        rootMargin: "-40% 0px -55% 0px",
      },
    );

    ids.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Update Navigation Lamp
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    restLamp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  /*
  |--------------------------------------------------------------------------
  | Mobile Action Dock
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const hero = document.getElementById("top");
    const check = document.getElementById("check");
    const pricing = document.getElementById("pricing");
    const footer = document.getElementById("foot");

    const state = {
      past: false,
      hide: new Set<Element>(),
    };

    const sync = () => {
      setDock(state.past && state.hide.size === 0);
    };

    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        state.past = !entry.isIntersecting;
        sync();
      },
      {
        rootMargin: "0px 0px -20% 0px",
      },
    );

    const hideObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          state.hide.add(entry.target);
        } else {
          state.hide.delete(entry.target);
        }
      }

      sync();
    });

    if (hero) {
      heroObserver.observe(hero);
    }

    [check, pricing, footer].forEach((element) => {
      if (element) {
        hideObserver.observe(element);
      }
    });

    return () => {
      heroObserver.disconnect();
      hideObserver.disconnect();
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Mobile Visual Viewport Handling
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const visualViewport = window.visualViewport;

    if (!visualViewport) return;

    const fit = () => {
      const gap = Math.max(
        0,
        Math.round(
          document.documentElement.clientHeight -
            (visualViewport.offsetTop + visualViewport.height),
        ),
      );

      dockRef.current?.style.setProperty(
        "--vv-gap",
        `${visualViewport.scale > 1.01 ? 0 : gap}px`,
      );
    };

    fit();

    visualViewport.addEventListener("resize", fit);
    visualViewport.addEventListener("scroll", fit);
    window.addEventListener("resize", fit);

    return () => {
      visualViewport.removeEventListener("resize", fit);
      visualViewport.removeEventListener("scroll", fit);
      window.removeEventListener("resize", fit);
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Mobile Menu Accessibility
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    const lenis = (
      window as unknown as {
        __lenis?: {
          stop(): void;
          start(): void;
        };
      }
    ).__lenis;

    const behind = [
      document.querySelector("main"),
      document.getElementById("foot"),
    ];

    document.documentElement.style.overflow = open ? "hidden" : "";

    behind.forEach((element) => {
      element?.toggleAttribute("inert", open);
    });

    if (open) {
      lenis?.stop();
      menuRef.current?.querySelector<HTMLElement>("a")?.focus();
    } else {
      lenis?.start();

      if (wasOpen.current) {
        burgerRef.current?.focus();
      }
    }

    wasOpen.current = open;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) return;

      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (event.key !== "Tab") return;

      const nodes = [
        burgerRef.current,
        ...Array.from(
          menuRef.current?.querySelectorAll<HTMLElement>("a") ?? [],
        ),
      ].filter(Boolean) as HTMLElement[];

      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  /*
  |--------------------------------------------------------------------------
  | Login Modal Scroll Lock
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!loginOpen) return;

    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [loginOpen]);

  /*
  |--------------------------------------------------------------------------
  | Login Modal Auto Focus
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (!loginOpen) return;

    const timer = window.setTimeout(() => {
      if (authStep === "mobile") {
        loginMobileInputRef.current?.focus();
      }

      if (authStep === "otp") {
        loginOtpInputRef.current?.focus();
      }
    }, 100);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loginOpen, authStep]);

  /*
  |--------------------------------------------------------------------------
  | Open Login
  |--------------------------------------------------------------------------
  */

  const openLogin = () => {
    setOpen(false);
    setAuthStep("mobile");
    setMobile("");
    setOtp("");
    setAuthError("");
    setAuthMessage("");
    setLoginOpen(true);
  };

  useEffect(() => {
    window.addEventListener(OPEN_LOGIN_EVENT, openLogin);
    return () => window.removeEventListener(OPEN_LOGIN_EVENT, openLogin);
  });

  /*
  |--------------------------------------------------------------------------
  | Close Login
  |--------------------------------------------------------------------------
  */

  const closeLogin = () => {
    if (authLoading) return;

    setLoginOpen(false);
    setAuthStep("mobile");
    setMobile("");
    setOtp("");
    setAuthError("");
    setAuthMessage("");
  };

  /*
  |--------------------------------------------------------------------------
  | Mobile Number Input
  |--------------------------------------------------------------------------
  */

  const handleMobileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/\D/g, "").slice(0, 10);
    setMobile(value);

    if (authError) {
      setAuthError("");
    }
  };

  /*
  |--------------------------------------------------------------------------
  | OTP Input
  |--------------------------------------------------------------------------
  */

  const handleOtpChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(value);

    if (authError) {
      setAuthError("");
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Safely Parse API Response
  |--------------------------------------------------------------------------
  */

  const parseApiResponse = async (response: Response) => {
    const raw = await response.text();

    if (!raw) {
      return {};
    }

    try {
      return JSON.parse(raw);
    } catch {
      console.error("API returned non-JSON response:", raw);

      throw new Error(
        `Backend returned an invalid response. Status: ${response.status}`,
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Send OTP
  |--------------------------------------------------------------------------
  */

  const handleSendOtp = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    setAuthError("");
    setAuthMessage("");

    if (mobile.length !== 10) {
      setAuthError("Please enter a valid 10-digit mobile number.");
      return;
    }

    try {
      setAuthLoading(true);

      const response = await fetch(AUTH_ENDPOINTS.SEND_OTP, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mobile,
        }),
      });

      const data = await parseApiResponse(response);
      console.log("SEND OTP RESPONSE:", data);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            "Unable to send OTP. Please try again.",
        );
      }

      setAuthStep("otp");
      setAuthMessage(data?.message || `OTP has been sent to +91 ${mobile}`);
    } catch (error) {
      console.error("Send OTP error:", error);

      setAuthError(
        error instanceof Error
          ? error.message
          : "Unable to send OTP. Please try again.",
      );
    } finally {
      setAuthLoading(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Verify OTP
  |--------------------------------------------------------------------------
  */

  // const handleVerifyOtp = async (event?: FormEvent<HTMLFormElement>) => {
  //   event?.preventDefault();

  //   setAuthError("");
  //   setAuthMessage("");

  //   if (otp.length !== 4) {
  //     setAuthError("Please enter the 4-digit OTP.");
  //     return;
  //   }

  //   try {
  //     setAuthLoading(true);

  //     const response = await fetch(AUTH_ENDPOINTS.VERIFY_OTP, {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify({
  //         mobile,
  //         otp,
  //       }),
  //     });

  //     const data = await parseApiResponse(response);
  //     console.log("OTP VERIFY RESPONSE:", data);

  //     if (!response.ok) {
  //       throw new Error(
  //         data?.message ||
  //           data?.error ||
  //           data?.data?.message ||
  //           "Invalid OTP. Please try again.",
  //       );
  //     }

  //     const accessToken =
  //       data?.data?.accessToken ||
  //       data?.data?.access_token ||
  //       data?.accessToken ||
  //       data?.access_token ||
  //       data?.token ||
  //       data?.authToken;

  //     const refreshToken =
  //       data?.data?.refreshToken ||
  //       data?.data?.refresh_token ||
  //       data?.refreshToken ||
  //       data?.refresh_token;

  //     if (!accessToken) {
  //       console.error(
  //         "OTP verification succeeded but no access token was found:",
  //         data,
  //       );

  //       throw new Error(
  //         "Login succeeded, but the authentication token was not returned by the backend.",
  //       );
  //     }

  //     localStorage.setItem("inrange_auth_token", accessToken);

  //     if (refreshToken) {
  //       localStorage.setItem("inrange_refresh_token", refreshToken);
  //     }

  //     localStorage.setItem("inrange_onboarding_mobile", mobile);
  //     localStorage.setItem("inrange_auth_response", JSON.stringify(data));

  //     if (data?.user) {
  //       localStorage.setItem("inrange_user", JSON.stringify(data.user));
  //     }

  //     if (data?.data?.user) {
  //       localStorage.setItem("inrange_user", JSON.stringify(data.data.user));
  //     }

  //     if (data?.customer) {
  //       localStorage.setItem(
  //         "inrange_customer",
  //         JSON.stringify(data.customer),
  //       );
  //     }

  //     if (data?.data?.customer) {
  //       localStorage.setItem(
  //         "inrange_customer",
  //         JSON.stringify(data.data.customer),
  //       );
  //     }

  //     const nextScreen = data?.data?.nextScreen || data?.nextScreen || "";

  //     localStorage.setItem("inrange_next_screen", nextScreen);

  //     console.log("Access token saved successfully.");
  //     console.log("Next screen:", nextScreen);

  //     setLoginOpen(false);
  //     setAuthStep("mobile");
  //     setOtp("");
  //     setAuthError("");
  //     setAuthMessage("");

  //     const normalizedNextScreen = String(nextScreen).trim().toUpperCase();

  //     // if (normalizedNextScreen === "ONBOARDING") {
  //     //   router.replace("/onboarding");
  //     // } else {
  //     //   router.replace("/dashboard");
  //     // }
  //     if (normalizedNextScreen === "ONBOARDING") {
  //       router.replace("/onboarding");
  //     } else if (
  //       normalizedNextScreen === "DOCTOR_DASHBOARD" ||
  //       normalizedNextScreen === "DOCTORDASHBOARD" ||
  //       normalizedNextScreen === "CLINICIAN"
  //     ) {
  //       router.replace("/DoctorDasboard/clinician");
  //     } else {
  //       router.replace("/dashboard");
  //     }

  //     setMobile("");
  //   } catch (error) {
  //     console.error("OTP verification error:", error);

  //     setAuthError(
  //       error instanceof Error
  //         ? error.message
  //         : "OTP verification failed. Please try again.",
  //     );
  //   } finally {
  //     setAuthLoading(false);
  //   }
  // };

  // const handleVerifyOtp = async (event?: FormEvent<HTMLFormElement>) => {
  //   event?.preventDefault();

  //   setAuthError("");
  //   setAuthMessage("");

  //   if (otp.length !== 4) {
  //     setAuthError("Please enter the 4-digit OTP.");
  //     return;
  //   }

  //   try {
  //     setAuthLoading(true);

  //     const response = await fetch(AUTH_ENDPOINTS.VERIFY_OTP, {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify({
  //         mobile,
  //         otp,
  //       }),
  //     });

  //     const data = await parseApiResponse(response);
  //     console.log("OTP VERIFY RESPONSE:", data);

  //     if (!response.ok) {
  //       throw new Error(
  //         data?.message ||
  //           data?.error ||
  //           data?.data?.message ||
  //           "Invalid OTP. Please try again.",
  //       );
  //     }

  //     const accessToken =
  //       data?.data?.accessToken ||
  //       data?.data?.access_token ||
  //       data?.accessToken ||
  //       data?.access_token ||
  //       data?.token ||
  //       data?.authToken;

  //     const refreshToken =
  //       data?.data?.refreshToken ||
  //       data?.data?.refresh_token ||
  //       data?.refreshToken ||
  //       data?.refresh_token;

  //     if (!accessToken) {
  //       console.error(
  //         "OTP verification succeeded but no access token was found:",
  //         data,
  //       );

  //       throw new Error(
  //         "Login succeeded, but the authentication token was not returned by the backend.",
  //       );
  //     }

  //     localStorage.setItem("inrange_auth_token", accessToken);

  //     if (refreshToken) {
  //       localStorage.setItem("inrange_refresh_token", refreshToken);
  //     }

  //     localStorage.setItem("inrange_onboarding_mobile", mobile);
  //     localStorage.setItem("inrange_auth_response", JSON.stringify(data));

  //     if (data?.user) {
  //       localStorage.setItem("inrange_user", JSON.stringify(data.user));
  //     }

  //     if (data?.data?.user) {
  //       localStorage.setItem("inrange_user", JSON.stringify(data.data.user));
  //     }

  //     if (data?.customer) {
  //       localStorage.setItem(
  //         "inrange_customer",
  //         JSON.stringify(data.customer),
  //       );
  //     }

  //     if (data?.data?.customer) {
  //       localStorage.setItem(
  //         "inrange_customer",
  //         JSON.stringify(data.data.customer),
  //       );
  //     }

  //     const nextScreen = data?.data?.nextScreen || data?.nextScreen || "";

  //     localStorage.setItem("inrange_next_screen", nextScreen);

  //     console.log("Access token saved successfully.");
  //     console.log("Next screen:", nextScreen);

  //     setLoginOpen(false);
  //     setAuthStep("mobile");
  //     setOtp("");
  //     setAuthError("");
  //     setAuthMessage("");

  //     // --- TOKEN SE ROLE NIKALNE KA LOGIC ---
  //     let userRole = "";
  //     try {
  //       const payloadBase64 = accessToken.split(".")[1];
  //       const decodedPayload = JSON.parse(atob(payloadBase64));
  //       userRole = String(decodedPayload?.role || "")
  //         .trim()
  //         .toUpperCase();
  //     } catch (err) {
  //       console.error("Token decode karne me error:", err);
  //     }

  //     const normalizedNextScreen = String(nextScreen).trim().toUpperCase();

  //     // --- ROLE & ONBOARDING BASED ROUTING ---
  //     if (userRole === "DOCTOR") {
  //       router.replace("/DoctorDasboard/clinician");
  //     } else if (normalizedNextScreen === "ONBOARDING") {
  //       // Naya user hai toh onboarding page
  //       router.replace("/onboarding");
  //     } else {
  //       // Patient dashboard (jab onboarding already ho chuki ho)
  //       router.replace("/dashboard");
  //     }

  //     setMobile("");
  //   } catch (error) {
  //     console.error("OTP verification error:", error);

  //     setAuthError(
  //       error instanceof Error
  //         ? error.message
  //         : "OTP verification failed. Please try again.",
  //     );
  //   } finally {
  //     setAuthLoading(false);
  //   }
  // };

  const handleVerifyOtp = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    setAuthError("");
    setAuthMessage("");

    if (otp.length !== 6) {
      setAuthError("Please enter the 6-digit OTP.");
      return;
    }

    try {
      setAuthLoading(true);

      const response = await fetch(AUTH_ENDPOINTS.VERIFY_OTP, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mobile,
          otp,
        }),
      });

      const data = await parseApiResponse(response);
      console.log("OTP VERIFY RESPONSE:", data);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            data?.data?.message ||
            "Invalid OTP. Please try again.",
        );
      }

      const accessToken =
        data?.data?.accessToken ||
        data?.data?.access_token ||
        data?.accessToken ||
        data?.access_token ||
        data?.token ||
        data?.authToken;

      const refreshToken =
        data?.data?.refreshToken ||
        data?.data?.refresh_token ||
        data?.refreshToken ||
        data?.refresh_token;

      if (!accessToken) {
        console.error(
          "OTP verification succeeded but no access token was found:",
          data,
        );
        throw new Error(
          "Login succeeded, but the authentication token was not returned by the backend.",
        );
      }

      const sessionUser = saveSession({
        accessToken,
        refreshToken,
        mobile,
        user: data?.user || data?.data?.user || data?.customer || data?.data?.customer || null,
      });

      const nextScreen = data?.data?.nextScreen || data?.nextScreen || "";

      setLoginOpen(false);
      setAuthStep("mobile");
      setOtp("");
      setAuthError("");
      setAuthMessage("");

      const normalizedNextScreen = String(nextScreen).trim().toUpperCase();

      if (sessionUser.role === "DOCTOR") {
        router.replace(homePathFor("DOCTOR"));
      } else if (normalizedNextScreen === "ONBOARDING") {
        router.replace("/onboarding");
      } else {
        router.replace(homePathFor("PATIENT"));
      }

      setMobile("");
    } catch (error) {
      console.error("OTP verification error:", error);
      setAuthError(
        error instanceof Error
          ? error.message
          : "OTP verification failed. Please try again.",
      );
    } finally {
      setAuthLoading(false);
    }
  };

  /*
  
  |--------------------------------------------------------------------------
  | Resend OTP
  |--------------------------------------------------------------------------
  */

  const handleResendOtp = async () => {
    setOtp("");
    setAuthError("");
    setAuthMessage("");

    await handleSendOtp();
  };

  /*
  |--------------------------------------------------------------------------
  | Back To Mobile
  |--------------------------------------------------------------------------
  */

  const handleBackToMobile = () => {
    if (authLoading) return;

    setAuthStep("mobile");
    setOtp("");
    setAuthError("");
    setAuthMessage("");
  };

  /*
  |--------------------------------------------------------------------------
  | Render
  |--------------------------------------------------------------------------
  */

  return (
    <>
      {/* MAIN NAVBAR */}
      <header className={s.bar} data-open={open}>
        <div className={s.inner}>
          {/* BRAND */}
          <a
            href="#top"
            className={s.brand}
            aria-label="InRange home"
            onClick={() => setOpen(false)}
          >
            <Wordmark height={34} />
          </a>

          {/* DESKTOP NAVIGATION */}
          <nav
            ref={linksRef}
            className={s.links}
            aria-label="Primary"
            onPointerLeave={restLamp}
          >
            <span ref={lampRef} className={s.lamp} aria-hidden="true" />

            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                aria-current={current === link.href ? "location" : undefined}
                onPointerEnter={(event) => moveLamp(event.currentTarget)}
                onFocus={(event) => moveLamp(event.currentTarget)}
                onBlur={restLamp}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* DESKTOP ACTIONS */}
          {/* DESKTOP ACTIONS */}
          <div className={s.desktopActions}>
            <button type="button" className={s.loginButton} onClick={openLogin}>
              Login
            </button>

            <a
              className={s.cta}
              onClick={openLogin}
              // onClick={() => router.push("/pricing")}
              style={{ cursor: "pointer" }}
            >
              Start free check
            </a>
          </div>
          {/* MOBILE MENU BUTTON */}
          <button
            ref={burgerRef}
            className={s.burger}
            aria-expanded={open}
            aria-controls="menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            <span />
            <span />
          </button>
        </div>
      </header>

      {/* MOBILE MENU */}
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
          {LINKS.map((link, index) => (
            <a
              key={link.href}
              href={link.href}
              style={{ "--i": index } as CSSProperties}
              onClick={() => setOpen(false)}
              tabIndex={open ? 0 : -1}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div
          className={s.menuFoot}
          style={{ "--i": LINKS.length } as CSSProperties}
        >
          <button
            type="button"
            className={s.mobileLoginButton}
            onClick={openLogin}
            tabIndex={open ? 0 : -1}
          >
            Login
          </button>

          <a
            className="btn btn--mint"
            onClick={() => router.push("/pricing")}
            tabIndex={open ? 0 : -1}
            style={{ cursor: "pointer" }}
          >
            <span>Start free check</span>
            <span className="well" aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          </a>

          <p>
            Doctor-led care for weight and blood sugar. Consultations by video,
            anywhere in India.
          </p>
        </div>
      </div>

      {/* MOBILE ACTION DOCK */}
      <div
        ref={dockRef}
        className={s.dock}
        data-show={dock && !open}
        aria-hidden={!dock}
      >
        <p>
          <strong>Two minutes, free</strong> Reviewed by a doctor
        </p>

        <a
          onClick={openLogin}
          className="btn btn--mint"
          tabIndex={dock ? 0 : -1}
        >
          <span>Start free check</span>
          <span className="well" aria-hidden="true">
            <ArrowRight size={18} />
          </span>
        </a>
      </div>

      {/* LOGIN / OTP MODAL */}
      {loginOpen && (
        <div
          className={s.authOverlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeLogin();
            }
          }}
        >
          <div
            className={s.authModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
          >
            {/* CLOSE BUTTON */}
            <button
              type="button"
              className={s.authClose}
              aria-label="Close login"
              onClick={closeLogin}
              disabled={authLoading}
            >
              <X size={22} />
            </button>

            {/* HEADER */}
            <div className={s.authHeader}>
              <h2 id="auth-title">
                {authStep === "mobile" ? "Login or sign up" : "Enter your OTP"}
              </h2>

              <p>
                {authStep === "mobile"
                  ? "Enter your mobile number to continue."
                  : `We sent a 6-digit OTP to +91 ${mobile}`}
              </p>
            </div>

            {/* MOBILE NUMBER STEP */}
            {authStep === "mobile" && (
              <form className={s.authForm} onSubmit={handleSendOtp}>
                <label htmlFor="login-mobile" className={s.authLabel}>
                  Mobile number
                </label>

                <div className={s.mobileInputWrapper}>
                  <span>+91</span>
                  <input
                    ref={loginMobileInputRef}
                    id="login-mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="9876543210"
                    value={mobile}
                    onChange={handleMobileChange}
                    maxLength={10}
                    disabled={authLoading}
                    className={s.authInput}
                  />
                </div>

                {authError && <p className={s.authError}>{authError}</p>}

                <button
                  type="submit"
                  className={s.authPrimaryButton}
                  disabled={authLoading || mobile.length !== 10}
                >
                  {authLoading ? "Sending OTP..." : "Send OTP"}
                </button>

                <p className={s.authTerms}>
                  By continuing, you agree to our terms and privacy policy.
                </p>
              </form>
            )}

            {/* OTP STEP */}
            {authStep === "otp" && (
              <form className={s.authForm} onSubmit={handleVerifyOtp}>
                <label htmlFor="login-otp" className={s.authLabel}>
                  Enter OTP
                </label>

                <input
                  ref={loginOtpInputRef}
                  id="login-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={otp}
                  onChange={handleOtpChange}
                  maxLength={6}
                  disabled={authLoading}
                  className={`${s.authInput} ${s.otpInput}`}
                />

                {authMessage && <p className={s.authSuccess}>{authMessage}</p>}

                {authError && <p className={s.authError}>{authError}</p>}

                <button
                  type="submit"
                  className={s.authPrimaryButton}
                  disabled={authLoading || otp.length !== 6}
                >
                  {authLoading ? "Verifying..." : "Verify & Continue"}
                </button>

                <div className={s.otpActions}>
                  <button
                    type="button"
                    onClick={handleBackToMobile}
                    disabled={authLoading}
                  >
                    Change number
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={authLoading}
                  >
                    Resend OTP
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
