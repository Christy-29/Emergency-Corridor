import React, { useCallback, useEffect, useMemo, useState } from "react";
import CityMap from "./CityMap";
import "./App.css";

const INITIAL_CONGESTION = {
  R1: 20,
  R2: 70,
  R3: 35,
  R4: 20,
  R5: 25,
  R6: 35,
};

const ROAD_INFO = {
  R1: { from: "J1", to: "J2" },
  R2: { from: "J1", to: "J3" },
  R3: { from: "J2", to: "J3" },
  R4: { from: "J2", to: "J4" },
  R5: { from: "J3", to: "J5" },
  R6: { from: "J4", to: "J5" },
};

function congestionText(value) {
  if (value >= 75) return "HEAVY";
  if (value >= 50) return "HIGH";
  if (value >= 30) return "MEDIUM";
  return "LOW";
}

export default function App() {
  const [congestion, setCongestion] = useState(
    INITIAL_CONGESTION
  );

  const [route, setRoute] = useState({
    nodes: ["J1", "J2", "J4", "J5"],
    roads: ["R1", "R4", "R6"],
  });

  const [running, setRunning] = useState(true);

  /*
   * Optional backend synchronization.
   *
   * If your backend is running on port 8000,
   * this sends congestion updates to it.
   */
  const updateTrafficBackend = async (roadId, value) => {
    try {
      await fetch(
        `http://127.0.0.1:8000/update-traffic?road_id=${roadId}&congestion=${value}`
      );
    } catch {
      /*
       * Frontend still works even if backend is unavailable.
       */
    }
  };

  const changeCongestion = (roadId, value) => {
    const number = Number(value);

    setCongestion((previous) => ({
      ...previous,
      [roadId]: number,
    }));

    updateTrafficBackend(roadId, number);
  };

  /*
   * Whenever CityMap recalculates the route,
   * update the dashboard.
   */
  const handleRouteChange = useCallback((newRoute) => {
    setRoute(newRoute);
  }, []);

  const routeText = useMemo(() => {
    return route.nodes.join(" → ");
  }, [route]);

  const averageCongestion = useMemo(() => {
    const values = Object.values(congestion);

    return Math.round(
      values.reduce((a, b) => a + b, 0) / values.length
    );
  }, [congestion]);

  const nextRoad = route.roads[0];

  return (
    <div className="app">
      {/* HEADER */}
      <header className="header">
        <div className="brand">
          <div className="brand-icon">🚑</div>

          <div>
            <h1>Emergency Corridor System</h1>
            <p>Dynamic Ambulance Route Management</p>
          </div>
        </div>

        <div className="header-status">
          <span className="status-dot"></span>

          <div>
            <strong>
              {route.nodes.at(-1) === "J5"
                ? "AMBULANCE EN ROUTE"
                : "AMBULANCE ACTIVE"}
            </strong>

            <small>{routeText}</small>
          </div>
        </div>
      </header>

      <main className="layout">
        {/* LEFT SIDEBAR */}
        <aside className="sidebar">
          <section className="card overview-card">
            <div className="card-title">
              <span>🚑</span>
              Ambulance Monitoring
            </div>

            <div className="stat-grid">
              <div>
                <span>CONGESTION</span>
                <strong>{averageCongestion}%</strong>
              </div>

              <div>
                <span>ROAD SPEED</span>
                <strong>
                  {Math.max(
                    20,
                    60 - Math.round(averageCongestion / 2)
                  )}{" "}
                  km/h
                </strong>
              </div>
            </div>

            <button
              className={`movement-button ${
                running ? "active" : ""
              }`}
              onClick={() => setRunning((v) => !v)}
            >
              {running
                ? "🚑 Ambulance Moving..."
                : "▶ Start Ambulance"}
            </button>
          </section>

          {/* TRAFFIC CONTROLS */}
          <section className="card traffic-card">
            <div className="card-title">
              <span>🚦</span>
              Traffic Conditions
            </div>

            <p className="card-subtitle">
              Change congestion dynamically. The ambulance
              will select the best available route.
            </p>

            {Object.entries(ROAD_INFO).map(
              ([roadId, road]) => {
                const value = congestion[roadId];

                return (
                  <div className="road-control" key={roadId}>
                    <div className="road-control-top">
                      <div>
                        <strong>{roadId}</strong>

                        <span>
                          {road.from} → {road.to}
                        </span>
                      </div>

                      <strong className="percentage">
                        {value}%
                      </strong>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={value}
                      onChange={(e) =>
                        changeCongestion(
                          roadId,
                          e.target.value
                        )
                      }
                    />

                    <div className="road-control-bottom">
                      <span>
                        {congestionText(value)}
                      </span>

                      {route.roads.includes(roadId) && (
                        <span className="route-badge">
                          🚑 ACTIVE ROUTE
                        </span>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </section>
        </aside>

        {/* CENTER MAP */}
        <section className="map-section">
          <div className="map-header">
            <div>
              <h2>Emergency Corridor Map</h2>
              <p>
                Real-time traffic-aware ambulance navigation
              </p>
            </div>

            <div className="route-pill">
              <span>ACTIVE ROUTE</span>
              <strong>{routeText}</strong>
            </div>
          </div>

          <CityMap
            congestion={congestion}
            onRouteChange={handleRouteChange}
          />
        </section>

        {/* RIGHT SIDEBAR */}
        <aside className="right-sidebar">
          <section className="card signal-card">
            <div className="card-title">
              <span>🚦</span>
              Signal Priority
            </div>

            <p className="card-subtitle">
              Green signal is automatically assigned to the
              ambulance's next junction.
            </p>

            {["J1", "J2", "J3", "J4", "J5"].map(
              (junction) => {
                const isNext =
                  route.nodes[1] === junction ||
                  route.nodes[route.nodes.indexOf(junction) + 1] ===
                    junction;

                const isRoute =
                  route.nodes.includes(junction);

                return (
                  <div
                    className={`signal-row ${
                      isNext ? "priority" : ""
                    }`}
                    key={junction}
                  >
                    <div className="signal-icon">
                      <span
                        className={
                          isNext ? "green-light" : ""
                        }
                      ></span>
                    </div>

                    <div>
                      <strong>{junction}</strong>

                      <small>
                        {isNext
                          ? "Priority Active"
                          : isRoute
                          ? "Route Junction"
                          : "Standby"}
                      </small>
                    </div>

                    <b>
                      {isNext ? "GREEN" : "READY"}
                    </b>
                  </div>
                );
              }
            )}
          </section>

          <section className="card route-agent">
            <div className="agent-icon">🧭</div>

            <h3>Route Agent</h3>

            <p>
              Traffic-aware emergency routing
            </p>

            <div className="divider"></div>

            <span>ACTIVE ROUTE</span>

            <strong>{routeText}</strong>

            <div className="agent-info">
              <span>NEXT ROAD</span>
              <b>{nextRoad || "HOSPITAL"}</b>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
