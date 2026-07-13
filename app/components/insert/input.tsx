import {
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    IconButton,
    Tooltip,
    Box,
    Typography,
    Button,
    Switch,
    Collapse,
    Divider,
    CircularProgress,
} from '@mui/material';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import BlurOnRoundedIcon from '@mui/icons-material/BlurOnRounded';
import RemoveCircleRoundedIcon from '@mui/icons-material/RemoveCircleRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { move } from '@dnd-kit/helpers';
import React, { useState } from 'react';

import type { FileInfo, Taskls } from '~/hooks/model';
import { type InsertSettings } from "~/components/insert/settings";
import { FileInfoComponent } from '../info';
import useLocalStorage from "~/hooks/storage";
import PathSelector from "~/components/pathselector";


export function InputTitle({
    insert,
    onChangeInsert,
    clearList,
    disable
}: {
    insert: InsertSettings,
    onChangeInsert: (newInsert: InsertSettings) => void,
    clearList: () => void,
    disable?: boolean
}) {
    return (
        <Box sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
        }}>
            <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                Input Settings
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Button onClick={clearList}>
                    Clear
                </Button>
                <Typography variant="body2" color="text.secondary">
                    Allow AV1
                </Typography>
                <Switch
                    checked={insert.allow_av1}
                    onChange={(_, checked) => onChangeInsert({ ...insert, allow_av1: checked })}
                    disabled={disable}
                />
                <Typography variant="body2" color="text.secondary">
                    Multi-in-one
                </Typography>
                <Switch
                    checked={insert.multi_in_one}
                    onChange={(_, checked) => onChangeInsert({ ...insert, multi_in_one: checked })}
                    disabled={disable || insert.only_subtitle}
                />
            </Box>
        </Box>
    );
}

export function InputInfoList({
    tasks,
    insertSettings,
    disable,
    onChange,
}: {
    tasks: Taskls[],
    insertSettings: InsertSettings,
    disable?: boolean,
    onChange: (newTasks: Taskls[]) => void,
}) {
    const [extend, setExtend] = useState<string>("");

    function SortableInfoItem({ data, index }: { data: FileInfo; index: number }) {
        const { ref, handleRef } = useSortable({ id: data.path, index });

        return (
            <div ref={ref}>
                <ListItem disablePadding>
                    <ListItemButton onClick={() => setExtend(extend === data.path ? "" : data.path)}>
                        <ListItemIcon>
                            <IconButton
                                disabled={disable}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange(tasks.filter((task) => task.input.path !== data.path));
                                }}>
                                <RemoveCircleRoundedIcon color="error" />
                            </IconButton>
                        </ListItemIcon>
                        <ListItemText sx={{ color: (theme) => theme.vars?.palette.primary.main }} secondary={data.path.split("/").slice(-1)[0]}>
                            <b>File {index + 1}</b>
                        </ListItemText>
                        {data.codec === "av1" && (
                            <ListItemIcon>
                                <Tooltip title="The original codec is AV1">
                                    <IconButton>
                                        <WarningAmberRoundedIcon color="warning" />
                                    </IconButton>
                                </Tooltip>
                            </ListItemIcon>
                        )}
                        <ListItemIcon>
                            {extend === data.path ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                        </ListItemIcon>
                        <ListItemIcon>
                            <Tooltip title="Drag to reorder" placement="bottom">
                                <IconButton ref={handleRef} onPointerDown={(e) => {
                                    e.stopPropagation();
                                }}>
                                    <BlurOnRoundedIcon />
                                </IconButton>
                            </Tooltip>
                        </ListItemIcon>
                    </ListItemButton>
                </ListItem>
            </div>
        )
    };

    return (
        <DragDropProvider
            onDragEnd={(event) => {
                onChange(move(tasks as any, event) as Taskls[]);
            }}
            onDragStart={() => { setExtend(""); }}
        >
            {tasks.filter((task) => insertSettings.allow_av1 || task.input.codec !== "av1").map((task, index) => (
                <React.Fragment key={task.input.path}>
                    <SortableInfoItem key={task.input.path} data={task.input} index={index} />
                    <Collapse in={extend === task.input.path} timeout="auto" unmountOnExit>
                        <Divider sx={{ mb: 1 }} />
                        <FileInfoComponent fileInfo={[task.input]} />
                        <Divider sx={{ mt: 1 }} />
                    </Collapse>
                </React.Fragment>
            ))}
        </DragDropProvider>
    );
}


export function InputAddNew({ onInsert, filter }: { onInsert: (path: string) => Promise<void>; filter?: "video" | "model" | "subtitle" }) {
    const [open, setOpen] = useState(false);
    const [inserting, setInserting] = useState(false);
    const [path, setPath] = useLocalStorage("outputTempPath", "/", "local");

    if (open) {
        return (
            <ListItem disablePadding>
                <ListItemIcon sx={{ gap: 1, mr: 1 }}>
                    <IconButton onClick={() => setOpen(false)}>
                        <RemoveCircleRoundedIcon color="error" />
                    </IconButton>
                    <IconButton onClick={() => {
                        setInserting(true);
                        setOpen(false);
                        onInsert(path)
                            .then(() => {
                                setInserting(false);
                                setPath(path.endsWith("/") ? path : path.slice(0, path.lastIndexOf("/") + 1));
                            });
                    }}>
                        <CheckRoundedIcon color="success" />
                    </IconButton>
                </ListItemIcon>
                <ListItemText sx={{ pr: 1 }}>
                    <PathSelector
                        label="Path"
                        onClose={(path) => setPath(path)}
                        onEnter={(path) => {
                            setPath(path);
                            setOpen(false);
                            setInserting(true);
                            onInsert(path)
                                .then(() => {
                                    setInserting(false);
                                    setPath(path.endsWith("/") ? path : path.slice(0, path.lastIndexOf("/") + 1));
                                });
                        }}
                        value={path}
                        filter={filter}
                    />
                </ListItemText>
            </ListItem>
        );
    }

    else if (inserting) {
        let msg = "Inserting ";
        if (path.endsWith("/")) {
            msg += "from directory \"" + path.match(/([^\/]+)\/$/)?.[1] + "/\"";
        }
        else {
            msg += path.slice(path.lastIndexOf("/") + 1);
        }
        msg += " ...";

        return (
            <ListItem>
                <ListItemIcon sx={{ mr: 1 }}>
                    <CircularProgress size="26px" />
                </ListItemIcon>
                <ListItemText primary={msg} />
            </ListItem>
        );
    }

    else {
        return (
            <ListItem disablePadding>
                <ListItemButton onClick={() => setOpen(true)}>
                    <ListItemIcon sx={{ mr: 1 }}>
                        <IconButton disableRipple>
                            <AddCircleRoundedIcon />
                        </IconButton>
                    </ListItemIcon>
                    <ListItemText primary="Add a video file or directory" />
                </ListItemButton>
            </ListItem>
        );
    }
}