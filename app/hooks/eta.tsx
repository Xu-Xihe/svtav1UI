import { Tooltip, Typography } from "@mui/material";

import type { TaskInfo, FileETAInfo } from "./model";
import { api } from "./api";
import { useErrorMsg } from "../components/error_popout";
import { getLocalStorage } from "../hooks/storage";


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

export async function getEta(task: TaskInfo | FileETAInfo) {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const { pushError } = useErrorMsg.getState();

    try {
        const res = await api.post(`${apiUrl}/plan/eta`, { json: task }).json<number>();
        return res;
    }
    catch (err) {
        pushError(err, "Fetch ETA");
        return -1;
    }
}

export function EtaText({ eta, title = "" }: { eta: number; title?: string }) {

    const formateInterval = (interval: number) => {
        const hours = Math.floor(interval / 3600);
        const minutes = Math.floor((interval % 3600) / 60);
        const seconds = Math.floor(interval % 60);

        return `${hours > 0 ? `${hours} hours ` : ""}${minutes > 0 ? `${minutes} minutes ` : ""}${seconds} seconds`;
    }


    return (
        <Tooltip title={eta <= 0 ? "ETA model is not available." : `Precise prediction: ${formateInterval(eta)}.`}>
            <Typography variant="body2">
                <b>{title}</b>{showEta(eta)}
            </Typography>
        </Tooltip>
    )
}