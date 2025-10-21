import React, { useEffect, useRef, useState } from "react";
import { postQuery } from "../api/api";
import "../styles/chat.css";
import avatar from '../assets/ai-avatar.jpg';

export default function Chat({ user, onLogout }) {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("chat_messages");
    return saved ? JSON.parse(saved) : [];
  });
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState("");
  const [expandedMessage, setExpandedMessage] = useState(null);
  const [typingMessage, setTypingMessage] = useState("");
  const chatEndRef = useRef(null);

  const PREDEFINED_QUESTIONS = [
    "What is the current breakdown of our applications by license utilization tier (Low, Medium, High)?",
    "How much is the district's total estimated potential savings from underutilized licenses right now?",
    "Which applications have the largest financial gap between the license fee per user and the effective cost per user?",
    "For licenses expiring in the next 90 days, which ones should we renew versus not renew based on usage?",
    "What are the critical usage trends for the past 7 days concerning risk and low adoption?",
  ];

  useEffect(() => {
    localStorage.setItem("chat_messages", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingMessage]);

  useEffect(() => {
    if (!user) {
      localStorage.removeItem("chat_messages");
      setMessages([]);
    }
  }, [user]);

  async function handleSend() {
    if (!selected.trim()) return;
    setPending(true);
    setMessages((prev) => [...prev, { role: "user", content: selected }]);
    setTypingMessage("");

    try {
      const res = await postQuery(selected, user.email, "test-session");
      const fullText = res.result || "No response";
      setPending(false);

      let index = 0;
      const interval = setInterval(() => {
        setTypingMessage(fullText.slice(0, index));
        index++;
        if (index > fullText.length) {
          clearInterval(interval);
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: fullText,
              tableData: res.tableData || [],
            },
          ]);
          setTypingMessage("");
        }
      }, 20);
    } catch (err) {
      setPending(false);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error getting response" },
      ]);
    }

    setSelected("");
  }

  const toggleTable = (index) => {
    setExpandedMessage(expandedMessage === index ? null : index);
  };

  return (
    <div className="chat-container">
      <h2 className="chat-title">Chat Assistant</h2>

      {messages.length > 0 && (
        <div className="chat-box">
          {messages.map((m, i) => (
            <div
                key={i}
                className={`chat-message ${m.role === "user" ? "user-msg" : "assistant-msg"}`}
                >
                <img
                    src={
                    m.role === "user"
                        ? user.picture
                        : avatar
                    }
                    alt={m.role === "user" ? user.name : "AI Avatar"}
                    className="chat-avatar"
                    referrerPolicy="no-referrer"
                />
                <div className="bubble">
                <b>{m.role === "user" ? user.name.split(" ")[0] : "AI"}:</b> {m.content}

                {m.role === "assistant" && m.tableData?.length > 0 && (
                  <div className="table-toggle">
                    <button
                      className="view-table-btn"
                      onClick={() => toggleTable(i)}
                    >
                      {expandedMessage === i ? "Hide Table" : "View Table"}
                    </button>
                    {expandedMessage === i && (
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              {Object.keys(m.tableData[0]).map((key) => (
                                <th key={key}>{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {m.tableData.map((row, idx) => (
                              <tr key={idx}>
                                {Object.values(row).map((val, vIdx) => (
                                  <td key={vIdx}>{val}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {pending && (
            <div className="spinner-overlay">
              <div className="spinner"></div>
              <div>Generating response...</div>
            </div>
          )}

          {typingMessage && (
            <div className="assistant-msg">
              <div className="bubble">
                <b>AI:</b> {typingMessage}
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      )}

      <div className="chat-input-section">
        <select
          className="chat-dropdown"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Select a question...</option>
          {PREDEFINED_QUESTIONS.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
        <button
          onClick={handleSend}
          disabled={pending}
          className="send-btn"
        >
          {pending ? "Loading..." : "Send"}
        </button>
      </div>
    </div>
  );
}
