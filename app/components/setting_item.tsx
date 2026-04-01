import {
    Box,
    Typography,
    Divider,
} from '@mui/material';


export default function SettingItem({ title, description, children }: { title: string, description: string, children: React.ReactNode }) {
    return (
        <>
            <Divider flexItem variant='fullWidth' />
            <Box sx={{
                display: "flex",
                width: "100%",
                justifyContent: "start",
                alignItems: "center",
                gap: 8,
            }}>
                <Typography variant="h6">
                    <b>{title}</b>
                </Typography>
                <Typography variant="body1">
                    {description}
                </Typography>
                {children}
            </Box>
        </>
    );
}