import { Box, Typography } from "@mui/material";

export function NoContent({ title = "" }: { title?: string }) {
    return (
        <Box sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
            width: "100%",
        }}>
            <Typography variant="h6">No {title} tasks</Typography>
        </Box>
    );
}