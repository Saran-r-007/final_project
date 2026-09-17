"""
Google Gemini audio understanding integration.
Used for broad contextual analysis, scene understanding, and final AI summary.
API key is NEVER exposed to frontend, logs, or API responses.
"""
import os
import traceback
from pathlib import Path


def analyze_audio_with_gemini(
    audio_path: str,
    transcript: str = "",
    detected_sounds: list = None,
    acoustic_features: dict = None,
    api_key: str = "",
) -> dict:
    """
    Send audio to Gemini for comprehensive AI understanding.
    
    Returns {
        "context_understanding": str,
        "scene_description": str,
        "gemini_sound_analysis": str,
        "emergency_assessment": str,
        "final_summary": str,
        "available": bool,
        "note": str
    }
    """
    result = {
        "context_understanding": "",
        "scene_description": "",
        "gemini_sound_analysis": "",
        "emergency_assessment": "",
        "final_summary": "",
        "available": False,
        "note": "",
    }

    if not api_key or api_key.startswith("your_"):
        result["note"] = (
            "Gemini API key not configured. Context understanding is based on "
            "local model analysis only. Add GEMINI_API_KEY to backend/.env for "
            "enhanced AI understanding."
        )
        return result

    try:
        from google import genai

        client = genai.Client(api_key=api_key)

        # Upload audio file to Gemini
        audio_file = client.files.upload(file=audio_path)

        # Build analysis prompt
        sound_list = ""
        if detected_sounds:
            sound_list = "\n".join(
                f"- {s.get('label', 'Unknown')} (confidence: {s.get('confidence', 0):.1%}, category: {s.get('category', 'Unknown')})"
                for s in detected_sounds[:15]
            )

        acoustic_info = ""
        if acoustic_features:
            acoustic_info = (
                f"BPM: {acoustic_features.get('bpm', 'N/A')}, "
                f"Rhythm: {acoustic_features.get('rhythm_strength', 'N/A')}, "
                f"Harmonic Ratio: {acoustic_features.get('harmonic_ratio', 'N/A')}, "
                f"Brightness: {acoustic_features.get('spectral_brightness', 'N/A')}"
            )

        prompt = f"""You are an expert audio intelligence analyst. Analyze the provided audio file comprehensively.

Local analysis has already detected:
- Transcript: {transcript if transcript else 'No speech detected'}
- Detected sounds: {sound_list if sound_list else 'None detected by local model'}
- Acoustic properties: {acoustic_info if acoustic_info else 'Not available'}

Provide your analysis in EXACTLY this format (keep each section heading and fill in the content):

=== SCENE DESCRIPTION ===
Describe the acoustic scene, environment, and what appears to be happening in this audio.

=== SOUND ANALYSIS ===
List and describe ALL sounds you can identify in the audio. For each sound, note:
- What the sound is
- Approximate time range
- Your confidence level (High/Medium/Low/Uncertain)
Include sounds the local model may have missed.

=== CONTEXT UNDERSTANDING ===
What is the broader context of this audio? What situation does it represent?
Consider: location type, activity type, time of day indicators, social context.

=== EMERGENCY ASSESSMENT ===
Assess whether this audio contains any emergency, distress, or safety-relevant signals.
Rate: No Emergency / Low Concern / Moderate Concern / High Concern / Critical Emergency
Explain your reasoning.

=== FINAL SUMMARY ===
Provide a comprehensive 3-5 sentence summary of everything detected in this audio.
Be specific about what you found. Do not fabricate details.
If uncertain about anything, explicitly state the uncertainty.

IMPORTANT RULES:
- Only report what you actually detect. Do NOT fabricate or hallucinate sounds, events, or context.
- If you're uncertain, say "Possible" or "Uncertain" — never claim 100% certainty.
- Be specific about timestamps when possible.
- Distinguish between what you're confident about and what's speculative.
"""

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[audio_file, prompt],
        )

        if response and response.text:
            text = response.text

            # Parse sections from response
            sections = {
                "scene_description": "",
                "gemini_sound_analysis": "",
                "context_understanding": "",
                "emergency_assessment": "",
                "final_summary": "",
            }

            current_section = None
            current_content = []

            for line in text.split("\n"):
                line_stripped = line.strip()
                if "SCENE DESCRIPTION" in line_stripped.upper():
                    if current_section and current_content:
                        sections[current_section] = "\n".join(current_content).strip()
                    current_section = "scene_description"
                    current_content = []
                elif "SOUND ANALYSIS" in line_stripped.upper():
                    if current_section and current_content:
                        sections[current_section] = "\n".join(current_content).strip()
                    current_section = "gemini_sound_analysis"
                    current_content = []
                elif "CONTEXT UNDERSTANDING" in line_stripped.upper():
                    if current_section and current_content:
                        sections[current_section] = "\n".join(current_content).strip()
                    current_section = "context_understanding"
                    current_content = []
                elif "EMERGENCY ASSESSMENT" in line_stripped.upper():
                    if current_section and current_content:
                        sections[current_section] = "\n".join(current_content).strip()
                    current_section = "emergency_assessment"
                    current_content = []
                elif "FINAL SUMMARY" in line_stripped.upper():
                    if current_section and current_content:
                        sections[current_section] = "\n".join(current_content).strip()
                    current_section = "final_summary"
                    current_content = []
                elif current_section is not None:
                    if not line_stripped.startswith("==="):
                        current_content.append(line)

            # Capture last section
            if current_section and current_content:
                sections[current_section] = "\n".join(current_content).strip()

            result.update(sections)
            result["available"] = True
            result["note"] = "Gemini audio analysis completed successfully."
            print("[GeminiService] Analysis complete")

        else:
            result["note"] = "Gemini returned an empty response."

    except ImportError:
        result["note"] = "google-genai package not installed. Install with: pip install google-genai"
    except Exception as e:
        error_msg = str(e)
        # Never leak the API key in error messages
        if api_key and api_key in error_msg:
            error_msg = error_msg.replace(api_key, "[REDACTED]")
        result["note"] = f"Gemini analysis error: {error_msg}"
        print(f"[GeminiService] Error: {error_msg}")

    return result
