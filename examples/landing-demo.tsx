export default function Preview() {
  return (
    <main
      style={{
        width: 600,
        height: 400,
        background: "#03060d",
        color: "#eef3ff",
        fontFamily: "Arial, sans-serif",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 440,
          height: 440,
          top: -200,
          left: 90,
          background: "radial-gradient(circle,#164cff45,transparent 65%)",
        }}
      />
      <article style={{ textAlign: "center", position: "relative" }}>
        <div
          style={{
            width: 62,
            height: 62,
            margin: "0 auto 26px",
            border: "2px solid #3e7bff",
            borderRadius: 14,
            transform: "rotate(-12deg)",
            boxShadow: "0 0 35px #2463ff44",
            display: "grid",
            placeItems: "center",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              background: "#2463ff",
              borderRadius: 5,
              boxShadow: "0 0 24px #2463ff77",
            }}
          />
        </div>
        <h1
          style={{
            fontSize: 44,
            fontWeight: 500,
            letterSpacing: "-2px",
            margin: "0 0 13px",
          }}
        >
          Hello, agent.
        </h1>
        <p style={{ fontSize: 15, color: "#8699bb", margin: 0 }}>
          Now you can see what you built.
        </p>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginTop: 29,
            padding: "8px 13px",
            border: "1px solid #234271",
            borderRadius: 20,
            color: "#a4c2ff",
            fontSize: 11,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              background: "#4385ff",
              borderRadius: 5,
            }}
          />
          Preview ready
        </div>
      </article>
      <span
        style={{
          position: "absolute",
          bottom: 20,
          left: 24,
          color: "#496084",
          fontSize: 10,
        }}
      >
        600 × 400
      </span>
      <span
        style={{
          position: "absolute",
          bottom: 20,
          right: 24,
          color: "#496084",
          fontSize: 10,
        }}
      >
        agent-render
      </span>
    </main>
  );
}
