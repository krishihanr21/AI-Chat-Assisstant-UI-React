// export const API_BASE_URL = "https://ai-virtual-assistant-847069729509.us-central1.run.app";
export const API_BASE_URL = "http://127.0.0.1:8000";

export async function postQuery(input, userId, sessionId) {
try {
  console.log("Sending to backend:", {
  input,
  user_id: userId,
  session_id: sessionId
});

// const response = await fetch(`${API_BASE_URL}/query`, {
const response = await fetch(`/query`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ input, user_id: userId, session_id: sessionId })
});
if (!response.ok) throw new Error(`Error: ${response.status}`);
const data = await response.json();
    console.log("Backend returned:", data);
    return data;
  } catch (error) {
    console.error("Query failed:", error);
    throw error;
}
}

export async function fetchAgentUpdates(sessionId) {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/pull_updates?session_id=${sessionId}`);
    if (!res.ok) throw new Error("Failed to fetch updates");
    const data = await res.json();
    return data.updates || [];
  } catch (err) {
    console.error("Update polling failed:", err);
    return [];
  }
}
