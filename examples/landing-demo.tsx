export default function Preview() {
  return (
    <div
      style={{
        padding: 40,
        background: "#edf0e8",
        height: "100vh",
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
        color: "#193628",
      }}
    >
      <article style={{ padding: 32, borderRadius: 20, background: "white" }}>
        <span style={{ fontSize: 14 }}>Your next iteration</span>
        <h1
          style={{
            fontSize: 42,
            letterSpacing: "-1.5px",
            margin: "28px 0 18px",
          }}
        >
          Hello, agent.
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.5, margin: 0 }}>
          Now you can see what you built.
        </p>
        <div
          style={{
            marginTop: 30,
            padding: "12px 18px",
            background: "#d5f17b",
            borderRadius: 8,
            display: "inline-block",
            fontSize: 15,
          }}
        >
          Ready to render ↗
        </div>
      </article>
    </div>
  );
}
