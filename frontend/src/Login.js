import React, { useState } from "react";

export default function Login({ onLoggedIn }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function doLogin() {
    setErr("");
    try {
      const res = await fetch("http://localhost:4000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error || "Login failed");
        return;
      }
      localStorage.setItem("token", j.token);
      onLoggedIn(j.token);
    } catch (e) {
      setErr("Network error");
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "20px auto" }}>
      <h2>Teacher Login</h2>
      <div>
        <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
      </div>
      <div style={{ marginTop: 8 }}>
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      </div>
      <div style={{ marginTop: 10 }}>
        <button onClick={doLogin}>Login</button>{" "}
        <span style={{ color: "red", marginLeft: 8 }}>{err}</span>
      </div>
    </div>
  );
}
