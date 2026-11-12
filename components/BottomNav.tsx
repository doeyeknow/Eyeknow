import LogoEye from "./LogoEye";

// The app's bottom navigation bar — shown when eyeKnow runs as an
// installed app (standalone display mode). In a browser tab the
// InstallFooter takes its place (Adam's direction, 2026-10-19).
interface Props {
  view: string;
  savedCount: number;
  popOpen: boolean;
  accountEmail: string | null;
  isAdmin?: boolean;
  canInstall: boolean;
  onHome: () => void;
  onHow: () => void;
  onHistory: () => void;
  onScan: () => void;
  onTogglePop: () => void;
  onSignIn: () => void;
  onCreateAccount: () => void;
  onSignOut: () => void;
  onInstall: () => void;
  /** Reveal finale: the center lens turns into the unlock button
   *  (Adam, 2026-11-06). */
  unlockMode?: boolean;
  onUnlockPress?: () => void;
}

export default function BottomNav(p: Props) {
  return (
    <nav className="bottombar no-print" aria-label="Main">
      {p.unlockMode && (
        <style>{`
          @keyframes lockpop {
            0%, 18% { transform: rotate(0deg); }
            36%, 70% { transform: rotate(-34deg); }
            88%, 100% { transform: rotate(0deg); }
          }
          @keyframes lockglow {
            0%, 100% { box-shadow: 0 0 0 0 rgba(240, 178, 62, 0.45); }
            50% { box-shadow: 0 0 0 10px rgba(240, 178, 62, 0); }
          }
          .lock-shackle {
            transform-origin: 6% 96%;
            transform-box: fill-box;
            animation: lockpop 3.2s ease-in-out infinite;
          }
          .lens-btn.unlocking { animation: lockglow 3.2s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) {
            .lock-shackle, .lens-btn.unlocking { animation: none; }
          }
        `}</style>
      )}
      <button
        type="button"
        className={`bar-btn${p.view === "home" ? " active" : ""}`}
        onClick={p.onHome}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3.5 11.2 12 4l8.5 7.2" />
          <path d="M5.8 9.8V20h12.4V9.8" />
          <path d="M9.8 20v-5.4h4.4V20" />
        </svg>
        <span>Home</span>
      </button>
      <button type="button" className="bar-btn" onClick={p.onHow}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="5.2" cy="6" r="1.15" fill="currentColor" stroke="none" />
          <circle cx="5.2" cy="12" r="1.15" fill="currentColor" stroke="none" />
          <circle cx="5.2" cy="18" r="1.15" fill="currentColor" stroke="none" />
          <path d="M9.5 6h9.5M9.5 12h9.5M9.5 18h9.5" />
        </svg>
        <span>How it works</span>
      </button>
      <div className="bar-center" aria-hidden="true" />
      <button
        type="button"
        className={`bar-btn${p.view === "history" ? " active" : ""}`}
        onClick={p.onHistory}
      >
        <span className="bar-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="3.5" width="14" height="17" rx="2" />
            <path d="M9.2 3.5v17" />
          </svg>
          {p.savedCount > 0 && <span className="bar-badge">{p.savedCount}</span>}
        </span>
        <span>My readings</span>
      </button>
      <button
        type="button"
        className={`bar-btn${p.popOpen ? " active" : ""}`}
        onClick={p.onTogglePop}
        aria-haspopup="true"
        aria-expanded={p.popOpen}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="3.6" />
          <path d="M5 19.6c1.2-3.3 3.8-4.9 7-4.9s5.8 1.6 7 4.9" />
        </svg>
        <span>Account</span>
      </button>
      <button
        type="button"
        className={`lens-btn${p.unlockMode ? " unlocking" : ""}`}
        onClick={p.unlockMode ? p.onUnlockPress : p.onScan}
        aria-label={p.unlockMode ? "Unlock this reading" : "Start a new scan"}
        title={p.unlockMode ? "Unlock this reading" : "Start a new scan"}
        style={
          p.unlockMode
            ? {
                background:
                  "radial-gradient(circle at 35% 30%, #ffe9a8, #f0b23e 72%)",
                border: "2px solid rgba(255, 215, 106, 0.9)",
              }
            : undefined
        }
      >
        {p.unlockMode ? (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
            }}
          >
          <svg
            viewBox="0 0 24 24"
            width="44"
            height="44"
            aria-hidden="true"
            style={{ display: "block" }}
          >
            <path
              className="lock-shackle"
              d="M7.5 11.2V7a4.5 4.5 0 0 1 9 0v1.4"
              fill="none"
              stroke="#4a3208"
              strokeWidth="2.3"
              strokeLinecap="round"
            />
            <rect x="5" y="10.6" width="14" height="9.6" rx="2.3" fill="#4a3208" />
            <circle cx="12" cy="14.4" r="1.7" fill="#f0b23e" />
            <rect x="11.05" y="14.4" width="1.9" height="3.1" rx="0.95" fill="#f0b23e" />
          </svg>
          </span>
        ) : (
          <span className="lens-glass">
            <LogoEye />
          </span>
        )}
      </button>
      {p.popOpen && (
        <div className="account-pop">
          {p.accountEmail ? (
            <>
              <p className="account-pop-email">{p.accountEmail}</p>
              {p.canInstall && (
                <button type="button" onClick={p.onInstall}>
                  📲 Install app
                </button>
              )}
              {p.isAdmin && (
                <button
                  type="button"
                  onClick={() => { window.location.href = "/admin"; }}
                >
                  Admin dashboard
                </button>
              )}
              <button type="button" onClick={p.onSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={p.onSignIn}>
                Sign in
              </button>
              <button type="button" onClick={p.onCreateAccount}>
                Create account
              </button>
              {p.canInstall && (
                <button type="button" onClick={p.onInstall}>
                  📲 Install app
                </button>
              )}
            </>
          )}
        </div>
      )}
    </nav>
  );
}
