import { Tooltip, Typography } from "@mui/material";

import type { FileInfo, TaskInfo } from "./model";

interface EtaInput {
    input: FileInfo[],
    video_br: number
}


function showEta(seconds: number) {
    if (seconds <= 0) {
        return "N/A";
    }
    else if (seconds < 10) {
        return "In seconds";
    }
    else if (seconds < 60) {
        return `About ${Math.round(seconds / 10) * 10} seconds`;
    }
    else if (seconds < 600) {
        return `About ${Math.round(seconds / 60)} minutes`;
    }
    else if (seconds < 3600) {
        return `About ${Math.round(seconds / 600) * 10} minutes`;
    }
    else if (seconds < 3600 * 24) {
        return `About ${Math.round(seconds / 3600)} hours`;
    }
    else {
        return `More than 1 day`;
    }
}

export function getTotalEta(speed: number, data: TaskInfo[] | EtaInput[]) {
    if (speed === 0) {
        return "N/A";
    }

    let eta = 0;
    for (const task of data) {
        for (const f of task.input) {
            if ("video_br" in task) {
                eta += f.duration * task.video_br / speed;
            }
            else {
                eta += f.duration * task.args.video_br / speed;
            }
        }
    }

    return showEta(eta);
}

export function GetEta({ speed, data }: { speed: number; data: TaskInfo | EtaInput }) {
    if (speed === 0) {
        return (
            <Tooltip title="ETA is caculated based on the completed tasks. No completed task found.">
                <Typography variant="body2">N/A</Typography>
            </Tooltip>
        )
    }
    else {
        let eta = 0;
        for (const f of data.input) {
            if ("video_br" in data) {
                eta += f.duration * data.video_br / speed;
            }
            else {
                eta += f.duration * data.args.video_br / speed;
            }
        }

        return (
            <Tooltip title="ETA is caculated based on the completed tasks. For reference only.">
                <Typography variant="body2">{showEta(eta)}</Typography>
            </Tooltip>
        )
    }
}