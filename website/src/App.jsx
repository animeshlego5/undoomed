import { useState } from "react";
import Nav from "./components/Nav.jsx";
import Hero from "./components/Hero.jsx";
import HowItWorks from "./components/HowItWorks.jsx";
import Downloads from "./components/Downloads.jsx";
import Faq from "./components/Faq.jsx";
import Cta from "./components/Cta.jsx";
import Footer from "./components/Footer.jsx";
import ExtensionModal from "./components/ExtensionModal.jsx";
import AgentModal from "./components/AgentModal.jsx";
import VsCodeModal from "./components/VsCodeModal.jsx";

export default function App() {
  // Which modal is open: "extension" | "agent" | "vscode" | null
  const [modal, setModal] = useState(null);
  const close = () => setModal(null);

  return (
    <>
      <Nav />
      <main id="top">
        <Hero />
        <HowItWorks />
        <Downloads
          onOpenExtension={() => setModal("extension")}
          onOpenAgent={() => setModal("agent")}
          onOpenVsCode={() => setModal("vscode")}
        />
        <Faq />
        <Cta />
      </main>
      <Footer />
      <ExtensionModal open={modal === "extension"} onClose={close} />
      <AgentModal open={modal === "agent"} onClose={close} />
      <VsCodeModal open={modal === "vscode"} onClose={close} />
    </>
  );
}
