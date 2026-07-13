import {
    Box,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    TextField,
    DialogActions,
    Button,
    IconButton,
    Tooltip,
} from "@mui/material";
import DriveFileRenameOutlineRoundedIcon from '@mui/icons-material/DriveFileRenameOutlineRounded';
import { useState } from "react";

import type { Taskls } from "~/hooks/model";
import type { InsertSettings } from "~/components/insert/settings";
import { EtaText } from "~/hooks/eta";


export function OutputInfo({
    task,
    index,
    output,
    maxMbps,
    onRename,
}: {
    task: Taskls,
    index?: number,
    output: string,
    maxMbps: number,
    onRename: (newName: string) => void,
}) {
    const [renameOpen, setRenameOpen] = useState(false);

    return (
        <Box sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "start",
            alignItems: "start",
            wordBreak: "break-all",
            gap: 1,
            mb: 3,
        }}>
            <Box sx={{
                display: "flex",
                alignItems: "center",
                gap: 3,
            }}>
                <Typography variant="body1" sx={{ fontWeight: "bold", color: "primary" }}>
                    File {index}
                </Typography>
                <EtaText eta={task.eta} title="ETA: " />
                <Tooltip title="Rename">
                    <IconButton onClick={() => setRenameOpen(true)}>
                        <DriveFileRenameOutlineRoundedIcon />
                    </IconButton>
                </Tooltip>
                {renameOpen &&
                    <OutputRenamePopout
                        defaultName={task.output}
                        onClose={(newName) => {
                            setRenameOpen(false);
                            onRename(newName);
                        }}
                    />
                }
            </Box>
            {
                [
                    ["Output Path", `${output}${output.endsWith("/") ? "" : "/"}${task.output}.mp4`],
                    ["Video Bitrate", `${(Math.min(task.trans.video_br / 1000 / 1000, maxMbps)).toFixed(2)} Mbps`],
                    ["Audio Bitrate", `${(task.trans.audio_br / 1000).toFixed(2)} kbps`],
                    ["Pixel Format", task.trans.pix_fmt],
                    ["Fix SAR", task.trans.sar_fix === "" ? "No" : task.trans.sar_fix],
                    ["Zscale", task.trans.zscale],
                ].map(([key, value]) => (
                    <Typography key={key} variant="body2" sx={{ pl: 2 }}>
                        <b>{key}:</b> {value}
                    </Typography>
                ))
            }
        </Box >
    );
}

export function OutputSubInfo({ task, index, insert }: { task: Taskls, index?: number, insert: InsertSettings }) {
    return (
        <Box sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "start",
            alignItems: "start",
            wordBreak: "break-all",
            gap: 1,
            mb: 3,
        }}>
            <Typography variant="body1" sx={{ fontWeight: "bold", color: "primary" }}>
                File {index}
            </Typography>
            <Typography variant="body2" sx={{ pl: 2 }}>
                <b>Subtitle Path:</b> {task.input.path.replace(/\.[^/.]+$/, `.${insert.subtitle}.srt`)}
            </Typography>
            {insert.tran && (
                <Typography variant="body2" sx={{ pl: 2 }}>
                    <b>Translation Path:</b> {task.input.path.replace(/\.[^/.]+$/, `.${insert.tran}.srt`)}
                </Typography>
            )}
        </Box >
    );
}

export function OutputTitle({ total_eta, show }: { total_eta: number; show?: boolean }) {
    return (
        <Box sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
        }}>
            <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                Output Settings
            </Typography>
            <Typography variant="body2">
                <EtaText eta={show ? -1 : total_eta} title="Total ETA: " />
            </Typography>
        </Box>
    );
}

function OutputRenamePopout({
    defaultName,
    onClose,
}: {
    defaultName: string;
    onClose: (newName: string) => void;
}) {
    const [name, setName] = useState(defaultName);


    return (
        <Dialog
            fullWidth
            open
            onClose={() => onClose(defaultName)}
            onKeyDown={(e) => {
                if (e.key === "Escape") {
                    e.stopPropagation();
                    onClose(defaultName);
                }
                if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    onClose(name);
                }
            }}
        >
            <DialogTitle>
                <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                    Rename
                </Typography>
            </DialogTitle>
            <DialogContent>
                <TextField
                    label="File Name"
                    value={name}
                    variant="outlined"
                    sx={{ mt: 1, width: "100%" }}
                    onChange={(e) => setName(e.target.value)}
                />
            </DialogContent>
            <DialogActions sx={{ pb: 3, pr: 3, gap: 1 }}>
                <Button onClick={() => onClose(defaultName)} variant="outlined">
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={() => { onClose(name); }}
                    disabled={name === ""}
                >
                    Rename
                </Button>
            </DialogActions>
        </Dialog>
    );
}