import React, { useState, useEffect } from "react";
import { GitBranch, Mail, Bell } from "lucide-react";
import "./App.css";

const API_URL = "https://impact-analyzer-mw0f.onrender.com";

export default function App() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDetails, setProjectDetails] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [email, setEmail] = useState(localStorage.getItem("userEmail") || "");
  const [selectedEndpoints, setSelectedEndpoints] = useState([]);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const res = await fetch(`${API_URL}/api/projects`);
    const data = await res.json();
    setProjects(data.projects);
  };

  const loadProjectDetails = async (name) => {
    const res = await fetch(`${API_URL}/api/projects/${name}`);
    const data = await res.json();

    setSelectedProject(name);
    setProjectDetails(data);
    setSelectedEndpoints([]); // reset selection when switching project
  };

  const toggleSelectEndpoint = (ep) => {
    setSelectedEndpoints((prev) =>
      prev.includes(ep) ? prev.filter((x) => x !== ep) : [...prev, ep]
    );
  };

  const toggleSelectAllInScan = (scan) => {
    const allStrings = scan.data.map((ep) => `${ep.Method}:${ep.Path}`);

    const allSelected = allStrings.every((s) => selectedEndpoints.includes(s));

    if (allSelected) {
      // Uncheck all from this scan
      setSelectedEndpoints((prev) =>
        prev.filter((ep) => !allStrings.includes(ep))
      );
    } else {
      // Add all from this scan
      setSelectedEndpoints((prev) => [
        ...prev.filter((ep) => !allStrings.includes(ep)),
        ...allStrings,
      ]);
    }
  };

  const subscribeNow = async () => {
    if (!email.trim()) {
      alert("Please enter an email.");
      return;
    }

    const payload = {
      name: projectDetails.name,
      mail: email,
      endpoints: selectedEndpoints,
    };

    await fetch(`${API_URL}/api/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    localStorage.setItem("userEmail", email);
    alert("Subscription successful!");

    setShowModal(false);
    setSelectedEndpoints([]); // clear checkbox selection!
  };

  return (
    <div className="page">
      {/* HEADER */}
      <header className="header">
        <div className="header-inner">
          <div className="header-icon">
            <GitBranch size={22} />
          </div>
          <div>
            <h1 className="title">Impact Analyzer</h1>
            <p className="subtitle">
              Track scans and subscribe to endpoint changes
            </p>
          </div>
        </div>
      </header>

      <div className="layout">
        {/* SIDEBAR */}
        <aside className="sidebar">
          <h2 className="sidebar-title">
            <GitBranch size={18} /> Projects
          </h2>

          {projects.map((p) => (
            <button
              key={p.name}
              className={`project-item ${selectedProject === p.name ? "active" : ""
                }`}
              onClick={() => loadProjectDetails(p.name)}
            >
              <strong>{p.name}</strong>

              <a
                href={p.url.replace(".git", "")}
                target="_blank"
                rel="noopener noreferrer"
                className="sidebar-gh"
              >
                <svg
                  className="gh-icon"
                  viewBox="0 0 24 24"
                  fill="black"
                  width="18"
                  height="18"
                >
                  <path d="M12 .5C5.648.5.5 5.648.5 12c0 5.086 3.292 9.387 7.868 10.907.575.11.787-.25.787-.556 0-.274-.01-1-.016-1.963-3.2.695-3.878-1.54-3.878-1.54-.523-1.33-1.277-1.684-1.277-1.684-1.044-.714.08-.7.08-.7 1.155.082 1.763 1.187 1.763 1.187 1.027 1.761 2.693 1.252 3.348.958.103-.744.402-1.253.732-1.542-2.554-.29-5.238-1.292-5.238-5.75 0-1.27.453-2.31 1.194-3.12-.12-.292-.52-1.464.112-3.05 0 0 .98-.313 3.213 1.19a11.17 11.17 0 0 1 2.93-.395c.995.005 1.996.135 2.93.395C17.83 6.152 18.81 6.465 18.81 6.465c.633 1.586.233 2.758.114 3.05.744.81 1.193 1.85 1.193 3.12 0 4.47-2.69 5.455-5.253 5.74.41.36.784 1.096.784 2.216 0 1.6-.014 2.888-.014 3.278 0 .31.207.67.792.555C20.21 21.38 23.5 17.08 23.5 12c0-6.352-5.148-11.5-11.5-11.5Z" />
                </svg>
              </a>
            </button>
          ))}
        </aside>

        {/* MAIN CONTENT */}
        <main className="content">
          {!projectDetails ? (
            <div className="empty-box">Select a project to view scans</div>
          ) : (
            <>
              <div className="project-details">
                <h2 className="proj-title">{projectDetails.name}</h2>

                <p className="meta">
                  Commit: {projectDetails.scans[0].commit} │ Tag:{" "}
                  {projectDetails.scans[0].tag_name} │{" "}
                  {projectDetails.scans[0].created_at}
                </p>
              </div>
              {projectDetails.scans.map((scan) => {
                const all = scan.data.map((ep) => `${ep.Method}:${ep.Path}`);
                const allSelected = all.every((s) =>
                  selectedEndpoints.includes(s)
                );

                return (
                  <div className="scan-box" key={scan.id}>
                    <div className="scan-header">
                      <label className="select-all-wrap">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => toggleSelectAllInScan(scan)}
                        />
                        Select All
                      </label>

                      {/* Subscribe */}
                      <button
                        className="subscribe-btn"
                        disabled={selectedEndpoints.length === 0}
                        onClick={() => setShowModal(true)}
                      >
                        <Bell size={16} />
                        {selectedEndpoints.length === 0
                          ? "Select endpoints"
                          : selectedEndpoints.length === all.length
                            ? "Subscribe to All"
                            : `Subscribe (${selectedEndpoints.length})`}
                      </button>
                    </div>

                    {/* ENDPOINT ROWS */}
                    {scan.data.map((ep, idx) => {
                      const epString = `${ep.Method}:${ep.Path}`;
                      const checked = selectedEndpoints.includes(epString);

                      return (
                        <div key={idx} className="endpoint-row">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelectEndpoint(epString)}
                            className="ep-check"
                          />

                          <span
                            className={`method-tag ${ep.Method.toLowerCase()}`}
                          >
                            {ep.Method}
                          </span>

                          <span className="ep-path">{ep.Path}</span>

                          <span className="ep-file">{ep.FileName}</span>

                          <button
                            className="mini-sub-btn"
                            onClick={() => {
                              setSelectedEndpoints([epString]);
                              setShowModal(true);
                            }}
                          >
                            Subscribe
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </main>
      </div>

      {/* SUBSCRIPTION MODAL */}
      {showModal && (
        <div className="modal-bg" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Subscribe to Endpoints</h3>

            <label>Email</label>

            <div className="input-wrap">
              <Mail size={16} />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <p className="selected-count">
              {selectedEndpoints.length} endpoint(s) selected
            </p>

            <button className="full-btn" onClick={subscribeNow}>
              Subscribe Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
