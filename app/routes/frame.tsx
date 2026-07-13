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
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import AddBoxRoundedIcon from '@mui/icons-material/AddBoxRounded';

import { useNavigate, Outlet, useLocation } from "react-router";

import { useState } from "react";

import AppBarComponent from "../components/appbar";
import InsertTaskDialog from "../components/insert";
import InsertLLMTaskDialog from "../components/insert/llm_index";

const drawerWidth = 218;

export default function Home() {
    const location = useLocation();
    const navigate = useNavigate();

    const [insertTaskOpen, setInsertTaskOpen] = useState<null | boolean>(null);

    return (
        <>
            {insertTaskOpen === true &&
                <InsertTaskDialog
                    onClose={() => {
                        setInsertTaskOpen(null);
                    }}
                    onCancel={() => {
                        setInsertTaskOpen(null);
                    }}
                />
            }
            {insertTaskOpen === false &&
                <InsertLLMTaskDialog
                    onClose={() => {
                        setInsertTaskOpen(null);
                    }}
                    onCancel={() => {
                        setInsertTaskOpen(null);
                    }}
                />
            }
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
                justifyContent: 'flex-start',
                alignItems: 'center',
                overflowY: 'auto',
                backgroundColor: (theme) => theme.vars?.palette.background.default,
            }}>
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    width: drawerWidth,
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
                            ['LLM Waiting', "/llm-waiting", <PauseCircleOutlineRoundedIcon />],
                            ['Completed', "/completed", <CheckCircleRoundedIcon />],
                            ['LLM Completed', "/llm-completed", <CheckCircleRoundedIcon />],
                            ['Failed', "/failed", <CancelOutlinedIcon />],
                        ],
                        "Settings": [
                            ['System Settings', "/sys_settings", <TuneRoundedIcon />],
                            ['Transcoder Settings', "/tran_settings", <TuneRoundedIcon />],
                            ['Whisper Settings', "/whisper_settings", <SettingsRoundedIcon />],
                            ['LLM Settings', "/llm_settings", <SettingsRoundedIcon />],
                        ],
                    } as Record<string, [string, string, React.ReactNode][]>)
                        .map(([subheader, items]) => (
                            <List
                                key={subheader}
                                sx={{ py: 0, width: "100%" }}
                                subheader={
                                    <ListSubheader>
                                        {subheader}
                                    </ListSubheader>
                                }
                            >
                                {items.map(([text, path, icon]) => (
                                    <ListItemButton
                                        key={text}
                                        selected={location.pathname === path}
                                        onClick={() => navigate(path)}
                                    >
                                        <ListItemIcon>{icon}</ListItemIcon>
                                        <ListItemText primary={text} />
                                    </ListItemButton>
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
                        <ListItem disablePadding>
                            <ListItemButton
                                onClick={() => setInsertTaskOpen(false)}
                            >
                                <ListItemIcon>
                                    <AddBoxRoundedIcon />
                                </ListItemIcon>
                                <ListItemText primary="Insert LLM Task" />
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
                    width: `calc(100vw - ${drawerWidth}px)`,
                    height: "100%",
                }}>
                    <Outlet />
                </Box>
            </Box>
        </>
    );
}
