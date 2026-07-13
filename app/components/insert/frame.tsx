import { Box } from '@mui/material';

export function NobarOverflow({
    children,
    gap = 0,
    width = "100%",
}: {
    children: React.ReactNode,
    gap?: number,
    width?: string,
}) {
    return (
        <Box sx={{
            gap: gap,
            display: "flex",
            flexDirection: "column",
            width: width,
            height: "100%",
            overflowY: "scroll",
            overflowX: "hidden",
            scrollbarWidth: 'none',     // Firefox
            msOverflowStyle: 'none',    // IE 10+
            '&::-webkit-scrollbar': {   // Chrome / Safari
                display: 'none',
            },
        }}>
            {children}
        </Box>
    );
}

export function ColumnWidth({
    children,
    width,
    gap = 0,
}: {
    children: React.ReactNode,
    width: string,
    gap?: number,
}) {
    return (
        <Box sx={{
            display: "flex",
            flexDirection: "column",
            width: width,
            height: "100%",
            px: 1,
            gap: gap,
        }}>
            {children}
        </Box>
    );
}