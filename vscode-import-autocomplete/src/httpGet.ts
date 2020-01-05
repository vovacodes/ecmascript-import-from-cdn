import { IncomingMessage } from "http";
import { get, Agent } from "https";
import { parse } from "url";

const agent = new Agent({
  keepAlive: true
});

export function httpGet(URL: string): Promise<IncomingMessage> {
  const { hostname, pathname } = parse(URL);
  const options = {
    agent: agent,
    hostname: hostname,
    path: pathname,
    headers: {
      Accept: "application/json"
    }
  };

  return new Promise((resolve, reject) => {
    get(options, resolve).on("error", reject);
  });
}
