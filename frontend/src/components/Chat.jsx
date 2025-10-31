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
  const pollIntervalRef = useRef(null);
  const isPollingActive = useRef(false);
  const finalMessageHandled = useRef(false);


   console.log(messages);
   
  const PREDEFINED_QUESTIONS = [
    "What is the current breakdown of our applications by license utilization tier (Low, Medium, High)?",
    "How much is the district's total estimated potential savings from underutilized licenses right now?",
    "Which applications have the largest financial gap between the license fee per user and the effective cost per user?",
    "For licenses expiring in the next 90 days, which ones should we renew versus not renew based on usage?",
    "What are the critical usage trends for the past 7 days concerning risk and low adoption?",
  ];

  // persist chat history
  useEffect(() => {
    localStorage.setItem("chat_messages", JSON.stringify(messages));
  }, [messages]);

  // scroll to bottom on update
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingThoughts]);

  // reset when user logs out
  useEffect(() => {
    if (!user) {
      localStorage.removeItem("chat_messages");
      setMessages([]);
    }
  }, [user]);

  useEffect(() => {
    return () => clearInterval(pollIntervalRef.current);
  }, []);

  // POST QUERY FUNCTION
  async function handleSend() {
    finalMessageHandled.current = false;
    finalMessageHandled.current = false;
    isPollingActive.current = false;
    clearInterval(pollIntervalRef.current);

    console.log("handleSend triggered at:", new Date().toISOString());
    if (!selected.trim()) return;

    const questionId = `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const session_id = `session-test33`;
    const user_id = "26ce089b-d650-47c6-84c5-8f4af1bbe8cd";
    const training_mode = false;

    setPending(true);
    setIsStreaming(true);
    setStreamingThoughts([]);
    setMessages((prev) => [...prev, { role: "user", content: selected }]);

    try {
      const res = await postQuery(selected, user_id, session_id, questionId, training_mode);
      console.log("Published:", res);
      console.log(postQuery);
      

      // clear any previous polling before starting new one
      clearInterval(pollIntervalRef.current);
      // wait 5s before starting to poll
      setTimeout(() => startPolling(user_id, session_id, questionId), 5000);
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

// POLLING FUNCTION
  async function startPolling(user_id, session_id, questionId) {
    if (isPollingActive.current) {
      console.warn("Polling already active — skipping new start.");
      return;
    }

    console.log("Starting new polling loop...");
    isPollingActive.current = true;
    finalMessageHandled.current = false;

    const POLL_INTERVAL_MS = 3000;
    const MAX_POLL_TIME = 600000;
    const startTime = Date.now();

    async function pollOnce() {
      if (finalMessageHandled.current || Date.now() - startTime > MAX_POLL_TIME) {
        console.log("Stopping polling (final handled or timeout).");
        isPollingActive.current = false;
        setPending(false);
        setIsStreaming(false);
        return;
      }

      try {
        const { messages: updates } = await pollUpdates(user_id, session_id, questionId);
        if (updates && updates.length > 0) {
          for (const msg of updates) {
            if (msg.Session !== session_id) continue;

            const agent = msg.Agent;
            const instruction = msg.Instructions;
            const answer = msg.FinalAnswer || msg.Answer;
            const output = msg.BigQueryJobId;
            const isFinal = String(msg.is_final).toLowerCase() === "true";

            if (!isFinal) {
              setStreamingThoughts((prev) => [...prev, { agent, instruction, answer }]);
            } else if (!finalMessageHandled.current) {
              finalMessageHandled.current = true;
              console.log("Final message received — stopping polling.");

              let finalTable = [];
              let bigqueryJobId = msg.BigQueryJobId;

              if (output && typeof output === "object") {
                if (Array.isArray(output.tableData) && output.tableData.length > 0)
                  finalTable = output.tableData;
                else if (Array.isArray(output) && output.length > 0 && typeof output[0] === "object")
                  finalTable = output;
                else if (typeof output === "object" && !Array.isArray(output))
                  finalTable = [output];
              }


              setStreamingThoughts((prevThoughts) => {
                const reasoningSnapshot = [...prevThoughts, { agent, instruction, answer }];

                setMessages((prev) => {
                  const alreadyExists = prev.some(
                    (m) =>
                      m.role === "assistant" &&
                      m.content === (answer || "Here's the AI response!") &&
                      m.questionId === questionId
                  );
                  if (alreadyExists) {
                    console.log("Skipping duplicate final message append.");
                    return prev;
                  }

                  return [
                    ...prev,
                    {
                      role: "assistant",
                      content: answer || "Here's the AI response!",
                      reasoningSnapshot,
                      tableData: finalTable,
                      bigqueryJobId,
                      questionId,
                    },
                  ];
                });
                return [];
              });
              isPollingActive.current = false;
              setPending(false);
              setIsStreaming(false);
              return; // stop polling
            }
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }

      // Schedule next poll only if still active
      if (isPollingActive.current && !finalMessageHandled.current) {
        setTimeout(pollOnce, POLL_INTERVAL_MS);
      }
    }

    pollOnce();
  }

  // UI HELPERS
  const toggleTable = (index) => {
    setExpandedMessage(expandedMessage === index ? null : index);
  };

  const toggleReasoning = (index) => {
    setReasoningExpanded(reasoningExpanded === index ? null : index);
  };

  const fetchTableData = async (questionId, bigqueryJobId) => {
    if (!bigqueryJobId) {
      console.warn("No BigQuery Job ID found for this message.");
      return;
    }

    try {
      const API_BASE_URL = "";
      const res = await fetch(`${API_BASE_URL}/api/bigquery/${bigqueryJobId}`);
      const data = await res.json();

      if (res.ok && Array.isArray(data.rows)) {
        setMessages((prev) =>
          prev.map((m) =>
            m.questionId === questionId ? { ...m, tableData: data.rows } : m
          )
        );
      } else {
        console.error("Error fetching BigQuery data:", data.detail || data);
      }
    } catch (error) {
      console.error("Error fetching table data:", error);
    }
  };

  const clean = (text = "") =>
      String(text)
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .trim();

    const lines = (text) =>
      clean(text)
        .split("\n")
        .map((line, idx) => (
          <div key={idx} style={{ whiteSpace: "pre-wrap", marginTop: "3px" }}>
            {line}
          </div>
        ));

  function formatAgentResponse(agent, instruction, answer) {
    if (!answer && !instruction) return null;

  return (
    <div className="formatted-agent-response" style={{ lineHeight: 1.6 }}>
      <div>
        <strong>Agent:</strong> {agent}
      </div>
      <div style={{ marginTop: "8px" }}>
        <strong>Instruction:</strong>
        <div>{lines(instruction)}</div>
      </div>
      <br />
      <div style={{ marginTop: "8px" }}>
        <strong>Answer:</strong>
        <div>{lines(answer)}</div>
      </div>
      <br /><br />
    </div>
  );
}

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
                    {m.content && (
                      <>
                        <div className="reasoning-section">
                          <button
                            className="reasoning-toggle-btn"
                            onClick={() => toggleReasoning(i)}
                          >
                            {reasoningExpanded === i
                              ? "Hide Thought Process"
                              : "Show Thought Process"}
                          </button>
 
                          {reasoningExpanded === i &&
                            Array.isArray(m.reasoningSnapshot) &&
                            m.reasoningSnapshot.length > 0 && (
                              <div className="reasoning-box">
                                {m.reasoningSnapshot
                                .filter((step) => step && typeof step === "object" && step.agent)
                                .map((step, idx) => (
                                  <div key={idx} className="reasoning-step">
                                    {formatAgentResponse(step.agent, step.instruction, step.answer)}
                                  </div>
                                ))}

                              </div>
                            )}
                        </div>

                        <div className="assistant-output">
                          <b>AI:</b> {lines(m.content)}
                        </div>

                        <div
                          className="table-toggle"
                          style={{ marginTop: "8px" }}
                        >
                          <button
                            className="view-table-btn"
                            onClick={() => {
                              toggleTable(i);
                              fetchTableData(m.questionId, m.bigqueryJobId);
                            }}
                          >
                            {expandedMessage === i
                              ? "Hide Table"
                              : "View Table"}
                          </button>

                          {expandedMessage === i &&
                            Array.isArray(m.tableData) &&
                            m.tableData.length > 0 && (
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
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className="assistant-msg">
              <div className="bubble thinking">
                <div className="reasoning-stream">
                  {streamingThoughts.map((step, idx) => (
                    <div key={idx} className="reasoning-step">
                      {formatAgentResponse(step.agent, step.instruction, step.answer)}
                    </div>
                  ))}
                </div>
                <div className="spinner"></div>
                <b>AI is thinking...</b>
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
          onClick={() => {
            if (!pending) handleSend();
          }}
          disabled={pending}
          className="send-btn"
        >
          {pending ? "Loading..." : "Send"}
        </button>
      </div>
    </div>
  );
}
