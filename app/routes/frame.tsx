import {
    Box,
    Divider,
    List,
    ListItem,
    ListItemIcon,
    ListItemButton,
    ListItemText,
    ListSubheader,
} from "@mui/material";
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import PauseCircleOutlineRoundedIcon from '@mui/icons-material/PauseCircleOutlineRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';

import { useNavigate, Outlet, useLocation } from "react-router";

import { useState } from "react";

import { useErrorMsg } from "../components/error_popout";
import { getLocalStorage } from "../hooks/storage";
import AppBarComponent from "../components/appbar";
import InsertTask from "../components/insert_task";



export default function Home() {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const { pushMsg } = useErrorMsg();

    const location = useLocation();
    const navigate = useNavigate();

    const [insertTaskOpen, setInsertTaskOpen] = useState(false);

    return (
        <>
            {insertTaskOpen && <InsertTask
                org_task={undefined}
                open
                onClose={() => {
                    setInsertTaskOpen(false);
                }}
                onCancelled={() => {
                    setInsertTaskOpen(false);
                }}
            />}
            <AppBarComponent />
            <Box sx={{
                position: "absolute",
                top: 68,
                left: 0,
                right: 0,
                bottom: 0,
                height: 'calc(100vh - 68px)',
                width: '100vw',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflowY: 'auto',
                backgroundColor: (theme) => theme.vars?.palette.background.default,
            }}>
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    width: 228,
                    height: "100%",
                    flexShrink: 0,
                    flexGrow: 0,
                    p: 0,
                    m: 0,
                }}>
                    {Object.entries({
                        "Queue": [
                            ['Running', "/running", <PlayCircleOutlineRoundedIcon />],
                            ['Waiting', "/waiting", <PauseCircleOutlineRoundedIcon />],
                            ['Completed', "/completed", <CheckRoundedIcon />],
                            ['Failed', "/failed", <CancelOutlinedIcon />],
                        ],
                        "Settings": [
                            ['System Settings', "/sys_settings", <SettingsRoundedIcon />],
                            ['SVT-AV1 Settings', "/svtav1_settings", <TuneRoundedIcon />],
                        ],
                    } as Record<string, [string, string, React.ReactNode][]>)
                        .map(([subheader, items]) => (
                            <List
                                key={subheader}
                                sx={{ p: 0, m: 0, width: "100%" }}
                                subheader={
                                    <ListSubheader>
                                        {subheader}
                                    </ListSubheader>
                                }
                            >
                                {items.map(([text, path, icon]) => (
                                    <ListItem key={text} disablePadding>
                                        <ListItemButton
                                            selected={location.pathname === path}
                                            onClick={() => navigate(path)}
                                        >
                                            <ListItemIcon>{icon}</ListItemIcon>
                                            <ListItemText primary={text} />
                                        </ListItemButton>
                                    </ListItem>
                                ))}
                            </List>
                        ))}
                    <List
                        sx={{ p: 0, m: 0, width: "100%" }}
                        subheader={
                            <ListSubheader>
                                Add Task
                            </ListSubheader>
                        }
                    >
                        <ListItem disablePadding>
                            <ListItemButton
                                onClick={() => setInsertTaskOpen(true)}
                            >
                                <ListItemIcon>
                                    <AddCircleRoundedIcon />
                                </ListItemIcon>
                                <ListItemText primary="Insert Task" />
                            </ListItemButton>
                        </ListItem>
                    </List>
                </Box>
                <Divider orientation="vertical" flexItem />
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    width: "calc(100vw - 228px)",
                    height: "100%",
                }}>
                    <Outlet />
                </Box>
            </Box>
        </>
    );
}
