"""
Speaker analysis using spectral feature clustering.
Provides speaker count estimation and segment-level speaker assignment.
Confidence levels are honestly reported.
"""
import numpy as np
import librosa
import soundfile as sf


def analyze_speakers(audio_path: str, speech_segments: list[dict]) -> dict:
    """
    Analyze speakers in audio using MFCC-based spectral clustering.
    
    Returns {
        "num_speakers": int,
        "confidence": str,  # "High", "Moderate", "Low", "Uncertain"
        "speakers": [{"speaker_id": str, "label": str, "total_duration": float, "segment_count": int, "confidence": str}],
        "segments_with_speakers": [{"start": float, "end": float, "text": str, "speaker": str}],
        "note": str
    }
    """
    result = {
        "num_speakers": 0,
        "confidence": "Uncertain",
        "speakers": [],
        "segments_with_speakers": [],
        "note": "",
    }

    if not speech_segments:
        result["note"] = "No speech segments detected for speaker analysis."
        return result

    try:
        y, sr = sf.read(audio_path)
        if len(y.shape) > 1:
            y = np.mean(y, axis=1)
        y = y.astype(np.float32)
    except Exception as e:
        result["note"] = f"Could not load audio for speaker analysis: {e}"
        return result

    # Extract MFCC features per speech segment
    segment_features = []
    valid_segments = []

    for seg in speech_segments:
        start_sample = int(seg["start"] * sr)
        end_sample = int(seg["end"] * sr)

        if start_sample >= len(y) or end_sample <= start_sample:
            continue

        end_sample = min(end_sample, len(y))
        segment_audio = y[start_sample:end_sample]

        if len(segment_audio) < sr * 0.3:  # Too short for analysis
            continue

        try:
            mfccs = librosa.feature.mfcc(y=segment_audio, sr=sr, n_mfcc=13)
            # Use mean and std of MFCCs as segment-level features
            feat = np.concatenate([np.mean(mfccs, axis=1), np.std(mfccs, axis=1)])
            segment_features.append(feat)
            valid_segments.append(seg)
        except Exception:
            continue

    if not segment_features:
        result["note"] = "Insufficient audio data for reliable speaker analysis."
        result["num_speakers"] = 1 if speech_segments else 0
        result["confidence"] = "Low"
        # Assign all segments to Speaker 1
        for seg in speech_segments:
            result["segments_with_speakers"].append({
                "start": seg["start"],
                "end": seg["end"],
                "text": seg.get("text", ""),
                "speaker": "Speaker 1",
                "confidence": "Low",
            })
        if speech_segments:
            result["speakers"] = [{
                "speaker_id": "spk_1",
                "label": "Speaker 1",
                "total_duration": sum(s["end"] - s["start"] for s in speech_segments),
                "segment_count": len(speech_segments),
                "confidence": "Low",
            }]
        return result

    feature_matrix = np.array(segment_features)

    # Estimate number of speakers using silhouette analysis
    from sklearn.cluster import AgglomerativeClustering
    from sklearn.preprocessing import StandardScaler

    scaler = StandardScaler()
    features_scaled = scaler.fit_transform(feature_matrix)

    if len(features_scaled) < 2:
        # Only one segment — can't cluster
        num_speakers = 1
        labels = [0]
        confidence = "Low — single segment analyzed"
    else:
        # Try 2–4 clusters and pick best silhouette
        from sklearn.metrics import silhouette_score

        best_score = -1
        best_n = 1
        best_labels = np.zeros(len(features_scaled), dtype=int)

        max_clusters = min(4, len(features_scaled))

        for n in range(2, max_clusters + 1):
            try:
                clustering = AgglomerativeClustering(n_clusters=n)
                cluster_labels = clustering.fit_predict(features_scaled)
                score = silhouette_score(features_scaled, cluster_labels)
                if score > best_score:
                    best_score = score
                    best_n = n
                    best_labels = cluster_labels
            except Exception:
                continue

        # Decide based on silhouette score
        if best_score < 0.15:
            # Low separation — likely single speaker or unreliable
            num_speakers = 1
            labels = [0] * len(features_scaled)
            confidence = "Uncertain — low spectral separation between segments"
        elif best_score < 0.35:
            num_speakers = best_n
            labels = best_labels.tolist()
            confidence = "Low"
        elif best_score < 0.55:
            num_speakers = best_n
            labels = best_labels.tolist()
            confidence = "Moderate"
        else:
            num_speakers = best_n
            labels = best_labels.tolist()
            confidence = "High"

    result["num_speakers"] = num_speakers
    result["confidence"] = confidence

    # Build speaker stats
    speaker_durations = {}
    speaker_counts = {}

    for seg, label in zip(valid_segments, labels):
        spk = f"Speaker {label + 1}"
        duration = seg["end"] - seg["start"]
        speaker_durations[spk] = speaker_durations.get(spk, 0.0) + duration
        speaker_counts[spk] = speaker_counts.get(spk, 0) + 1

        result["segments_with_speakers"].append({
            "start": seg["start"],
            "end": seg["end"],
            "text": seg.get("text", ""),
            "speaker": spk,
            "confidence": confidence,
        })

    for spk in sorted(speaker_durations.keys()):
        result["speakers"].append({
            "speaker_id": f"spk_{spk.split()[-1]}",
            "label": spk,
            "total_duration": round(speaker_durations[spk], 2),
            "segment_count": speaker_counts[spk],
            "confidence": confidence,
        })

    # Remaining segments not clustered
    clustered_starts = {(s["start"], s["end"]) for s in valid_segments}
    for seg in speech_segments:
        key = (seg["start"], seg["end"])
        if key not in clustered_starts:
            result["segments_with_speakers"].append({
                "start": seg["start"],
                "end": seg["end"],
                "text": seg.get("text", ""),
                "speaker": "Speaker 1",
                "confidence": "Low",
            })

    result["note"] = (
        f"Speaker analysis performed using MFCC-based spectral clustering. "
        f"Estimated {num_speakers} speaker(s) with {confidence} confidence. "
        f"For production-grade diarization, pyannote.audio is recommended."
    )

    return result
