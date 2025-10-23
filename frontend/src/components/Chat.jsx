import React, { useEffect, useRef, useState } from "react";
import { postQuery, pollUpdates } from "../api/api";
import "../styles/chat.css";
import avatar from "../assets/ai-avatar.jpg";

export default function Chat({ user }) {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("chat_messages");
    return saved ? JSON.parse(saved) : [];
  });
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState("");
  const [expandedMessage, setExpandedMessage] = useState(null);
  const [reasoningExpanded, setReasoningExpanded] = useState(null);
  const [streamingThoughts, setStreamingThoughts] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
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
  }, [messages, streamingThoughts]);

  useEffect(() => {
    if (!user) {
      localStorage.removeItem("chat_messages");
      setMessages([]);
    }
  }, [user]);

  async function handleSend() {
  if (!selected.trim()) return;

  const questionId = `abc-123`;
  const session_id = `session-${user.name.split(" ")[0]}-${new Date().toISOString()}`;
  const user_id = '26ce089b-d650-47c6-84c5-8f4af1bbe8cd'
  setPending(true);
  setMessages((prev) => [...prev, { role: "user", content: selected }]);
  setIsStreaming(true);
  setStreamingThoughts([]);

const MAX_POLL_TIME = 30000;
const POLL_INTERVAL_MS = 3000;

  try {
    const res = await postQuery(
      selected,
      user_id,
      session_id,
      questionId
    );
    console.log("Published:", res);

    const startTime = Date.now();
    const pollInterval = setInterval(async () => {
      if (Date.now() - startTime > MAX_POLL_TIME) {
      console.warn("Polling timed out.");
      clearInterval(pollInterval);
      setPending(false);
      setIsStreaming(false);
      return;
    }
      try {
        const { messages: updates } = await pollUpdates(user_id, session_id);
        if (!updates || updates.length === 0) return;

        updates.forEach((msg) => {
          if (msg.session_id !== session_id) return;

          const { agent, instruction, answer, isFinal, output } = msg;

          if (isFinal === "false") {
            setStreamingThoughts((prev) => [
              ...prev,
              { agent, instruction, answer },
            ]);
          } else if (isFinal === "true") {
            clearInterval(pollInterval);
            setIsStreaming(false);
            setPending(false);

            let finalTable = [];
            if (output && typeof output === "object") {
              if (Array.isArray(output.tableData) && output.tableData.length > 0) {
                finalTable = output.tableData;
              }
              else if (Array.isArray(output) && output.length > 0 && typeof output[0] === "object") {
                finalTable = output;
              }
              else if (typeof output === "object" && !Array.isArray(output)) {
                finalTable = [output];
              }
            }

            if (!Array.isArray(finalTable)) finalTable = [];

            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                content: output?.text || "Here's the AI response!",
                reasoning: [...streamingThoughts, { agent, instruction, answer }],
                tableData: finalTable,
                questionId,
              },
            ]);
            setStreamingThoughts([]);
          }
        });
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, POLL_INTERVAL_MS);
  } catch (err) {
    console.error("Error publishing:", err);
    setPending(false);
    setIsStreaming(false);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Error publishing query." },
    ]);
  }

  setSelected("");
}

  const toggleTable = (index) => {
    setExpandedMessage(expandedMessage === index ? null : index);
  };

  const toggleReasoning = (index) => {
    setReasoningExpanded(reasoningExpanded === index ? null : index);
  };

  const fetchTableData = async (questionId) => {
    try {
      
    } catch (error) {
      console.error("Error fetching table data:", error);
    }
  };

  return (
    <div className="chat-container">
      <h2 className="chat-title">Chat Assistant</h2>

      {messages.length > 0 && (
        <div className="chat-box">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`chat-message ${
                m.role === "user" ? "user-msg" : "assistant-msg"
              }`}
            >
              <img
                src={m.role === "user" ? user.picture : avatar}
                alt={m.role === "user" ? user.name : "AI Avatar"}
                className="chat-avatar"
                referrerPolicy="no-referrer"
              />
              <div className="bubble">
                {m.role === "user" ? (
                <>
                  <b>{user.name.split(" ")[0]}:</b> {m.content}
                </>
              ) : (
                <>
                  {m.content ? (
                    <>
                      <div className="reasoning-section">
                        <button
                          className="reasoning-toggle-btn"
                          onClick={() => toggleReasoning(i)}
                        >
                          {reasoningExpanded === i ? "Hide Thought Process" : "Show Thought Process"}
                        </button>

                        {reasoningExpanded === i && Array.isArray(m.reasoning) && m.reasoning.length > 0 && (
                          <div className="reasoning-box">
                            {m.reasoning
                              .filter((step) => step && typeof step === "object" && step.agent)
                              .map((step, idx) => (
                                <div key={idx} className="reasoning-step">
                                  <span className="agent-name">{step.agent}:</span>{" "}
                                  <span>{step.instruction}</span>{" "}
                                  <i>{step.answer}</i>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>

                      <div className="assistant-output">
                        <b>AI:</b> {m.content}
                      </div>

                      <div className="table-toggle" style={{ marginTop: "8px" }}>
                        <button
                          className="view-table-btn"
                          onClick={() => {
                            toggleTable(i);
                            fetchTableData(m.questionId);
                          }}
                        >
                          {expandedMessage === i ? "Hide Table" : "View Table"}
                        </button>

                        {expandedMessage === i && Array.isArray(m.tableData) && m.tableData.length > 0 && (
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
                    </>
                  ) : null}
                </>
              )}

              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="assistant-msg">
              <div className="bubble thinking">
                <div className="spinner"></div>
                <b>AI is thinking...</b>
                <div className="reasoning-stream">
                  {streamingThoughts.map((step, idx) => (
                    <div key={idx} className="reasoning-step">
                      <span className="agent-name">{step.agent}:</span>{" "}
                      <span>{step.instruction}</span>{" "}
                      <i>{step.answer}</i>
                    </div>
                  ))}
                </div>
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
        <button onClick={handleSend} disabled={pending} className="send-btn">
          {pending ? "Loading..." : "Send"}
        </button>
      </div>
    </div>
  );
}
