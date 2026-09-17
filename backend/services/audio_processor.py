"""
Audio preprocessing: format conversion, normalization, acoustic feature extraction.
Uses librosa + soundfile. Falls back to pydub for exotic formats.
"""
import os
import subprocess
import numpy as np
import soundfile as sf
import librosa
from pathlib import Path


def _convert_with_ffmpeg(input_path: str, output_path: str, sr: int = 16000) -> bool:
    """Convert any audio format to 16kHz mono WAV using FFmpeg."""
    try:
        cmd = [
            "ffmpeg", "-y", "-i", input_path,
            "-ar", str(sr), "-ac", "1", "-sample_fmt", "s16",
            output_path
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=120)
        return result.returncode == 0 and os.path.exists(output_path)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def extract_acoustic_features(y: np.ndarray, sr: int = 16000) -> dict:
    """
    Extracts real acoustic properties from audio signal:
    - Tempo (BPM) & beat strength
    - Frequency band distribution (Bass, Mid, Treble)
    - Harmonic vs Percussive ratio
    - Spectral centroid (brightness)
    - RMS Energy Level
    """
    features = {
        "bpm": 0.0,
        "rhythm_strength": "Unknown",
        "harmonic_ratio": 0.0,
        "is_musical": False,
        "frequency_distribution": {
            "bass_percent": 0.0,
            "mid_percent": 0.0,
            "treble_percent": 0.0,
        },
        "rms_energy": 0.0,
        "spectral_brightness": "Unknown",
    }

    if y is None or len(y) < sr * 0.5:
        return features

    try:
        # RMS Energy
        rms = float(np.mean(librosa.feature.rms(y=y)))
        features["rms_energy"] = round(rms, 6)

        # Tempo & Rhythm
        tempo_result = librosa.beat.beat_track(y=y, sr=sr)
        tempo = tempo_result[0]
        if isinstance(tempo, np.ndarray):
            tempo = float(tempo[0]) if len(tempo) > 0 else 0.0
        else:
            tempo = float(tempo)
        features["bpm"] = round(tempo, 1)

        if tempo > 130:
            features["rhythm_strength"] = "Fast / Energetic"
        elif tempo > 90:
            features["rhythm_strength"] = "Moderate / Rhythmic"
        elif tempo > 0:
            features["rhythm_strength"] = "Slow / Ambient"
        else:
            features["rhythm_strength"] = "Non-rhythmic"

        # Harmonic-to-Percussive Separation
        try:
            y_harm, y_perc = librosa.effects.hpss(y)
            harm_power = float(np.sum(y_harm ** 2))
            perc_power = float(np.sum(y_perc ** 2))
            total_power = harm_power + perc_power + 1e-8
            harm_ratio = harm_power / total_power
            features["harmonic_ratio"] = round(harm_ratio, 3)
            features["is_musical"] = harm_ratio > 0.55 or tempo > 60
        except Exception:
            pass

        # Frequency Band Distribution (STFT)
        try:
            spec = np.abs(librosa.stft(y))
            freqs = librosa.fft_frequencies(sr=sr)

            bass_mask = (freqs >= 20) & (freqs < 250)
            mid_mask = (freqs >= 250) & (freqs < 4000)
            treble_mask = freqs >= 4000

            bass_energy = float(np.sum(spec[bass_mask, :])) if np.any(bass_mask) else 0.0
            mid_energy = float(np.sum(spec[mid_mask, :])) if np.any(mid_mask) else 0.0
            treble_energy = float(np.sum(spec[treble_mask, :])) if np.any(treble_mask) else 0.0

            total = bass_energy + mid_energy + treble_energy + 1e-8
            features["frequency_distribution"] = {
                "bass_percent": round((bass_energy / total) * 100, 1),
                "mid_percent": round((mid_energy / total) * 100, 1),
                "treble_percent": round((treble_energy / total) * 100, 1),
            }
        except Exception:
            pass

        # Spectral Centroid
        try:
            cent = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
            if cent > 3000:
                features["spectral_brightness"] = "Bright / High Pitch"
            elif cent > 1500:
                features["spectral_brightness"] = "Standard / Vocal Range"
            else:
                features["spectral_brightness"] = "Deep / Low Pitch"
        except Exception:
            pass

    except Exception as e:
        print(f"[AudioProcessor] Feature extraction error: {e}")

    return features


def preprocess_audio(file_path: str) -> tuple[str, float, dict]:
    """
    Decodes audio → 16kHz mono WAV, extracts acoustic features.
    Returns (processed_wav_path, duration_seconds, acoustic_features).
    """
    base, ext = os.path.splitext(file_path)
    processed_path = base + "_processed.wav"
    y = None
    sr = 16000

    # Strategy 1: FFmpeg conversion (handles all formats)
    if ext.lower() not in (".wav",):
        if _convert_with_ffmpeg(file_path, processed_path, sr):
            try:
                y, sr = sf.read(processed_path)
                if len(y.shape) > 1:
                    y = np.mean(y, axis=1)
                y = y.astype(np.float32)
            except Exception:
                y = None

    # Strategy 2: Direct soundfile read
    if y is None:
        try:
            data, file_sr = sf.read(file_path)
            if len(data.shape) > 1:
                data = np.mean(data, axis=1)
            if file_sr != sr:
                y = librosa.resample(data.astype(np.float32), orig_sr=file_sr, target_sr=sr)
            else:
                y = data.astype(np.float32)
        except Exception:
            pass

    # Strategy 3: librosa load
    if y is None:
        try:
            y, _ = librosa.load(file_path, sr=sr, mono=True)
        except Exception:
            pass

    # Strategy 4: pydub fallback
    if y is None:
        try:
            from pydub import AudioSegment
            audio = AudioSegment.from_file(file_path)
            audio = audio.set_frame_rate(sr).set_channels(1)
            raw_data = np.array(audio.get_array_of_samples(), dtype=np.float32)
            y = raw_data / float(1 << (8 * audio.sample_width - 1))
        except Exception as e:
            print(f"[AudioProcessor] All decoding strategies failed: {e}")

    if y is not None:
        # Normalize amplitude
        max_val = np.max(np.abs(y))
        if max_val > 0:
            y = y / max_val * 0.95

        duration = float(len(y) / sr)
        sf.write(processed_path, y, sr)

        features = extract_acoustic_features(y, sr)
        return processed_path, duration, features
    else:
        return file_path, 0.0, extract_acoustic_features(np.array([]))


def get_waveform_data(file_path: str, num_points: int = 200) -> list[float]:
    """Generate downsampled waveform data for frontend visualization."""
    try:
        y, sr = sf.read(file_path)
        if len(y.shape) > 1:
            y = np.mean(y, axis=1)
        # Downsample to num_points
        if len(y) > num_points:
            chunk_size = len(y) // num_points
            waveform = []
            for i in range(num_points):
                chunk = y[i * chunk_size: (i + 1) * chunk_size]
                waveform.append(float(np.max(np.abs(chunk))))
            return waveform
        return [float(abs(v)) for v in y]
    except Exception:
        return []
