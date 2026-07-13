import {
    Box,
    Button,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import PauseCircleOutlineRoundedIcon from '@mui/icons-material/PauseCircleOutlineRounded';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { useState } from 'react';

import { useErrorMsg } from "~/components/error_popout";
import { getLocalStorage } from "~/hooks/storage";
import { api } from "~/hooks/api";


const apiUrl = getLocalStorage("apiUrl", "local");
const { pushMsg, pushError } = useErrorMsg.getState();


export function StateTitle({ llm = false }: { llm?: boolean }) {
    const [pause, setPause] = useState(false);
    const [openCancel, setOpenCancel] = useState(false);

    const fetch = () => {
        api.get(`${apiUrl}/task/running/pause`).json<boolean>()
            .then((is_set) => setPause(!is_set))
            .catch((error) => pushError(error, "Get Pause/Resume Status"));
    }

    const submit = () => {
        api.post(`${apiUrl}/task/running/pause`, { searchParams: { set: pause } }).json<boolean>()
            .then((is_set) => {
                setPause(!is_set);
                pushMsg(`Task ${!is_set ? "paused" : "resumed"} successfully.`, "success");
            })
            .catch((error) => pushError(error, "Set Pause/Resume Status"));
    }

    return (
        <Box sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
        }}>
            <Typography variant="h4">
                Running Task
            </Typography>
            <Box sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 3,
            }}>
                <Button
                    disabled={llm}
                    color={pause ? "error" : "primary"}
                    variant={pause ? 'contained' : 'outlined'}
                    startIcon={pause ? <PlayCircleOutlineRoundedIcon /> : <PauseCircleOutlineRoundedIcon />}
                    onClick={submit}
                    onMouseEnter={fetch}
                >
                    {pause ? "Resume" : "Pause"}
                </Button>
                <Button
                    disabled={llm}
                    variant='outlined'
                    color='error'
                    startIcon={<CloseRoundedIcon />}
                    onClick={() => setOpenCancel(true)}
                >
                    Cancel
                </Button>
                {openCancel && <CancelPopout onClose={() => setOpenCancel(false)} />}
            </Box>
        </Box>
    );
}


function CancelPopout({ onClose }: { onClose: () => void }) {
    const cancel = () => {
        api.get(`${apiUrl}/task/running/cancel`)
            .then(() => {
                pushMsg("Task cancelled successfully.", "info");
                onClose();
            })
            .catch((error) => {
                pushError(error, "Cancel Task");
                onClose();
            });
    }

    return (
        <Dialog open onClose={onClose} fullWidth>
            <DialogTitle>
                <Typography variant="h6" sx={{ fontWeight: "bold" }}>
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
                    onClick={onClose}
                >
                    No
                </Button>
                <Button
                    color="error"
                    variant="contained"
                    onClick={cancel}
                >
                    Yes
                </Button>
            </DialogActions>
        </Dialog>
    );
}