import { useTheme } from "../theme-context";

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

export function Modal({ title, children }: ModalProps) {
  const theme = useTheme();

  return (
    <box
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
      }}
      backgroundColor={theme.background}
    >
      {/* Modal content box */}
      <box
        style={{
          flexDirection: "column",
          width: "70%",
          maxHeight: "90%",
          minHeight: 10,
          margin: 2,
          padding: 3,
        }}
        border={true}
        borderStyle="double"
        borderColor={theme.accent}
        backgroundColor={theme.background}
        title={title}
        titleAlignment="center"
      >
        {/* Scrollable content area */}
        <scrollbox
          style={{ flexGrow: 1 }}
          scrollY={true}
          focused={false}
          focusedBorderColor={theme.accent}
        >
          {children}
        </scrollbox>

        {/* Fixed footer */}
        <text fg={theme.foregroundMuted} style={{ marginTop: 1 }}>
          Press ESC to close • ↑↓ to scroll
        </text>
      </box>
    </box>
  );
}
