import { useTheme } from "../../theme-context";
import type { Server } from "./utils";
import { generateMcpConfig } from "./utils";

interface ServerConfigExportProps {
	server: Server;
}

/**
 * View for exporting server configuration for Claude Desktop
 */
export function ServerConfigExport({ server }: ServerConfigExportProps) {
	const theme = useTheme();
	const config = generateMcpConfig(server);

	return (
		<box
			style={{
				flexDirection: "column",
				flexGrow: 1,
				padding: 0,
				paddingLeft: 1,
				paddingRight: 1,
			}}
		>
			{/* Header */}
			<box
				style={{
					flexDirection: "row",
					justifyContent: "space-between",
					alignItems: "flex-start",
					backgroundColor: theme.background,
					padding: 0,
					paddingLeft: 1,
					paddingRight: 1,
					border: ["bottom"],
					borderColor: theme.border,
				}}
			>
				<text fg={theme.accent}>Export Config</text>
				<text fg={theme.foregroundMuted}>[{server.name}]</text>
			</box>

			{/* Content */}
			<box style={{ flexDirection: "column", flexGrow: 1 }}>
				<text style={{ marginBottom: 1 }}>
					Copy this configuration to your Claude Desktop config:
				</text>

				<box
					style={{
						flexDirection: "column",
						padding: 1,
						marginBottom: 1,
					}}
					backgroundColor={theme.emphasis}
				>
					{config.split("\n").map((line, i) => (
						<text
							// biome-ignore lint/suspicious/noArrayIndexKey: It's okay to use the index as the key here
							key={i}
							fg={theme.foreground}
						>
							{line}
						</text>
					))}
				</box>
			</box>

			{/* Footer */}
			<box
				style={{
					paddingTop: 1,
					border: ["top"],
					borderColor: theme.border,
				}}
			>
				<text fg={theme.foregroundMuted}>
					Press any key to go back • [ESC] Return to Activity Log
				</text>
			</box>
		</box>
	);
}
