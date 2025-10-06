import { render } from "@opentui/react";
import { Header } from "./components/Header";
import { ServerList } from "./components/ServerList";
import { Footer } from "./components/Footer";

function App() {
  return (
    <box style={{ flexDirection: "column", height: "100%", padding: 2 }}>
      <Header />

      <box style={{ flexDirection: "column", flexGrow: 1 }}>
        <ServerList />
      </box>

      <Footer />
    </box>
  );
}

render(<App />);
