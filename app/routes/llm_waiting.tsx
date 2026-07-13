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
} from '@mui/material';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';

import { useEffect, useState } from 'react';

import { useErrorMsg } from "../components/error_popout";
import { getLocalStorage } from "../hooks/storage";
import { api } from "../hooks/api";
import { type LLMTaskInfo, Language } from "../hooks/model";


export default function LLMWaiting() {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const { pushError } = useErrorMsg();

    const [tasks, setTasks] = useState<LLMTaskInfo[]>([]);

    const fetch = () => {
        api.get(`${apiUrl}/task/waiting/llm`).json<LLMTaskInfo[]>()
            .then(data => setTasks(data))
            .catch(error => pushError(error, "Failed tasks"));
    }

    const deleteItem = (uid: number) => {
        api.post(`${apiUrl}/task/waiting/llm/delete`, { searchParams: { uid } }).json()
            .then(() => setTasks(tasks.filter(task => task.uid !== uid)))
            .catch(error => pushError(error, "Delete task"));
    }


    useEffect(() => { fetch(); }, []);


    if (tasks.length === 0) {
        return (
            <Box sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
                width: "100%",
            }}>
                <Typography variant="h6">No LLM waiting tasks</Typography>
            </Box>
        );
    }

    else {
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
                    <Table sx={{ width: "100%" }} stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell>UID</TableCell>
                                <TableCell>Input</TableCell>
                                <TableCell>Output</TableCell>
                                <TableCell>Original Language</TableCell>
                                <TableCell>Translation Language</TableCell>
                                <TableCell align="right" sx={{ minWidth: 163 }} />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {tasks.map((task) => (
                                <TableRow key={task.output}>
                                    <TableCell>{task.uid}</TableCell>
                                    <TableCell>{task.input}</TableCell>
                                    <TableCell>{task.output}</TableCell>
                                    <TableCell>{Language[task.org_lang]}</TableCell>
                                    <TableCell>{Language[task.tran_lang]}</TableCell>
                                    <TableCell>
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
        );
    }
}