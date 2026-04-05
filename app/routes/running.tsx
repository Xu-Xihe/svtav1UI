import {
    Box,
    Typography,
    Divider,
    LinearProgress,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { useQuery } from '@tanstack/react-query';

import { useState } from 'react';

import { useErrorMsg } from "../components/error_popout";
import { getLocalStorage } from "../hooks/storage";
import { FileInfoComponent, TaskInfoComponent } from "../components/info";
import { api } from "../hooks/api";
import type { TaskInfo } from "../hooks/model";


interface ApiRunning extends TaskInfo {
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
}

export default function Running() {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const { pushMsg, pushError } = useErrorMsg();

    const [runningInfo, setRunningInfo] = useState<ApiRunning | null>(null);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

    useQuery({
        queryKey: ["running"],
        queryFn: async () => {
            try {
                const data = await api.get(`${apiUrl}/task/running`).json<ApiRunning | null>();
                setRunningInfo(data);
            }
            catch (error) {
                pushError(error, "Running tasks");
            }
            return null;
        },
        retry: 0,
        refetchInterval: 500,
        refetchIntervalInBackground: false,
    })


    if (runningInfo === null) {
        return (
            <Box sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
                width: "100%",
            }}>
                <Typography variant="h6">No running tasks</Typography>
            </Box>
        );
    }

    else {
        return (
            <>
                <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} fullWidth>
                    <DialogTitle>
                        <Typography variant="h6" fontWeight="bold">
                            Cancel Task
                        </Typography>
                    </DialogTitle>
                    <DialogContent>
                        <Typography variant="body1">
                            Are you sure you want to cancel the running task?
                        </Typography>
                    </DialogContent>
                    <DialogActions sx={{ pb: 3, pr: 3, gap: 1 }}>
                        <Button
                            variant='outlined'
                            onClick={() => setCancelDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            color="error"
                            variant="contained"
                            onClick={() => {
                                api.get(`${apiUrl}/task/running/cancel`)
                                    .then(() => {
                                        pushMsg("Task cancelled successfully.", "info");
                                        setCancelDialogOpen(false);
                                    })
                                    .catch((error) => {
                                        pushError(error, "Cancel Task");
                                    })
                            }}
                        >
                            Confirm
                        </Button>
                    </DialogActions>
                </Dialog>
                <Box sx={{
                    display: "flex",
                    justifyContent: "start",
                    alignItems: "start",
                    flexDirection: "column",
                    height: "100%",
                    width: "100%",
                    gap: 1,
                }}>
                    <Box sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%",
                        gap: 1,
                        px: 3,
                        pt: 3,
                        pb: 1,
                    }}>
                        <Typography variant="h4">
                            Running Task
                        </Typography>
                        <Button
                            variant='outlined'
                            color='error'
                            startIcon={<CloseRoundedIcon />}
                            onClick={() => setCancelDialogOpen(true)}
                        >
                            Cancel
                        </Button>
                    </Box>
                    <Divider flexItem variant='fullWidth' />
                    <Box sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "start",
                        width: "100%",
                        height: "80%",
                        px: 3,
                        pt: 1,
                    }}>
                        <Box sx={{
                            display: "flex",
                            justifyContent: "start",
                            flexDirection: "column",
                            alignItems: "start",
                            height: "100%",
                            width: "33%",
                            overflow: "auto",
                            scrollbarWidth: 'none',     // Firefox
                            msOverflowStyle: 'none',    // IE 10+
                            '&::-webkit-scrollbar': {   // Chrome / Safari
                                display: 'none',
                            },
                            pr: 1,
                        }}>
                            <Typography variant="h5" gutterBottom>
                                Input Info
                            </Typography>
                            <FileInfoComponent fileInfo={runningInfo.input} />
                        </Box>
                        <Box sx={{
                            display: "flex",
                            justifyContent: "start",
                            flexDirection: "column",
                            alignItems: "start",
                            height: "100%",
                            width: "33%",
                            overflow: "auto",
                        }}>
                            <Typography variant="h5" gutterBottom>
                                Output Info
                            </Typography>
                            <TaskInfoComponent taskInfo={runningInfo} />
                        </Box>
                        <Box sx={{
                            display: "flex",
                            justifyContent: "start",
                            flexDirection: "column",
                            alignItems: "start",
                            height: "100%",
                            width: "33%",
                            overflow: "auto",
                            pr: 1,
                        }}>
                            <Typography variant="h5" gutterBottom>
                                Progress Info
                            </Typography>
                            < Box sx={{
                                display: "flex",
                                flexDirection: "column",
                                alignContent: "start",
                                justifyContent: "start",
                                gap: 1,
                            }}>
                                {[
                                    ["CPU Usage", `${runningInfo.cpu_usage} %`],
                                    ["RAM Usage", `${runningInfo.ram_usage} %`],
                                    ["Start Time", new Date(runningInfo.start_time).toLocaleString('zh-CN')],
                                    ["Consumed Time", runningInfo.consumed_time],
                                    ["Frame", runningInfo.frame],
                                    ["FPS", runningInfo.fps],
                                    ["QP", runningInfo.qp],
                                    ["Bitrate", runningInfo.bitrate],
                                    ["Size", runningInfo.size],
                                    ["Completed Time", runningInfo.completed_time],
                                    ["Dup Frames", runningInfo.dup_frames],
                                    ["Drop Frames", runningInfo.drop_frames],
                                    ["Speed", `${runningInfo.speed}x`],
                                    ["ETA", runningInfo.eta],
                                ].map(([key, value]) => (
                                    <Typography key={key}>
                                        <b>{key}:</b> {value}
                                    </Typography>
                                ))}
                            </Box>
                        </Box>
                    </Box>
                    <Box sx={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        width: "100%",
                        height: "20%",
                    }}>
                        <LinearProgress variant={runningInfo.progress >= 100 || runningInfo.progress === 0 ? "indeterminate" : "determinate"} value={runningInfo.progress} sx={{ width: "80%" }} />
                        <Typography gutterBottom sx={{ ml: 1.5 }}>
                            {runningInfo.progress.toFixed(2)} %
                        </Typography>
                    </Box>
                </Box >
            </>
        );
    }
}