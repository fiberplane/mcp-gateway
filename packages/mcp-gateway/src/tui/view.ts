import { CLEAR_SCREEN } from "./components/formatting.js";
import { renderMenu } from "./components/menu.js";
import { renderModal } from "./components/modal.js";
import type { State } from "./state.js";

function applyPadding(content: string): string {
  const leftPad = "  ";
  const topPad = "\n";
  return (
    topPad +
    content
      .split("\n")
      .map((line) => leftPad + line)
      .join("\n")
  );
}

// Pure rendering function - State → Display
export function view(state: State): void {
  // Render modal if in modal mode
  if (state.mode === "modal" && state.modalContent) {
    const content = renderModal(
      state.modalContent,
      state.formState,
      state.deleteServerState,
      state.registry,
    );
    process.stdout.write(CLEAR_SCREEN + applyPadding(content));
    return;
  }

  // Only render menu in menu mode
  if (state.mode !== "menu") {
    return;
  }

  const content = renderMenu(state.registry, state.logs);
  process.stdout.write(CLEAR_SCREEN + applyPadding(content));
}
