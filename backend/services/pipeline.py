"""
Comprehensive Audio Intelligence Pipeline Orchestrator.
Executes the multi-stage deep learning pipeline, tracks progress,
and synthesizes the complete 18-section Analysis Report.
"""
import time
import os
from pathlib import Path
from config import settings
import storage

from services.audio_processor import preprocess_audio
from services.speech_service import transcribe
from services.speaker_analyzer import analyze_speakers
from services.sound_classifier import detect_sounds
from services.music_analyzer import analyze_music
from services.source_separator import separate_sources
from services.gemini_service import analyze_audio_with_gemini
from services.emergency_detector import assess_emergency
from services.notification_service import dispatch_emergency_notification, SERVICE_CONTACTS, _classify_emergency_type, _get_service_contact


async def run_full_pipeline(job_id: str, audio_id: str, user_id: str = None):
    """
    Executes the 9-stage analysis pipeline sequentially and persists
    progress and the final structured report into SQLite.
    """
    start_time = time.time()
    try:
        # Fetch audio record
        record = await storage.get_audio_record(audio_id)
        if not record:
            await storage.update_job(job_id, status="FAILED", error="Audio record not found.")
            return

        raw_audio_path = record["stored_path"]
        original_filename = record["original_filename"]

        # ── Step 1: Preprocessing & Acoustic Analysis (10%) ──
        await storage.update_job(
            job_id, status="PREPROCESSING", progress=10,
            current_step="Validating audio & extracting acoustic features..."
        )
        processed_path, duration, acoustic_features = preprocess_audio(raw_audio_path)
        
        # Update record with true duration
        await storage.update_audio_record(audio_id, duration=duration)

        # ── Step 2: Speech Recognition (25%) ──
        await storage.update_job(
            job_id, status="ANALYZING_SPEECH", progress=25,
            current_step="Running Speech Recognition (Whisper / AssemblyAI)..."
        )
        speech_raw = transcribe(processed_path, assemblyai_key=settings.assemblyai_api_key)
        transcript = speech_raw.get("transcript", "")
        speech_segments = speech_raw.get("segments", [])
        has_speech = bool(transcript)

        # ── Step 3: Speaker Analysis / Diarization (40%) ──
        await storage.update_job(
            job_id, status="ANALYZING_SPEAKERS", progress=40,
            current_step="Analyzing speaker characteristics & clustering..."
        )
        speaker_res = analyze_speakers(processed_path, speech_segments)

        # ── Step 4: Sound Event Classification (55%) ──
        await storage.update_job(
            job_id, status="ANALYZING_SOUNDS", progress=55,
            current_step="Classifying environmental and human sound events (AST)..."
        )
        sound_res = detect_sounds(processed_path)
        all_sound_events = sound_res.get("all_events", [])
        human_sound_events = sound_res.get("human_sounds", [])
        env_sound_events = sound_res.get("environmental_sounds", [])

        # ── Step 5: Music Analysis (65%) ──
        await storage.update_job(
            job_id, status="ANALYZING_MUSIC", progress=65,
            current_step="Analyzing musical properties, tempo, and key..."
        )
        music_res = analyze_music(processed_path, acoustic_features)

        # ── Step 6: Source Separation (75%) ──
        await storage.update_job(
            job_id, status="SEPARATING_SOURCES", progress=75,
            current_step="Performing AI source separation (Demucs)..."
        )
        sep_res = separate_sources(processed_path, audio_id)

        # ── Step 7: Gemini ALM Context Understanding (85%) ──
        await storage.update_job(
            job_id, status="GEMINI_ANALYSIS", progress=85,
            current_step="Performing contextual reasoning with Gemini ALM..."
        )
        gemini_res = analyze_audio_with_gemini(
            audio_path=processed_path,
            transcript=transcript,
            detected_sounds=all_sound_events,
            acoustic_features=acoustic_features,
            api_key=settings.gemini_api_key,
        )

        # ── Step 8: Emergency & Risk Assessment (92%) ──
        await storage.update_job(
            job_id, status="CONTEXT_ANALYSIS", progress=92,
            current_step="Computing explainable risk score and alerting status..."
        )
        emergency_res = assess_emergency(
            sound_events=all_sound_events,
            transcript=transcript,
            acoustic_features=acoustic_features,
            gemini_assessment=gemini_res.get("emergency_assessment", ""),
            music_analysis=music_res,
        )

        # Step 8b: Dispatch Notification (using per-user settings)
        notif_phone = settings.notification_phone
        notif_email = settings.notification_email
        notif_mode = settings.notification_mode
        if user_id:
            try:
                user_settings = await storage.get_user_settings(user_id)
                notif_phone = user_settings.get("emergency_phone") or notif_phone
                notif_email = user_settings.get("emergency_email") or notif_email
                notif_mode = user_settings.get("notification_mode") or notif_mode
            except Exception:
                pass

        notification_res = dispatch_emergency_notification(
            risk_score_data=emergency_res["risk_score"],
            emergency_analysis=emergency_res,
            audio_filename=original_filename,
            mode=notif_mode,
            phone=notif_phone,
            email=notif_email,
        )

        # Create emergency event in database if emergency was detected
        if emergency_res.get("is_emergency") and user_id:
            try:
                emg_category = _classify_emergency_type(emergency_res.get("emergency_types", []))
                service = _get_service_contact(emg_category)
                
                # Determine email and SMS status from notification result
                email_status = "FAILED"
                sms_status = "NOT_SENT"
                email_msg_id = ""
                sms_id = ""
                err_msg = ""
                
                if notification_res.get("email_result", {}).get("success"):
                    email_status = "SENT"
                    email_msg_id = notification_res.get("email_detail", "")
                else:
                    err_msg = notification_res.get("email_result", {}).get("error", "")
                
                if notif_mode == "LIVE":
                    if notification_res.get("sms", {}).get("success"):
                        sms_status = "SENT"
                        sms_id = notification_res.get("sms_sid", "")
                    else:
                        sms_status = "FAILED"
                        sms_err = notification_res.get("sms", {}).get("error", "")
                        err_msg = (err_msg + "; " + sms_err) if err_msg else sms_err
                
                # Build detected problem from emergency types
                emergency_types_list = emergency_res.get("emergency_types", [])
                detected_problem = ", ".join([t.get("type", "") for t in emergency_types_list]) if emergency_types_list else f"Auto-detected {service['label']} emergency"
                
                await storage.create_emergency_event(
                    user_id=user_id,
                    alert_type=emg_category,
                    details=f"Auto-detected {service['label']} emergency. Risk score: {emergency_res['risk_score']['score']}/100. {emergency_res['risk_score'].get('explanation', '')}",
                    phone=notif_phone,
                    email=notif_email,
                    status="DISPATCHED",
                    detected_problem=detected_problem,
                    service_label=service["label"],
                    service_contact=service["phone"],
                    email_status=email_status,
                    sms_status=sms_status,
                    email_message_id=email_msg_id,
                    sms_sid=sms_id,
                    error_message=err_msg,
                )
            except Exception as create_err:
                print(f"[Pipeline] WARNING: Failed to create emergency event in database: {create_err}")

        # ── Step 9: Assemble Multi-Track Timeline & Report (98%) ──
        await storage.update_job(
            job_id, status="GENERATING_REPORT", progress=98,
            current_step="Compiling multi-track timeline and final report..."
        )

        # Construct Timeline
        timeline = []
        
        # Track 1: Speech segments
        for seg in speaker_res.get("segments_with_speakers", speech_segments):
            timeline.append({
                "start": seg.get("start", 0.0),
                "end": seg.get("end", 0.0),
                "label": f"Speech ({seg.get('speaker', 'Speaker 1')}): \"{seg.get('text', '')[:40]}\"",
                "track": "Speech",
                "confidence": 0.85
            })

        # Track 2: Sound Events
        for evt in all_sound_events:
            s_start = evt.get("start")
            s_end = evt.get("end")
            if s_start is not None and s_end is not None:
                timeline.append({
                    "start": s_start,
                    "end": s_end,
                    "label": f"{evt.get('label', 'Sound')}",
                    "track": evt.get("category", "Sound Events"),
                    "confidence": evt.get("confidence", 0.0)
                })

        # Track 3: Music (if present)
        if music_res.get("is_music", False):
            timeline.append({
                "start": 0.0,
                "end": round(duration, 2),
                "label": f"Music: {music_res.get('genre_estimate', 'Rhythmic/Harmonic')}",
                "track": "Music",
                "confidence": music_res.get("confidence", 0.7)
            })

        # Sort timeline by start time
        timeline.sort(key=lambda x: x["start"])

        # Construct Final AI Summary
        if gemini_res.get("final_summary"):
            final_summary = gemini_res["final_summary"]
        else:
            speech_info = f"Spoken content transcribed ({len(transcript.split())} words)." if transcript else "No speech identified."
            sound_count = len(all_sound_events)
            music_info = "Musical properties identified." if music_res.get("is_music") else "Non-musical ambient audio."
            final_summary = (
                f"Audio analyzed over {duration:.1f} seconds. {speech_info} "
                f"Detected {sound_count} distinct sound signature(s). {music_info} "
                f"Emergency status evaluated at {emergency_res['risk_score']['score']}/100 "
                f"({emergency_res['risk_score']['severity']})."
            )

        # Construct Context Understanding text
        context_text = gemini_res.get("context_understanding") or gemini_res.get("scene_description") or (
            f"Acoustic environment with {len(all_sound_events)} identified sound patterns. "
            f"Dominant spectral frequencies: {acoustic_features.get('spectral_brightness', 'Normal')}. "
            f"Rhythm profile: {acoustic_features.get('rhythm_strength', 'Ambient')}."
        )

        total_proc_time = round(time.time() - start_time, 2)

        # Assemble Full 18-Section Report
        final_report = {
            "audio_info": {
                "audio_id": audio_id,
                "filename": original_filename,
                "duration": round(duration, 2),
                "sample_rate": 16000,
                "channels": 1,
                "format": record.get("format", "wav"),
                "file_size_bytes": record.get("file_size", 0),
                "rms_energy": acoustic_features.get("rms_energy", 0.0),
                "bpm": acoustic_features.get("bpm", 0.0),
                "rhythm_strength": acoustic_features.get("rhythm_strength", "Unknown"),
                "harmonic_ratio": acoustic_features.get("harmonic_ratio", 0.0),
                "spectral_brightness": acoustic_features.get("spectral_brightness", "Unknown"),
                "frequency_distribution": acoustic_features.get("frequency_distribution", {
                    "bass_percent": 0.0, "mid_percent": 0.0, "treble_percent": 0.0
                }),
            },
            "speech_detection": {
                "has_speech": has_speech,
                "transcript": transcript,
                "language": speech_raw.get("language", "en"),
                "confidence": speech_raw.get("confidence", 0.0),
                "segments": speaker_res.get("segments_with_speakers", speech_segments),
            },
            "speech_to_text": transcript,
            "speaker_analysis": {
                "num_speakers": speaker_res.get("num_speakers", 0),
                "confidence": speaker_res.get("confidence", "Uncertain"),
                "speakers": speaker_res.get("speakers", []),
                "note": speaker_res.get("note", "")
            },
            "human_sounds": {
                "detected": len(human_sound_events) > 0,
                "sounds": human_sound_events
            },
            "environmental_sounds": {
                "detected": len(env_sound_events) > 0,
                "sounds": env_sound_events
            },
            "music_analysis": music_res,
            "source_separation": sep_res,
            "individual_events": all_sound_events,
            "timestamps": [
                {
                    "label": e.get("label"),
                    "start": e.get("start"),
                    "end": e.get("end"),
                    "confidence": e.get("confidence")
                }
                for e in all_sound_events if e.get("start") is not None
            ],
            "timeline": timeline,
            "context_understanding": context_text,
            "emergency_analysis": {
                "is_emergency": emergency_res.get("is_emergency", False),
                "emergency_types": emergency_res.get("emergency_types", []),
                "risk_factors": emergency_res.get("risk_factors", [])
            },
            "risk_score": emergency_res.get("risk_score", {}),
            "explainable_ai": emergency_res.get("explainable_ai", {}),
            "recommended_response": emergency_res.get("recommended_response", {}),
            "notification_status": notification_res,
            "final_ai_summary": final_summary,
            "processing_time": total_proc_time,
        }

        # Save Report into SQLite
        analysis_id = await storage.save_analysis(audio_id, final_report)

        # Mark Job as COMPLETED
        await storage.update_job(
            job_id,
            status="COMPLETED",
            progress=100,
            current_step="Analysis successfully completed!",
            analysis_id=analysis_id
        )
        print(f"[Pipeline] Job {job_id} completed successfully in {total_proc_time}s. Analysis ID: {analysis_id}")

    except Exception as e:
        import traceback
        err_str = traceback.format_exc()
        print(f"[Pipeline] Job {job_id} encountered fatal error:\n{err_str}")
        await storage.update_job(
            job_id,
            status="FAILED",
            error=f"Processing failed: {str(e)}"
        )
