import React, { useState } from "react";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [webAppUrl, setWebAppUrl] = useState("");
  const [webAppSecret, setWebAppSecret] = useState("");
  const [msg, setMsg] = useState("");

  async function submit() {
    setMsg("");
    try {
      const res = await fetch("http://localhost:4000/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, sheetUrl, webAppUrl, webAppSecret }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMsg("Error: " + (j.error || JSON.stringify(j)));
        return;
      }
      setMsg("Registered OK — please login now.");
    } catch (e) {
      setMsg("Network error");
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "20px auto" }}>
      <h2>Teacher Registration</h2>
      <div><input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} /></div>
      <div style={{ marginTop: 8 }}><input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} /></div>
      <div style={{ marginTop: 8 }}>
        <input placeholder="Google Sheet URL (optional)" value={sheetUrl} onChange={e=>setSheetUrl(e.target.value)} />
      </div>
      <div style={{ marginTop: 8 }}>
        <input placeholder="Apps Script Web App URL (required)" value={webAppUrl} onChange={e=>setWebAppUrl(e.target.value)} />
      </div>
      <div style={{ marginTop: 8 }}>
        <input placeholder="Web App Secret (required)" value={webAppSecret} onChange={e=>setWebAppSecret(e.target.value)} />
      </div>
      <div style={{ marginTop: 10 }}>
        <button onClick={submit}>Register</button>
        <div style={{ marginTop: 8, color: msg.startsWith("Error") ? "red" : "green" }}>{msg}</div>
      </div>
    </div>
  );
}
