import { useTheme } from "../theme-context";

type ModalSize = "small" | "medium" | "large";

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: ModalSize;
  scrollable?: boolean;
}

const sizeConfig = {
  small: { width: "50%", maxWidth: 50 },
  medium: { width: "70%", maxWidth: 70 },
  large: { width: "90%", maxWidth: 120 },
} as const;

export function Modal({
  title,
  children,
  size = "medium",
  scrollable = false,
}: ModalProps) {
  const theme = useTheme();
  const { width, maxWidth } = sizeConfig[size];

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
      backgroundColor={theme.backgroundTransparent}
    >
      {/* Modal content box */}
      <box
        style={{
          flexDirection: "column",
          width,
          maxWidth,
          maxHeight: "90%",
          height: scrollable ? undefined : "auto",
          minHeight: 10,
          margin: 2,
          padding: 2,
          paddingTop: 1,
          paddingBottom: 1,
        }}
        border={true}
        borderStyle="rounded"
        // Use foregroundMuted (as opposed to border) because the title of the modal
        // is based on the border color
        borderColor={theme.foregroundMuted}
        backgroundColor={theme.background}
        title={` ${title} `}
        titleAlignment="center"
      >
        {/* Content area - scrollable or static */}
        {scrollable ? (
          <scrollbox
            style={{ maxHeight: 40, flexShrink: 1 }}
            scrollY={true}
            focused={true}
          >
            {children}
          </scrollbox>
        ) : (
          <box style={{ flexDirection: "column" }}>{children}</box>
        )}

        {/* Fixed footer */}
        <text fg={theme.foregroundMuted} style={{ marginTop: 1 }}>
          Press ESC to close{scrollable ? " • ↑↓ to scroll" : ""}
        </text>
      </box>
    </box>
  );
}
