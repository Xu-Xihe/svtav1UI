import {
    AppBar,
    Box,
    useTheme,
    useMediaQuery,
    IconButton,
    Badge,
    Avatar,
    Typography,
} from "@mui/material";
import ContrastRoundedIcon from '@mui/icons-material/ContrastRounded';
import CableRoundedIcon from '@mui/icons-material/CableRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
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
    const { setOpen } = useErrorMsg();

    const theme = useTheme();
    const { mode, setMode } = useColorScheme();
    const preferIsDark = useMediaQuery("(prefers-color-scheme: dark)");
    const [themeMode, setThemeMode] = useLocalStorage<'light' | 'dark' | 'system'>('theme-mode', 'system', 'local');

    const [apiConnect, setApiConnect] = useState<boolean>(false);

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
    })

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
    }


    useEffect(() => {
        setMode(themeMode);
    }, [themeMode]);



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
                        <IconButton>
                            <Badge variant="dot" color={apiConnect ? "success" : "error"}>
                                <CableRoundedIcon />
                            </Badge>
                        </IconButton>
                        <IconButton>
                            <SettingsRoundedIcon />
                        </IconButton>
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