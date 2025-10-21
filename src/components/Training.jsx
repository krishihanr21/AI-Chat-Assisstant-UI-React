import React, { useState, useEffect } from "react";
import { postQuery } from "../api/api";
import "../styles/training.css";

export default function Training({ user }) {
  const SESSION_KEY = `training_session_${user.email}`;

  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedSession = sessionStorage.getItem(SESSION_KEY);
    if (savedSession) {
      const { question, response, feedback } = JSON.parse(savedSession);
      setQuestion(question);
      setResponse(response);
      setFeedback(feedback);
    }
  }, [SESSION_KEY]);

  useEffect(() => {
    const sessionData = { question, response, feedback };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  }, [question, response, feedback, SESSION_KEY]);

  async function handleSend() {
    if (!question.trim()) return;
    setLoading(true);
    const res = await postQuery(question, user.email, "training-session");
    setResponse(res.answer || "No response");
    setLoading(false);
  }

  function handleFeedback(type) {
    setFeedback(type);
    if (type === "up") {
      alert("Response saved as good example");
    } else {
      alert("Generating a new alternative response...");
    }
  }

  return (
    <div className="training-container">
      <div className="training-card">
        <h2 className="training-title">Training Mode</h2>
        <p className="training-subtitle">
          Test and refine your AI assistant’s responses below.
        </p>

        <div className="training-input-group">
          <input
            type="text"
            placeholder="Enter a question..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="training-input"
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="training-button"
          >
            {loading ? "Generating..." : "Send"}
          </button>
        </div>

        {response && (
          <div className="training-response">
            <p>
              <b>AI Response:</b> {response}
            </p>
            <div className="feedback-buttons">
              <button
                onClick={() => handleFeedback("up")}
                className={`feedback-btn up ${feedback === "up" ? "selected" : ""}`}
              >
                👍
              </button>
              <button
                onClick={() => handleFeedback("down")}
                className={`feedback-btn down ${feedback === "down" ? "selected" : ""}`}
              >
                👎
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
