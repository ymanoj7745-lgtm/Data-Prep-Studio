import "@/App.css";
import { Toaster } from "sonner";
import Studio from "@/pages/Studion";

function App() {
  return (
    <div className="App">
      <Studio />
      <Toaster richColors position="top-right" />
    </div>
  );
}

export default App;


