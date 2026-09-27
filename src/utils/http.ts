import axios from "axios";

export const http = axios.create({
  timeout: 15_000,
  maxContentLength: 6 * 1024 * 1024,
  maxRedirects: 5,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 HardwareDealsBot/1.0",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.7",
    Accept: "text/html,application/xhtml+xml",
  },
  responseType: "text",
});
