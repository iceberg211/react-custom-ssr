import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { PrefetchKeys } from "apis/queryKeys";
import HomeService from "apis/services/Home";
import ViewTransitionLink from "@app/client/ViewTransitionLink";

const Home = () => {
  const params = useParams();
  const coinList = useQuery({
    queryKey: [PrefetchKeys.HOME],
    queryFn: () => HomeService.getList(params),
  });

  return (
    <main className="vt-page min-h-screen bg-neutral-900 text-white">
      <header className="vt-header w-full flex justify-center items-center h-[58px] text-green-300 bg-primary">
        header
        <ViewTransitionLink
          className="ml-4 text-brand underline"
          to="/about"
          viewTransitionName="page-link"
        >
          about
        </ViewTransitionLink>
      </header>
      <section className="px-6 py-4">
        <h1 className="text-2xl font-semibold mb-4">Home</h1>
        <ul>
          {coinList.data?.map((i) => (
            <li
              onClick={() => {
                console.log(i);
              }}
              key={i.key}
            >
              {i.content}
            </li>
          ))}
        </ul>
      </section>
      <footer>footer</footer>
    </main>
  );
};

export default Home;
