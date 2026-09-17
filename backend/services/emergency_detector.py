"""
Explainable Emergency & Risk Assessment Engine.
Computes a granular 0-100 risk score based on multi-modal audio evidence:
- Acoustic energy, high pitch, urgency indicators
- AST sound classification labels (screaming, siren, explosion, gunshot, crash, alarm)
- Speech keyword/intent analysis (distress phrases, help calls)
- Gemini contextual insights
Provides full reasoning, evidence list, severity categorization, and recommended actions.
"""
from typing import Optional

# Distress keywords for transcript scanning
DISTRESS_KEYWORDS = [
    "help", "emergency", "call 911", "call the police", "call an ambulance",
    "fire", "gun", "shooting", "hurt", "bleeding", "dying", "attack",
    "danger", "please help", "save me", "intruder", "accident", "crash",
    "choking", "heart attack", "can't breathe", "robbery", "thief",
    "stop it", "get away", "screaming", "run", "trapped"
]

# Granular emergency threat category base weights
EMERGENCY_SOUND_WEIGHTS = {
    # Critical Level Threats (Base points 60-75)
    "gunshot": 75,
    "gunfire": 75,
    "machine gun": 75,
    "artillery": 75,
    "explosion": 75,
    "screaming": 65,
    "shriek": 60,
    "fire alarm": 65,
    "smoke detector": 65,
    "smoke alarm": 65,
    "civil defense siren": 65,
    "siren": 60,
    "emergency vehicle": 55,
    "police car": 55,
    "ambulance": 55,
    "fire engine": 55,

    # High Level Threats (Base points 40-50)
    "car alarm": 45,
    "alarm": 45,
    "crash": 50,
    "smash": 45,
    "shatter": 45,
    "glass": 40,
    "breaking": 35,
    "shout": 40,
    "yell": 40,
    "wail": 40,
    "crying": 35,
    "sobbing": 35,

    # Moderate Level Threats (Base points 25-35)
    "buzzer": 35,
    "foghorn": 35,
    "groan": 30,
    "bang": 30,
    "whimper": 25,
    "police whistle": 35,
    "referee whistle": 30,
}


def assess_emergency(
    sound_events: list[dict],
    transcript: str = "",
    acoustic_features: dict = None,
    gemini_assessment: str = "",
    music_analysis: dict = None,
) -> dict:
    """
    Evaluates audio findings across multiple modalities to produce an explainable
    emergency rating and 0-100 risk score.
    
    Returns:
        is_emergency: bool
        risk_score: dict (score: 0-100, severity, explanation)
        emergency_types: list[dict] (e.g. [{"type": "Sirens / Alarms", "confidence": 0.85}])
        risk_factors: list[dict] (points, factor name, description)
        explainable_ai: {"reasoning": list[str], "evidence": list[str]}
        recommended_response: {"urgency": str, "responders": list[str], "actions": list[str]}
    """
    risk_factors = []
    reasoning = []
    evidence = []
    emergency_types = []
    total_score = 0

    acoustic_features = acoustic_features or {}
    music_analysis = music_analysis or {}

    # 1. Check Sound Events from AST model
    detected_emergency_labels = []
    seen_kws = set()

    for evt in sound_events:
        label = evt.get("label", "").lower()
        conf = float(evt.get("confidence", 0.0))
        category = evt.get("category", "")
        window_count = evt.get("window_count", 1)

        matched_weight = 0
        matched_kw = None

        # Check keyword weight map
        for kw, weight in EMERGENCY_SOUND_WEIGHTS.items():
            if kw in label:
                if weight > matched_weight:
                    matched_weight = weight
                    matched_kw = kw

        # Fallback if categorized as EMERGENCY
        if not matched_kw and category == "EMERGENCY":
            matched_weight = 40
            matched_kw = label

        # If a valid emergency sound was detected by AST (AudioSet conf >= 0.03)
        if matched_kw and conf >= 0.03:
            # Scale points appropriately for AudioSet 527-class softmax distribution
            # where conf 0.03-0.05 is detected, 0.10+ is very strong, 0.25+ is dominant
            scale = min(1.0, 0.60 + 1.6 * conf)
            points = int(round(matched_weight * scale))

            # Deduplicate by keyword to avoid duplicate counts of same sound
            if matched_kw not in seen_kws:
                seen_kws.add(matched_kw)
                detected_emergency_labels.append({
                    "label": evt.get("label", label.title()),
                    "matched_kw": matched_kw,
                    "confidence": conf,
                    "points": points,
                    "window_count": window_count,
                    "start": evt.get("start"),
                    "end": evt.get("end"),
                })

    # Sort detected emergency sounds by base points descending
    detected_emergency_labels.sort(key=lambda x: x["points"], reverse=True)

    # Primary emergency sound contributes 100% of its points; secondary contribute 40%
    for idx, item in enumerate(detected_emergency_labels[:4]):
        item_points = item["points"] if idx == 0 else int(round(item["points"] * 0.40))
        if item_points <= 0:
            continue

        total_score += item_points
        lbl_name = item["label"]
        lbl_conf = item["confidence"]

        time_info = ""
        if item.get("start") is not None and item.get("end") is not None:
            time_info = f" (detected at {item['start']:.1f}s – {item['end']:.1f}s)"

        risk_factors.append({
            "factor": f"Critical Acoustic Event: {lbl_name}",
            "points": item_points,
            "description": f"AST deep neural classifier identified '{lbl_name}' with {lbl_conf:.1%} confidence{time_info}."
        })
        evidence.append(f"Acoustic event: {lbl_name} (confidence: {lbl_conf:.1%}){time_info}")
        emergency_types.append({
            "type": lbl_name,
            "confidence": round(lbl_conf, 2)
        })

    # 2. Check Transcript for Distress Keywords
    if transcript:
        transcript_lower = transcript.lower()
        matched_keywords = []
        for kw in DISTRESS_KEYWORDS:
            if kw in transcript_lower:
                matched_keywords.append(kw)

        if matched_keywords:
            kw_points = min(40, len(matched_keywords) * 15)
            total_score += kw_points
            risk_factors.append({
                "factor": "Distress / Urgent Keywords in Speech",
                "points": kw_points,
                "description": f"Spoken keywords identified in audio transcript: {', '.join(matched_keywords)}."
            })
            evidence.append(f"Spoken distress phrases detected: {', '.join(matched_keywords)}")
            emergency_types.append({
                "type": "Verbal Distress Call",
                "confidence": 0.85
            })

    # 3. Acoustic Profile Modifiers
    rms_energy = float(acoustic_features.get("rms_energy", 0.0))
    brightness = acoustic_features.get("spectral_brightness", "")

    # Elevated RMS loudness: if emergency sound is detected, adds urgency
    if rms_energy > 0.15:
        if detected_emergency_labels:
            rms_pts = 15 if rms_energy > 0.40 else 10
            total_score += rms_pts
            risk_factors.append({
                "factor": "High Acoustic Intensity / Loudness",
                "points": rms_pts,
                "description": f"Elevated acoustic energy (RMS: {rms_energy:.4f}) corroborates an active acoustic disturbance."
            })
            evidence.append(f"High acoustic energy profile (RMS: {rms_energy:.4f})")

    # Persistent temporal presence: sustained alarm/siren over multiple windows
    if detected_emergency_labels:
        max_windows = max([e.get("window_count", 1) for e in detected_emergency_labels], default=1)
        if max_windows >= 2:
            total_score += 10
            risk_factors.append({
                "factor": "Sustained Emergency Sound Duration",
                "points": 10,
                "description": f"Emergency signature was continuously tracked across {max_windows} temporal audio windows."
            })
            evidence.append(f"Persistent emergency acoustic signature (active across {max_windows} windows)")

    # High frequency / scream / alarm profile
    if "Bright" in brightness or "High Pitch" in brightness:
        if detected_emergency_labels:
            total_score += 8
            risk_factors.append({
                "factor": "High-Frequency Spectral Profile",
                "points": 8,
                "description": "Spectral centroid matches characteristic high-frequency siren/alarm resonance."
            })
            evidence.append("High-frequency spectral centroid matching siren/alarm resonance")

    # 4. Music Detection Mitigation (reduce false alarms on musical audio)
    is_music = music_analysis.get("is_music", False)
    if is_music and not detected_emergency_labels and not transcript:
        total_score = 0
        reasoning.append("Acoustic harmonic ratio and rhythmic structure indicate structured music playback rather than ambient distress.")

    # 5. Gemini Context Assessment Integration (when API key is provided)
    if gemini_assessment:
        gemini_lower = gemini_assessment.lower()
        if "critical emergency" in gemini_lower or "high concern" in gemini_lower:
            total_score = max(total_score, 75)
            evidence.append("Gemini ALM context reasoning identified high-severity risk indicators.")
        elif "moderate concern" in gemini_lower:
            total_score = max(total_score, 45)
            evidence.append("Gemini ALM context reasoning identified potential safety concern.")
        elif "no emergency" in gemini_lower and not detected_emergency_labels:
            total_score = min(total_score, 10)
            reasoning.append("Gemini ALM verified standard non-emergency situational context.")

    # Clamp final score strictly between 0 and 100
    final_score = min(100, max(0, total_score))

    # Determine Severity & Emergency Flag
    if is_music and final_score < 30:
        severity = "MUSIC"
        is_emergency = False
        explanation = "Audio analysis detected musical or rhythmic content. No distress or emergency indicators found."
    elif final_score >= 70:
        severity = "CRITICAL"
        is_emergency = True
        explanation = "Immediate high-risk situation detected! Multiple critical acoustic or verbal emergency indicators confirmed."
    elif final_score >= 40:
        severity = "WARNING"
        is_emergency = True
        explanation = "Elevated safety concern. Active siren, alarm, or distress signals detected requiring immediate attention."
    elif final_score >= 15:
        severity = "INFO"
        is_emergency = False
        explanation = "Standard ambient audio with minor acoustic anomalies. No active emergency confirmed."
    else:
        severity = "PEACEFUL"
        is_emergency = False
        explanation = "Quiet, peaceful or normal ambient audio profile with zero emergency signatures."

    # Build Explainable Reasoning
    if is_emergency:
        reasoning.append(f"Risk score evaluated at {final_score}/100 ({severity}) based on {len(risk_factors)} contributing risk factors.")
        if detected_emergency_labels:
            reasoning.append(f"Acoustic models flagged emergency sound signatures: {', '.join([l['label'] for l in detected_emergency_labels])}.")
        if transcript and any(kw in transcript.lower() for kw in DISTRESS_KEYWORDS):
            reasoning.append("Natural language analysis detected urgent verbal cues in transcript.")
    else:
        if not evidence:
            evidence.append("No alarming acoustic frequencies, distress words, or sirens detected.")
        reasoning.append("All acoustic and contextual analysis modules indicate a safe environment.")

    # Determine Recommended Response
    if severity == "CRITICAL":
        urgency = "Immediate (Urgent Dispatch Recommended)"
        responders = ["Emergency Medical Services (EMS)", "Local Police / First Responders", "Facility Security"]
        actions = [
            "Verify location coordinates and verify simulated alert dispatch",
            "Establish two-way audio or visual confirmation if available",
            "Maintain continuous audio recording and timeline monitoring"
        ]
    elif severity == "WARNING":
        urgency = "High (Investigation Required)"
        responders = ["On-site Security / Facility Manager", "Safety Officer"]
        actions = [
            "Review detected timeline events and listen to specific stem segments",
            "Perform immediate safety check at audio monitoring station"
        ]
    elif severity == "INFO":
        urgency = "Low (Informational)"
        responders = ["System Administrator"]
        actions = ["Log event in routine monitoring dashboard"]
    else:
        urgency = "None"
        responders = []
        actions = ["Standard background logging active"]

    return {
        "is_emergency": is_emergency,
        "risk_score": {
            "score": final_score,
            "severity": severity,
            "explanation": explanation
        },
        "emergency_types": emergency_types,
        "risk_factors": risk_factors,
        "explainable_ai": {
            "reasoning": reasoning,
            "evidence": evidence
        },
        "recommended_response": {
            "urgency": urgency,
            "responders": responders,
            "actions": actions
        }
    }
