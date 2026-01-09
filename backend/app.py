from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64
import os
import uvicorn
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load environment variables
load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini Client
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("Warning: GEMINI_API_KEY not found in environment variables.")

client = genai.Client(api_key=api_key)

class AnalyzeRequest(BaseModel):
    image: str

@app.post("/api/analyze")
async def analyze_image(request: AnalyzeRequest):
    try:
        if not request.image:
            raise HTTPException(status_code=400, detail="No image data provided")

        # Decode base64 image
        try:
            image_bytes = base64.b64decode(request.image)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 image data")

        # Create the prompt
        prompt_text = """You are ChalkX, a smart Blackboard AI assistant. Your goal is to help users with whatever is written or drawn on the blackboard.
        
        Analyze the content of the image (which represents the blackboard):
        1. If it contains a greeting (like "Hi", "Hello"), respond politely and ask how you can help (e.g., "Hi! I'm ChalkX. How can I assist you?").
        2. If it contains a math problem, solve it step-by-step. ALWAYS use LaTeX for math formulas (wrap them in $ for inline and $$ for block).
        3. If it contains a question, answer it directly.
        4. If it contains diagrams, explain them.
        5. If it contains text, engage with it meaningfully.
        
        Do NOT start with "The image contains..." or "Analysis result:". Respond directly to the user.
        Format your response in Markdown, using LaTeX for any mathematical expressions."""

        # Generate content
        # Using the simplified API where possible, or constructing Content objects
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_text(text=prompt_text),
                        types.Part.from_bytes(data=image_bytes, mime_type="image/png")
                    ]
                )
            ],
            config=types.GenerateContentConfig(
                temperature=0.5,
                top_p=0.95,
                top_k=40,
                max_output_tokens=8192,
                response_mime_type="text/plain",
            )
        )
        
        return {"result": response.text}

    except Exception as e:
        print(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)
