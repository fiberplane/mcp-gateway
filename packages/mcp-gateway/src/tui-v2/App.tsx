import { render } from "@opentui/react";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { COLORS } from "./colors";

function App() {
  return (
    <box style={{ flexDirection: "column", height: "100%", padding: 2 }}>
      <Header />

      {/* Spacer - will be content area later */}
      <box style={{ flexGrow: 1 }}>
        <text fg={COLORS.GRAY}>No servers registered</text>
      </box>

      <Footer />
    </box>
  );
}

render(<App />);
