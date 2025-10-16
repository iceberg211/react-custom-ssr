import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { PrefetchKeys } from "apis/queryKeys";
import HomeService from "apis/services/Home";
import { useEffect } from "react";

const Home = () => {
  const params = useParams();
  const coinList = useQuery({
    queryKey: [PrefetchKeys.HOME],
    queryFn: () => HomeService.getList(params),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="w-full flex justify-center items-center h-[58px] text-green-300 bg-primary">
        <span className="text-xl font-bold">React Custom SSR Demo</span>
        <Link className="ml-4 text-brand hover:underline" to="/about">
          About
        </Link>
      </header>

      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-white">
            Welcome to React 19.2 + React Compiler
          </h1>

          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-green-300">
              Data Fetching Demo (SSR + React Query)
            </h2>

            {coinList.isLoading && (
              <div className="text-gray-400">Loading data...</div>
            )}

            {coinList.isError && (
              <div className="text-red-400">
                Error loading data. Make sure the mock server is running:
                <code className="ml-2 bg-gray-700 px-2 py-1 rounded">npm run mock</code>
              </div>
            )}

            {coinList.isSuccess && (
              <div>
                <p className="text-gray-300 mb-4">
                  Fetched {coinList.data?.length || 0} items from API
                </p>
                <ul className="space-y-2">
                  {coinList.data?.map((item) => (
                    <li
                      key={item.key}
                      onClick={() => console.log(item)}
                      className="bg-gray-700 p-3 rounded cursor-pointer hover:bg-gray-600 transition-colors text-white"
                    >
                      <span className="font-mono text-sm text-gray-400">
                        [{item.key}]
                      </span>{" "}
                      {item.content}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-blue-900 bg-opacity-30 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-2 text-blue-300">
              Features Enabled:
            </h3>
            <ul className="list-disc list-inside space-y-1 text-gray-300">
              <li>React 19.2 with latest features</li>
              <li>React Compiler for automatic optimization</li>
              <li>Server-Side Rendering (SSR)</li>
              <li>React Query for data fetching</li>
              <li>Code splitting with @loadable/component</li>
              <li>TypeScript support</li>
            </ul>
          </div>
        </div>
      </main>

      <footer className="w-full text-center py-4 bg-gray-900 text-gray-400">
        React Custom SSR • React 19.2 + React Compiler
      </footer>
    </div>
  );
};

export default Home;
