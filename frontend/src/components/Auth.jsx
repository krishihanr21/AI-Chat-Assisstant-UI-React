import React, { useEffect, useState } from "react";
import "../styles/auth.css";
import logo from '../assets/qoria-logo.png';

export default function Auth({ onLogin }) {
  const [loading, setLoading] = useState(true);
  const [dialogMessage, setDialogMessage] = useState("");

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setLoading(false);
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
        });
        window.google.accounts.id.renderButton(
          document.getElementById("googleSignInDiv"),
          {
            theme: "outline",
            size: "large",
            width: "250",
            text: "signin_with",
          }
        );
      }
    };
    document.body.appendChild(script);
  }, []);

  const handleCredentialResponse = async (response) => {
    const userObject = parseJwt(response.credential);

    if (userObject && userObject.email.endsWith("@qoria.com")) {
      try {
        const res = await fetch(`/api/user-role?email=${encodeURIComponent(userObject.email)}`);

        if (res.status === 403) {
          setDialogMessage("You are not authorized to use this system.");
          return;
        }

        if (!res.ok) {
          setDialogMessage("Error verifying your account. Please try again later.");
          return;
        }

        const data = await res.json();

        onLogin({
          email: userObject.email,
          name: userObject.name,
          picture: userObject.picture,
          role: data.role,
        });
      } catch (error) {
        console.error(error);
        setDialogMessage("Network error verifying access.");
        
      }
    } else {
      setDialogMessage("Unauthorized domain");
    }
  };


  function parseJwt(token) {
    try {
      return JSON.parse(atob(token.split(".")[1]));
    } catch (e) {
      return null;
    }
  }

  return (
    <div className="auth-container">
      <img src={logo} alt="Qoria Logo" className="auth-logo" />

      <div className="auth-card">
        <h1 className="auth-title">AI Virtual Assistant</h1>
        <p className="auth-subtitle">
          Sign in with your <b>@qoria.com</b> account to continue
        </p>
        <div id="googleSignInDiv" className="google-btn-container"></div>
      </div>

      {dialogMessage && (
        <div className="dialog-overlay">
          <div className="dialog-box">
            <h3>Notice</h3>
            <p>{dialogMessage}</p>
            <button className="dialog-btn" onClick={() => setDialogMessage("")}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

