"use client";

// Last-resort boundary (root layout failed): no providers available, so plain markup.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", background: "#F4F1DE", color: "#1B263B", display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <h1>Something went wrong / कुछ गड़बड़ हो गई</h1>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 16px", borderRadius: 10, background: "#1B263B", color: "#fff", border: 0 }}>
            Try again / फिर से कोशिश करें
          </button>
        </div>
      </body>
    </html>
  );
}
