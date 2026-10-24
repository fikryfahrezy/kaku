// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";

const root = document.getElementById("app");
if (!root) throw new Error("Application root was not found.");

mount(() => <StartClient />, root);
