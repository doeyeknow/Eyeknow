export default function Loading() {
  return (
    <main aria-busy="true" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#090d18", color: "#f4f5fa", padding: 24 }}>
      <div role="status" aria-live="polite" style={{ textAlign: "center", maxWidth: 360 }}>
        <p style={{ fontSize: 30, marginBottom: 12 }}>eyeKnow</p>
        <p>Loading your app…</p>
        <p style={{ opacity: 0.7, fontSize: 14 }}>Your screen will appear when it is ready.</p>
      </div>
    </main>
  );
}
