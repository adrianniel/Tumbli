import { useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Tumbler } from "../components/Tumbler";
import { IconChevronLeft } from "../components/Icons";
import { SUPPORT_EMAIL } from "../config";
import type { Settings } from "../lib/store";

type Kind = "suggestion" | "bug" | "other";

const KINDS: { value: Kind; label: string; hint: string; placeholder: string }[] = [
  {
    value: "suggestion",
    label: "Suggestion",
    hint: "An idea to make Tumbli better",
    placeholder: "It would be great if Tumbli could…",
  },
  {
    value: "bug",
    label: "Something's wrong",
    hint: "A bug or something confusing",
    placeholder: "What happened, and what did you expect instead?",
  },
  { value: "other", label: "Something else", hint: "Praise, questions, anything", placeholder: "Tell me anything!" },
];

const SUBJECT: Record<Kind, string> = {
  suggestion: "Tumbli suggestion",
  bug: "Tumbli bug report",
  other: "Tumbli feedback",
};

/** Write feedback and hand it to the user's email app. Nothing is sent by Tumbli itself. */
export function Feedback({ settings, onBack }: { settings: Settings; onBack: () => void }) {
  const [kind, setKind] = useState<Kind>("suggestion");
  const [message, setMessage] = useState("");
  const [withInfo, setWithInfo] = useState(true);
  const [status, setStatus] = useState<"idle" | "opened" | "failed">("idle");
  const current = KINDS.find((k) => k.value === kind)!;

  const send = async () => {
    let body = message.trim();
    if (withInfo) {
      const version = await getVersion().catch(() => "?");
      body +=
        `\n\n---\nTumbli ${version} · ${settings.mode === "tumbler" ? `tumbler ${settings.tumblerMl} ml` : `glass ${settings.glassMl} ml`}` +
        ` · goal ${settings.goalMl} ml · ${navigator.userAgent.match(/Windows NT [\d.]+/)?.[0] ?? "Windows"}`;
    }
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUBJECT[kind])}&body=${encodeURIComponent(body)}`;
    try {
      await openUrl(url);
      setStatus("opened");
    } catch {
      setStatus("failed");
    }
  };

  if (status === "opened") {
    return (
      <main className="onb feedback">
        <div className="fb-thanks">
          <Tumbler fill={0.8} size={120} arms happy />
          <h1>Thank you!</h1>
          <p className="sub">
            Your email app should be open with your message ready. Just press Send there. Every note helps make me a
            better tumbler.
          </p>
        </div>
        <footer className="onb-nav">
          <button className="primary-btn" onClick={onBack}>
            Back to Tumbli
          </button>
          <button className="link fb-again" onClick={() => setStatus("idle")}>
            Email app didn't open?
          </button>
        </footer>
      </main>
    );
  }

  return (
    <main className="onb feedback">
      <header className="onb-top">
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <IconChevronLeft size={20} />
        </button>
        <span className="fb-title">Feedback</span>
      </header>

      <div className="onb-buddy">
        <div className="onb-buddy-bottle">
          <Tumbler fill={0.6} size={68} arms />
        </div>
        <div className="says">I'm all ears! What's on your mind?</div>
      </div>

      <div className="fb-kinds" role="radiogroup" aria-label="Kind of feedback">
        {KINDS.map((k) => (
          <button
            key={k.value}
            role="radio"
            aria-checked={kind === k.value}
            className={kind === k.value ? "fb-kind on" : "fb-kind"}
            onClick={() => setKind(k.value)}
          >
            <b>{k.label}</b>
            <small>{k.hint}</small>
          </button>
        ))}
      </div>

      <label className="fb-field">
        <span className="row-label">Your message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={current.placeholder}
          rows={6}
          maxLength={1500}
        />
        <small className="fb-count">{message.length}/1500</small>
      </label>

      <label className="fb-info">
        <input className="switch" type="checkbox" checked={withInfo} onChange={(e) => setWithInfo(e.target.checked)} />
        <span>
          Include app info
          <small>Version, tracking mode, goal and Windows version. Nothing personal.</small>
        </span>
      </label>

      {status === "failed" && (
        <p className="warn">
          Couldn't open your email app. You can email <b>{SUPPORT_EMAIL}</b> directly.
        </p>
      )}

      <footer className="onb-nav">
        <button className="primary-btn" onClick={() => void send()} disabled={message.trim().length < 3}>
          Open in my email app
        </button>
        <p className="fine">Goes to {SUPPORT_EMAIL}. Tumbli doesn't send anything by itself.</p>
      </footer>
    </main>
  );
}
