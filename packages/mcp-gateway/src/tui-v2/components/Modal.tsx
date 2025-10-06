import { COLORS } from "../colors";

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

export function Modal({ title, children }: ModalProps) {
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
      backgroundColor={COLORS.BLACK}
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
        borderColor={COLORS.CYAN}
        backgroundColor={COLORS.BLACK}
        title={title}
        titleAlignment="center"
      >
        {/* Scrollable content area - focused by default for immediate scrolling */}
        <scrollbox
          style={{ flexGrow: 1 }}
          scrollY={true}
          focused={true}
          focusedBorderColor={COLORS.CYAN}
        >
          {children}
        </scrollbox>

        {/* Fixed footer */}
        <text fg={COLORS.GRAY} style={{ marginTop: 1 }}>
          Press ESC to close • ↑↓ to scroll
        </text>
      </box>
    </box>
  );
}
