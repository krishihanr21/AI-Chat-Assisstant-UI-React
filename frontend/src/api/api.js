export const API_BASE_URL = "";

export async function postQuery(input, userId, sessionId, questionId, trainingMode) {
  console.log("Publishing query...");
  const response = await fetch(`${API_BASE_URL}/api/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      user_id: userId,
      session_id: sessionId,
      question_id: questionId,
      training_mode: trainingMode,
    }),
  });
  if (!response.ok) throw new Error("Failed to publish query");
  return response.json();
}

export async function pollUpdates(userId, sessionId, questionId) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/poll?user_id=${userId}&session_id=${sessionId}&question_id=${questionId}`
    );
    if (!response.ok) throw new Error(`Error: ${response.status}`);
    const data = await response.json();
    return { messages: data.messages || [] };
  } catch (error) {
    console.error("Polling error:", error);
    return { messages: [] };
  }
}
