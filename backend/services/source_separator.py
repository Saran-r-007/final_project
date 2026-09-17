"""
Source separation using Facebook's Demucs (HT-Demucs).
Separates audio into vocals, drums, bass, and other stems.
Falls back gracefully if Demucs is unavailable.
"""
import os
import shutil
import subprocess
from pathlib import Path
from config import settings


def separate_sources(audio_path: str, audio_id: str) -> dict:
    """
    Run Demucs source separation on the audio file.
    
    Returns {
        "performed": bool,
        "stems": [{"name": str, "type": str, "file_path": str, "duration": float}],
        "note": str
    }
    """
    result = {
        "performed": False,
        "stems": [],
        "note": "",
    }

    output_dir = settings.separated_path / audio_id
    output_dir.mkdir(parents=True, exist_ok=True)

    # Try running Demucs via command line
    try:
        cmd = [
            "python", "-m", "demucs",
            "--two-stems", "vocals",  # Separate into vocals + accompaniment
            "-o", str(output_dir),
            "--mp3",  # Output as MP3 for smaller files
            audio_path,
        ]

        print(f"[SourceSeparator] Running Demucs: {' '.join(cmd)}")
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
        )

        if proc.returncode != 0:
            # Try simpler separation
            cmd_simple = [
                "python", "-m", "demucs",
                "-o", str(output_dir),
                audio_path,
            ]
            proc = subprocess.run(
                cmd_simple,
                capture_output=True,
                text=True,
                timeout=300,
            )

        if proc.returncode == 0:
            # Find output stems
            stem_names = {
                "vocals": "Vocals",
                "no_vocals": "Accompaniment",
                "drums": "Drums",
                "bass": "Bass",
                "other": "Other / Background",
            }

            # Demucs outputs to: output_dir/htdemucs/filename/
            for model_dir in output_dir.iterdir():
                if model_dir.is_dir():
                    for track_dir in model_dir.iterdir():
                        if track_dir.is_dir():
                            for stem_file in track_dir.iterdir():
                                stem_key = stem_file.stem.lower()
                                stem_name = stem_names.get(stem_key, stem_key.title())
                                
                                # Copy to a clean location
                                clean_path = output_dir / f"{stem_key}{stem_file.suffix}"
                                shutil.copy2(stem_file, clean_path)
                                
                                result["stems"].append({
                                    "name": stem_name,
                                    "type": stem_key,
                                    "file_path": str(clean_path),
                                    "duration": 0.0,  # Will be filled by caller if needed
                                })

            if result["stems"]:
                result["performed"] = True
                result["note"] = f"Source separation completed with Demucs. {len(result['stems'])} stems extracted."
                print(f"[SourceSeparator] Success: {len(result['stems'])} stems")
            else:
                result["note"] = "Demucs ran but no output stems were found."

        else:
            stderr = proc.stderr[:500] if proc.stderr else "Unknown error"
            result["note"] = f"Demucs source separation failed. This may require additional setup. Error: {stderr}"
            print(f"[SourceSeparator] Demucs error: {stderr}")

    except FileNotFoundError:
        result["note"] = (
            "Demucs is not installed or not accessible. "
            "Install with: pip install demucs. "
            "Source separation was skipped."
        )
        print("[SourceSeparator] Demucs not found")

    except subprocess.TimeoutExpired:
        result["note"] = (
            "Source separation timed out (>5 minutes). "
            "This is expected for long audio files on CPU. "
            "Consider using a GPU for faster processing."
        )
        print("[SourceSeparator] Demucs timed out")

    except Exception as e:
        result["note"] = f"Source separation encountered an error: {str(e)}"
        print(f"[SourceSeparator] Error: {e}")

    return result
