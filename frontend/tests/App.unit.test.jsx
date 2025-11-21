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

describe("App Unit Tests", () => {
  beforeEach(() => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ json: () => mockProjects })
      .mockResolvedValueOnce({ json: () => mockProjectDetails });
    localStorage.clear();
  });

  it("loads and displays project list", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("DemoProject")).toBeInTheDocument();
    });
  });

  it("selects project and loads scans", async () => {
    render(<App />);
    await waitFor(() => screen.getByText("DemoProject"));

    fireEvent.click(screen.getByText("DemoProject"));

    await waitFor(() =>
      expect(screen.getByText("/api/test")).toBeInTheDocument()
    );
  });

  it("allows selecting an endpoint", async () => {
    render(<App />);
    await waitFor(() => screen.getByText("DemoProject"));
    fireEvent.click(screen.getByText("DemoProject"));

    const checkboxes = await screen.findAllByRole("checkbox");
    const endpointCheckbox = checkboxes[1];

    fireEvent.click(endpointCheckbox);

    expect(endpointCheckbox.checked).toBe(true);
  });

  it("select all toggles endpoint selection correctly", async () => {
    render(<App />);

    await waitFor(() => screen.getByText("DemoProject"));
    fireEvent.click(screen.getByText("DemoProject"));

    const checkboxes = await screen.findAllByRole("checkbox");
    const selectAllCheckbox = checkboxes[0];

    fireEvent.click(selectAllCheckbox);

    const endpointCheckbox = checkboxes[1];
    expect(endpointCheckbox.checked).toBe(true);

    fireEvent.click(selectAllCheckbox);

    expect(endpointCheckbox.checked).toBe(false);
  });
});
