import {
    Box,
    Typography,
    Button,
    Tooltip,
} from '@mui/material';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';


export function SettingItemFrame({ title, desc = "", children }: { title: string, desc?: string, children: React.ReactNode }) {
    return (
        <Box sx={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
            px: 3,
            pt: 3,
        }}>
            <Tooltip title={desc}>
                <Typography variant="body1">
                    {title}
                </Typography>
            </Tooltip>
            {children}
        </Box>
    )

}

export function SettingTitleFrame({ title, reset, children }: { title: string, reset: () => void, children?: React.ReactNode }) {
    return (
        <Box sx={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            height: 73,
            alignItems: "center",
            px: 3,
            py: 3,
        }}>
            <Typography variant="h4">
                {title}
            </Typography>
            {children}
            <Button
                variant="contained"
                onClick={reset}
                startIcon={<ReplayRoundedIcon />}
            >
                Reset
            </Button>
        </Box>
    )
}