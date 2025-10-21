export const API_BASE_URL = "http://127.0.0.1:8000";


export async function postQuery(input, userId, sessionId) {
try {
// const response = await fetch(`${API_BASE_URL}/query`, {
const response = await fetch(`/query`, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ input, user_id: userId, session_id: sessionId })
});
if (!response.ok) throw new Error(`Error: ${response.status}`);
const data = await response.json();
    console.log("🔍 Backend returned:", data); // 👈 this will show actual keys
    return data;
  } catch (error) {
    console.error("Query failed:", error);
    throw error;
}
}