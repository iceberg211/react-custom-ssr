import { Params } from "react-router-dom";
import axios from "axios";
import { HomeResponse } from "../model/Home";

class HomeService {
  static async getList(params: Params<string>): Promise<HomeResponse[]> {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return axios.get("http://localhost:8007/home");
  }
}

export default HomeService;
