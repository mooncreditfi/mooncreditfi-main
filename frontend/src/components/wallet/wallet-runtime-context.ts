import { createContext, useContext } from "react";

export const WalletRuntimeContext = createContext(false);
export const useWalletRuntimeReady = () => useContext(WalletRuntimeContext);
