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

import { pushMsg, pushError } from "../components/error_popout";
import { getLocalStorage } from "../hooks/storage";
import { api } from "../hooks/api";
import type { TaskInfo } from "../hooks/model";
import InsertTaskDialog from '~/components/insert';
import InsertLLMTaskDialog from '~/components/insert/llm_index';
import { NoContent } from "../components/no_content";

interface ApiFailed extends TaskInfo {
    error: string[];
    time: string;
}

export default function Failed() {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const [failedInfo, setFailedInfo] = useState<ApiFailed[]>([]);
    const [errorDialog, setErrorDialog] = useState<number>(-1);
    const [insertTask, setInsertTask] = useState<ApiFailed | null>(null);
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

    const fetchls = () => {
        api.get(`${apiUrl}/task/failed`).json<ApiFailed[]>()
            .then(data => setFailedInfo(data))
            .catch(error => pushError(error, "Failed tasks"));
    }

    const deleteItem = (uid: number) => {
        if (!uid) { pushMsg("Invalid task UID."); return; }
        api.post(`${apiUrl}/task/failed/delete`, { searchParams: { uid } })
            .then(() => { fetchls(); })
            .catch(error => pushError(error, "Delete failed task"));
    }

    useEffect(() => { fetchls(); }, [])

    if (failedInfo.length === 0) { return (<NoContent title="failed" />); }

    return (
        <>
            <Dialog open={clearConfirmOpen} onClose={() => setClearConfirmOpen(false)} >
                <DialogTitle>Are you sure to clear the failed tasks list?</DialogTitle>
                <DialogActions>
                    <Button onClick={() => setClearConfirmOpen(false)} variant='outlined'>Cancel</Button>
                    <Button
                        onClick={() => {
                            api.post(`${apiUrl}/task/failed/clear`)
                                .then(() => {
                                    fetchls();
                                })
                                .catch(error => pushError(error, "Clear failed tasks"));
                            setClearConfirmOpen(false);
                        }}
                        variant='contained'>
                        Clear
                    </Button>
                </DialogActions>
            </Dialog>
            {insertTask && (
                typeof insertTask.input === "string"
                    ? <InsertLLMTaskDialog
                        retry_task={{
                            input: insertTask.input,
                            output: insertTask.output,
                            org_lang: insertTask.args.subtitle!,
                            tran_lang: insertTask.args.tran!,
                        }}
                        onClose={() => {
                            insertTask?.uid
                                ? deleteItem(insertTask.uid)
                                : pushMsg("Delete task failed.");
                            setInsertTask(null);
                            fetchls();
                        }}
                        onCancel={() => setInsertTask(null)}
                    />
                    : <InsertTaskDialog
                        retry_task={insertTask}
                        onClose={() => {
                            insertTask?.uid
                                ? deleteItem(insertTask.uid)
                                : pushMsg("Delete task failed.");
                            setInsertTask(null);
                            fetchls();
                        }}
                        onCancel={() => setInsertTask(null)}
                    />
            )}
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
            <TableContainer
                component={Box}
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignContent: "start",
                    justifyContent: "start",
                    width: "100%",
                    height: "100%",
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
                            <TableCell>Output</TableCell>
                            <TableCell sx={{ whiteSpace: "nowrap" }}>Time</TableCell>
                            <TableCell sx={{ whiteSpace: "nowrap" }}>
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
                        {failedInfo.map((task, index) => (
                            <TableRow key={index}>
                                {typeof task.input === "object"
                                    ? <TableCell>{task.input.map(file => file.path.split("/").slice(-1)[0]).join(", ")}</TableCell>
                                    : <TableCell>{task.input}</TableCell>
                                }
                                <TableCell sx={{ width: "100%", overflowWrap: "anywhere" }}>{task.output}</TableCell>
                                <TableCell sx={{ whiteSpace: "nowrap" }}>{new Date(task.time).toLocaleString()}</TableCell>
                                <TableCell sx={{ gap: 1, whiteSpace: "nowrap" }}>
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
        </>
    );
}