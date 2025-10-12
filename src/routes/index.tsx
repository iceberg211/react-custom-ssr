import loadable from "@app/utils/loadable";
import Index from "pages/index";
import { PreFetchRouteObject } from "@app/utils/routesTypes";
import { PrefetchKeys } from "apis/queryKeys";
import HomeService from "apis/services/Home";

const Home = loadable(/* #__LOADABLE__ */ () => import("pages/Home"), null);

const routes: PreFetchRouteObject[] = [
  {
    path: "/",
    element: <Index />,
    children: [
      {
        path: ":locales/home",
        element: <Home />,
        queryKey: [PrefetchKeys.HOME],
        loadData: HomeService.getList,
      },
      {
        path: ":locales?/about",
        element: <div>about</div>,
      },
    ],
  },
];

export default routes;
