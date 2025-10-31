import React, { useEffect, useState } from "react";
import Auth from "./components/Auth";
import Chat from "./components/Chat";
import Config from "./components/Config";
import Training from "./components/Training";
import "./styles/app.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [activeTab, setActiveTab] = useState("chat Assistant");

  useEffect(() => {
    if (user) {
      fetch(`/api/user-role?email=${encodeURIComponent(user.email)}`)
        .then((res) => {
          if (res.status === 403) {
            alert("You are not authorized to access this system.");
            setUser(null);
            return null;
          }
          return res.json();
        })
        .then((data) => {
          if (data) setRole(data.role);
        })
        .catch(() => {
          alert("Error verifying your access.");
          setUser(null);
        });
    }
  }, [user]);



  if (!user) return <Auth onLogin={setUser} />;

  const isAdmin = role === "admin";

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">AI Virtual Assistant</h1>
        <div className="app-user">
          <img src={user.picture} alt="profile" referrerPolicy="no-referrer" />
          <span className="app-user-email">{user.email}</span>
          <button onClick={() => {
            setUser(null);
            localStorage.removeItem("chat_messages");
            sessionStorage.clear();
            sessionStorage.removeItem(`training_session_${user.email}`);
          }} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <nav className="app-nav">
        {["chat Assistant", "Agent configuration", "Training Mode"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`nav-tab ${activeTab === tab ? "active" : ""}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      <main className="app-content">
        {activeTab === "chat Assistant" && <Chat user={user} />}
        {isAdmin ? (
          <>
            {activeTab === "Agent configuration" && <Config />}
            {activeTab === "Training Mode" && <Training user={user} />}
          </>
        ) : (
          activeTab !== 'chat Assistant' && (
            <div className="p-6 text-center text-gray-600">
              <p>You don’t have permission to access this section.</p>
            </div>
          )
        )}
      </main>
    </div>
  );
}
