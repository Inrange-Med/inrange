import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import s from "./ComboBanner.module.css";

/*
  The team's combo offer (a doctor consultation and home lab tests in one package). It sits as a quiet
  band straight under the hero: a strip above the floating nav would sit under the nav pill. The link
  is theirs: /pricing sends people to onboarding, where the real packages and prices are chosen.
*/
export default function ComboBanner() {
  return (
    <aside className={s.band} aria-label="Combo package">
      <div className={s.inner}>
        <p className={s.text}>
          <strong>Doctor consultation and home lab tests</strong> in one package, with an itemised price before you pay.
        </p>
        <a href="/pricing" className="btn">
          <span>Book the combo check</span>
          <span className="well" aria-hidden="true">
            <ArrowRight size={18} />
          </span>
        </a>
      </div>
    </aside>
  );
}
