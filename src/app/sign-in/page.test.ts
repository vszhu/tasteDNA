// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import SignInPage from "./page";

const auth = vi.hoisted(() => ({
  status: "signed-out", user: null as { id: string; email: string; displayName: string } | null,
  requestMagicLink: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(), signOut: vi.fn(),
}));
const navigation = vi.hoisted(() => ({ search: new URLSearchParams(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => navigation.search, useRouter: () => ({ replace: navigation.replace }) }));
vi.mock("@/components/providers/session-provider", () => ({ useSession: () => auth }));
beforeEach(() => { vi.clearAllMocks(); auth.user = null; auth.status = "signed-out"; navigation.search = new URLSearchParams(); });
afterEach(cleanup);
function credentials() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ben@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "example-passphrase" } });
}
it("offers password signup for any email domain and waits for confirmation", async () => {
  auth.signUp.mockResolvedValue({ ok: true, needsConfirmation: true });
  render(createElement(SignInPage));
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  credentials();
  fireEvent.click(screen.getByRole("button", { name: "Create my account" }));
  expect((await screen.findByRole("status")).textContent).toContain("confirm your email");
  expect(auth.signUp).toHaveBeenCalledWith("ben@example.test", "example-passphrase", undefined);
  expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
  expect(screen.queryByRole("link", { name: /Go to friends/ })).toBeNull();
});

it("returns a signed-out invite recipient to the meal only after verified sign-in", async () => {
  const next = "/sessions/c2000000-0000-4000-8000-000000000001";
  navigation.search.set("next", next);
  auth.signInWithPassword.mockResolvedValue({ ok: true, needsConfirmation: false });
  const view = render(createElement(SignInPage));
  credentials();
  fireEvent.click(screen.getByRole("button", { name: "Sign in with password" }));
  await screen.findByText(/Sign-in complete/);
  expect(navigation.replace).not.toHaveBeenCalled();
  auth.status = "signed-in";
  auth.user = { id: "account-b", email: "ben@example.test", displayName: "Ben" };
  view.rerender(createElement(SignInPage));
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(next));
});

it("keeps the meal destination while an existing login switches accounts", async () => {
  const next = "/sessions/c2000000-0000-4000-8000-000000000001";
  navigation.search.set("next", next);
  auth.status = "signed-in";
  auth.user = { id: "account-a", email: "ada@example.test", displayName: "Ada" };
  auth.signOut.mockResolvedValue(undefined);
  const view = render(createElement(SignInPage));
  expect(screen.getByRole("link", { name: /Continue to your meal/ }).getAttribute("href")).toBe(next);
  expect(navigation.replace).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Sign out / switch account" }));
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce());
  auth.status = "signed-out";
  auth.user = null;
  view.rerender(createElement(SignInPage));
  auth.signInWithPassword.mockResolvedValue({ ok: true, needsConfirmation: false });
  credentials();
  fireEvent.click(screen.getByRole("button", { name: "Sign in with password" }));
  await screen.findByText(/Sign-in complete/);
  auth.status = "signed-in";
  auth.user = { id: "account-b", email: "ben@example.test", displayName: "Ben" };
  view.rerender(createElement(SignInPage));
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(next));
});

it("carries the invitation into signup confirmation and email-link sign-in", async () => {
  const next = "/sessions/c2000000-0000-4000-8000-000000000001";
  navigation.search.set("next", next);
  auth.signUp.mockResolvedValue({ ok: true, needsConfirmation: true });
  auth.requestMagicLink.mockResolvedValue({ ok: true });
  render(createElement(SignInPage));
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  credentials();
  fireEvent.click(screen.getByRole("button", { name: "Create my account" }));
  await screen.findByText(/Check your inbox to confirm/);
  expect(auth.signUp).toHaveBeenCalledWith("ben@example.test", "example-passphrase", next);
  expect(navigation.replace).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Use an email link instead" }));
  fireEvent.click(screen.getByRole("button", { name: "Send magic link" }));
  await waitFor(() => expect(auth.requestMagicLink).toHaveBeenCalledWith("ben@example.test", next));
});

it("does not link an existing login to an external next URL", () => {
  navigation.search.set("next", "/\\attacker.test");
  auth.status = "signed-in";
  auth.user = { id: "account-a", email: "ada@example.test", displayName: "Ada" };
  render(createElement(SignInPage));
  expect(screen.getByRole("link", { name: /Go to friends/ }).getAttribute("href")).toBe("/friends");
  expect(navigation.replace).not.toHaveBeenCalled();
});
it("restores the submit button after a network failure", async () => {
  auth.signInWithPassword.mockRejectedValue(new Error("offline"));
  render(createElement(SignInPage));
  credentials();
  fireEvent.click(screen.getByRole("button", { name: "Sign in with password" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Check your connection");
  expect((screen.getByRole("button", { name: "Sign in with password" }) as HTMLButtonElement).disabled).toBe(false);
});
it("preserves email-link sign-in and displays the provider limit", async () => {
  auth.requestMagicLink.mockResolvedValue({ ok: false, message: "The sign-in email limit was reached." });
  render(createElement(SignInPage));
  fireEvent.click(screen.getByRole("button", { name: "Use an email link instead" }));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Send magic link" }));
  expect((await screen.findByRole("alert")).textContent).toContain("email limit");
  expect(screen.queryByLabelText("Password")).toBeNull();
});
it("shows the active account and does not hide sign-out failures", async () => {
  auth.user = { id: "account-a", email: "ada@example.test", displayName: "Ada" };
  auth.status = "signed-in";
  auth.signOut.mockRejectedValue(new Error("offline"));
  render(createElement(SignInPage));
  expect(screen.getByText("ada@example.test")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Sign out / switch account" }));
  expect((await screen.findByRole("alert")).textContent).toContain("couldn't sign you out");
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce());
  expect(screen.getByText("ada@example.test")).toBeTruthy();
});
