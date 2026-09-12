// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SessionNavItem } from "./session-nav-item";

const state = vi.hoisted(() => ({ pathname: "/sessions/c2000000-0000-4000-8000-000000000001" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("@/components/providers/session-provider", () => ({ useSession: () => ({ status: "signed-out", user: null }) }));
afterEach(cleanup);

it("also keeps the invite when the recipient uses the header sign-in button", () => {
  render(createElement(SessionNavItem));
  const url = new URL(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")!, "https://taste.example.test");
  expect(url.searchParams.get("next")).toBe(state.pathname);
});
