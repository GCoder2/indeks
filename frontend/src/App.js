import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";

import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Results from "@/pages/Results";
import Admin from "@/pages/Admin";
import Favorites from "@/pages/Favorites";
import History from "@/pages/History";
import { getAnonId } from "@/lib/anon";

// Ensure anonymous ID exists immediately
getAnonId();

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Results />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </Layout>
        <Toaster position="bottom-right" richColors closeButton />
      </BrowserRouter>
    </div>
  );
}

export default App;
