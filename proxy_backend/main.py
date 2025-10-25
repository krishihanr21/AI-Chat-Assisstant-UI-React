from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import pubsub_v1
from dotenv import load_dotenv
import os, json

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

@app.get("/")
async def root():
    return {"message": "Proxy backend is running"}

@app.post("/publish")
async def publish_message(request: Request):
    body = await request.json()
    topic_path = publisher.topic_path(PROJECT_ID, TOPIC_ID)

    data_str = json.dumps(body)
    data = data_str.encode("utf-8")

    future = publisher.publish(topic_path, data=data)
    message_id = future.result()
    return {"status": "published", "message_id": message_id}

@app.get("/poll")
async def poll_messages(user_id: str = None, session_id: str = None):
    subscription_path = subscriber.subscription_path(PROJECT_ID, SUBSCRIPTION_ID)
    response = subscriber.pull(
        request={"subscription": subscription_path, "max_messages": 10}
    )

    messages, ack_ids = [], []
    print(f"[Poll Triggered] user_id={user_id}, session_id={session_id}")
    print(f"Pulled {len(response.received_messages)} messages")
    for msg in response.received_messages:
        data = json.loads(msg.message.data.decode("utf-8"))
        print(f"Raw Message: {data}")
        messages.append(data)
        ack_ids.append(msg.ack_id)

    if ack_ids:
        subscriber.acknowledge(
            request={"subscription": subscription_path, "ack_ids": ack_ids}
        )

    return {"messages": messages}
