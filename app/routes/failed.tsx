import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
} from '@mui/material';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';

import { useEffect, useState } from 'react';

import { useErrorMsg } from "../components/error_popout";
import { getLocalStorage } from "../hooks/storage";
import { api } from "../hooks/api";
import type { TaskInfo } from "../hooks/model";
import InsertTask from '../components/insert_task';

interface ApiFailed extends TaskInfo {
    error: string[]
}

export default function Failed() {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const { pushMsg, pushError } = useErrorMsg();

    const [failedInfo, setFailedInfo] = useState<ApiFailed[]>([]);
    const [errorDialog, setErrorDialog] = useState<number>(-1);
    const [insertTask, setInsertTask] = useState<ApiFailed | null>(null);

    const fetchls = () => {
        api.get(`${apiUrl}/task/failed`).json<ApiFailed[]>()
            .then(data => setFailedInfo(data))
            .catch(error => pushError(error, "Failed tasks"));
    }

    const deleteItem = (uid: number) => {
        if (!uid) {
            pushMsg("Invalid task UID.");
            return;
        }
        api.get(`${apiUrl}/task/failed/delete`, { searchParams: { uid } })
            .then(() => {
                fetchls();
            })
            .catch(error => pushError(error, "Delete failed task"));
    }

    useEffect(() => {
        fetchls();
    }, [])

    if (failedInfo.length === 0) {
        return (
            <Box sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
                width: "100%",
            }}>
                <Typography variant="h6">No failed tasks</Typography>
            </Box>
        );
    }

    return (
        <>
            {insertTask &&
                <InsertTask
                    open
                    org_task={insertTask}
                    onClose={() => {
                        insertTask?.uid
                            ? deleteItem(insertTask.uid)
                            : pushMsg("Delete task failed.");
                        setInsertTask(null);
                        fetchls();
                    }}
                    onCancelled={() => setInsertTask(null)}
                />}
            <Dialog
                open={errorDialog !== -1}
                onClose={() => setErrorDialog(-1)}
                maxWidth={false}
            >
                <DialogTitle>Error Details</DialogTitle>
                <DialogContent sx={{
                    display: "flex",
                    flexDirection: "column",
                    maxHeight: '60vh',
                    minWidth: '50vw',
                    gap: 1,
                    m: 3,
                }}>
                    {errorDialog !== -1 && failedInfo[errorDialog].error.map((line, index) => (
                        <>
                            <Typography key={index} color='error' variant='h6'>
                                {`Error ${index + 1}:`}
                            </Typography>
                            <Typography key={index} sx={{ pl: 4 }}>
                                {line}
                            </Typography>
                        </>
                    ))}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setErrorDialog(-1)} variant="contained" sx={{ mr: 6, mb: 1 }}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
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
                                <TableCell></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {failedInfo.map((task, index) => (
                                <TableRow key={index}>
                                    <TableCell>{task.input.map(file => file.path.split("/").slice(-1)[0]).join(", ")}</TableCell>
                                    <TableCell>{task.output}</TableCell>
                                    <TableCell sx={{ gap: 1 }}>
                                        <IconButton onClick={() => { setErrorDialog(index) }}>
                                            <InfoOutlineRoundedIcon />
                                        </IconButton>
                                        <IconButton onClick={() => { setInsertTask(task); }}>
                                            <ReplayRoundedIcon />
                                        </IconButton>
                                        <IconButton onClick={() => deleteItem(task.uid!)}>
                                            <DeleteRoundedIcon color='error' />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box >
        </>
    );
}