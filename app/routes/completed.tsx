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
    IconButton,
    Dialog,
    DialogTitle,
    DialogActions,
} from '@mui/material';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';

import { useEffect, useState } from 'react';
import React from 'react';

import { pushError } from "../components/error_popout";
import { getLocalStorage } from "../hooks/storage";
import { FileInfoComponent } from "../components/info";
import { api } from "../hooks/api";
import type { FileInfo } from '../hooks/model';
import { NoContent } from '~/components/no_content';


interface ApiCompleted {
    input: FileInfo[]
    output: FileInfo
    total_consumed: string
    finished_time: string
}

export default function Completed() {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const [completedInfo, setCompletedInfo] = useState<ApiCompleted[]>([]);
    const [taskSelected, setTaskSelected] = useState<number>(-1);
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);


    const fetchls = () => {
        api.get(`${apiUrl}/task/completed`).json<ApiCompleted[]>()
            .then(data => setCompletedInfo(data))
            .catch(error => pushError(error, "Completed tasks"));
    }

    const clearList = () => {
        api.post(`${apiUrl}/task/completed/clear`)
            .then(() => {
                fetchls();
                setClearConfirmOpen(false);
            })
            .catch(error => pushError(error, "Clear completed tasks"));
    }

    useEffect(() => { fetchls(); }, [])


    if (completedInfo.length === 0) { return (<NoContent title="completed" />); }

    return (
        <>
            <Dialog open={clearConfirmOpen} onClose={() => setClearConfirmOpen(false)} >
                <DialogTitle>Are you sure to clear the completed tasks list?</DialogTitle>
                <DialogActions>
                    <Button onClick={() => setClearConfirmOpen(false)} variant='outlined'>Cancel</Button>
                    <Button onClick={clearList} variant='contained'>Clear</Button>
                </DialogActions>
            </Dialog>
            <TableContainer
                component={Box}
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignContent: "start",
                    justifyContent: "start",
                    width: "100%",
                    height: "100%",
                    overflowY: "auto",
                    scrollbarWidth: "none",
                    "&::-webkit-scrollbar": {
                        display: "none",
                    },
                }}
            >
                <Table stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell>Input</TableCell>
                            <TableCell sx={{ width: "100%" }}>Output</TableCell>
                            <TableCell sx={{ whiteSpace: "nowrap" }} align='center'>Total Consumed Time</TableCell>
                            <TableCell sx={{ whiteSpace: "nowrap" }} align='center'>Finished Time</TableCell>
                            <TableCell sx={{ whiteSpace: "nowrap" }} align='center'>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={() => setClearConfirmOpen(true)}
                                >
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
                                    <TableCell sx={{ width: "100%", overflowWrap: "anywhere" }}>{task.output.path}</TableCell>
                                    <TableCell sx={{ whiteSpace: "nowrap" }} align='center'>{task.total_consumed}</TableCell>
                                    <TableCell sx={{ whiteSpace: "nowrap" }} align='center'>{new Date(task.finished_time).toLocaleString()}</TableCell>
                                    <TableCell sx={{ whiteSpace: "nowrap" }} align='center'>
                                        <IconButton disableRipple>
                                            {taskSelected === index ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                                <TableRow sx={{ p: 0, m: 0 }}>
                                    <TableCell colSpan={5} sx={{ p: 0, m: 0 }}>
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
        </>
    );
}