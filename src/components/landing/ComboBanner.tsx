// "use client";

// import React, { useState } from "react";
// import Link from "next/link";
// import s from "./ComboBanner.module.css";
// import { openLogin } from "./Nav";

// export default function ComboBanner() {
//   const [isVisible, setIsVisible] = useState(true);

//   if (!isVisible) return null;

//   return (
//     <aside className={s.bannerWrapper} aria-label="Announcement">
//       <div className={s.container}>
//         {/* Left Badge */}
//         <div className={s.badge}>
//           <span className={s.pulseDot} />
//           Combo Plan
//         </div>

//         {/* Center Details */}
//         <p className={s.text}>
//           <strong>Doctor Consultation + Complete Lab Test</strong> combo package
//           starting at just <span className={s.price}>₹1999</span>
//         </p>

//         {/* Right Action */}
//         <div className={s.actions}>
//           <button onClick={openLogin} className={s.ctaBtn}>
//             Book Combo Check
//             <svg
//               width="14"
//               height="14"
//               viewBox="0 0 24 24"
//               fill="none"
//               stroke="currentColor"
//               strokeWidth="2.5"
//               strokeLinecap="round"
//               strokeLinejoin="round"
//             >
//               <path d="M5 12h14M12 5l7 7-7 7" />
//             </svg>
//           </button>

//           {/* Optional Close Button */}
//           <button
//             type="button"
//             className={s.closeBtn}
//             onClick={() => setIsVisible(false)}
//             aria-label="Close banner"
//           >
//             ✕
//           </button>
//         </div>
//       </div>
//     </aside>
//   );
// }

"use client";

import React, { useState } from "react";
import Link from "next/link";
import s from "./ComboBanner.module.css";

export default function ComboBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <aside className={s.bannerWrapper} aria-label="Announcement">
      <div className={s.container}>
        {/* Left Badge */}
        <div className={s.badge}>
          <span className={s.pulseDot} />
          Combo Plan
        </div>

        {/* Center Details */}
        <p className={s.text}>
          <strong>Doctor consultation and home lab tests</strong> in one
          package, with an itemised price before you pay
        </p>

        {/* Right Action */}
        <div className={s.actions}>
          <Link href="/pricing" className={s.ctaBtn}>
            Book Combo Check
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>

          {/* Close Button */}
          <button
            type="button"
            className={s.closeBtn}
            onClick={() => setIsVisible(false)}
            aria-label="Close banner"
          >
            ✕
          </button>
        </div>
      </div>
    </aside>
  );
}
