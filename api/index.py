import os
import sys

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from server import app

# Export ASGI app for Vercel Serverless Python Execution
handler = app
