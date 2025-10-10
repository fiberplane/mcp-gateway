import { useTheme } from "../../theme-context";
import { ServerCard } from "./ServerCard";
import type { Server } from "./utils";

interface ServerListProps {
	servers: Server[];
	selectedIndex: number;
	showConfig: boolean;
}

/**
 * List view for server management
 */
export function ServerList({
	servers,
	selectedIndex,
	showConfig,
}: ServerListProps) {
	const theme = useTheme();

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
					border: ["bottom"],
					borderColor: theme.border,
				}}
			>
				<text fg={theme.accent}>Server Management</text>
				<text fg={theme.foregroundMuted}>
					[{servers.length} {servers.length === 1 ? "server" : "servers"}]
				</text>
			</box>

			{/* Content */}
			<box style={{ flexDirection: "column", flexGrow: 1, padding: 0 }}>
				{servers.length === 0 ? (
					<box
						style={{
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							flexGrow: 1,
						}}
					>
						<text fg={theme.foregroundMuted} style={{ marginBottom: 2 }}>
							<em>No servers registered yet.</em>
						</text>
						<text fg={theme.accent}>Press [a] to add your first server</text>
					</box>
				) : (
					<scrollbox
						scrollY={true}
						focused={!showConfig}
						style={{ flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}
					>
						{servers.map((server, index) => {
							const isSelected = index === selectedIndex;
							return (
								<ServerCard
									key={server.name}
									server={server}
									isSelected={isSelected}
								/>
							);
						})}
					</scrollbox>
				)}
			</box>

			{/* Footer */}
			<box
				style={{
					flexDirection: "column",
					paddingTop: 1,
					border: ["top"],
					borderColor: theme.border,
				}}
			>
				<text fg={theme.foregroundMuted}>
					[↑↓] Select • [e] Export • [d] Delete • [a] Add • [ESC] Back to
					Activity Log
				</text>
			</box>
		</box>
	);
}
