import webbrowser
import threading
import time
import uvicorn
from src.config import HOST, PORT
from src.database import init_db

def open_browser():
    """Waits for server to start and automatically opens the browser."""
    time.sleep(1.5)
    url = f"http://{HOST}:{PORT}"
    print(f"\n[+] Abrindo o painel do Instagram Follow Tracker no seu navegador: {url}")
    webbrowser.open(url)

if __name__ == "__main__":
    # Ensure database is initialized
    init_db()
    print("=" * 60)
    print(" 🚀 INSTAGRAM FOLLOW TRACKER & AI INTELLIGENCE DASHBOARD")
    print(f" 🌐 Servidor iniciado em: http://{HOST}:{PORT}")
    print("=" * 60)

    # Open browser automatically in a separate thread
    threading.Thread(target=open_browser, daemon=True).start()

    # Start FastAPI server
    uvicorn.run("src.app:app", host=HOST, port=PORT, reload=False)
