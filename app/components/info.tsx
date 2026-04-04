import { Box, Typography } from "@mui/material";

import React from "react";

import type { FileInfo, TaskInfo } from "../hooks/model";
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

export function TaskInfoComponent({ taskInfo }: { taskInfo: TaskInfo }) {
    return (
        <>
            <Box sx={{
                display: "flex",
                flexDirection: "column",
                alignContent: "start",
                justifyContent: "start",
                wordWrap: "break-word",
                gap: 1,
            }}>
                {[
                    ["UID", taskInfo.uid],
                    ["Output", taskInfo.output],
                ].map(([key, value]) => (
                    <Typography key={key} sx={{
                        overflowWrap: "break-word",
                        wordBreak: "break-word",
                    }}>
                        <b>{key}:</b> {value}
                    </Typography>
                ))}
                <Typography>
                    <b>Args:</b>
                </Typography>
                {[
                    ["SAR Fix", taskInfo.args.sar_fix === "" ? "No" : taskInfo.args.sar_fix],
                    ["Video Bit Rate", `${(taskInfo.args.video_br / 1000 / 1000).toFixed(2)} Mbps`],
                    ["Audio Bit Rate", `${(taskInfo.args.audio_br / 1000).toFixed(2)} kbps`],
                ].map(([key, value]) => (
                    <Typography key={key} sx={{
                        pl: 2,
                        overflowWrap: "break-word",
                        wordBreak: "break-word",
                    }}>
                        <b>{key}:</b> {value}
                    </Typography>
                ))}
                <Typography>
                    <b>Settings:</b>
                </Typography>
                {[
                    ["Overwrite", taskInfo.settings.overwrite ? "Yes" : "No"],
                    ["Delete Source", taskInfo.settings.delete_source ? "Yes" : "No"],
                    ["Rotate", taskInfo.settings.rotate === null ? "No" : Rotate[taskInfo.settings.rotate]],
                ].map(([key, value]) => (
                    <Typography key={key} sx={{ pl: 2 }}>
                        <b>{key}:</b> {value}
                    </Typography>
                ))}
            </Box>
        </>
    );
}