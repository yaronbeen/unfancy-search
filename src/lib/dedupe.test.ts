import { describe, it, expect } from "vitest";
import { canonicalizeUrl, extractDomain } from "./dedupe";

describe("canonicalizeUrl", () => {
  it("strips UTM tracking params", () => {
    const url =
      "https://example.com/page?utm_source=twitter&utm_medium=social&foo=bar";
    expect(canonicalizeUrl(url)).toBe("https://example.com/page?foo=bar");
  });

  it("strips all known tracking params", () => {
    const url =
      "https://example.com/?fbclid=abc&gclid=def&msclkid=ghi&ref=jkl&_ga=mno&ck_subscriber_id=pqr&s_kwcid=stu&mc_cid=vwx&mc_eid=yza";
    expect(canonicalizeUrl(url)).toBe("https://example.com/");
  });

  it("removes www. prefix", () => {
    const url = "https://www.example.com/path";
    expect(canonicalizeUrl(url)).toBe("https://example.com/path");
  });

  it("lowercases hostname", () => {
    const url = "https://EXAMPLE.COM/Path";
    expect(canonicalizeUrl(url)).toBe("https://example.com/Path");
  });

  it("removes trailing slash", () => {
    const url = "https://example.com/page/";
    expect(canonicalizeUrl(url)).toBe("https://example.com/page");
  });

  it("keeps root path slash", () => {
    const url = "https://example.com/";
    expect(canonicalizeUrl(url)).toBe("https://example.com/");
  });

  it("removes fragment", () => {
    const url = "https://example.com/page#section";
    expect(canonicalizeUrl(url)).toBe("https://example.com/page");
  });

  it("sorts remaining query params", () => {
    const url = "https://example.com/page?z=1&a=2&m=3";
    expect(canonicalizeUrl(url)).toBe("https://example.com/page?a=2&m=3&z=1");
  });

  it("handles URL with no params", () => {
    const url = "https://example.com/simple/path";
    expect(canonicalizeUrl(url)).toBe("https://example.com/simple/path");
  });

  it("handles URL with only tracking params (strips all)", () => {
    const url = "https://example.com/page?utm_source=google&fbclid=abc";
    expect(canonicalizeUrl(url)).toBe("https://example.com/page");
  });

  it("handles invalid URL gracefully", () => {
    const result = canonicalizeUrl("not a url at all");
    expect(result).toBe("not a url at all");
  });

  it("handles invalid URL with trailing slash fallback", () => {
    const result = canonicalizeUrl("not-a-url/");
    expect(result).toBe("not-a-url");
  });

  it("combines www removal, param stripping, and lowercase", () => {
    const url = "https://WWW.Example.COM/Page/?utm_source=x&keep=yes#frag";
    expect(canonicalizeUrl(url)).toBe("https://example.com/Page?keep=yes");
  });

  it("handles HTTP protocol", () => {
    const url = "http://www.example.com/page";
    expect(canonicalizeUrl(url)).toBe("http://example.com/page");
  });
});

describe("extractDomain", () => {
  it("extracts domain from standard URL", () => {
    expect(extractDomain("https://example.com/page")).toBe("example.com");
  });

  it("removes www. prefix", () => {
    expect(extractDomain("https://www.example.com/page")).toBe("example.com");
  });

  it("lowercases the domain", () => {
    expect(extractDomain("https://EXAMPLE.COM/page")).toBe("example.com");
  });

  it("handles subdomains", () => {
    expect(extractDomain("https://blog.example.com/post")).toBe(
      "blog.example.com",
    );
  });

  it("handles invalid URL gracefully", () => {
    expect(extractDomain("not a url")).toBe("not a url");
  });

  it("handles URL with port", () => {
    expect(extractDomain("https://example.com:8080/page")).toBe("example.com");
  });
});
