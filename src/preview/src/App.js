import "./App.css";
import Previews from "./components/Previews";
import React from "react";

import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import { BrowserRouter } from "react-router-dom";

// import adsList from './data/ads.json'
import getData from "./utils/getData";
import { useState, useEffect } from "react";

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

function App() {
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const fileData = await getData("./data/ads.json");

        if (fileData.ads) {
          // some json verification
          setData(fileData);
        } else {
          setError("something wrong with the file");
        }
      } catch (e) {
        setError("error loading file");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (error) return <div>{error}</div>;
  if (isLoading) return <div>loading...</div>;

  return (
    <ThemeProvider theme={darkTheme}>
      <BrowserRouter>
        <CssBaseline />
        <div className="App">
          <Previews data={data} />
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
