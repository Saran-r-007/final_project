import requests
import json
import time

def test_full_pipeline():
    url_upload = "http://localhost:8000/api/upload"
    url_analyze = "http://localhost:8000/api/analyze"

    from pathlib import Path
    sample_file = Path(__file__).resolve().parent.parent / "public" / "samples" / "emergency_siren.wav"
    with open(sample_file, "rb") as f:
        files = {"file": ("emergency_siren.wav", f, "audio/wav")}
        r = requests.post(url_upload, files=files)
    
    assert r.status_code == 200, f"Upload failed: {r.text}"
    audio_id = r.json()["audio_id"]
    print(f"[Test] Uploaded. Audio ID: {audio_id}")

    print("[Test] Starting deep learning analysis...")
    r = requests.post(url_analyze, json={"audio_id": audio_id})
    assert r.status_code == 200, f"Analyze start failed: {r.text}"
    job_id = r.json()["job_id"]
    print(f"[Test] Job created: {job_id}")

    print("[Test] Polling pipeline progress...")
    for i in range(40):
        time.sleep(2)
        r = requests.get(f"http://localhost:8000/api/status/{job_id}")
        data = r.json()
        print(f"[{i*2}s] Progress: {data.get('progress')}% - Step: {data.get('current_step')}")
        
        if data.get("status") == "COMPLETED":
            analysis_id = data.get("analysis_id")
            print(f"[Test] Pipeline COMPLETED! Analysis ID: {analysis_id}")
            
            # Fetch report
            rep_res = requests.get(f"http://localhost:8000/api/results/{analysis_id}")
            report = rep_res.json()
            print("\n=== VERIFIED REAL AI REPORT METRICS ===")
            print(f"File: {report.get('audio_info', {}).get('filename')}")
            print(f"Duration: {report.get('audio_info', {}).get('duration')}s")
            print(f"Risk Score: {report.get('risk_score', {}).get('score')}/100 ({report.get('risk_score', {}).get('severity')})")
            print(f"Explanation: {report.get('risk_score', {}).get('explanation')}")
            print(f"Executive Summary: {report.get('final_ai_summary')}")
            return True
        elif data.get("status") == "FAILED":
            print(f"[Test] Job Failed: {data.get('error')}")
            return False
            
    print("[Test] Timeout waiting for pipeline completion.")
    return False

if __name__ == "__main__":
    test_full_pipeline()
