import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { safeErrorMessage } from "../src/utils/safeError.js";

describe("safeErrorMessage", () => {
  it("resume erro HTTP sem expor headers ou tokens", () => {
    const error = new AxiosError(
      "Request failed",
      "ERR_BAD_REQUEST",
      { headers: new AxiosHeaders({ Authorization: "Bearer token-secreto" }) },
      undefined,
      {
        data: { message: "forbidden" },
        status: 403,
        statusText: "Forbidden",
        headers: {},
        config: { headers: new AxiosHeaders() },
      },
    );

    const message = safeErrorMessage(error);

    expect(message).toContain("HTTP 403");
    expect(message).toContain("forbidden");
    expect(message).not.toContain("token-secreto");
    expect(message).not.toContain("Authorization");
  });
});
