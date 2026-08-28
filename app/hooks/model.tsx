export const UI_VERSION = "3.1.0";

export const Language = {
    en: "English",
    ja: "Japanese",
    zh: "Chinese",
    "zh-CN": "Chinese (Simplified)",
    "zh-TW": "Chinese (Traditional)",
    ko: "Korean",
    fr: "French",
    de: "German",
    es: "Spanish",
    it: "Italian",
    ru: "Russian",
    pt: "Portuguese",
    ar: "Arabic",
    th: "Thai",
    vi: "Vietnamese"
};
export type LanguageKey = keyof typeof Language;

export interface FileInfo {
    path: string;
    size: number;
    codec: string;
    width: number;
    height: number;
    sar: string;
    pix_fmt: string;
    color_space: string;
    color_transfer: string;
    color_primaries: string;
    bit_rate: number;
    frame_rate: number;
    duration: number;
    audio_bit_rate: number;
}

export interface GeneralSettings {
    // General Settings
    overwrite: boolean;
    delete_source: boolean;
    retry: number;

    // Transcoder Settings
    preset: number;
    max_bitrate_mb: number;
    overshoot_pct: number;
    undershoot_pct: number;
    minsection_pct: number;
    maxsection_pct: number;
    keyint: string;
    lookahead: number;
    scd: boolean;
}

export interface TranslatorSettings {
    // whisper settings
    asr_model: string | null
    voice_temperature: number
    max_length_segment: number
    no_speech_threshold: number
    entropy_thold: number
    logprob_thold: number
    max_context: number
    suppress_nst: boolean
    no_fallback: boolean

    // VAD settings
    vad_model: string | null
    voice_speech_duration: number
    voice_minimum_silence_duration: number
    voice_threshold: number

    // llm settings
    llm_type: "openai-api" | "llama.cpp" | "mlx"
    llm_key: string | null
    max_tokens: number
    max_input: number
    prompt: Object[]
    temperature: number
}

export interface TranscodeInfo {
    pix_fmt: string;
    zscale: string;
    sar_fix: string;
    video_br: number;
    audio_br: number;
    rotate?: number | null;
    subtitle?: LanguageKey | null;
    tran?: LanguageKey | null;
    tran_inmediate?: boolean | null;
}

export interface TaskInfo {
    uid?: number;
    input: FileInfo[];
    output: string;
    args: TranscodeInfo;
    settings: GeneralSettings;
}

export interface LLMTaskInfo {
    uid?: number;
    input: string;
    output: string;
    org_lang: LanguageKey;
    tran_lang: LanguageKey;
}

export const Rotate = [
    "90° clockwise and flip vertically",
    "90° clockwise",
    "90° counterclockwise",
    "90° counterclockwise and flip vertically",
    "Horizontal flip",
    "Vertical flip",
    "180° rotation",
] as const;

export interface TaskSchedule {
    on: boolean;
    finish_time: string;
    max_extend: number;
    sort: "longest" | "shortest" | "default";
    weight: "size" | "duration";
}

export interface FileETAInfo {
    codec: number;
    pixel_count: number;
    frame_count: number;
    subtitle: boolean;

    preset: number;
    target_bit_rate: number;
    lookahead: number;
    keyint: number; // frame count
    scd: boolean;
}

export interface ApiRunning extends TaskInfo {
    org_lang?: LanguageKey;
    tran_lang?: LanguageKey;

    state: "audio_prefix" | "transcode" | "whisper" | "llm_gen"
    cpu_usage: number;
    ram_usage: number;

    start_time: string;
    consumed_time: string

    frame: number
    fps: number
    qp: number
    bitrate: string
    size: string
    completed_time: string
    dup_frames: number
    drop_frames: number
    speed: number
    progress: number
    eta: string

    log: string[]
}

export interface ApiPath {
    dir: string[]
    file: string[]
}

export interface Taskls {
    input: FileInfo
    output: string
    trans: TranscodeInfo
    eta: number
}