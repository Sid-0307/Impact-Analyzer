import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "../src/App";
import { vi } from "vitest";

const mockProjects = {
  projects: [{ name: "DemoProject", url: "http://github.com/demo/repo.git" }],
};

const mockProjectDetails = {
  name: "DemoProject",
  scans: [
    {
      id: "1",
      commit: "abc123",
      tag_name: "v1",
      created_at: "2025-01-01",
      data: [{ Method: "GET", Path: "/api/test", FileName: "Test.java" }],
    },
  ],
};

describe("App Integration Test", () => {
  beforeEach(() => {
    global.alert = vi.fn();
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ json: () => mockProjects })
      .mockResolvedValueOnce({ json: () => mockProjectDetails })
      .mockResolvedValueOnce({ json: () => ({ success: true }) });
  });

  it("shows alert if trying to subscribe without email", async () => {
    render(<App />);

    await waitFor(() => screen.getByText("DemoProject"));
    fireEvent.click(screen.getByText("DemoProject"));

    const checkboxes = await screen.findAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);

    const subscribeBtn = screen.getAllByRole("button", {
      name: /subscribe/i,
    })[0];
    fireEvent.click(subscribeBtn);

    expect(screen.getByText("Subscribe to Endpoints")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "" },
    });

    fireEvent.click(screen.getByText("Subscribe Now"));

    expect(global.alert).toHaveBeenCalledWith("Please enter an email.");
  });

  it("selects endpoint and subscribes", async () => {
    render(<App />);

    await waitFor(() => screen.getByText("DemoProject"));
    fireEvent.click(screen.getByText("DemoProject"));

    const checkboxes = await screen.findAllByRole("checkbox");
    fireEvent.click(checkboxes[1]);

    const subscribeButtons = screen.getAllByRole("button", {
      name: /Subscribe/i,
    });
    fireEvent.click(subscribeButtons[0]);

    expect(screen.getByText("Subscribe to Endpoints")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "me@test.com" },
    });

    fireEvent.click(screen.getByText("Subscribe Now"));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
  });
});
