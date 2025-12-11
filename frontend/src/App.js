import React, { useEffect, useMemo, useState } from "react";
import "./App.css"; // keep your existing css (or merge styles)

const API_BASE = "http://localhost:4000"; // change if your backend URL differs

export default function AttendaceForm({ onLogout }) {
  // header state
  const [subject, setSubject] = useState("cn");
  const [lectureRegular, setLectureRegular] = useState(true);
  const [lectureExtra, setLectureExtra] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  // grid state (present map: 1..100 -> boolean)
  const initial = useMemo(() => {
    const x = {};
    for (let i = 1; i <= 100; i++) x[i] = false;
    return x;
  }, []);

  const [presentMap, setPresentMap] = useState(initial);

  // UI state
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success'|'error'|'info', text: '' }

  // ensure mutual exclusivity: if both true for some reason, keep the last-changed behavior implemented in handlers below

  // helpers to toggle roll
  const toggleRoll = (n) => {
    setPresentMap((p) => ({ ...p, [n]: !p[n] }));
  };

  const clearAll = () => {
    setPresentMap(Object.fromEntries(Object.keys(initial).map((k) => [k, false])));
    setMessage({ type: "info", text: "Cleared selections." });
  };

  const invertAll = () => {
    setPresentMap((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, !v])));
    setMessage({ type: "info", text: "Inverted selections." });
  };

  // build presentMatrix as array of '0'/'1' strings length 100
  const buildPresentMatrix = () => {
    return Array.from({ length: 100 }, (_, i) => (presentMap[i + 1] ? "1" : "0"));
  };

  // Submit attendance to backend
  const submit = async () => {
    setMessage(null);

    // check token
    const token = localStorage.getItem("token");
    if (!token) {
      setMessage({ type: "error", text: "Not logged in. Please login first." });
      return;
    }

    // build payload
    const presentMatrix = buildPresentMatrix();
    const payload = {
      subject,
      date,
      regular: lectureRegular ? 1 : 0,
      extra: lectureExtra ? 1 : 0,
      presentMatrix,
    };

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/attendance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = json.error || json.detail || "Submit failed";
        setMessage({ type: "error", text: err });
      } else {
        setMessage({ type: "success", text: "Attendance submitted successfully." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Network error or server not reachable." });
      console.error("submit error", err);
    } finally {
      setLoading(false);
    }
  };

  // keyboard accessibility: allow toggling with Enter/Space by focusing the number div
  useEffect(() => {
    // ensure each cell is focusable (done via tabIndex below)
  }, []);

  // simple count of present
  const presentCount = Object.values(presentMap).filter(Boolean).length;

  // Lecture checkbox handlers: keep mutually exclusive behavior (Option 1)
  const onRegularChange = (checked) => {
    setLectureRegular(checked);
    if (checked) setLectureExtra(false);
  };
  const onExtraChange = (checked) => {
    setLectureExtra(checked);
    if (checked) setLectureRegular(false);
  };

  return (
    <div className="page">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h1 style={{ margin: 0 }}>Attendance</h1>
          <div>
            {onLogout && <button onClick={() => { localStorage.removeItem("token"); onLogout(); }}>Logout</button>}
          </div>
        </div>

        <div className="form" style={{ marginBottom: 12 }}>
          <div className="group">
            <label>Subject</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="cn">CN</option>
              <option value="os">OS</option>
              <option value="bc">Block Chain</option>
            </select>
          </div>

          <div className="group lecture">
            <label>Lecture</label>

            <label className="inline" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={lectureRegular}
                onChange={(e) => onRegularChange(e.target.checked)}
              />
              <span>Regular</span>
            </label>

            <label className="inline" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={lectureExtra}
                onChange={(e) => onExtraChange(e.target.checked)}
              />
              <span>Extra</span>
            </label>
          </div>

          <div className="group">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="grid-wrapper">
          <div className="grid-10x10" role="grid" aria-label="Roll numbers grid">
            {Array.from({ length: 100 }, (_, i) => i + 1).map((n) => (
              <div
                className="cell"
                key={n}
                role="gridcell"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    toggleRoll(n);
                    e.preventDefault();
                  }
                }}
              >
                <div
                  className="num"
                  onClick={() => toggleRoll(n)}
                  style={{ userSelect: "none" }}
                >
                  {n}
                </div>
                <div className="cb">
                  <input
                    id={"r" + n}
                    type="checkbox"
                    checked={!!presentMap[n]}
                    onChange={() => toggleRoll(n)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hint" style={{ marginTop: 10 }}>Tap a number to toggle its checkbox. On small widths (400px) all 10 columns fit.</div>

        <div className="controls-bottom" style={{ marginTop: 12 }}>
          <button onClick={clearAll} disabled={loading}>Clear</button>
          <button onClick={invertAll} disabled={loading}>Invert</button>
          <button className="primary" onClick={submit} disabled={loading}>
            {loading ? "Submitting..." : `Submit (${presentCount})`}
          </button>
        </div>

        {message && (
          <div style={{
            marginTop: 12,
            padding: "8px 10px",
            borderRadius: 8,
            color: message.type === "error" ? "#7f1d1d" : (message.type === "success" ? "#064e3b" : "#0c4a6e"),
            background: message.type === "error" ? "#fee2e2" : (message.type === "success" ? "#ecfdf5" : "#e6f0fa"),
            border: message.type === "error" ? "1px solid #fecaca" : "1px solid rgba(0,0,0,0.06)"
          }}>
            {message.text}
          </div>
        )}

      </div>
    </div>
  );
}
