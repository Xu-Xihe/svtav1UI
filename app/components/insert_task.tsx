import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Divider,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    IconButton,
    TextField,
    Autocomplete,
    Switch,
    Tooltip,
    Slider,
    Collapse,
    Select,
    MenuItem,
} from "@mui/material";
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import RemoveCircleRoundedIcon from '@mui/icons-material/RemoveCircleRounded';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';

import React, { useEffect, useState } from 'react';

import { useNavigate } from "react-router";

import { useErrorMsg } from "../components/error_popout";
import { getLocalStorage } from "../hooks/storage";
import useLocalStorage from "../hooks/storage";
import { api } from "../hooks/api";
import { FileInfoComponent } from "./info";
import type { Settings, TaskInfo, FileInfo, TranscodeInfo } from "../hooks/model";
import { Rotate } from "../hooks/model";

interface PathInfo {
    dir: string[]
    file: string[]
}

interface Taskls {
    input: FileInfo
    trans: TranscodeInfo
}

export default function InsertTask({ org_task, open, onClose, onCancelled }: { org_task?: TaskInfo; open: boolean; onClose: () => void; onCancelled: () => void }) {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const { pushMsg, pushError } = useErrorMsg();
    const navigate = useNavigate();

    const [openNewFolder, setOpenNewFolder] = useState("");

    // Path state
    const [pathList, setPathList] = useState<PathInfo>({
        dir: [],
        file: [],
    });
    const [tempPath, setTempPath] = useLocalStorage("tempPath", "/", "local");

    // Input state
    const [multiInOne, setMultiInOne] = useState(false);
    const [multiargs, setMultiargs] = useState<TranscodeInfo>({ sar_fix: "", video_br: 0, audio_br: 0 } as TranscodeInfo);
    const [extendInputInfo, setExtendInputInfo] = useState(-2); // -2 for none, >=0 for showing input info of taskInfo[extendInputInfo]

    // Settings state
    const [settingsInfo, setSettingsInfo] = useState<Settings>({
        overwrite: false,
        delete_source: true,
        rotate: null,
        retry: 3,
        preset: 6,
        overshoot_pct: 100,
        undershoot_pct: 10,
        maxsection_pct: 6000,
        keyint: "6s",
        lookahead: 120,
        scd: true,
    } as Settings);
    const [expanded, setExpanded] = useState(false);

    // Task state
    const [taskInfo, setTaskInfo] = useState<Taskls[]>([]);
    const [outputDir, setOutputDir] = useLocalStorage("outputDir", "/", "local");

    // Network functions
    const fetchSettings = () => {
        api.get(`${apiUrl}/settings`).json<Settings>()
            .then(data => {
                setSettingsInfo(data);
            })
            .catch(error => {
                pushError(error, "System settings");
            })
    }

    const fetchFileList = (path: string) => {
        if (path === "") path = "/";
        api.get(`${apiUrl}/path/ls?path_str=${path}`).json<PathInfo>()
            .then(data => {
                setPathList(data);
            })
            .catch(error => {
                pushError(error, "Fetch file list");
            })
    }

    const makeDir = () => {
        api.get(`${apiUrl}/path/mkdir?path_str=${outputDir}/${openNewFolder}`)
            .then(() => {
                setOutputDir(prev => ((prev === "/" ? "" : prev) + "/" + openNewFolder).replaceAll("//", "/"));
                setOpenNewFolder("");
            })
            .catch(error => {
                pushError(error, "Create new folder");
            })
    }



    // Event handlers
    const handleInsert = async (path: string) => {
        let files = [] as string[];
        try {
            const filels = (await api.get(`${apiUrl}/path/ls?path_str=${tempPath}`).json<PathInfo>()).file;
            if (filels.length === 0) {
                files = [path];
            }
            else {
                files = filels.map(file => path === "/" ? "/" + file : path + "/" + file);
            }
            for (const file of files) {
                const input = await api.get(`${apiUrl}/file/info?file_path=${file}`).json<FileInfo>();
                const trans = await api.post(`${apiUrl}/file/single`, { json: input }).json<TranscodeInfo>();
                setTaskInfo(prev => [...prev, { input, trans } as Taskls]);
            }
        }
        catch (error) {
            pushError(error, "Fetch File Info");
        }
    }

    const insertTasks = () => {
        if (taskInfo.length === 0) {
            pushMsg("No tasks to insert");
            return;
        }
        let tasks = [] as TaskInfo[];
        if (multiInOne) {
            const newTask: TaskInfo = {
                uid: org_task?.uid,
                input: taskInfo.map(t => t.input),
                output: outputDir + "/" + taskInfo[0].input.path.split("/").pop()?.split(".").slice(0, -1).join(".") + ".mp4",
                args: multiargs,
                settings: settingsInfo,
            } as TaskInfo;
            tasks = [newTask];
        }
        else {
            for (let i = 0; i < taskInfo.length; i++) {
                const newTask: TaskInfo = {
                    uid: i === 0 ? org_task?.uid : undefined,
                    input: [taskInfo[i].input],
                    output: outputDir + "/" + taskInfo[i].input.path.split("/").pop()?.split(".").slice(0, -1).join(".") + ".mp4",
                    args: taskInfo[i].trans,
                    settings: settingsInfo,
                } as TaskInfo;
                console.log(newTask.output);
                tasks.push(newTask);
            }
        }
        let is_error = false;
        for (const task of tasks) {
            api.post(`${apiUrl}/task/submit`, { json: task })
                .catch(error => {
                    is_error = true;
                    pushError(error, `Insert task (${task.input[0].path.split("/").slice(-1)[0]})`);
                })
        }
        if (!is_error) {
            pushMsg(`Insert ${tasks.length} task(s) successfully.`, "success");
            onClose();
            navigate("/running");
        }
    }


    // Effect hooks
    useEffect(() => {
        // If org_task is provided, initialize with its data
        if (org_task) {
            // Initialize with org_task data
            if (org_task.input.length > 1) {
                setMultiInOne(true);
                for (const input of org_task.input) {
                    api.post(`${apiUrl}/file/single`, { json: input }).json<TranscodeInfo>()
                        .then(data => {
                            setTaskInfo(prev => [...prev, { input, trans: data } as Taskls]);
                        })
                        .catch(error => {
                            pushError(error, "Fetch File Info");
                        })
                }

            }
            else {
                setTaskInfo(prev => [...prev, { input: org_task.input[0], trans: org_task.args } as Taskls]);
            }
            setSettingsInfo(org_task.settings);
            setOutputDir(org_task.output.split("/").slice(0, -1).join("/") || "/");
        }
        else {
            // Initialize states when dialog opens
            fetchSettings();
        }
    }, [, open]);

    useEffect(() => {
        if (!open) return;
        if (tempPath === "") setTempPath("/");
        fetchFileList(tempPath);
    }, [tempPath]);

    useEffect(() => {
        if (!open) return;
        if (outputDir === "") setOutputDir("/");
        fetchFileList(outputDir);
    }, [outputDir]);

    useEffect(() => {
        if (!multiInOne) return;
        if (taskInfo.length === 0) return;
        api.post(`${apiUrl}/file/multi`, { json: taskInfo.map(t => t.input) }).json<TranscodeInfo>()
            .then(data => {
                setMultiargs(data);
            })
            .catch(error => {
                pushError(error, "Multi-in-one");
            })
    }, [multiInOne, taskInfo]);



    return (
        <Dialog open={open} fullScreen>
            <DialogTitle>
                <Typography variant="h4" fontWeight="bold">
                    Insert Task
                </Typography>
            </DialogTitle>
            <DialogContent sx={{
                display: "flex",
                flexDirection: "row",
                gap: 1,
                p: 3,
            }}>
                <Dialog open={openNewFolder !== ""} onClose={() => setOpenNewFolder("")}>
                    <DialogTitle>
                        <Typography variant="h6" fontWeight="bold">
                            Create New Folder
                        </Typography>
                    </DialogTitle>
                    <DialogContent>
                        <TextField
                            label="Folder Name"
                            variant="outlined"
                            fullWidth
                            sx={{ mt: 1 }}
                            onChange={(e) => setOpenNewFolder(e.target.value)}
                        />
                    </DialogContent>
                    <DialogActions sx={{ pb: 3, pr: 3, gap: 1 }}>
                        <Button onClick={() => setOpenNewFolder("")} variant="outlined">
                            Cancel
                        </Button>
                        <Button variant="contained" onClick={() => makeDir()} disabled={openNewFolder === ""}>
                            Create
                        </Button>
                    </DialogActions>
                </Dialog>
                <Box sx={{
                    display: "flex",
                    flexDirection: "column",
                    width: "38%",
                    height: "100%",
                    overflowY: "auto",
                    scrollbarWidth: 'none',     // Firefox
                    msOverflowStyle: 'none',    // IE 10+
                    '&::-webkit-scrollbar': {   // Chrome / Safari
                        display: 'none',
                    },
                }}>
                    <Box sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}>
                        <Typography variant="h6" fontWeight="bold">
                            Input Settings
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                Multi-in-one
                            </Typography>
                            <Switch checked={multiInOne} onChange={(_, checked) => setMultiInOne(checked)} />
                        </Box>
                    </Box>
                    <List>
                        {taskInfo.map((task, index) => (
                            <React.Fragment key={index}>
                                <ListItem disablePadding>
                                    <ListItemButton onClick={() => setExtendInputInfo(extendInputInfo === index ? -1 : index)}>
                                        <ListItemIcon>
                                            <IconButton
                                                sx={{ display: index === 0 && org_task !== undefined ? "none" : "flex" }}
                                                disabled={index === 0 && org_task !== undefined}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setTaskInfo(prev => prev.filter((_, i) => i !== index));
                                                }}>
                                                <RemoveCircleRoundedIcon color="error" />
                                            </IconButton>
                                        </ListItemIcon>
                                        <ListItemText sx={{ color: (theme) => theme.vars?.palette.primary.main }} secondary={task.input.path.split("/").slice(-1)[0]}>
                                            <b>File {index + 1}</b>
                                        </ListItemText>
                                        <ListItemIcon>
                                            {extendInputInfo === index ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                                        </ListItemIcon>
                                    </ListItemButton>
                                </ListItem>
                                <Collapse in={extendInputInfo === index} timeout="auto" unmountOnExit>
                                    <FileInfoComponent fileInfo={[task.input]} />
                                </Collapse>
                            </React.Fragment>
                        ))}
                        {(extendInputInfo !== -1) && (
                            <ListItem disablePadding>
                                <ListItemButton onClick={() => setExtendInputInfo(-1)}>
                                    <ListItemIcon>
                                        <IconButton disableRipple>
                                            <AddCircleRoundedIcon />
                                        </IconButton>
                                    </ListItemIcon>
                                    <ListItemText primary="Add a video file" />
                                </ListItemButton>
                            </ListItem>
                        )}
                        {extendInputInfo === -1 && (
                            <ListItem disablePadding>
                                <ListItemIcon sx={{ gap: 1, mr: 1 }}>
                                    <IconButton onClick={() => setExtendInputInfo(-2)}>
                                        <RemoveCircleRoundedIcon color="error" />
                                    </IconButton>
                                    <IconButton onClick={() => { handleInsert(tempPath); setExtendInputInfo(-2); }}>
                                        <CheckRoundedIcon color="success" />
                                    </IconButton>
                                    <IconButton onClick={() => setTempPath(tempPath.split('/').slice(0, -1).join('/'))}>
                                        <ArrowBackRoundedIcon color="primary" />
                                    </IconButton>
                                </ListItemIcon>
                                <ListItemText sx={{ pr: 1 }}>
                                    <Autocomplete
                                        disableCloseOnSelect
                                        disablePortal
                                        value={tempPath}
                                        onOpen={() => fetchFileList(tempPath)}
                                        options={[...pathList.dir.map((dir) => (tempPath === "/" ? "/" + dir : tempPath + "/" + dir).replaceAll("//", "/")), ...pathList.file.map((file) => tempPath + "/" + file)]}
                                        sx={{ width: "100%" }}
                                        onInputChange={(_, value) => setTempPath(value === "" ? "/" : value)}
                                        renderInput={(params) => <TextField
                                            {...params}
                                            multiline
                                            label="Path"
                                            variant="outlined"
                                        />}
                                    />
                                </ListItemText>
                            </ListItem>
                        )}
                    </List>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box sx={{
                    display: "flex",
                    flexDirection: "column",
                    width: "38%",
                    height: "100%",
                    overflowY: "auto",
                    scrollbarWidth: 'none',     // Firefox
                    msOverflowStyle: 'none',    // IE 10+
                    '&::-webkit-scrollbar': {   // Chrome / Safari
                        display: 'none',
                    },
                    pl: 1,
                    gap: 3,
                }}>
                    <Typography variant="h6" fontWeight="bold">
                        Output Settings
                    </Typography>
                    <Box sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-around",
                    }}>
                        <Autocomplete
                            disableCloseOnSelect
                            disablePortal
                            value={outputDir}
                            onOpen={() => fetchFileList(outputDir)}
                            options={[...pathList.dir.map((dir) => (outputDir === "/" ? "/" + dir : outputDir + "/" + dir).replaceAll("//", "/"))]}
                            sx={{ width: "calc(100% - 68px)" }}
                            onInputChange={(_, value) => setOutputDir(value === "" ? "/" : value)}
                            renderInput={(params) => <TextField
                                {...params}
                                multiline
                                label="Output Dir"
                                variant="outlined"
                            />}
                        />
                        <IconButton onClick={() => setOpenNewFolder("new_folder")}>
                            <CreateNewFolderRoundedIcon color="primary" />
                        </IconButton>
                    </Box>
                    <Divider />
                    {!multiInOne && taskInfo.map((task, index) => (
                        <Box key={index} sx={{
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "start",
                            alignItems: "start",
                            gap: 1,
                        }}>
                            <Typography variant="body1" fontWeight="bold" color="primary">
                                File {index + 1}
                            </Typography>
                            {[
                                ["Output Path", `${outputDir === "/" ? "/" : outputDir + "/"}${task.input.path.split("/").slice(-1)[0].split(".").slice(0, -1).join(".")}.mp4`],
                                ["Video Bitrate", `${(task.trans.video_br / 1000 / 1000).toFixed(2)} Mbps`],
                                ["Audio Bitrate", `${(task.trans.audio_br / 1000).toFixed(2)} kbps`],
                            ].map(([key, value]) => (
                                <Typography key={key} variant="body2" sx={{ pl: 2 }}>
                                    <b>{key}:</b> {value}
                                </Typography>
                            ))}
                        </Box>
                    ))}
                    {multiInOne && (<Box sx={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "start",
                        alignItems: "start",
                        gap: 1,
                    }}>
                        <Typography variant="body1" fontWeight="bold" color="primary">
                            File
                        </Typography>
                        {[
                            ["Output Path", `${outputDir === "/" ? "/" : outputDir + "/"}${taskInfo[0]?.input.path.split("/").slice(-1)[0].split(".").slice(0, -1).join(".")}.mp4`],
                            ["Video Bitrate", `${(multiargs.video_br / 1000 / 1000).toFixed(2)} Mbps`],
                            ["Audio Bitrate", `${(multiargs.audio_br / 1000).toFixed(2)} kbps`],
                        ].map(([key, value]) => (
                            <Typography key={key} variant="body2" sx={{ pl: 2 }}>
                                <b>{key}:</b> {value}
                            </Typography>
                        ))}
                    </Box>)
                    }
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box sx={{
                    display: "flex",
                    flexDirection: "column",
                    width: "24%",
                    height: "100%",
                    overflowY: "auto",
                    scrollbarWidth: 'none',     // Firefox
                    msOverflowStyle: 'none',    // IE 10+
                    '&::-webkit-scrollbar': {   // Chrome / Safari
                        display: 'none',
                    },
                    pl: 1,
                    gap: 3,
                }}>
                    <Box sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 3,
                    }}>
                        <Typography variant="h6" fontWeight="bold">
                            Encoder Settings
                        </Typography>
                        <Button
                            variant="outlined"
                            onClick={() => fetchSettings()}
                            startIcon={<ReplayRoundedIcon />}
                        >
                            Reset
                        </Button>
                    </Box>
                    {(([
                        ["Overwrite", "Overwrite the output file if it already exists.",
                            (s: Settings) =>
                                <Switch
                                    checked={s.overwrite}
                                    onChange={(e) => { setSettingsInfo({ ...s, overwrite: e.target.checked }) }}
                                />
                        ],
                        ["Delete Source File", "Delete the source file after successful processing.",
                            (s: Settings) =>
                                <Switch
                                    checked={s.delete_source}
                                    onChange={(e) => setSettingsInfo({ ...s, delete_source: e.target.checked })}
                                />
                        ],
                        ["Rotate", "Rotate the video.",
                            (s: Settings) =>
                                <Select
                                    value={s.rotate ?? -1}
                                    onChange={(e) => setSettingsInfo({ ...s, rotate: e.target.value === -1 ? null : e.target.value as number })}
                                    displayEmpty
                                    sx={{ width: "100%", ml: 1 }}
                                >
                                    <MenuItem value={-1}>None</MenuItem>
                                    {Rotate.map((option, index) => (
                                        <MenuItem key={option} value={index}>
                                            {option}
                                        </MenuItem>
                                    ))}
                                </Select>
                        ],
                    ]) as [string, string, (s: Settings) => React.ReactNode][]).map(([title, description, component]) => (

                        <Box key={title} sx={{
                            display: "flex",
                            width: "100%",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}>
                            <Tooltip title={description} placement="bottom-start">
                                <Typography variant="body1" fontWeight="bold">
                                    {title}
                                </Typography>
                            </Tooltip>
                            {component(settingsInfo)}
                        </Box>
                    ))}
                    <Box sx={{
                        display: "flex",
                        flexDirection: "column",
                        width: "100%",
                        alignItems: "flex-start",
                    }}>
                        <Tooltip title={"Number of times to retry if the task failed."} placement="right">
                            <Typography variant="body1">
                                <b>Retry:</b> {settingsInfo.retry}
                            </Typography>
                        </Tooltip>
                        <Slider
                            value={settingsInfo.retry}
                            onChange={(e, value) => setSettingsInfo({ ...settingsInfo, retry: value as number })}
                            min={0}
                            max={8}
                            step={1}
                            valueLabelDisplay="auto"
                            sx={{ width: "88%" }}
                        />
                    </Box>
                    <Box sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%",
                    }}>
                        <Typography variant="h6" fontWeight="bold">
                            SVT-AV1 Settings
                        </Typography>
                        <IconButton onClick={() => setExpanded(!expanded)}>
                            {expanded ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                        </IconButton>
                    </Box>
                    <Collapse in={expanded} timeout="auto" unmountOnExit sx={{ width: "100%" }}>
                        {([
                            ["preset", "The preset of the SVT-AV1 encoder.",
                                (s: Settings) =>
                                    <Slider
                                        value={s.preset}
                                        onChange={(e, value) => setSettingsInfo({ ...s, preset: value as number })}
                                        min={1}
                                        max={12}
                                        step={1}
                                        valueLabelDisplay="auto"
                                        sx={{ width: "88%" }}
                                    />
                            ],
                            ["overshoot_pct", "How much the encoder is allowed to overshoot the target bitrate.",
                                (s: Settings) =>
                                    <Slider
                                        value={s.overshoot_pct}
                                        onChange={(e, value) => setSettingsInfo({ ...s, overshoot_pct: value as number })}
                                        min={0}
                                        max={100}
                                        step={1}
                                        valueLabelDisplay="auto"
                                        sx={{ width: "88%" }}
                                    />
                            ],
                            ["undershoot_pct", "How much the encoder is allowed to undershoot the target bitrate.",
                                (s: Settings) =>
                                    <Slider
                                        value={s.undershoot_pct}
                                        onChange={(e, value) => setSettingsInfo({ ...s, undershoot_pct: value as number })}
                                        min={0}
                                        max={100}
                                        step={1}
                                        valueLabelDisplay="auto"
                                        sx={{ width: "88%" }}
                                    />
                            ],
                            ["maxsection_pct", "Maximum percentage of the section that can be used.",
                                (s: Settings) =>
                                    <Slider
                                        value={s.maxsection_pct}
                                        onChange={(e, value) => setSettingsInfo({ ...s, maxsection_pct: value as number })}
                                        min={0}
                                        max={10000}
                                        step={100}
                                        valueLabelDisplay="auto"
                                        sx={{ width: "88%" }}
                                    />
                            ],
                            ["keyint", "Maximum interval between keyframes in seconds.",
                                (s: Settings) =>
                                    <Slider
                                        value={Number(s.keyint.split('s')[0])}
                                        onChange={(e, value) => setSettingsInfo({ ...s, keyint: `${value}s` })}
                                        min={1}
                                        max={100}
                                        step={1}
                                        valueLabelDisplay="auto"
                                        sx={{ width: "88%" }}
                                    />
                            ],
                            ["lookahead", "Number of frames to look ahead for better encoding decisions.",
                                (s: Settings) =>
                                    <Slider
                                        value={s.lookahead}
                                        onChange={(e, value) => setSettingsInfo({ ...s, lookahead: value as number })}
                                        min={1}
                                        max={120}
                                        step={1}
                                        valueLabelDisplay="auto"
                                        sx={{ width: "88%" }}
                                    />
                            ],
                        ] as [string, string, (s: Settings) => React.ReactNode][]).map(([title, description, component]) => (
                            <Box key={title} sx={{
                                display: "flex",
                                flexDirection: "column",
                                width: "100%",
                                alignItems: "flex-start",
                            }}>
                                <Tooltip title={description} placement="right">
                                    <Typography variant="body1">
                                        <b>{title}:</b> {settingsInfo[title as keyof Settings]}
                                    </Typography>
                                </Tooltip>
                                {component(settingsInfo)}
                            </Box>
                        ))
                        }
                        <Box sx={{
                            display: "flex",
                            width: "100%",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}>
                            <Tooltip title={"Scene change detection."} placement="bottom-start">
                                <Typography variant="body1" fontWeight="bold">
                                    scd
                                </Typography>
                            </Tooltip>
                            <Switch
                                checked={settingsInfo.scd}
                                onChange={(e) => setSettingsInfo({ ...settingsInfo, scd: e.target.checked })}
                            />
                        </Box>
                    </Collapse>
                </Box>

            </DialogContent>
            <DialogActions sx={{ pb: 3, pr: 3, gap: 1 }}>
                <Button onClick={onCancelled} variant="outlined">
                    Cancel
                </Button>
                <Button variant="contained" onClick={() => insertTasks()}>
                    Insert
                </Button>
            </DialogActions>
        </Dialog>
    )
}