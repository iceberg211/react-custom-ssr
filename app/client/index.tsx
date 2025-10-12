import { hydrateRoot, createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { loadableReady } from "@loadable/component";
import {
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";

import App from "index";

interface TradeFlagType {
  isSSR: boolean;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      retryDelay: 1000,
    },
  },
});

const getDehydratedState = () => {
  try {
    const element = document.querySelector("#__REACT_QUERY_STATE__");
    if (!element?.textContent) return {};
    return JSON.parse(element.textContent);
  } catch (error) {
    console.error("Failed to parse dehydrated state:", error);
    return {};
  }
};

const getTradeFlag = (): TradeFlagType => {
  try {
    const element = document.querySelector("#__APP_FLAG__");
    if (!element?.textContent) return { isSSR: false };
    return JSON.parse(element.textContent);
  } catch (error) {
    console.error("Failed to parse trade flag:", error);
    return { isSSR: false };
  }
};

const dehydratedState = getDehydratedState();
const tradeFlag = getTradeFlag();

const ClientApp = () => (
  <BrowserRouter>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <HydrationBoundary state={dehydratedState}>
          <App />
        </HydrationBoundary>
      </QueryClientProvider>
    </HelmetProvider>
  </BrowserRouter>
);

const root = document.querySelector("#root");

if (!root) {
  throw new Error("Root element not found");
}

const renderApp = () => {
  if (tradeFlag.isSSR) {
    loadableReady(() => {
      hydrateRoot(root, <ClientApp />);
    });
  } else {
    createRoot(root).render(<ClientApp />);
  }
};

renderApp();
