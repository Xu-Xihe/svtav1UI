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

export interface Settings {
    vca_on: boolean;
    overwrite: boolean;
    delete_source: boolean;
    preset: number;
    rotate: number | null;
    retry: number;

    max_bitrate_mb: number;

    overshoot_pct: number;
    undershoot_pct: number;
    minsection_pct: number;
    maxsection_pct: number;
    keyint: string;
    lookahead: number;
    scd: boolean;
}

export interface TranscodeInfo {
    pix_fmt: string;
    zscale: string;
    sar_fix: string;
    video_br: number;
    audio_br: number;
}

export interface TaskInfo {
    uid?: number;
    input: FileInfo[];
    output: string;
    args: TranscodeInfo;
    settings: Settings;
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
    pixels_per_second: number;
    frame_count: number;

    preset: number;
    target_bit_rate: number;
    lookahead: number;
    keyint: number; // frame count
    scd: boolean;

    E_mean?: number;
    E_p95?: number;
    E_diff_mean?: Number;

    h_mean?: number;
    h_diff_mean?: number;

    epsilon_mean?: number;
    epsilon_diff_mean?: number;
}