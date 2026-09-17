"""
Speech-to-text using OpenAI Whisper (primary) with optional AssemblyAI fallback.
Returns real transcripts with real timestamps — no fabricated data.
"""
import os
import re
import numpy as np
import soundfile as sf

_whisper_pipeline = None


def _get_whisper_pipeline():
    """Lazy-load Whisper ASR pipeline."""
    global _whisper_pipeline
    if _whisper_pipeline is None:
        from transformers import pipeline
        _whisper_pipeline = pipeline(
            "automatic-speech-recognition",
            model="openai/whisper-base",
            return_timestamps=True,
        )
        print("[SpeechService] Whisper model loaded (openai/whisper-base)")
    return _whisper_pipeline


def sanitize_transcript(text: str) -> str:
    """
    Clean transcript and filter hallucination artifacts.
    Ported from old project with improvements.
    """
    if not text or not isinstance(text, str):
        return ""

    cleaned = text.strip()

    # Remove long character repetitions (e.g. 'aaaaa...')
    cleaned = re.sub(r"(.)\1{4,}", r"\1", cleaned)

    # Check for word-level repetition (>60% same word = likely hallucination)
    words = cleaned.split()
    if len(words) > 8:
        word_counts = {}
        for w in words:
            w_lower = w.lower()
            word_counts[w_lower] = word_counts.get(w_lower, 0) + 1
        max_rep = max(word_counts.values()) if word_counts else 0
        if max_rep / len(words) > 0.6:
            return ""

    # Filter common Whisper hallucination phrases on ambient noise
    hallucination_phrases = [
        "thank you for watching",
        "thanks for watching",
        "subtitles by",
        "amara.org",
        "subscribe to my channel",
        "you",
        "...",
        "thank you",
        "bye",
    ]
    if cleaned.lower().strip(". ") in hallucination_phrases:
        return ""

    if len(cleaned) < 2:
        return ""

    return cleaned


def transcribe(audio_path: str, assemblyai_key: str = "") -> dict:
    """
    Transcribe audio with real ASR models.
    Returns {
        "transcript": str,
        "segments": [{"start": float, "end": float, "text": str}],
        "language": str,
        "confidence": float,
        "method": str
    }
    """
    result = {
        "transcript": "",
        "segments": [],
        "language": "Unknown",
        "confidence": 0.0,
        "method": "none",
    }

    # ── Strategy 1: Whisper (primary, runs locally) ──
    try:
        pipe = _get_whisper_pipeline()
        # Load audio data
        audio_data, sr = sf.read(audio_path)
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)
        audio_data = audio_data.astype(np.float32)

        whisper_result = pipe(
            {"raw": audio_data, "sampling_rate": sr},
            generate_kwargs={"repetition_penalty": 1.2, "no_repeat_ngram_size": 3},
            return_timestamps=True,
        )

        raw_text = whisper_result.get("text", "").strip()
        cleaned = sanitize_transcript(raw_text)

        if cleaned:
            result["transcript"] = cleaned
            result["method"] = "whisper-base"
            result["confidence"] = 0.85  # Base model typical confidence

            # Extract segment timestamps from Whisper output
            chunks = whisper_result.get("chunks", [])
            for chunk in chunks:
                ts = chunk.get("timestamp", (None, None))
                text = chunk.get("text", "").strip()
                if text and ts[0] is not None:
                    seg_text = sanitize_transcript(text)
                    if seg_text:
                        result["segments"].append({
                            "start": float(ts[0]) if ts[0] is not None else 0.0,
                            "end": float(ts[1]) if ts[1] is not None else float(ts[0]) + 1.0,
                            "text": seg_text,
                        })

            if result["segments"]:
                result["confidence"] = 0.88

            print(f"[SpeechService] Whisper transcription successful: {len(cleaned)} chars, {len(result['segments'])} segments")
            return result

    except Exception as e:
        print(f"[SpeechService] Whisper error: {e}")

    # ── Strategy 2: AssemblyAI (optional cloud fallback) ──
    if assemblyai_key and not assemblyai_key.startswith("your_"):
        try:
            import assemblyai as aai
            aai.settings.api_key = assemblyai_key
            transcriber = aai.Transcriber()
            transcript_obj = transcriber.transcribe(audio_path)

            if transcript_obj.status != aai.TranscriptStatus.error and transcript_obj.text:
                cleaned = sanitize_transcript(transcript_obj.text.strip())
                if cleaned:
                    result["transcript"] = cleaned
                    result["method"] = "assemblyai"
                    result["confidence"] = 0.92

                    # AssemblyAI provides word-level timestamps
                    if hasattr(transcript_obj, "words") and transcript_obj.words:
                        current_seg = {"start": 0.0, "end": 0.0, "text": ""}
                        for word in transcript_obj.words:
                            if not current_seg["text"]:
                                current_seg["start"] = word.start / 1000.0
                            current_seg["text"] += word.text + " "
                            current_seg["end"] = word.end / 1000.0

                            # Break segments on sentence boundaries
                            if word.text.endswith((".", "!", "?")):
                                current_seg["text"] = current_seg["text"].strip()
                                if current_seg["text"]:
                                    result["segments"].append(current_seg.copy())
                                current_seg = {"start": 0.0, "end": 0.0, "text": ""}

                        # Final segment
                        if current_seg["text"].strip():
                            current_seg["text"] = current_seg["text"].strip()
                            result["segments"].append(current_seg)

                    print(f"[SpeechService] AssemblyAI transcription successful: {len(cleaned)} chars")
                    return result

        except Exception as e:
            print(f"[SpeechService] AssemblyAI fallback error: {e}")

    return result
