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
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';

import { useEffect, useState } from 'react';
import React from 'react';

import { useErrorMsg } from "../components/error_popout";
import { getLocalStorage } from "../hooks/storage";
import { FileInfoComponent } from "../components/info";
import { api } from "../hooks/api";
import type { FileInfo } from '../hooks/model';


interface ApiCompleted {
    input: FileInfo[]
    output: FileInfo
    total_consumed: string
    finished_time: string
}

export default function Completed() {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const { pushError } = useErrorMsg();

    const [completedInfo, setCompletedInfo] = useState<ApiCompleted[]>([]);
    const [taskSelected, setTaskSelected] = useState<number>(-1);


    const fetchls = () => {
        api.get(`${apiUrl}/task/completed`).json<ApiCompleted[]>()
            .then(data => setCompletedInfo(data))
            .catch(error => pushError(error, "Completed tasks"));
    }

    const clearList = () => {
        api.post(`${apiUrl}/task/completed/clear`)
            .then(() => {
                fetchls();
            })
            .catch(error => pushError(error, "Clear completed tasks"));
    }

    useEffect(() => {
        fetchls();
    }, [])


    if (completedInfo.length === 0) {
        return (
            <Box sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
                width: "100%",
            }}>
                <Typography variant="h6">No completed tasks</Typography>
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
                            <TableCell>Input</TableCell>
                            <TableCell>Output</TableCell>
                            <TableCell>Total Consumed Time</TableCell>
                            <TableCell>Finished Time</TableCell>
                            <TableCell>
                                <Button variant="contained" color="primary" onClick={clearList}>
                                    Clear List
                                </Button>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {completedInfo.map((task, index) => (
                            <React.Fragment key={index}>
                                <TableRow
                                    hover
                                    onClick={() => setTaskSelected(taskSelected === index ? -1 : index)}
                                >
                                    <TableCell>{task.input.map((file) => file.path.split("/").pop()).join(", ")}</TableCell>
                                    <TableCell>{task.output.path}</TableCell>
                                    <TableCell>{task.total_consumed}</TableCell>
                                    <TableCell>{new Date(task.finished_time).toLocaleString('zh-CN')}</TableCell>
                                    <TableCell>
                                        {taskSelected === index ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                                    </TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell colSpan={5} sx={{ paddingBottom: 0, paddingTop: 0 }}>
                                        <Collapse in={taskSelected === index} timeout="auto" unmountOnExit>
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
                                                    width: "50%",
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
                                                    width: "50%",
                                                }}>
                                                    <Typography variant="h5" gutterBottom>
                                                        Output Info
                                                    </Typography>
                                                    <FileInfoComponent fileInfo={[task.output]} />
                                                </Box>
                                            </Box>
                                        </Collapse>
                                    </TableCell>
                                </TableRow>
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer >
        </Box >
    );
}