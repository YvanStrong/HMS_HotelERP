import axios from "axios";



export function isNetworkError(err: unknown): boolean {

  if (axios.isAxiosError(err)) {

    if (!err.response) return true;

    if (err.code === "ERR_NETWORK" || err.code === "ECONNABORTED") return true;

  }

  if (err instanceof TypeError && String(err.message).toLowerCase().includes("network")) {

    return true;

  }

  return false;

}


