export default function Card() {
  return (
    <main
      style={{
        background: "#edf0e8",
        boxSizing: "border-box",
        color: "#193628",
        fontFamily: "Arial, sans-serif",
        minHeight: "100vh",
        padding: 64,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 24,
          maxWidth: 680,
          padding: 48,
        }}
      >
        <p style={{ fontSize: 14, letterSpacing: 2 }}>AGENT RENDER / 001</p>
        <h1 style={{ fontSize: 64, lineHeight: 1.05, margin: "32px 0" }}>
          Code in.
          <br />
          Screenshot out.
        </h1>
        <p style={{ fontSize: 22, lineHeight: 1.5 }}>
          Drop a component. See the result. Make the next edit.
        </p>
        <div
          style={{
            background: "#d5f17b",
            borderRadius: 12,
            display: "inline-block",
            marginTop: 24,
            padding: "16px 24px",
          }}
        >
          Ready for the next iteration ↗
        </div>
      </div>
    </main>
  );
}
