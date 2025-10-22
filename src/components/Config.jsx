import React, { useState } from "react";
import "../styles/config.css";

export default function Config() {
  const [selectedAgent, setSelectedAgent] = useState("");
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");

  async function uploadToGCS() {
    if (!file || !selectedAgent) {
      alert("Select an agent and a YAML file");
      return;
    }

    setStatus("Uploading to backend...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("agent", selectedAgent);

      const res = await fetch(`${import.meta.env.VITE_API_URL}/upload_to_gcs`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Upload failed");
      }
      const data = await res.json();

      setStatus(`File uploaded successfully! (${data.public_url || "private file"})`);
    } catch (err) {
      console.error("Upload error:", err);
      setStatus("Upload failed: " + err.message);
    }
  }


  return (
    <div className="config-container">
      <div className="config-card">
        <h2 className="config-title">Agent Configuration</h2>
        <p className="config-subtitle">
          Upload YAML configuration files for each CrewAI agent.
        </p>

        <div className="config-form">
          <label htmlFor="agent" className="config-label">
            Select Agent:
          </label>
          <select
            id="agent"
            className="config-select"
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
          >
            <option value="">-- Choose an Agent --</option>
            <option value="validator">Validator</option>
            <option value="schema_filter">Schema Filter</option>
            <option value="query_generator">Query Generator</option>
          </select>

          <label htmlFor="file" className="config-label">
            Choose YAML File:
          </label>
          <input
            id="file"
            type="file"
            accept=".yaml,.yml"
            className="config-file"
            onChange={(e) => setFile(e.target.files[0])}
          />

          <button onClick={uploadToGCS} className="config-button">
            Upload
          </button>

          {status && <p className="config-status">{status}</p>}
        </div>
      </div>
    </div>
  );
}
