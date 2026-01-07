import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

const API = "http://localhost:4000";
const MAX_ROLL = 80;

/* ================= MAIN APP ================= */
export default function App() {
  const [view, setView] = useState("login"); // login | attendance
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("token")) setView("attendance");
  }, []);

  return (
    <div className="page-wrapper">
      <div className="card">

        {/* HEADER */}
        <header className="top-header">
          <div className="header-title">
            {view === "attendance" ? "Attendance Dashboard" : "Attendance App"}
          </div>

          {view === "attendance" && (
            <div>
              <button className="hdr-btn" onClick={() => setShowPwd(true)}>
                Change Password
              </button>
              <button
                className="hdr-btn"
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
              >
                Logout
              </button>
            </div>
          )}
        </header>

        {view === "login" && <LoginForm onSuccess={() => setView("attendance")} />}
        {view === "attendance" && <AttendanceForm />}

        {showPwd && <ChangePassword onClose={() => setShowPwd(false)} />}
      </div>
    </div>
  );
}

/* ================= LOGIN ================= */
function LoginForm({ onSuccess }) {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState("");

  async function login() {
    setErr("");
    try {
      const res = await fetch(API + "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const j = await res.json();
      if (!res.ok) return setErr(j.error || "Login failed");

      localStorage.setItem("token", j.token);
      onSuccess();
    } catch {
      setErr("Network error");
    }
  }

  return (
    <div className="form-col">
      <h3>Login</h3>
      <input placeholder="Username" onChange={e => setU(e.target.value)} />
      <input type="password" placeholder="Password" onChange={e => setP(e.target.value)} />
      <button className="btn" onClick={login}>Login</button>
      {err && <div className="msg error">{err}</div>}
    </div>
  );
}

/* ================= CHANGE PASSWORD ================= */
function ChangePassword({ onClose }) {
  const [oldP, setOld] = useState("");
  const [newP, setNew] = useState("");
  const [msg, setMsg] = useState("");

  async function submit() {
    setMsg("");
    try {
      const res = await fetch(API + "/api/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({ oldPassword: oldP, newPassword: newP }),
      });
      const j = await res.json();
      if (!res.ok) return setMsg(j.error || "Failed");

      setMsg("Password updated. Please login again.");
      setTimeout(() => {
        localStorage.clear();
        window.location.reload();
      }, 1200);
    } catch {
      setMsg("Network error");
    }
  }

  return (
    <div className="modal">
      <div className="modal-card">
        <h3>Change Password</h3>
        <input type="password" placeholder="Old Password" onChange={e => setOld(e.target.value)} />
        <input type="password" placeholder="New Password" onChange={e => setNew(e.target.value)} />
        <button className="btn" onClick={submit}>Update</button>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        {msg && <div className="msg">{msg}</div>}
      </div>
    </div>
  );
}

/* ================= ATTENDANCE ================= */
function AttendanceForm() {
  const initial = useMemo(() => {
    const o = {};
    for (let i = 1; i <= MAX_ROLL; i++) o[i] = false;
    return o;
  }, []);

  const [map, setMap] = useState(initial);
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [regular, setRegular] = useState(true);
  const [extra, setExtra] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggle = n => setMap(p => ({ ...p, [n]: !p[n] }));
  const clearAll = () => setMap(initial);
  const invertAll = () =>
    setMap(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, !v])));

  async function submitAttendance() {
    if (!subject.trim()) {
      setMsg({ type: "error", text: "Please enter subject" });
      return;
    }

    setLoading(true);
    setMsg(null);

    const presentMatrix = Array.from(
      { length: MAX_ROLL },
      (_, i) => (map[i + 1] ? "1" : "0")
    );

    try {
      const res = await fetch(API + "/api/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({
          subject,
          date,
          regular,
          extra,
          presentMatrix,
        }),
      });

      const j = await res.json();
      if (!res.ok) {
        setMsg({ type: "error", text: j.error || j.detail || "Submit failed" });
      } else {
        setMsg({ type: "success", text: "✅ Attendance submitted successfully" });
        setTimeout(() => setMsg(null), 3000);
      }
    } catch {
      setMsg({ type: "error", text: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* FORM ROW */}
      <div className="form-row">
        <label>
          Subject
          <input
            type="text"
            placeholder="Enter subject name"
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
        </label>

        <label>
          Date
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </label>

        <label className="lecture">
          <input
            type="checkbox"
            checked={regular}
            onChange={e => {
              setRegular(e.target.checked);
              if (e.target.checked) setExtra(false);
            }}
          />
          Regular
        </label>

        <label className="lecture">
          <input
            type="checkbox"
            checked={extra}
            onChange={e => {
              setExtra(e.target.checked);
              if (e.target.checked) setRegular(false);
            }}
          />
          Extra
        </label>
      </div>

      {/* GRID */}
      <div className="grid-wrapper">
        <div className="grid-10x10">
          {Array.from({ length: MAX_ROLL }, (_, i) => i + 1).map(n => (
            <div key={n} className="cell" onClick={() => toggle(n)}>
              <div className="num">{n}</div>
              <input type="checkbox" checked={map[n]} readOnly />
            </div>
          ))}
        </div>
      </div>

      {/* CONTROLS */}
      <div className="controls-bottom">
        <button className="btn" onClick={clearAll}>Clear</button>
        <button className="btn" onClick={invertAll}>Invert</button>
        <button className="btn primary" onClick={submitAttendance} disabled={loading}>
          {loading ? "Submitting..." : "Submit"}
        </button>
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
    </>
  );
}
