import React, { useState, useEffect, useRef } from "react";
import { postQuery, pollUpdates } from "../api/api";
import "../styles/training.css";

export default function Training({ user }) {
  const SESSION_KEY = `training_session_${user.email}`;

  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  const [reasoningSteps, setReasoningSteps] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  const [expandedTable, setExpandedTable] = useState(false);
  const [tableData, setTableData] = useState([]);
  const [bigqueryJobId, setBigqueryJobId] = useState(null);

  const pollIntervalRef = useRef(null);
  const isPollingActive = useRef(false);
  const finalMessageHandled = useRef(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      const { question, response, feedback, reasoningSteps } = JSON.parse(saved);
      setQuestion(question || "");
      setResponse(response || "");
      setFeedback(feedback || null);
      setReasoningSteps(reasoningSteps || []);
    }
  }, [SESSION_KEY]);

  // Save session to storage
  useEffect(() => {
    const data = { question, response, feedback, reasoningSteps };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  }, [question, response, feedback, reasoningSteps, SESSION_KEY]);

  // Cleanup
  useEffect(() => {
    return () => clearInterval(pollIntervalRef.current);
  }, []);

  const toggleReasoning = () => setReasoningExpanded(!reasoningExpanded);
  const toggleTable = () => {
    // Toggle UI and fetch table
    const willOpen = !expandedTable;
    setExpandedTable(willOpen);
    if (willOpen && bigqueryJobId) {
      fetchTableData(bigqueryJobId);
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
      <div className="reasoning-step-box" style={{ marginBottom: "12px" }}>
        <div>
          <strong>Agent:</strong> {agent}
        </div>
        <div>
          <strong>Instruction:</strong>
          {lines(instruction)}
        </div>
        <br />
        <div>
          <strong>Answer:</strong>
          {lines(answer)}
        </div>
        <br /><br />
      </div>
    );
  }

  async function handleSend() {
    if (!question.trim()) return;
    clearInterval(pollIntervalRef.current);
    finalMessageHandled.current = false;
    isPollingActive.current = false;

    const questionId = `train-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const session_id = "training-session";
    const user_id = "26ce089b-d650-47c6-84c5-8f4af1bbe8cd";
    const training_mode = true;

    setLoading(true);
    setResponse("");
    setReasoningSteps([]);
    setIsStreaming(true);
    setFeedback(null);
    setTableData([]);
    setBigqueryJobId(null);

    try {
      const res = await postQuery(question, user_id, session_id, questionId, training_mode);
      console.log("Training published:", res);
      // start polling after a short delay
      setTimeout(() => startPolling(user_id, session_id, questionId), 3000);
    } catch (err) {
      console.error("Error sending query:", err);
      setResponse("Error sending query.");
      setLoading(false);
      setIsStreaming(false);
    }
  }

  async function startPolling(user_id, session_id, questionId) {
    if (isPollingActive.current) {
      console.warn("Polling already active.");
      return;
    }

    isPollingActive.current = true;
    finalMessageHandled.current = false;

    const POLL_INTERVAL_MS = 3000;
    const MAX_POLL_TIME = 600000;
    const startTime = Date.now();

    async function pollOnce() {
      if (finalMessageHandled.current || Date.now() - startTime > MAX_POLL_TIME) {
        console.log("Stopping polling (final handled or timeout).");
        isPollingActive.current = false;
        setLoading(false);
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
            const isFinal = String(msg.is_final).toLowerCase() === "true";

            if (!isFinal) {
              setReasoningSteps((prev) => [...prev, { agent, instruction, answer }]);
            } else if (!finalMessageHandled.current) {
              finalMessageHandled.current = true;

              setBigqueryJobId(msg.BigQueryJobId || null);
              setResponse(answer || "No final answer.");
              setIsStreaming(false);
              setLoading(false);
              isPollingActive.current = false;
              return;
            }
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }

      if (isPollingActive.current && !finalMessageHandled.current) {
        setTimeout(pollOnce, POLL_INTERVAL_MS);
      }
    }

    pollOnce();
  }

  //fetch BigQuery rows and set local tableData state
  const fetchTableData = async (bigqueryJobIdArg) => {
    const jobId = bigqueryJobIdArg || bigqueryJobId;
    if (!jobId) {
      console.warn("No BigQuery Job ID found for this query.");
      return;
    }

    try {
      const API_BASE_URL = "";
      const res = await fetch(`${API_BASE_URL}/api/bigquery/${jobId}`);
      const data = await res.json();

      if (res.ok && Array.isArray(data.rows)) {
        setTableData(data.rows);
      } else {
        console.error("Error fetching BigQuery data:", data.detail || data);
      }
    } catch (error) {
      console.error("Error fetching table data:", error);
    }
  };

  function handleFeedback(type) {
    setFeedback(type);
    if (type === "up") {
      console.log("Feedback positive: Save this response (placeholder)");
    } else if (type === "down") {
      console.log("Feedback negative: Regenerating...");
      handleSend();
    }
  }

  return (
    <div className="training-container">
      <div className="training-card">
        <h2 className="training-title">Training Mode</h2>
        <p className="training-subtitle">
          Test and refine your AI assistant’s reasoning and responses.
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
            {loading ? "Training..." : "Train"}
          </button>
        </div>

        {isStreaming && (
          <div className="training-reasoning-box">
            <div className="t-bubble thinking">
              <div className="reasoning-stream">
                {reasoningSteps.map((step, idx) => (
                  <div key={idx}>{formatAgentResponse(step.agent, step.instruction, step.answer)}</div>
                ))}
              </div>
              <div className="spinner"></div>
              <b>AI is thinking...</b>
            </div>
          </div>
        )}

        {response && !isStreaming && (
          <div className="training-response">
            <div className="reasoning-section">
              <button
                className="reasoning-toggle-btn"
                onClick={toggleReasoning}
              >
                {reasoningExpanded ? "Hide Thought Process" : "Show Thought Process"}
              </button>

              {reasoningExpanded && reasoningSteps.length > 0 && (
                <div className="reasoning-box">
                  {reasoningSteps.map((step, idx) => (
                    <div key={idx} className="reasoning-step">
                      {formatAgentResponse(step.agent, step.instruction, step.answer)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p>
              <b>AI Response:</b> {lines(response)}
            </p>

            <div className="table-toggle" style={{ marginTop: "8px" }}>
              <button
                className="view-table-btn"
                onClick={() => {
                  toggleTable();
                }}
              >
                {expandedTable ? "Hide Table" : "View Table"}
              </button>

              {expandedTable && tableData.length > 0 && (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        {Object.keys(tableData[0]).map((key) => (
                          <th key={key}>{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row, idx) => (
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
