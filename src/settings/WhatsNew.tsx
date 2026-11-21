import { useEffect, useState } from "react";
import { Tumbler } from "../components/Tumbler";
import { IconChevronLeft } from "../components/Icons";
import { appVersion, CHANGELOG, compareVersions, markVersionSeen } from "../lib/changelog";

/** What changed in each version, the one running now first. */
export function WhatsNew({ onBack }: { onBack: () => void }) {
  const [version, setVersion] = useState(CHANGELOG[0].version);
  useEffect(() => {
    void appVersion().then((v) => {
      setVersion(v);
      markVersionSeen(v); // read here: no need for the bubble on the widget
    });
  }, []);
  const releases = CHANGELOG.filter((r) => compareVersions(r.version, version) <= 0);

  return (
    <main className="onb whats-new">
      <header className="onb-top">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <IconChevronLeft size={20} />
        </button>
        <span className="fb-title">What's new</span>
      </header>

      <div className="onb-buddy">
        <div className="onb-buddy-bottle">
          <Tumbler fill={0.7} size={68} arms happy />
        </div>
        <div className="says">I keep getting better! Here's what changed.</div>
      </div>

      {releases.map((r, i) => (
        <section className={i === 0 ? "card release current" : "card release"} key={r.version}>
          <div className="card-head">
            <h2>Version {r.version}</h2>
            <span className="muted small">{i === 0 ? "This version" : r.date}</span>
          </div>
          <ul className="changes">
            {r.changes.map((c) => (
              <li key={c.title}>
                <b>{c.title}</b>
                <span>{c.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <footer className="onb-nav">
        <button className="primary-btn" onClick={onBack}>
          Back to Tumbli
        </button>
      </footer>
    </main>
  );
}
