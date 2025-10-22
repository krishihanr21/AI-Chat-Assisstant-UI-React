import React, { useEffect, useRef, useState } from "react";
import { postQuery } from "../api/api";
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

  // Simulate Pub/Sub receiving 6 streamed reasoning messages
    const startStreamingUpdates = (questionId) => {
      return new Promise((resolve) => {
        setStreamingThoughts([]);
        setIsStreaming(true);

        const mockStream = [
          { agent: "Query Planner", instruction: "Analyzing the user query structure.", answer: "Identified main intent as cost optimization." },
          { agent: "Data Retriever", instruction: "Fetching license utilization data.", answer: "Retrieved 12 application usage records." },
          { agent: "Analyzer", instruction: "Computing underutilization ratios.", answer: "Found 4 apps below 40% usage." },
          { agent: "Finance Evaluator", instruction: "Calculating cost gaps.", answer: "Detected $2,300 potential savings." },
          { agent: "Summarizer", instruction: "Drafting final response for user.", answer: "Formulated human-readable summary." },
          { agent: "Reporting Agent", instruction: "Formatting structured response.", answer: "Output ready for presentation." },
        ];

        let index = 0;
        const interval = setInterval(() => {
          if (index < mockStream.length-1) {
            setStreamingThoughts((prev) => [...prev, mockStream[index]]);
            index++;
          } else {
            clearInterval(interval);
            setIsStreaming(false);
            resolve(mockStream);
          }
        }, 20000);
      });
    };


  async function handleSend() {
  if (!selected.trim()) return;
  const questionId = `abc-123`;
  setPending(true);
  setMessages((prev) => [...prev, { role: "user", content: selected }]);

  try {
    // Wait for both to finish in parallel
    const [res, reasoningData] = await Promise.all([
      postQuery(selected, "26ce089b-d650-47c6-84c5-8f4af1bbe8cd", "test-session"),
      startStreamingUpdates(questionId),
    ]);

    const fullText = res.result || "Here’s your summarized insight!";
    const dummyTable = [
      { Application: "Google Classroom", Licenses: 120, Used: 80, Savings: "$400" },
      { Application: "Zoom Education", Licenses: 90, Used: 45, Savings: "$900" },
    ];

    setPending(false);

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: fullText,
        tableData: dummyTable,
        reasoning: reasoningData.filter(Boolean),
        questionId,
      },
    ]);

    setStreamingThoughts([]);
  } catch (err) {
    console.error(err);
    setPending(false);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Error getting response." },
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
                /* ---------- USER MESSAGE ---------- */
                <>
                  <b>{user.name.split(" ")[0]}:</b> {m.content}
                </>
              ) : (
                /* ---------- ASSISTANT MESSAGE (safe conditional render) ---------- */
                <>
                  {/* Only show this after content exists */}
                  {m.content ? (
                    <>
                      {/* 1) Thought Process (top) */}
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

                      {/* 2) AI main output (middle) */}
                      <div className="assistant-output">
                        <b>AI:</b> {m.content}
                      </div>

                      {/* 3) Table toggle + table (bottom) */}
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
