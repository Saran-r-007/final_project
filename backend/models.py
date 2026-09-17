"""
Pydantic models / schemas for API requests, responses, and internal data structures.
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
import time


# ── Enums ──────────────────────────────────────────────────────────────────

class JobStatus(str, Enum):
    PENDING = "PENDING"
    PREPROCESSING = "PREPROCESSING"
    ANALYZING_SPEECH = "ANALYZING_SPEECH"
    ANALYZING_SOUNDS = "ANALYZING_SOUNDS"
    SEPARATING_SOURCES = "SEPARATING_SOURCES"
    ANALYZING_MUSIC = "ANALYZING_MUSIC"
    ANALYZING_SPEAKERS = "ANALYZING_SPEAKERS"
    GEMINI_ANALYSIS = "GEMINI_ANALYSIS"
    CONTEXT_ANALYSIS = "CONTEXT_ANALYSIS"
    GENERATING_REPORT = "GENERATING_REPORT"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Severity(str, Enum):
    PEACEFUL = "PEACEFUL"
    INFO = "INFO"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"
    MUSIC = "MUSIC"


# ── Audio Info ─────────────────────────────────────────────────────────────

class AudioInfo(BaseModel):
    audio_id: str = ""
    filename: str = ""
    duration: float = 0.0
    sample_rate: int = 16000
    channels: int = 1
    format: str = ""
    file_size_bytes: int = 0
    bit_depth: Optional[str] = None
    rms_energy: float = 0.0
    bpm: float = 0.0
    rhythm_strength: str = "Unknown"
    harmonic_ratio: float = 0.0
    spectral_brightness: str = "Unknown"
    frequency_distribution: dict = Field(default_factory=lambda: {
        "bass_percent": 0.0, "mid_percent": 0.0, "treble_percent": 0.0
    })


# ── Speech ─────────────────────────────────────────────────────────────────

class SpeechSegment(BaseModel):
    start: float
    end: float
    text: str = ""
    speaker: str = "Unknown"
    confidence: float = 0.0


class SpeechResult(BaseModel):
    has_speech: bool = False
    transcript: str = ""
    language: str = "Unknown"
    confidence: float = 0.0
    segments: list[SpeechSegment] = Field(default_factory=list)


# ── Speaker Analysis ──────────────────────────────────────────────────────

class SpeakerInfo(BaseModel):
    speaker_id: str = ""
    label: str = ""
    total_duration: float = 0.0
    segment_count: int = 0
    confidence: str = "Uncertain"


class SpeakerAnalysis(BaseModel):
    num_speakers: int = 0
    confidence: str = "Uncertain"
    speakers: list[SpeakerInfo] = Field(default_factory=list)
    note: str = ""


# ── Sound Events ──────────────────────────────────────────────────────────

class SoundEvent(BaseModel):
    label: str
    confidence: float
    category: str = "GENERAL_SOUND"
    start: Optional[float] = None
    end: Optional[float] = None


class HumanSoundResult(BaseModel):
    detected: bool = False
    sounds: list[SoundEvent] = Field(default_factory=list)


class EnvironmentalSoundResult(BaseModel):
    detected: bool = False
    sounds: list[SoundEvent] = Field(default_factory=list)


# ── Music ─────────────────────────────────────────────────────────────────

class MusicAnalysis(BaseModel):
    is_music: bool = False
    confidence: float = 0.0
    bpm: float = 0.0
    estimated_key: str = "Unknown"
    estimated_scale: str = "Unknown"
    harmonic_ratio: float = 0.0
    rhythm_strength: str = "Unknown"
    genre_estimate: str = "Unknown"
    note: str = ""


# ── Source Separation ─────────────────────────────────────────────────────

class StemInfo(BaseModel):
    name: str
    type: str
    file_path: Optional[str] = None
    duration: float = 0.0


class SourceSeparation(BaseModel):
    performed: bool = False
    stems: list[StemInfo] = Field(default_factory=list)
    note: str = ""


# ── Timeline ──────────────────────────────────────────────────────────────

class TimelineEvent(BaseModel):
    start: float
    end: float
    label: str
    track: str  # "Speech", "Sound Events", "Music", etc.
    confidence: float = 0.0


# ── Emergency ─────────────────────────────────────────────────────────────

class EmergencyType(BaseModel):
    type: str
    confidence: float


class RiskFactor(BaseModel):
    factor: str
    points: int
    description: str = ""


class EmergencyAnalysis(BaseModel):
    is_emergency: bool = False
    emergency_types: list[EmergencyType] = Field(default_factory=list)
    risk_factors: list[RiskFactor] = Field(default_factory=list)


class RiskScore(BaseModel):
    score: int = 0
    severity: Severity = Severity.INFO
    explanation: str = ""


class ExplainableAI(BaseModel):
    reasoning: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)


class RecommendedResponse(BaseModel):
    responders: list[str] = Field(default_factory=list)
    actions: list[str] = Field(default_factory=list)
    urgency: str = "None"


class NotificationStatus(BaseModel):
    sent: bool = False
    mode: str = "SIMULATION"
    phone: str = ""
    email: str = ""
    timestamp: float = 0.0
    details: str = ""


# ── Complete Report ───────────────────────────────────────────────────────

class AnalysisReport(BaseModel):
    audio_info: AudioInfo = Field(default_factory=AudioInfo)
    speech_detection: SpeechResult = Field(default_factory=SpeechResult)
    speech_to_text: str = ""
    speaker_analysis: SpeakerAnalysis = Field(default_factory=SpeakerAnalysis)
    human_sounds: HumanSoundResult = Field(default_factory=HumanSoundResult)
    environmental_sounds: EnvironmentalSoundResult = Field(default_factory=EnvironmentalSoundResult)
    music_analysis: MusicAnalysis = Field(default_factory=MusicAnalysis)
    source_separation: SourceSeparation = Field(default_factory=SourceSeparation)
    individual_events: list[SoundEvent] = Field(default_factory=list)
    timestamps: list[dict] = Field(default_factory=list)
    timeline: list[TimelineEvent] = Field(default_factory=list)
    context_understanding: str = ""
    emergency_analysis: EmergencyAnalysis = Field(default_factory=EmergencyAnalysis)
    risk_score: RiskScore = Field(default_factory=RiskScore)
    explainable_ai: ExplainableAI = Field(default_factory=ExplainableAI)
    recommended_response: RecommendedResponse = Field(default_factory=RecommendedResponse)
    notification_status: NotificationStatus = Field(default_factory=NotificationStatus)
    final_ai_summary: str = ""
    processing_time: float = 0.0


# ── API Request / Response ────────────────────────────────────────────────

class UploadResponse(BaseModel):
    audio_id: str
    filename: str
    format: str
    size_bytes: int
    message: str = "Audio uploaded successfully"


class AnalyzeRequest(BaseModel):
    audio_id: str


class JobResponse(BaseModel):
    job_id: str
    audio_id: str
    status: JobStatus
    progress: int = 0  # 0-100
    current_step: str = ""
    analysis_id: Optional[str] = None
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str = "ok"
    models_loaded: dict = Field(default_factory=dict)
    timestamp: float = Field(default_factory=time.time)
