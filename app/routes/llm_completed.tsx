import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    Dialog,
    DialogTitle,
    DialogActions,
} from '@mui/material';
import { useEffect, useState } from 'react';

import { useErrorMsg } from "../components/error_popout";
import { getLocalStorage } from "../hooks/storage";
import { api } from "../hooks/api";
import { type LanguageKey, Language } from '../hooks/model';
import { NoContent } from '~/components/no_content';


interface ApiLLMCompleted {
    input: string
    output: string
    org_lang: LanguageKey
    tran_lang: LanguageKey
    finished_time: string
}

export default function LLMCompleted() {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const { pushError } = useErrorMsg();

    const [tasks, setTasks] = useState<ApiLLMCompleted[]>([]);
    const [clearConfirmOpen, setClearConfirmOpen] = useState(false);


    const fetchls = () => {
        api.get(`${apiUrl}/task/completed/llm`).json<ApiLLMCompleted[]>()
            .then(data => setTasks(data))
            .catch(error => pushError(error, "Completed tasks"));
    }

    const clearList = () => {
        api.post(`${apiUrl}/task/completed/llm/clear`)
            .then(() => {
                fetchls();
                setClearConfirmOpen(false);
            })
            .catch(error => pushError(error, "Clear completed tasks"));
    }

    useEffect(() => { fetchls(); }, [])


    if (tasks.length === 0) { return (<NoContent title="LLM completed" />); }

    return (
        <Box sx={{
            display: "flex",
            flexDirection: "column",
            alignContent: "start",
            justifyContent: "start",
            width: "100%",
            height: "100%",
        }}>
            <Dialog open={clearConfirmOpen} onClose={() => setClearConfirmOpen(false)} >
                <DialogTitle>Are you sure to clear the completed tasks list?</DialogTitle>
                <DialogActions>
                    <Button onClick={() => setClearConfirmOpen(false)} variant='outlined'>Cancel</Button>
                    <Button onClick={clearList} variant='contained'>Clear</Button>
                </DialogActions>
            </Dialog>
            <TableContainer component={Box}>
                <Table sx={{ width: "100%" }} stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell>Input</TableCell>
                            <TableCell>Output</TableCell>
                            <TableCell sx={{ minWidth: 163 }} align='center'>Original Language</TableCell>
                            <TableCell sx={{ minWidth: 168 }} align='center'>Translated Language</TableCell>
                            <TableCell sx={{ minWidth: 263 }} align='left'>
                                Finished Time
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={() => setClearConfirmOpen(true)}
                                    sx={{ ml: 3 }}
                                >
                                    Clear List
                                </Button>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {tasks.map((task, index) => (
                            <TableRow key={index} hover>
                                <TableCell>{task.input}</TableCell>
                                <TableCell>{task.output}</TableCell>
                                <TableCell align='center'>{Language[task.org_lang]}</TableCell>
                                <TableCell align='center'>{Language[task.tran_lang]}</TableCell>
                                <TableCell align='left'>{new Date(task.finished_time).toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer >
        </Box >
    );
}