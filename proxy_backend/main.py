from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import pubsub_v1, bigquery, firestore
from google.api_core.exceptions import NotFound
from dotenv import load_dotenv
import os, json

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

load_dotenv()

PROJECT_ID = os.getenv("PROJECT_ID", "fzo-edu-ds")
TOPIC_ID = os.getenv("TOPIC_ID", "socket-to-agent")
SUBSCRIPTION_ID = os.getenv("SUBSCRIPTION_ID", "sub-agent-to-socket")


publisher = pubsub_v1.PublisherClient()
subscriber = pubsub_v1.SubscriberClient()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

frontend_path = os.path.join(os.getcwd(), "static")
static_assets_path = os.path.join(frontend_path, "assets")

if os.path.exists(static_assets_path):
    app.mount("/assets", StaticFiles(directory=static_assets_path), name="assets")
else:
    print(static_assets_path)

@app.get("/api/")
async def root():
    return {"message": "Proxy backend is running"}

db = firestore.Client(database = "user-credentials")

@app.get("/api/user-role")
def get_user_role(email: str = Query(...)):
    try:
        doc_ref = db.collection("config").document("roles")
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=500, detail="Role configuration not found")
        
        data = doc.to_dict()
        admins = data.get("admins", [])
        users = data.get("users", [])

        if email in admins:
            role = "admin"
        elif email in users:
            role = "user"
        else:
            raise HTTPException(status_code=403, detail="Unauthorized user")

        return {"email": email, "role": role}
    except Exception as e:
        print("Error fetching role: ", e)
        raise HTTPException(status_code=500, detail="Error fetchig role data")


@app.post("/api/publish")
async def publish_message(request: Request):
    body = await request.json()
    topic_path = publisher.topic_path(PROJECT_ID, TOPIC_ID)
 
    data_str = json.dumps(body)
    data = data_str.encode("utf-8")

    future = publisher.publish(topic_path, data=data)
    message_id = future.result()
    return {"status": "published", "message_id": message_id}

@app.get("/api/poll")
async def poll_messages(
    user_id: str = None,
    session_id: str = None,
    question_id: str = None
):
    subscription_path = subscriber.subscription_path(PROJECT_ID, SUBSCRIPTION_ID)
    response = subscriber.pull(
        request={"subscription": subscription_path, "max_messages": 30}
    )
 
    messages, ack_ids = [], []
    print(f"[Poll Triggered] user_id={user_id}, session_id={session_id}, question_id={question_id}")
    print(f"Pulled {len(response.received_messages)} messages")

    for msg in response.received_messages:
        data = json.loads(msg.message.data.decode("utf-8"))
        print(f"Raw Message: {data}")

        messages.append(data)

        msg_question_id = data.get("Question") or data.get("question_id")

        if question_id and msg_question_id == question_id:
            print(f"Acking message with Question={msg_question_id}")
            ack_ids.append(msg.ack_id)
        else:
            print(f"Skipping ack for unmatched message (Question={msg_question_id})")

    if ack_ids:
        subscriber.acknowledge(
            request={"subscription": subscription_path, "ack_ids": ack_ids}
        )
        print(f"Acknowledged {len(ack_ids)} message(s)")

    if question_id:
        filtered_messages = [m for m in messages if (m.get("Question") or m.get("question_id") or m.get("q_id")) == question_id]
        # Add cache-control headers to the JSON response
        return JSONResponse(
            content={"messages": filtered_messages, "acked_count": len(ack_ids)},
            headers={"Cache-Control": "no-store, no-cache, must-revalidate"}
        )
    
    # Add cache-control headers to the JSON response
    return JSONResponse(
        content={"messages": messages, "acked_count": len(ack_ids)},
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"}
    )

@app.get("/api/bigquery/{job_id}")
async def get_bigquery_results(job_id: str, location: str = None):
    try:
        client = bigquery.Client(project=PROJECT_ID)

        if not location:
            for job in client.list_jobs(all_users=True, max_results=1000):
                if job.job_id == job_id:
                    location = job.location
                    break
        
        if not location:
            raise HTTPException(status_code=404, detail=f"could not find location for job '{job_id}'")
        
        job = client.get_job(job_id, location=location)
        results = job.result(max_results=20)  # limit rows

        rows = [dict(row) for row in results]

        print(f"[DEBUG] Raw BigQuery results for {job_id}:")
        if rows:
            print(rows[0])

        return {
            "job_id": job_id,
            "location": location,
            "query": job.query,
            "rows": rows[:20],
            "row_count": len(rows),
        }

    except NotFound:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        

@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    index_file = os.path.join(frontend_path, "index.html")
    if os.path.exists(index_file):
        # Add cache-control headers to index.html to prevent stale JS
        return FileResponse(index_file, headers={"Cache-Control": "no-store, no-cache, must-revalidate"})
    
    # Add cache-control headers to the error response
    return JSONResponse(
        status_code=404, 
        content={"error": "index.html not found", "path_checked": index_file},
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"}
    )

