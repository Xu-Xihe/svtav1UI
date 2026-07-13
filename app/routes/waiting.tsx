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
    IconButton,
    Tooltip,
    Switch,
} from '@mui/material';
import BlurOnRoundedIcon from '@mui/icons-material/BlurOnRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import VerticalAlignTopRoundedIcon from '@mui/icons-material/VerticalAlignTopRounded';

import React, { useEffect, useRef, useState } from 'react';

import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';

import { useErrorMsg } from "../components/error_popout";
import useLocalStorage, { getLocalStorage } from "../hooks/storage";
import { FileInfoComponent, TaskInfoComponent } from "../components/info";
import { api } from "../hooks/api";
import type { TaskInfo, FileETAInfo } from "../hooks/model";
import { EtaText, getEta } from "../hooks/eta";
import { NoContent } from "../components/no_content";

interface ApiWaiting extends TaskInfo {
    has_retry: number
    error: string[]
    sort: number
    eta: FileETAInfo
    eta_v: number
}

interface ApiSort {
    uid: number
    last?: number
    next?: number
}


function throttle<T extends (...args: any[]) => void>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let canRun = true;

    return (...args: Parameters<T>) => {
        if (!canRun) return;

        canRun = false;
        fn(...args);

        setTimeout(() => {
            canRun = true;
        }, delay);
    };
}


export default function Waiting() {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const { pushMsg, pushError } = useErrorMsg();
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [scrollTop, setScrollTop] = useLocalStorage("scrollTop", true, "local");

    const [waitingInfo, setWaitingInfo] = useState<ApiWaiting[]>([]);
    const [taskExtend, setTaskExtend] = useState<number>(-1);

    const resortTask = (oldIndex: number, newIndex: number) => {
        if (oldIndex === newIndex) return;

        const newArr = [...waitingInfo];
        const [item] = newArr.splice(oldIndex, 1);
        newArr.splice(newIndex, 0, item);
        setWaitingInfo(newArr);

        const data: ApiSort = {
            uid: item.uid ?? -1,
            last: newArr[newIndex - 1]?.uid,
            next: newArr[newIndex + 1]?.uid,
        };

        api.post(`${apiUrl}/task/waiting/sort`, { json: data })
            .catch(error => {
                pushError(error, "Resort waiting tasks");
                setWaitingInfo(waitingInfo);
            });
    }

    const fetchls = throttle(() => {
        api.get(`${apiUrl}/task/waiting`).json<ApiWaiting[]>()
            .then(async (data) => {
                const newData = await Promise.all(
                    data.map(async (task) => {
                        const eta_v = task.args.video_br > 0 ? await getEta(task) : -1;
                        return {
                            ...task,
                            eta_v,
                        };
                    })
                );

                setWaitingInfo(newData);
            })
            .catch(error => pushError(error, "Waiting tasks"));
    }, 8000);

    const deleteTask = (uid: number | undefined) => {
        if (uid === undefined) pushMsg("Task uid is undefined", "warning");
        api.get(`${apiUrl}/task/waiting/delete`, { searchParams: { uid } })
            .then(() => {
                fetchls();
            })
            .catch(error => pushError(error, "Delete waiting task"));
    }

    useEffect(() => { fetchls(); }, []);


    function SortableFileInfo({ task, index }: { task: ApiWaiting, index: number }) {
        const { ref, handleRef } = useSortable({ id: task.uid || -1, index });

        return (
            <TableRow
                ref={ref}
                hover
                onClick={() => setTaskExtend(taskExtend === task.uid ? -1 : task.uid || -1)}
            >
                <TableCell>{task.uid}</TableCell>
                <TableCell>{task.input.map((file) => file.path.split("/").pop()).join(", ")}</TableCell>
                <TableCell>{task.output}</TableCell>
                <TableCell>
                    <EtaText eta={task.eta_v} />
                </TableCell>
                <TableCell>{task.has_retry}</TableCell>
                <TableCell>
                    <Box sx={{
                        display: "flex",
                        flexDirection: "row",
                        alignContent: "center",
                        justifyContent: "center",
                        width: "100%",
                        gap: 1,
                    }}>
                        <IconButton
                            color="error"
                            onMouseEnter={() => fetchls()}
                            onClick={(e) => {
                                e.stopPropagation();
                                deleteTask(task.uid);
                            }}
                        >
                            <DeleteForeverRoundedIcon />
                        </IconButton>
                        <Tooltip title="Move to Top" placement="bottom">
                            <IconButton
                                onClick={(e) => {
                                    e.stopPropagation();
                                    resortTask(index, 0);
                                }}
                                onMouseEnter={() => fetchls()}
                            >
                                <VerticalAlignTopRoundedIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Drag to reorder" placement="bottom">
                            <IconButton
                                ref={handleRef}
                                onPointerDown={(e) => e.stopPropagation()}
                                onMouseEnter={() => fetchls()}
                            >
                                <BlurOnRoundedIcon />
                            </IconButton>
                        </Tooltip>
                        <IconButton disableRipple>
                            {taskExtend === task.uid ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                        </IconButton>
                    </Box>
                </TableCell>
            </TableRow>
        )
    }


    if (waitingInfo.length === 0) { return (<NoContent title="waiting" />); }

    return (
        <Box sx={{
            display: "flex",
            flexDirection: "column",
            alignContent: "start",
            justifyContent: "start",
            width: "100%",
            height: "100%",
        }}>
            <TableContainer component={Box} ref={containerRef}>
                <Table sx={{ width: "100%" }} stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ minWidth: 18 }}>UID</TableCell>
                            <TableCell>Input</TableCell>
                            <TableCell>Output</TableCell>
                            <TableCell sx={{ minWidth: 188 }}>
                                <EtaText eta={waitingInfo.reduce((sum, task) => sum + Math.max(task.eta_v, 0), 0)} title="Total ETA: " />
                            </TableCell>
                            <TableCell sx={{ minWidth: 8 }}>Retry</TableCell>
                            <TableCell sx={{ minWidth: 8 }}>
                                <Tooltip title="Auto scroll to top when move task to top." placement="top" arrow>
                                    <Switch checked={scrollTop} onChange={(_, v) => setScrollTop(v)} />
                                </Tooltip>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <DragDropProvider
                            onDragEnd={({ operation }) => {
                                // @ts-ignore
                                const newIndex = operation.source?.index;
                                // @ts-ignore
                                const oldIndex = operation.source?.initialIndex;

                                if (newIndex === undefined || oldIndex === undefined || newIndex === oldIndex) return;

                                resortTask(oldIndex, newIndex);
                            }}
                            onDragStart={() => { setTaskExtend(-1) }}
                        >
                            {waitingInfo.map((task, index) => (
                                <React.Fragment key={task.uid}>
                                    <SortableFileInfo task={task} index={index} />
                                    <TableRow sx={{ p: 0, m: 0 }}>
                                        <TableCell colSpan={6} sx={{ p: 0, m: 0 }}>
                                            <Collapse in={taskExtend === task.uid} timeout="auto" unmountOnExit>
                                                <Box sx={{
                                                    display: "flex",
                                                    flexDirection: "row",
                                                    alignContent: "start",
                                                    justifyContent: "space-between",
                                                    width: "100%",
                                                    gap: 1,
                                                    p: 3,
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
                                                        <TaskInfoComponent task={task} />
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
                        </DragDropProvider>
                    </TableBody>
                </Table>
            </TableContainer>
        </Box >
    );
}