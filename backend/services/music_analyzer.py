"""
Music analysis using librosa.
Detects musical content, estimates key/tempo/genre from real spectral features.
"""
import numpy as np
import librosa
import soundfile as sf


# Key names for chroma-based key estimation
KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def analyze_music(audio_path: str, acoustic_features: dict = None) -> dict:
    """
    Analyze musical properties of the audio.
    
    Returns {
        "is_music": bool,
        "confidence": float,
        "bpm": float,
        "estimated_key": str,
        "estimated_scale": str,
        "harmonic_ratio": float,
        "rhythm_strength": str,
        "genre_estimate": str,
        "spectral_features": dict,
        "note": str
    }
    """
    result = {
        "is_music": False,
        "confidence": 0.0,
        "bpm": 0.0,
        "estimated_key": "Unknown",
        "estimated_scale": "Unknown",
        "harmonic_ratio": 0.0,
        "rhythm_strength": "Unknown",
        "genre_estimate": "Unknown",
        "spectral_features": {},
        "note": "",
    }

    try:
        y, sr = sf.read(audio_path)
        if len(y.shape) > 1:
            y = np.mean(y, axis=1)
        y = y.astype(np.float32)

        if len(y) < sr * 1.0:
            result["note"] = "Audio too short for reliable music analysis."
            return result

        # ── Harmonic-Percussive Source Separation ──
        y_harm, y_perc = librosa.effects.hpss(y)
        harm_power = float(np.sum(y_harm ** 2))
        perc_power = float(np.sum(y_perc ** 2))
        total_power = harm_power + perc_power + 1e-8
        harmonic_ratio = harm_power / total_power
        result["harmonic_ratio"] = round(harmonic_ratio, 3)

        # ── Tempo (BPM) ──
        tempo_result = librosa.beat.beat_track(y=y, sr=sr)
        tempo = tempo_result[0]
        if isinstance(tempo, np.ndarray):
            tempo = float(tempo[0]) if len(tempo) > 0 else 0.0
        else:
            tempo = float(tempo)
        result["bpm"] = round(tempo, 1)

        # ── Rhythm Strength ──
        if tempo > 130:
            result["rhythm_strength"] = "Fast / Energetic"
        elif tempo > 90:
            result["rhythm_strength"] = "Moderate / Rhythmic"
        elif tempo > 60:
            result["rhythm_strength"] = "Slow / Ambient"
        else:
            result["rhythm_strength"] = "Non-rhythmic / Ambient"

        # ── Key Estimation (Chroma-based) ──
        try:
            chromagram = librosa.feature.chroma_cqt(y=y_harm, sr=sr)
            chroma_vals = np.mean(chromagram, axis=1)
            key_idx = int(np.argmax(chroma_vals))
            result["estimated_key"] = KEY_NAMES[key_idx]

            # Major vs Minor estimation using Krumhansl-Kessler profiles
            major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
            minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

            # Rotate profiles to each key and correlate
            best_major_corr = -1
            best_minor_corr = -1
            for shift in range(12):
                major_rotated = np.roll(major_profile, shift)
                minor_rotated = np.roll(minor_profile, shift)
                major_corr = float(np.corrcoef(chroma_vals, major_rotated)[0, 1])
                minor_corr = float(np.corrcoef(chroma_vals, minor_rotated)[0, 1])
                if major_corr > best_major_corr:
                    best_major_corr = major_corr
                if minor_corr > best_minor_corr:
                    best_minor_corr = minor_corr

            result["estimated_scale"] = "Major" if best_major_corr > best_minor_corr else "Minor"
        except Exception:
            result["estimated_key"] = "Uncertain"
            result["estimated_scale"] = "Uncertain"

        # ── Music Detection Score ──
        # Combine multiple indicators to determine if this is music
        music_score = 0.0

        # High harmonic ratio suggests melodic content
        if harmonic_ratio > 0.55:
            music_score += 0.3
        if harmonic_ratio > 0.7:
            music_score += 0.2

        # Steady tempo suggests music
        if 60 < tempo < 200:
            music_score += 0.2

        # Spectral flatness (music tends to have lower flatness)
        try:
            flatness = float(np.mean(librosa.feature.spectral_flatness(y=y)))
            if flatness < 0.1:
                music_score += 0.15
            result["spectral_features"]["flatness"] = round(flatness, 4)
        except Exception:
            pass

        # Zero crossing rate (lower for tonal/music)
        try:
            zcr = float(np.mean(librosa.feature.zero_crossing_rate(y)))
            if zcr < 0.1:
                music_score += 0.15
            result["spectral_features"]["zero_crossing_rate"] = round(zcr, 4)
        except Exception:
            pass

        result["confidence"] = round(min(music_score, 1.0), 2)
        result["is_music"] = music_score > 0.45

        # ── Genre Estimation (rough, based on spectral features) ──
        if result["is_music"]:
            try:
                spectral_centroid = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
                spectral_rolloff = float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr)))
                result["spectral_features"]["centroid"] = round(spectral_centroid, 1)
                result["spectral_features"]["rolloff"] = round(spectral_rolloff, 1)

                # Very rough genre heuristics based on acoustic properties
                if harmonic_ratio > 0.75 and tempo < 90:
                    result["genre_estimate"] = "Possible: Classical / Ambient"
                elif harmonic_ratio > 0.6 and 90 < tempo < 130:
                    result["genre_estimate"] = "Possible: Pop / R&B"
                elif perc_power > harm_power and tempo > 120:
                    result["genre_estimate"] = "Possible: Electronic / Hip-Hop"
                elif spectral_centroid > 3000 and tempo > 130:
                    result["genre_estimate"] = "Possible: Rock / Metal"
                elif harmonic_ratio > 0.65 and tempo < 100:
                    result["genre_estimate"] = "Possible: Jazz / Blues"
                else:
                    result["genre_estimate"] = "Uncertain — mixed acoustic profile"

            except Exception:
                result["genre_estimate"] = "Uncertain"

        result["note"] = (
            f"Music analysis based on librosa spectral features. "
            f"{'Musical content detected' if result['is_music'] else 'No strong musical content detected'}. "
            f"Genre estimation is approximate and based on acoustic heuristics."
        )

    except Exception as e:
        result["note"] = f"Music analysis error: {str(e)}"
        print(f"[MusicAnalyzer] Error: {e}")

    return result
