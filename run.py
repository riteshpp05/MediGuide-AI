import os
import sys
import subprocess
import webbrowser
import time

def main():
    import sys
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    print("=" * 60)
    print("🩺 Starting MediGuide AI (FastAPI + Modern React 2.0)")
    print("=" * 60)

    # Check if React dist exists
    dist_path = os.path.join("frontend-react", "dist")
    if not os.path.exists(dist_path):
        print("\n🔨 Building React frontend production bundle...")
        npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
        subprocess.run([npm_cmd, "run", "build"], cwd="frontend-react", check=True)
        print("✅ React frontend build complete!\n")

    print("🚀 Launching MediGuide AI Server on http://localhost:8000")
    
    # Optional auto-open browser in 1.5 seconds
    def open_browser():
        time.sleep(1.5)
        webbrowser.open("http://localhost:8000")

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)

if __name__ == "__main__":
    main()
