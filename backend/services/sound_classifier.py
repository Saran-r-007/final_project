"""
Environmental and human sound classification using MIT/AST AudioSet model.
Processes audio in sliding windows for temporal localization of sound events.
"""
import os
import numpy as np
import soundfile as sf

_sound_pipeline = None

# Category mappings for detected sound labels
CATEGORY_MAPPINGS = {
    "EMERGENCY": [
        "alarm", "siren", "screaming", "shriek", "shout", "yell", "explosion",
        "gunshot", "gunfire", "machine gun", "artillery", "glass", "breaking",
        "shatter", "crying", "sobbing", "groan", "wail", "whimper", "emergency vehicle",
        "police car", "ambulance", "fire engine", "fire alarm", "smoke detector",
        "smoke alarm", "car alarm", "buzzer", "foghorn", "bang", "crash", "smash",
        "police whistle", "referee whistle",
    ],
    "HUMAN": [
        "speech", "conversation", "narration", "whispering", "laughter", "giggle",
        "applause", "clapping", "cough", "throat clearing", "sigh", "sneeze",
        "breathing", "hiccup", "burping", "crying", "screaming", "shout",
        "singing", "humming", "whistling",
    ],
    "CLASSROOM_OFFICE": [
        "typing", "computer keyboard", "drawer", "fan", "air conditioning",
        "ventilation", "telephone", "bell", "door", "footsteps",
    ],
    "MUSIC": [
        "music", "singing", "song", "musical instrument", "guitar", "electric guitar",
        "acoustic guitar", "piano", "drum", "drum kit", "snare drum", "bass guitar",
        "synthesizer", "orchestra", "brass instrument", "plucked string instrument",
        "electronic music", "pop music", "rock music", "hip hop music", "vocal music",
        "choir", "rapping", "beatboxing", "violin", "flute", "harmonica",
    ],
    "NATURE_WEATHER": [
        "rain", "raindrop", "thunderstorm", "thunder", "wind", "water", "stream",
        "ocean", "waves", "waterfall", "bird", "bird vocalization", "chirp", "tweet",
        "animal", "dog", "bark", "howl", "cat", "meow", "insect", "cricket",
        "frog", "rooster", "crow",
    ],
    "VEHICLE_TRANSPORT": [
        "traffic noise", "motor vehicle", "car", "engine", "vehicle horn",
        "honk", "train", "rail transport", "railroad car", "airplane", "aircraft",
        "bus", "truck", "motorcycle", "subway", "metro", "heavy machinery",
        "bicycle", "skateboard",
    ],
    "DOMESTIC": [
        "door", "doorbell", "knock", "footsteps", "keys", "lock",
        "dishes", "cutlery", "microwave", "blender", "vacuum cleaner",
        "washing machine", "toilet", "water tap", "shower",
    ],
}

# Specific labels considered "human sounds" vs "environmental"
HUMAN_SOUND_LABELS = set()
for lbl in CATEGORY_MAPPINGS.get("HUMAN", []):
    HUMAN_SOUND_LABELS.add(lbl)

ENVIRONMENTAL_CATEGORIES = {"NATURE_WEATHER", "VEHICLE_TRANSPORT", "DOMESTIC", "CLASSROOM_OFFICE"}


def categorize_sound_label(label: str) -> str:
    lbl_lower = label.lower()
    for category, keywords in CATEGORY_MAPPINGS.items():
        if any(k in lbl_lower for k in keywords):
            return category
    return "GENERAL_SOUND"


def is_human_sound(label: str) -> bool:
    lbl_lower = label.lower()
    return any(h in lbl_lower for h in HUMAN_SOUND_LABELS)


def is_environmental_sound(label: str) -> bool:
    cat = categorize_sound_label(label)
    return cat in ENVIRONMENTAL_CATEGORIES


def _get_sound_pipeline():
    """Lazy-load MIT/AST AudioSet classification model."""
    global _sound_pipeline
    if _sound_pipeline is None:
        from transformers import pipeline
        _sound_pipeline = pipeline(
            "audio-classification",
            model="MIT/ast-finetuned-audioset-10-10-0.4593",
        )
        print("[SoundClassifier] MIT/AST model loaded")
    return _sound_pipeline


def classify_full_audio(audio_path: str) -> list[dict]:
    """Classify the entire audio file at once — returns top sound events."""
    try:
        pipe = _get_sound_pipeline()
        audio_data, sr = sf.read(audio_path)
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)

        results = pipe({"raw": audio_data.astype(np.float32), "sampling_rate": sr})

        sounds = []
        for res in results[:10]:
            score = float(res.get("score", 0))
            if score > 0.03:
                label = res.get("label", "")
                category = categorize_sound_label(label)
                sounds.append({
                    "label": label,
                    "confidence": round(score, 4),
                    "category": category,
                })
        return sounds
    except Exception as e:
        print(f"[SoundClassifier] Full classification error: {e}")
        return []


def classify_windowed(audio_path: str, window_sec: float = 2.0, hop_sec: float = 1.0) -> list[dict]:
    """
    Classify audio in sliding windows for temporal localization.
    Returns events with start/end timestamps.
    """
    try:
        pipe = _get_sound_pipeline()
        audio_data, sr = sf.read(audio_path)
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)
        audio_data = audio_data.astype(np.float32)

        duration = len(audio_data) / sr
        window_samples = int(window_sec * sr)
        hop_samples = int(hop_sec * sr)

        # Track detected events with temporal info
        event_tracker = {}  # label -> list of (start, end, confidence)

        offset = 0
        while offset < len(audio_data):
            end = min(offset + window_samples, len(audio_data))
            chunk = audio_data[offset:end]

            if len(chunk) < sr * 0.5:
                break

            try:
                results = pipe({"raw": chunk, "sampling_rate": sr})
                start_time = offset / sr
                end_time = end / sr

                for res in results[:10]:
                    score = float(res.get("score", 0))
                    if score > 0.03:
                        label = res.get("label", "")
                        if label not in event_tracker:
                            event_tracker[label] = []
                        event_tracker[label].append((start_time, end_time, score))
            except Exception:
                pass

            offset += hop_samples

        # Merge consecutive windows for same label
        events = []
        for label, windows in event_tracker.items():
            if not windows:
                continue

            # Sort by start time
            windows.sort(key=lambda x: x[0])

            # Merge overlapping/adjacent windows
            merged = []
            current_start, current_end, scores = windows[0][0], windows[0][1], [windows[0][2]]

            for start, end, score in windows[1:]:
                if start <= current_end + hop_sec:
                    current_end = max(current_end, end)
                    scores.append(score)
                else:
                    merged.append((current_start, current_end, scores))
                    current_start, current_end, scores = start, end, [score]

            merged.append((current_start, current_end, scores))

            for start, end, scores in merged:
                avg_conf = float(np.mean(scores))
                max_conf = float(np.max(scores))
                category = categorize_sound_label(label)
                events.append({
                    "label": label,
                    "confidence": round(max_conf, 4),
                    "avg_confidence": round(avg_conf, 4),
                    "category": category,
                    "start": round(start, 2),
                    "end": round(end, 2),
                    "window_count": len(scores),
                })

        # Sort by confidence descending
        events.sort(key=lambda x: x["confidence"], reverse=True)
        return events

    except Exception as e:
        print(f"[SoundClassifier] Windowed classification error: {e}")
        return classify_full_audio(audio_path)


def detect_sounds(audio_path: str) -> dict:
    """
    Main entry point: runs both full and windowed classification.
    Separates results into human sounds and environmental sounds.
    """
    # Full audio classification for overall sound profile
    full_sounds = classify_full_audio(audio_path)

    # Windowed classification for temporal events
    windowed_events = classify_windowed(audio_path)

    # Separate into categories
    human_sounds = []
    environmental_sounds = []
    all_events = []

    # Process windowed events (preferred — they have timestamps)
    seen_labels = set()
    for evt in windowed_events:
        label = evt["label"]
        if label in seen_labels:
            continue
        seen_labels.add(label)

        if is_human_sound(label):
            human_sounds.append(evt)
        if is_environmental_sound(label):
            environmental_sounds.append(evt)
        all_events.append(evt)

    # Add any full-audio labels not captured by windowed
    for snd in full_sounds:
        if snd["label"] not in seen_labels:
            seen_labels.add(snd["label"])
            if is_human_sound(snd["label"]):
                human_sounds.append(snd)
            if is_environmental_sound(snd["label"]):
                environmental_sounds.append(snd)
            all_events.append(snd)

    return {
        "all_events": all_events,
        "human_sounds": human_sounds,
        "environmental_sounds": environmental_sounds,
        "full_profile": full_sounds,
    }
