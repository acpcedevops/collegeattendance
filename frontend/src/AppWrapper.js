import React, { useEffect, useState } from "react";
import Login from "./Login";
import Register from "./Register";
import AttendaceForm from "./App"; // your renamed component file

export default function AppWrapper() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [showRegister, setShowRegister] = useState(false);

  function handleLoggedIn(t) {
    localStorage.setItem('token', t);
    setToken(t);
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
  }

  // optional: try to verify token on load by calling a protected endpoint (not required)
  useEffect(() => {
    // you can add token validation here
  }, []);

  if (!token) {
    return (
      <div>
        <header style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 900, margin: '16px auto' }}>
          <h1>Attendance App</h1>
          <div>
            <button onClick={()=>setShowRegister(false)}>Login</button>
            <button onClick={()=>setShowRegister(true)} style={{ marginLeft: 8 }}>Register</button>
          </div>
        </header>

        {showRegister ? <Register /> : <Login onLoggedIn={handleLoggedIn} />}
      </div>
    );
  }

  // logged in -> show attendance UI
  return (
    <div>
      <div style={{ maxWidth: 1100, margin: '12px auto', display: 'flex', justifyContent: 'space-between' }}>
        <h2>Attendance Dashboard</h2>
        <div>
          <button onClick={logout}>Logout</button>
        </div>
      </div>

      <AttendaceForm />
    </div>
  );
}
