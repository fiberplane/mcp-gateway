import { useOverflowDetection } from "../hooks/useOverflowDetection";
import { useTheme } from "../theme-context";

type ModalSize = "small" | "medium" | "large";

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: ModalSize;
  scrollable?: boolean;
  maxContentHeight?: number; // Max height for scrollbox content area
}

const sizeConfig = {
  small: { width: "50%", maxWidth: 50 },
  medium: { width: "70%", maxWidth: 70 },
  large: { width: "90%", maxWidth: 120 },
} as const;

export function Modal({
  title,
  children,
  onClose,
  size = "medium",
  scrollable = false,
  maxContentHeight = 60,
}: ModalProps) {
  const theme = useTheme();
  const { width, maxWidth } = sizeConfig[size];
  const { hasOverflow, measured, measurementRef } =
    useOverflowDetection(maxContentHeight);

  // Handle click on background to close modal
  const handleBackgroundClick = () => {
    onClose();
  };

  // Prevent modal content clicks from closing the modal
  const handleContentClick = (event: any) => {
    event.stopPropagation();
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: This is not a web ui
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
      onMouseDown={handleBackgroundClick}
    >
      {/* Modal content box */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: This is not a web ui */}
      <box
        onMouseDown={handleContentClick}
        style={{
          flexDirection: "column",
          width,
          maxWidth,
          maxHeight: "90%",
          // height: scrollable ? undefined : "auto",
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
        {/* Content area - conditionally use scrollbox only if content overflows */}
        {scrollable ? (
          <>
            {/* Hidden measurement box to determine natural content height */}
            {!measured && (
              <box
                ref={measurementRef as React.Ref<any>}
                style={{
                  position: "absolute",
                  left: -9999,
                  flexDirection: "column",
                }}
              >
                {children}
              </box>
            )}

            {/* Render actual content with scrollbox if overflow detected */}
            {measured && hasOverflow ? (
              <scrollbox
                style={{
                  maxHeight: maxContentHeight,
                  flexShrink: 1,
                  minHeight: 0,
                }}
                scrollY={true}
                focused={true}
              >
                {children}
              </scrollbox>
            ) : measured ? (
              <box style={{ flexDirection: "column" }}>{children}</box>
            ) : null}
          </>
        ) : (
          <box style={{ flexDirection: "column" }}>{children}</box>
        )}

        {/* Fixed footer */}
        <text
          fg={theme.foregroundMuted}
          style={{ marginTop: 1, flexShrink: 0 }}
        >
          Press ESC to close{scrollable ? " • ↑↓ to scroll" : ""}
        </text>
      </box>
    </box>
  );
}
