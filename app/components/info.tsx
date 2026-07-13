import { Box, Typography } from "@mui/material";

import React from "react";

import type { FileInfo, TaskInfo } from "../hooks/model";
import { Language } from "../hooks/model";
import { Rotate } from "../hooks/model";


export function FileInfoComponent({ fileInfo }: { fileInfo: FileInfo[] }) {
    return (
        <>
            {fileInfo.map((file, index) => (
                <React.Fragment key={index}>
                    {fileInfo.length > 1 &&
                        (
                            <Typography variant="h6" gutterBottom color='primary' sx={{ mt: index === 0 ? 0 : 1 }}>
                                <b>File {index + 1}</b>
                            </Typography>
                        )
                    }
                    < Box sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignContent: "start",
                        justifyContent: "start",
                        gap: 1,
                    }}>
                        {[
                            ["Name", file.path.split("/").slice(-1)[0]],
                            ["Path", file.path],
                            ["Size", `${(file.size / 1024 / 1024).toFixed(2)} MB`],
                            ["Codec", file.codec],
                            ["Width", file.width],
                            ["Height", file.height],
                            ["SAR", file.sar],
                            ["Pixel Format", file.pix_fmt],
                            ["Color Info", `s: ${file.color_space}; t: ${file.color_transfer}; p: ${file.color_primaries}`],
                            ["Bit Rate", `${(file.bit_rate / 1000 / 1000).toFixed(2)} Mbps`],
                            ["Frame Rate", `${file.frame_rate} fps`],
                            ["Duration", `${Math.floor(file.duration / 60)} min ${Math.floor(file.duration % 60)} sec`],
                            ["Audio Bit Rate", `${(file.audio_bit_rate / 1000).toFixed(2)} kbps`]
                        ].map(([key, value]) => (
                            <Typography key={key} sx={{
                                overflowWrap: "break-word",
                                wordBreak: "break-word",
                            }}>
                                <b>{key}:</b> {value}
                            </Typography>
                        ))}
                    </Box >
                </React.Fragment>
            ))
            }
        </>
    );
}

export function TaskInfoComponent({ task }: { task: TaskInfo }) {
    const info: Record<string, [string, any][]> = {
        "Task Info": [
            ["UID", task.uid],
            ["Output", task.output],
        ],
        "Args": [
            ["Video Bit Rate", `${(task.args.video_br / 1000 / 1000).toFixed(2)} Mbps`],
            ["Audio Bit Rate", `${(task.args.audio_br / 1000).toFixed(2)} kbps`],
            ["Pixel Format", task.args.pix_fmt],
            ["SAR Fix", task.args.sar_fix === "" ? "No" : task.args.sar_fix],
            ["Zscale", task.args.zscale],
            ["Rotate", task.args.rotate ? Rotate[task.args.rotate] : "N/A"],
        ],
        "Subtitle": [
            ["Original Language", task.args.subtitle ? Language[task.args.subtitle] : "N/A"],
            ["Translation Language", task.args.tran ? Language[task.args.tran] : "N/A"],
            ["Translate Inmediately", task.args.tran_inmediate ? "Yes" : "No"],
        ],
        "System Settings": [
            ["Overwrite", task.settings.overwrite ? "Yes" : "No"],
            ["Delete Source", task.settings.delete_source ? "Yes" : "No"],
        ]
    }

    function InfoBlock({ title, items }: { title: string, items: [string, any][] }) {
        return (
            <>
                <Typography>
                    <b>{title}:</b>
                </Typography>
                {items.map(([key, value]) => (
                    <Typography key={key} sx={{
                        overflowWrap: "anywhere",
                        wordBreak: "break-all",
                        pl: 3,
                    }}>
                        <b>{key}:</b> {value}
                    </Typography>
                ))}
            </>
        );
    }


    return (
        <Box sx={{
            display: "flex",
            flexDirection: "column",
            alignContent: "start",
            justifyContent: "start",
            wordWrap: "break-word",
            gap: 1,
        }}>
            <InfoBlock title="Task Info" items={info["Task Info"]} />
            {task.args.video_br > 0 && <InfoBlock title="Args" items={info["Args"]} />}
            {task.args.subtitle && <InfoBlock title="Subtitle" items={info["Subtitle"]} />}
            {task.args.video_br > 0 && <InfoBlock title="System Settings" items={info["System Settings"]} />}
        </Box>
    );
}
