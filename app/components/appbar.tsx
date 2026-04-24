import {
    AppBar,
    Box,
    useTheme,
    useMediaQuery,
    IconButton,
    Badge,
    Avatar,
    Typography,
    Tooltip,
} from "@mui/material";
import ContrastRoundedIcon from '@mui/icons-material/ContrastRounded';
import CableRoundedIcon from '@mui/icons-material/CableRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { useColorScheme } from '@mui/material/styles';

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { useQuery } from '@tanstack/react-query';

import { api } from "../hooks/api";
import { useErrorMsg } from "../components/error_popout";
import DisconnectBackdrop from "./disconnect_backdrop";
import useLocalStorage, { getLocalStorage } from "../hooks/storage";


export default function AppBarComponent() {
    const apiUrl = getLocalStorage("apiUrl", "local");
    const navigate = useNavigate();
    const { setOpen, pushError } = useErrorMsg();

    const theme = useTheme();
    const { setMode } = useColorScheme();
    const preferIsDark = useMediaQuery("(prefers-color-scheme: dark)");
    const [themeMode, setThemeMode] = useLocalStorage<'light' | 'dark' | 'system'>('theme-mode', 'system', 'local');

    const [apiConnect, setApiConnect] = useState<boolean>(false);
    const [status, setStatus] = useState<boolean>(true);

    useQuery({
        queryKey: ["health"],
        queryFn: async () => {
            try {
                await api.get(`${apiUrl}/health`);
                setApiConnect(true);
                setOpen(true);

            }
            catch {
                setApiConnect(false);
                setOpen(false);
            }
            return null;
        },
        retry: 0,
        refetchInterval: 3000,
        refetchIntervalInBackground: true,
    });

    const changeThemeMode = () => {
        let newMode: 'light' | 'dark' | 'system' = themeMode;
        if (themeMode === 'system') {
            newMode = preferIsDark ? 'light' : 'dark';
        }
        else if (themeMode === 'light') {
            newMode = preferIsDark ? 'system' : 'dark';
        }
        else if (themeMode === 'dark') {
            newMode = preferIsDark ? 'light' : 'system';
        }
        setMode(newMode);
        setThemeMode(newMode);
    };

    const changeStatus = () => {
        setStatus(!status);
        api.post(`${apiUrl}/task/status`, { searchParams: { set: !status } }).json()
            .catch((error) => {
                pushError(error, "Set task status");
            })
    };


    useEffect(() => {
        setMode(themeMode);
    }, [themeMode]);

    useEffect(() => {
        api.get(`${apiUrl}/task/status`, { searchParams: { set: !status } }).json<boolean>()
            .then((data) => {
                setStatus(data);
            })
            .catch((error) => {
                pushError(error, "Get task status");
            });
    }, []);

    useEffect(() => {
        api.get(`${apiUrl}/task/status`).json<boolean>()
            .then((data: boolean) => {
                setStatus(data);
            })
            .catch((error) => {
                pushError(error, "Get task status");
            });
    }, []);

    return (
        <>
            <DisconnectBackdrop open={!apiConnect} />
            <AppBar
                position="fixed"
                sx={{
                    height: 68,
                    bgcolor: theme.vars?.palette.secondary.light,
                    transition: theme.transitions.create(["background-color", "box-shadow", "border-color", "color"])
                }}
            >
                <Box sx={{
                    px: 3,
                    width: "100%",
                    height: "100%",
                    display: 'flex',
                    justifyContent: "space-between",
                    alignItems: "center",
                }}>
                    <Box sx={{
                        display: 'flex',
                        gap: 3,
                    }}>
                        <Avatar alt="svtav1UI" src="/icon.png" variant="rounded" />
                        <Typography variant="h4" fontWeight="bold">
                            SVT-AV1 UI
                        </Typography>
                    </Box>
                    <Box sx={{
                        display: 'flex',
                        gap: 1,
                    }}>
                        <Tooltip title={<>
                            Green: OK
                            <br />
                            Orange: Pause when current task finished
                            <br />
                            Red: Disconnected
                        </>}>
                            <IconButton onClick={changeStatus}>
                                <Badge variant="dot" color={apiConnect
                                    ? status
                                        ? "success"
                                        : "warning"
                                    : "error"
                                }>
                                    <CableRoundedIcon />
                                </Badge>
                            </IconButton>
                        </Tooltip>
                        <IconButton onClick={() => changeThemeMode()}>
                            <ContrastRoundedIcon />
                        </IconButton>
                        <IconButton onClick={() => navigate("/")}>
                            <LogoutRoundedIcon />
                        </IconButton>
                    </Box>
                </Box>
            </AppBar>
        </>
    );
}