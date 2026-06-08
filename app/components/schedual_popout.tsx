import {
    Box,
    Button,
    IconButton,
    Switch,
    Typography,
    Tooltip,
    TextField,
    Badge,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    ListItemButton,
    ListItemIcon,
    Collapse,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from "@mui/material";
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import SettingsBackupRestoreRoundedIcon from '@mui/icons-material/SettingsBackupRestoreRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { Dayjs, type ManipulateType } from 'dayjs';

import { useEffect, useState } from "react";

import { api } from "../hooks/api";
import { useErrorMsg } from "../components/error_popout";
import useLocalStorage, { getLocalStorage } from "../hooks/storage";
import type { TaskSchedule } from "../hooks/model";


const defaultQuickSet: [number, ManipulateType][] = [
    [3, "minute"],
    [10, "minute"],
    [30, "minute"],
    [1, "hour"],
    [3, "hour"],
    [5, "hour"],
    [8, "hour"],
    [10, "hour"],
];


const IntervalPicker = ({ org = 0, onChange, onClose }: { org?: number; onChange: (value: number) => void; onClose?: () => void }) => {
    const [hour, setHour] = useState<string>(Math.floor(org / 60).toString());
    const [minute, setMinute] = useState<string>((org % 60).toString());

    return (
        <Box sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,

            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            p: 1,
        }}>
            <TextField
                type="number"
                size="small"
                value={hour}
                onChange={(e) => setHour(e.target.value)}
                sx={{ width: 80 }}
            />
            <Typography variant="body1" sx={{ mr: 3 }}>
                hours
            </Typography>
            <TextField
                type="number"
                size="small"
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                sx={{ width: 80 }}
            />
            <Typography variant="body1" sx={{ mr: 3 }}>
                minutes
            </Typography>
            {onClose &&
                <>
                    <IconButton color="error" onClick={onClose}>
                        <CloseRoundedIcon />
                    </IconButton>
                    <IconButton
                        disabled={Number(hour) <= 0 && Number(minute) <= 0}
                        color="primary"
                        onClick={() => {
                            onChange((Number(hour) || 0) * 60 + (Number(minute) || 0));
                            onClose();
                        }}
                    >
                        <DoneAllRoundedIcon />
                    </IconButton>
                </>
            }
        </Box>
    );
}


export default function SchedualPopout({ onClose }: { onClose: () => void }) {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const { pushError } = useErrorMsg();

    const [schedual, setSchedual] = useState<TaskSchedule>({
        on: false,
        finish_time: dayjs().toISOString(),
        max_extend: 0,
        sort: "default",
        weight: "size",
    });
    const [quickSetJson, setQuickSetJson] = useLocalStorage("quickSet", JSON.stringify(defaultQuickSet), "local");
    const [quickSet, setQuickSet] = useState<[number, ManipulateType][]>(defaultQuickSet);

    const [editQuickSet, setEditQuickSet] = useState<boolean>(false);
    const [showIpicker, setShowIpicker] = useState<boolean>(false);
    const [showExtend, setShowExtend] = useState<boolean>(false);


    const updateSchedual = () => {
        api.post(`${apiUrl}/plan/status`, { json: schedual })
            .catch((error) => {
                pushError(error, "Update Schedual");
            });
    };


    useEffect(() => {
        setQuickSet(JSON.parse(quickSetJson));
        api.get(`${apiUrl}/plan/status`).json<TaskSchedule>()
            .then((res) => {
                setSchedual(res);
            })
            .catch((error) => {
                pushError(error, "Fetch Schedual");
            });
    }, []);

    useEffect(() => {
        setQuickSetJson(JSON.stringify(quickSet));
    }, [quickSet]);


    return (
        <Dialog open onClose={onClose} fullWidth onKeyDown={(e) => {
            if (e.key === "Escape") {
                onClose();
            }
            if (e.key == "Enter") {
                updateSchedual();
                onClose();
            }
        }}>
            <DialogTitle>
                <Box sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexDirection: "row",
                }}>
                    Task Schedual
                    <Box sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                    }}>
                        <Typography variant="body1">
                            Enable
                        </Typography>
                        <Switch checked={schedual?.on || false} onChange={(e) => setSchedual(prev => ({ ...prev, on: e.target.checked } as TaskSchedule))} />
                    </Box>
                </Box>
            </DialogTitle>
            <DialogContent>
                <Box sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.8,
                    py: 1,
                }}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DateTimePicker
                            disabled={!schedual?.on}
                            label="End Time"
                            value={schedual?.finish_time ? dayjs(schedual.finish_time) : dayjs()}
                            onChange={(newValue) => {
                                setSchedual(prev => ({ ...prev, finish_time: newValue ? newValue.toISOString() : dayjs().toISOString() } as TaskSchedule));
                            }}
                        />
                    </LocalizationProvider>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                        <Typography variant="h6" color={!schedual?.on ? "textDisabled" : "textPrimary"}>
                            Quick Set
                        </Typography>
                        <Tooltip title="Custom Set">
                            <IconButton
                                onClick={() => setEditQuickSet(prev => !prev)}
                                color={editQuickSet ? "primary" : "default"}
                                disabled={!schedual?.on}
                            >
                                <SettingsRoundedIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Restore Default">
                            <IconButton
                                onClick={() => setQuickSet(defaultQuickSet)}
                                disabled={!schedual?.on}
                            >
                                <SettingsBackupRestoreRoundedIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Set by Time">
                            <IconButton
                                onClick={() => setShowIpicker(prev => !prev)}
                                color={showIpicker ? "primary" : "default"}
                                disabled={editQuickSet || !schedual?.on}
                            >
                                <ScheduleRoundedIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                    {showIpicker &&
                        <IntervalPicker
                            onClose={() => setShowIpicker(false)}
                            onChange={(value) => {
                                if (editQuickSet) {
                                    if ((quickSet.some(item => (item[0] === value && item[1] === "minute") || (item[0] * 60 === value && item[1] === "hour"))) || value === 0)
                                        return;
                                    else {
                                        setQuickSet(prev => [...prev, [value, "minute"]]);
                                    }
                                }
                                else {
                                    const newFinishTime = dayjs().add(value, "minute").toISOString();
                                    setSchedual(prev => ({ ...prev, finish_time: newFinishTime } as TaskSchedule));
                                }
                            }}
                        />
                    }
                    <Box sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        columnGap: 1.8,
                        rowGap: 1,
                        flexWrap: "wrap",
                    }}>
                        {quickSet.map(([value, unit]) => (
                            <Badge
                                invisible={!editQuickSet}
                                color="error"
                                badgeContent={
                                    <IconButton
                                        size="small"
                                        sx={{
                                            width: 16,
                                            height: 16,
                                            backgroundColor: "error.main",
                                            color: "white",
                                            "&:hover": {
                                                backgroundColor: "error.dark",
                                            },
                                        }}
                                        onClick={() => {
                                            setQuickSet(prev => prev.filter(item => item[0] !== value || item[1] !== unit));
                                        }}
                                        disabled={!schedual?.on}
                                    >
                                        <CloseRoundedIcon sx={{ fontSize: 12 }} />
                                    </IconButton>
                                }
                                key={value + unit}
                                anchorOrigin={{
                                    vertical: 'top',
                                    horizontal: 'left',
                                }}
                                sx={{
                                    "& .MuiBadge-badge": {
                                        minWidth: 16,
                                        height: 16,
                                        borderRadius: "50%",
                                        padding: 0,
                                    },
                                }}
                            >
                                <Button
                                    disabled={!schedual?.on}
                                    variant="outlined"
                                    onClick={() => {
                                        if (editQuickSet) {
                                            setQuickSet(prev => prev.filter(item => item[0] !== value || item[1] !== unit));
                                        }
                                        else {
                                            const newFinishTime = dayjs().add(value, unit).toISOString();
                                            setSchedual(prev => ({ ...prev, finish_time: newFinishTime } as TaskSchedule));
                                        }
                                    }}
                                >
                                    {unit === "minute" && value >= 60 ? `${Math.floor(value / 60)} ${value % 60 === 0 ? "hour" : `h ${value % 60} m`}` : `${value} ${unit}`}
                                </Button>
                            </Badge>
                        ))}
                        {editQuickSet &&
                            <Button
                                variant="outlined"
                                startIcon={<AddCircleOutlineRoundedIcon />}
                                onClick={() => setShowIpicker(true)}
                            >
                                Add
                            </Button>
                        }
                    </Box>
                </Box>
                <ListItemButton disabled={!schedual?.on} onClick={() => setShowExtend(prev => !prev)}>
                    <ListItemIcon>
                        {showExtend ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                    </ListItemIcon>
                    <Typography variant="h6">
                        Extend Settings
                    </Typography>
                </ListItemButton>
                <Collapse in={showExtend && schedual?.on} timeout="auto" unmountOnExit sx={{ gap: 1.8 }}>
                    <Box sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        flexDirection: "column",
                        py: 1.8,
                    }}>
                        <Typography variant="body1" sx={{ mb: 0.8 }}>
                            Max Allowed Extend Time
                        </Typography>
                        <IntervalPicker
                            org={schedual?.max_extend || 0}
                            onChange={(value) => setSchedual(prev => ({ ...prev, max_extend: value < 0 ? 0 : value } as TaskSchedule))}
                        />
                        <FormControl sx={{ minWidth: 168, mt: 3 }}>
                            <InputLabel>Sort</InputLabel>
                            <Select
                                value={schedual?.sort || "default"}
                                label="Sort"
                                onChange={(e) => setSchedual(prev => ({ ...prev, sort: e.target.value } as TaskSchedule))}
                            >
                                <MenuItem value={"default"}>Default</MenuItem>
                                <MenuItem value={"longest"}>Longest First</MenuItem>
                                <MenuItem value={"shortest"}>Shortest First</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl sx={{ minWidth: 168, mt: 3 }}>
                            <InputLabel>Weight</InputLabel>
                            <Select
                                value={schedual?.weight || "default"}
                                label="Weight"
                                onChange={(e) => setSchedual(prev => ({ ...prev, weight: e.target.value } as TaskSchedule))}
                            >
                                <MenuItem value={"size"}>File Size</MenuItem>
                                <MenuItem value={"duration"}>Duration</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </Collapse>
            </DialogContent>
            <DialogActions>
                <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 3 }}>
                    <Button variant="outlined" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="contained" onClick={() => {
                        updateSchedual();
                        onClose();
                    }}>
                        Apply
                    </Button>
                </Box>
            </DialogActions>
        </Dialog >
    );
}