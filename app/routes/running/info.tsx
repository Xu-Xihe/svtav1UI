import { Box, LinearProgress, Typography, TextField } from "@mui/material";
import { useEffect, useState, useRef } from "react";

import type { ApiRunning } from "~/hooks/model";
import { NobarOverflow } from "~/components/insert/frame";

export function LineProgress({ progress }: { progress: number }) {
    return (
        <Box sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            gap: 3,
        }}>
            <LinearProgress
                variant={progress >= 100 || progress === 0 ? "indeterminate" : "determinate"}
                value={progress}
                sx={{ width: "83%" }}
            />
            <Typography sx={{ width: "8%" }}>
                {progress >= 100 || progress === 0 ? "Processing..." : `${progress.toFixed(2)} %`}
            </Typography>
        </Box>
    );
}

export function TranscodeProgress({ info }: { info: ApiRunning }) {
    return (
        <>
            <Typography variant="h5" sx={{ mb: 1 }}>
                Transcode Progress Info
            </Typography>
            <NobarOverflow gap={1}>
                {[
                    ["CPU Usage", `${info.cpu_usage} %`],
                    ["RAM Usage", `${info.ram_usage} %`],
                    ["Start Time", new Date(info.start_time).toLocaleString()],
                    ["Consumed Time", info.consumed_time],
                    ["Frame", info.frame],
                    ["FPS", info.fps],
                    ["QP", info.qp],
                    ["Bitrate", info.bitrate],
                    ["Size", info.size],
                    ["Completed Time", info.completed_time],
                    ["Dup Frames", info.dup_frames],
                    ["Drop Frames", info.drop_frames],
                    ["Speed", `${info.speed}x`],
                    ["ETA", info.eta],
                ].map(([key, value]) => (
                    <Typography key={key} variant="body1">
                        <b>{key}:</b> {value}
                    </Typography>
                ))}
            </NobarOverflow>
        </>
    );
}

export function AudioProgress({ info }: { info: ApiRunning }) {
    return (
        <>
            <Typography variant="h5" sx={{ mb: 1 }}>
                Audio Progress Info
            </Typography>
            <NobarOverflow gap={1}>
                {[
                    ["CPU Usage", `${info.cpu_usage} %`],
                    ["RAM Usage", `${info.ram_usage} %`],
                    ["Start Time", new Date(info.start_time).toLocaleString()],
                    ["Consumed Time", info.consumed_time],
                    ["Bitrate", info.bitrate],
                    ["Size", info.size],
                    ["Completed Time", info.completed_time],
                    ["Dup Frames", info.dup_frames],
                    ["Drop Frames", info.drop_frames],
                    ["Speed", `${info.speed}x`],
                    ["ETA", info.eta],
                ].map(([key, value]) => (
                    <Typography key={key} variant="body1">
                        <b>{key}:</b> {value}
                    </Typography>
                ))}
            </NobarOverflow>
        </>
    );
}

export function LogsProgress({ title, info }: { title: string; info: ApiRunning }) {
    const [logs, setLogs] = useState<string[]>([]);
    const textRef = useRef<HTMLTextAreaElement | null>(null);
    const shouldScrollRef = useRef(true);
    const autoScrollingRef = useRef(false);

    useEffect(() => { setLogs(prev => [...prev, ...info.log]) }, [info.log]);

    const handleScroll = () => {
        const textarea = textRef.current;
        if (!textarea) return;

        if (autoScrollingRef.current) {
            return;
        }

        shouldScrollRef.current =
            textarea.scrollHeight - textarea.scrollTop <= textarea.clientHeight + 5;
    };
    useEffect(() => {
        if (!shouldScrollRef.current) return;

        const textarea = textRef.current;
        if (!textarea) return;

        requestAnimationFrame(() => {
            autoScrollingRef.current = true;

            textarea.scrollTop = textarea.scrollHeight;

            requestAnimationFrame(() => {
                autoScrollingRef.current = false;
            });
        });
    }, [logs]);


    return (
        <>
            <Typography variant="h5" sx={{ mb: 1 }}>
                {title} Progress Info
            </Typography>
            <TextField
                multiline
                value={logs.join("\n")}
                slotProps={{
                    htmlInput: {
                        readOnly: true,
                        ref: textRef,
                        onScroll: handleScroll,
                    },
                }}
                sx={{
                    mb: 3,
                    width: "100%",
                    height: "100%",
                    "& .MuiInputBase-root": {
                        height: "100%",
                    },
                    "& textarea": {
                        height: "100% !important",
                        overflowY: "auto !important",
                    },
                }}
            />
        </>
    );
}

export function LLMInfo({ info }: { info: ApiRunning }) {
    return (
        <Box sx={{
            display: "flex",
            flexDirection: "column",
            alignContent: "start",
            justifyContent: "start",
            wordWrap: "break-word",
            gap: 1,
        }}>
            {([
                ["Input", info.input],
                ["Output", info.output],
                ["Original Language", info.org_lang],
                ["Translated Language", info.tran_lang],
                ["Start Time", new Date(info.start_time).toLocaleString()],
                ["Consumed Time", info.consumed_time],
            ] as [string, string | number][]).map(([key, value]) => (
                <Typography key={key} sx={{
                    overflowWrap: "anywhere",
                    wordBreak: "break-all",
                    pl: 3,
                }}>
                    <b>{key}:</b> {value}
                </Typography>
            ))}
        </Box>
    );
}
