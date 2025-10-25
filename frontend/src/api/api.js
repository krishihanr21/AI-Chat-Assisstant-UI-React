export const API_BASE_URL = "http://localhost:8000";

export async function postQuery(input, userId, sessionId, questionId) {
  console.log("Publishing query...");
  const response = await fetch(`${API_BASE_URL}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      user_id: userId,
      session_id: sessionId,
      question_id: questionId,
    }),
  });
  if (!response.ok) throw new Error("Failed to publish query");
  return response.json();
}

export async function pollUpdates(userId, sessionId) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/poll?user_id=${userId}&session_id=${sessionId}`
    );
    if (!response.ok) throw new Error(`Error: ${response.status}`);
    const data = await response.json();
    return { messages: data.messages || [] };
  } catch (error) {
    console.error("Polling error:", error);
    return { messages: [] };
  }
}
