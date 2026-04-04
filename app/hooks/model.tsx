export interface FileInfo {
    path: string
    size: number
    codec: string
    width: number
    height: number
    sar: string
    bit_rate: number
    frame_rate: number
    duration: number
    audio_bit_rate: number
}

export interface Settings {
    overwrite: boolean
    delete_source: boolean
    preset: number
    rotate: number | null
    retry: number

    overshoot_pct: number
    undershoot_pct: number
    minsection_pct: number
    maxsection_pct: number
    keyint: string
    lookahead: number
    scd: boolean
}

export interface TranscodeInfo {
    sar_fix: string
    video_br: number
    audio_br: number
}

export interface TaskInfo {
    uid?: number
    input: FileInfo[]
    output: string
    args: TranscodeInfo
    settings: Settings
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