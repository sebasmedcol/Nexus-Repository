import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import App from "./App.jsx"
import { AuthProvider } from "./contexts/AuthContext"
import logoIco from "./assets/logo-ico.ico"

const favicon = document.querySelector('link[rel="icon"]') || document.createElement("link")
favicon.setAttribute("rel", "icon")
favicon.setAttribute("type", "image/x-icon")
favicon.setAttribute("href", logoIco)
if (!favicon.parentNode) document.head.appendChild(favicon)

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
