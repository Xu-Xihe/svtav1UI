import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Collapse,
    Button,
} from '@mui/material';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';

import { useEffect, useState } from 'react';
import React from 'react';

import { useErrorMsg } from "../components/error_popout";
import { getLocalStorage } from "../hooks/storage";
import { FileInfoComponent, TaskInfoComponent } from "../components/info";
import { api } from "../hooks/api";
import type { TaskInfo } from "../hooks/model";

interface ApiWaiting extends TaskInfo {
    has_retry: number
    error: string[]
}

export default function Waiting() {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const { pushMsg, pushError } = useErrorMsg();

    const [waitingInfo, setWaitingInfo] = useState<ApiWaiting[]>([]);
    const [taskSelected, setTaskSelected] = useState<number>(-1);

    const fetchls = () => {
        api.get(`${apiUrl}/task/waiting`).json<ApiWaiting[]>()
            .then(data => setWaitingInfo(data))
            .catch(error => pushError(error, "Waiting tasks"));
    }

    const deleteTask = (uid: number | undefined) => {
        if (uid === undefined) pushMsg("Task uid is undefined", "warning");
        api.get(`${apiUrl}/task/waiting/delete`, { searchParams: { uid } })
            .then(() => {
                fetchls();
            })
            .catch(error => pushError(error, "Delete waiting task"));
    }

    useEffect(() => {
        fetchls();
    }, [])



    if (waitingInfo.length === 0) {
        return (
            <Box sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
                width: "100%",
            }}>
                <Typography variant="h6">No waiting tasks</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{
            display: "flex",
            flexDirection: "column",
            alignContent: "start",
            justifyContent: "start",
            width: "100%",
            height: "100%",
        }}>
            <TableContainer component={Box}>
                <Table sx={{ width: "100%" }}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ minwidth: 18 }}>UID</TableCell>
                            <TableCell>Input</TableCell>
                            <TableCell>Output</TableCell>
                            <TableCell sx={{ minwidth: 8 }}>Retry</TableCell>
                            <TableCell sx={{ minwidth: 8 }}></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {waitingInfo.map((task, index) => (
                            <React.Fragment key={index}>
                                <TableRow
                                    hover
                                    onClick={() => setTaskSelected(taskSelected === index ? -1 : index)}
                                >
                                    <TableCell>{task.uid}</TableCell>
                                    <TableCell>{task.input.map((file) => file.path.split("/").pop()).join(", ")}</TableCell>
                                    <TableCell>{task.output}</TableCell>
                                    <TableCell>{task.has_retry}</TableCell>
                                    <TableCell>
                                        {taskSelected === index ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell colSpan={5} sx={{ p: 0 }}>
                                        <Collapse in={taskSelected === index} timeout="auto" unmountOnExit>
                                            <Box sx={{
                                                display: "flex",
                                                justifyContent: "end",
                                                alignItems: "start",
                                                width: "100%",
                                                px: 8,
                                                py: 1,
                                            }}>
                                                <Button variant="outlined" color='error' onClick={() => deleteTask(task.uid)} startIcon={<DeleteRoundedIcon />}>
                                                    Delete
                                                </Button>
                                            </Box>
                                            <Box sx={{
                                                display: "flex",
                                                flexDirection: "row",
                                                alignContent: "start",
                                                justifyContent: "space-between",
                                                width: "100%",
                                                gap: 1,
                                                px: 3,
                                            }}>
                                                <Box sx={{
                                                    display: "flex",
                                                    justifyContent: "start",
                                                    flexDirection: "column",
                                                    alignItems: "start",
                                                    width: "33%",
                                                    pr: 1,
                                                }}>
                                                    <Typography variant="h5" gutterBottom>
                                                        Input Info
                                                    </Typography>
                                                    <FileInfoComponent fileInfo={task.input} />
                                                </Box>
                                                <Box sx={{
                                                    display: "flex",
                                                    justifyContent: "start",
                                                    flexDirection: "column",
                                                    alignItems: "start",
                                                    width: "34%",
                                                    pr: 1,
                                                }}>
                                                    <Typography variant="h5" gutterBottom>
                                                        Output Info
                                                    </Typography>
                                                    <TaskInfoComponent taskInfo={task} />
                                                </Box>
                                                <Box sx={{
                                                    display: "flex",
                                                    justifyContent: "start",
                                                    flexDirection: "column",
                                                    alignItems: "start",
                                                    width: "33%",
                                                }}>
                                                    <Typography variant="h5" gutterBottom>
                                                        FFmpeg Config
                                                    </Typography>
                                                    < Box sx={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignContent: "start",
                                                        justifyContent: "start",
                                                        gap: 1,
                                                    }}>
                                                        {[
                                                            ["Preset", task.settings.preset],
                                                            ["Retry", task.settings.retry],
                                                            ["Overshoot Pct", task.settings.overshoot_pct],
                                                            ["Undershoot Pct", task.settings.undershoot_pct],
                                                            ["Min Section Pct", task.settings.minsection_pct],
                                                            ["Max Section Pct", task.settings.maxsection_pct],
                                                            ["Keyint", task.settings.keyint],
                                                            ["Lookahead", task.settings.lookahead],
                                                            ["SCD", task.settings.scd ? "Enabled" : "Disabled"],
                                                        ].map(([key, value]) => (
                                                            <Typography key={key} sx={{
                                                                overflowWrap: "break-word",
                                                                wordBreak: "break-word",
                                                            }}>
                                                                <b>{key}:</b> {value}
                                                            </Typography>
                                                        ))}
                                                    </Box>
                                                </Box>
                                            </Box>
                                        </Collapse>
                                    </TableCell>
                                </TableRow>
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}