import { useCallback, useEffect, useRef, useState } from "react";
import CityMap from "./CityMap";
import "./App.css";

const API = "http://127.0.0.1:8000";

const FALLBACK_ROADS = [
  {
    road_id: "R1",
    start: "J1",
    end: "J2",
    traffic: 30,
    distance_km: 2,
    speed_kmph: 40,
  },
  {
    road_id: "R2",
    start: "J1",
    end: "J3",
    traffic: 70,
    distance_km: 3,
    speed_kmph: 20,
  },
  {
    road_id: "R3",
    start: "J2",
    end: "J3",
    traffic: 80,
    distance_km: 2,
    speed_kmph: 15,
  },
  {
    road_id: "R4",
    start: "J2",
    end: "J4",
    traffic: 20,
    distance_km: 2.5,
    speed_kmph: 45,
  },
  {
    road_id: "R5",
    start: "J3",
    end: "J5",
    traffic: 25,
    distance_km: 3,
    speed_kmph: 40,
  },
  {
    road_id: "R6",
    start: "J4",
    end: "J5",
    traffic: 35,
    distance_km: 1.8,
    speed_kmph: 35,
  },
];

const FALLBACK_ROUTE = ["J1", "J2", "J4", "J5"];

function App() {
  const [route, setRoute] = useState(FALLBACK_ROUTE);
  const [trafficData, setTrafficData] =
    useState(FALLBACK_ROADS);

  const [ambulanceProgress, setAmbulanceProgress] =
    useState(0);

  const [journeyStarted, setJourneyStarted] =
    useState(false);

  const [completed, setCompleted] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // --------------------------------------------------
  // IMPORTANT REFS
  // --------------------------------------------------

  const routeRef = useRef(FALLBACK_ROUTE);
  const roadsRef = useRef(FALLBACK_ROADS);

  const progressRef = useRef(0);

  const animationRef = useRef(null);
  const lastFrameRef = useRef(null);

  // --------------------------------------------------
  // LOAD CITY
  // --------------------------------------------------

  const fetchTraffic = useCallback(async () => {
    try {
      const response =
        await fetch(`${API}/city`);

      if (!response.ok) {
        throw new Error("City API failed");
      }

      const data =
        await response.json();

      if (
        Array.isArray(data.roads) &&
        data.roads.length > 0
      ) {
        roadsRef.current =
          data.roads;

        setTrafficData(
          data.roads
        );
      }
    } catch (err) {
      console.error(
        "Traffic loading error:",
        err
      );
    }
  }, []);

  // --------------------------------------------------
  // LOAD ROUTE
  // --------------------------------------------------

  const fetchRoute = useCallback(async () => {
    try {
      const response =
        await fetch(
          `${API}/green-corridor?start=J1&destination=J5`
        );

      if (!response.ok) {
        throw new Error(
          "Route API failed"
        );
      }

      const data =
        await response.json();

      let newRoute =
        data.emergency_route ||
        data.route ||
        [];

      if (
        !Array.isArray(newRoute) ||
        newRoute.length < 2
      ) {
        newRoute =
          FALLBACK_ROUTE;
      }

      /*
       * Only update route when ambulance
       * is NOT travelling.
       *
       * This prevents a congestion slider
       * from teleporting the ambulance.
       */

      if (!journeyStarted) {
        routeRef.current =
          newRoute;

        setRoute(
          newRoute
        );
      }

      /*
       * If backend returned road data,
       * update traffic data too.
       */

      if (
        Array.isArray(data.roads) &&
        data.roads.length > 0
      ) {
        roadsRef.current =
          data.roads;

        setTrafficData(
          data.roads
        );
      }

      return newRoute;
    } catch (err) {
      console.error(
        "Route loading error:",
        err
      );

      if (!journeyStarted) {
        routeRef.current =
          FALLBACK_ROUTE;

        setRoute(
          FALLBACK_ROUTE
        );
      }

      return routeRef.current;
    }
  }, [journeyStarted]);

  // --------------------------------------------------
  // INITIAL LOAD
  // --------------------------------------------------

  useEffect(() => {
    async function load() {
      setLoading(true);

      await Promise.all([
        fetchTraffic(),
        fetchRoute(),
      ]);

      setLoading(false);
    }

    load();
  }, [fetchTraffic, fetchRoute]);

  // --------------------------------------------------
  // FIND CURRENT ROAD
  // --------------------------------------------------

  function getRoadForSegment(
    segmentIndex
  ) {
    const currentRoute =
      routeRef.current;

    const currentRoads =
      roadsRef.current;

    if (
      currentRoute.length < 2
    ) {
      return null;
    }

    if (
      segmentIndex < 0 ||
      segmentIndex >=
        currentRoute.length - 1
    ) {
      return null;
    }

    const from =
      currentRoute[
        segmentIndex
      ];

    const to =
      currentRoute[
        segmentIndex + 1
      ];

    const road =
      currentRoads.find(
        (road) =>
          (
            road.start === from &&
            road.end === to
          ) ||
          (
            road.start === to &&
            road.end === from
          )
      );

    return road || null;
  }

  // --------------------------------------------------
  // CURRENT ROAD
  // --------------------------------------------------

  function getCurrentRoad() {
    const progress =
      progressRef.current;

    const segment =
      Math.min(
        Math.floor(progress),
        Math.max(
          routeRef.current.length - 2,
          0
        )
      );

    return getRoadForSegment(
      segment
    );
  }

  // --------------------------------------------------
  // EFFECTIVE SPEED
  // --------------------------------------------------
  //
  // Congestion directly affects ambulance speed.
  //
  // 0%   = 100% speed
  // 25%  = 87.5%
  // 50%  = 75%
  // 75%  = 62.5%
  // 100% = 50%
  //
  // Emergency vehicle still moves.
  // --------------------------------------------------

  function getEffectiveSpeed(
    road
  ) {
    if (!road) {
      return 35;
    }

    const baseSpeed =
      Math.max(
        15,
        Number(
          road.speed_kmph || 35
        )
      );

    const traffic = Math.max(
      0,
      Math.min(
        100,
        Number(
          road.traffic || 0
        )
      )
    );

    /*
     * Strong enough visual difference
     * between low and high congestion.
     */

    const multiplier =
      1 -
      traffic * 0.005;

    return Math.max(
      baseSpeed * 0.5,
      baseSpeed * multiplier
    );
  }

  // --------------------------------------------------
  // VISUAL SPEED
  // --------------------------------------------------
  //
  // We don't use real km/h directly because
  // a browser map would become extremely slow.
  //
  // Instead:
  //
  // distance + speed + congestion
  //        ↓
  // visual segment duration
  //        ↓
  // ambulance progress
  // --------------------------------------------------

  function getVisualDuration(
    road
  ) {
    if (!road) {
      return 4;
    }

    const distance =
      Math.max(
        0.5,
        Number(
          road.distance_km || 1
        )
      );

    const speed =
      getEffectiveSpeed(
        road
      );

    const realSeconds =
      (distance / speed) *
      3600;

    /*
     * Convert real travel time
     * to visual animation time.
     *
     * Low traffic:
     * roughly 2.5-4 sec
     *
     * High traffic:
     * roughly 5-7 sec
     */

    const visualSeconds =
      realSeconds * 0.055;

    return Math.max(
      2.5,
      Math.min(
        7,
        visualSeconds
      )
    );
  }

  // --------------------------------------------------
  // AMBULANCE MOVEMENT
  // --------------------------------------------------

  useEffect(() => {
    if (
      !journeyStarted ||
      completed ||
      routeRef.current.length < 2
    ) {
      return;
    }

    if (animationRef.current) {
      cancelAnimationFrame(
        animationRef.current
      );
    }

    lastFrameRef.current =
      null;

    const animate = (
      timestamp
    ) => {
      if (
        lastFrameRef.current ===
        null
      ) {
        lastFrameRef.current =
          timestamp;
      }

      const deltaSeconds =
        Math.min(
          0.05,
          (
            timestamp -
            lastFrameRef.current
          ) / 1000
        );

      lastFrameRef.current =
        timestamp;

      const currentRoute =
        routeRef.current;

      const destinationIndex =
        currentRoute.length - 1;

      const oldProgress =
        progressRef.current;

      if (
        oldProgress >=
        destinationIndex
      ) {
        progressRef.current =
          destinationIndex;

        setAmbulanceProgress(
          destinationIndex
        );

        setJourneyStarted(
          false
        );

        setCompleted(
          true
        );

        animationRef.current =
          null;

        return;
      }

      /*
       * Determine which road ambulance
       * is physically travelling on.
       */

      const segmentIndex =
        Math.min(
          Math.floor(
            oldProgress
          ),
          destinationIndex - 1
        );

      const currentRoad =
        getRoadForSegment(
          segmentIndex
        );

      /*
       * IMPORTANT:
       *
       * This is recalculated EVERY FRAME.
       *
       * Therefore if the user changes
       * congestion while ambulance is
       * travelling, the speed changes
       * immediately.
       */

      const duration =
        getVisualDuration(
          currentRoad
        );

      const progressPerSecond =
        1 / duration;

      let nextProgress =
        oldProgress +
        progressPerSecond *
          deltaSeconds;

      /*
       * Never jump over a junction.
       */

      const endOfCurrentSegment =
        segmentIndex + 1;

      if (
        nextProgress >
          endOfCurrentSegment
      ) {
        nextProgress =
          endOfCurrentSegment;
      }

      /*
       * Destination.
       */

      if (
        nextProgress >=
        destinationIndex
      ) {
        nextProgress =
          destinationIndex;

        progressRef.current =
          nextProgress;

        setAmbulanceProgress(
          nextProgress
        );

        setJourneyStarted(
          false
        );

        setCompleted(
          true
        );

        animationRef.current =
          null;

        return;
      }

      /*
       * Normal movement.
       */

      progressRef.current =
        nextProgress;

      setAmbulanceProgress(
        nextProgress
      );

      animationRef.current =
        requestAnimationFrame(
          animate
        );
    };

    animationRef.current =
      requestAnimationFrame(
        animate
      );

    return () => {
      if (
        animationRef.current
      ) {
        cancelAnimationFrame(
          animationRef.current
        );
      }

      animationRef.current =
        null;

      lastFrameRef.current =
        null;
    };
  }, [
    journeyStarted,
    completed,
  ]);

  // --------------------------------------------------
  // START
  // --------------------------------------------------

  async function startJourney() {
    /*
     * Get the latest route BEFORE departure.
     */

    if (
      routeRef.current.length < 2
    ) {
      await fetchRoute();
    }

    if (
      routeRef.current.length < 2
    ) {
      return;
    }

    if (
      animationRef.current
    ) {
      cancelAnimationFrame(
        animationRef.current
      );
    }

    progressRef.current =
      0;

    setAmbulanceProgress(
      0
    );

    setCompleted(
      false
    );

    setJourneyStarted(
      true
    );
  }

  // --------------------------------------------------
  // RESET
  // --------------------------------------------------

  function resetJourney() {
    if (
      animationRef.current
    ) {
      cancelAnimationFrame(
        animationRef.current
      );
    }

    animationRef.current =
      null;

    lastFrameRef.current =
      null;

    progressRef.current =
      0;

    setAmbulanceProgress(
      0
    );

    setJourneyStarted(
      false
    );

    setCompleted(
      false
    );
  }

  // --------------------------------------------------
  // UPDATE TRAFFIC
  // --------------------------------------------------

  async function updateTraffic(
    roadId,
    value
  ) {
    const traffic =
      Math.max(
        0,
        Math.min(
          100,
          Number(value)
        )
      );

    /*
     * UPDATE LOCAL DATA FIRST.
     *
     * This is the most important part.
     *
     * Animation reads roadsRef every frame.
     * So the running ambulance immediately
     * sees the new congestion.
     */

    const updatedRoads =
      roadsRef.current.map(
        (road) =>
          road.road_id === roadId
            ? {
                ...road,
                traffic,
              }
            : road
      );

    roadsRef.current =
      updatedRoads;

    setTrafficData(
      updatedRoads
    );

    /*
     * Send to backend.
     *
     * DO NOT fetchRoute() here.
     *
     * Otherwise changing traffic while
     * ambulance is moving can change the
     * route and make the ambulance jump.
     */

    try {
      await fetch(
        `${API}/update-traffic?road_id=${encodeURIComponent(
          roadId
        )}&traffic=${traffic}`
      );
    } catch (error) {
      console.error(
        "Traffic update error:",
        error
      );
    }
  }

  // --------------------------------------------------
  // CURRENT INFORMATION
  // --------------------------------------------------

  const safeProgress =
    Number.isFinite(
      Number(
        ambulanceProgress
      )
    )
      ? Math.max(
          0,
          Number(
            ambulanceProgress
          )
        )
      : 0;

  const currentSegment =
    Math.min(
      Math.floor(
        safeProgress
      ),
      Math.max(
        route.length - 2,
        0
      )
    );

  const currentFrom =
    route[
      currentSegment
    ] || "J1";

  const currentTo =
    route[
      currentSegment + 1
    ] || "J5";

  const currentRoad =
    getRoadForSegment(
      currentSegment
    );

  const currentTraffic =
    Number(
      currentRoad?.traffic || 0
    );

  const progressPercent =
    route.length > 1
      ? Math.min(
          100,
          Math.round(
            (
              safeProgress /
              (route.length - 1)
            ) * 100
          )
        )
      : 0;

  const getTrafficLevel = (
    value
  ) => {
    if (value >= 70) {
      return "HIGH";
    }

    if (value >= 40) {
      return "MEDIUM";
    }

    return "LOW";
  };

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <div className="loading-icon">
            🚑
          </div>

          <h2>
            Emergency Corridor
          </h2>

          <p>
            Connecting to traffic
            intelligence...
          </p>

          <div className="loader" />
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="app">

      {/* HEADER */}

      <header className="topbar">

        <div className="brand">

          <div className="brand-icon">
            🚑
          </div>

          <div>
            <h1>
              Emergency Corridor System
            </h1>

            <p>
              Dynamic Ambulance Route
              Management
            </p>
          </div>

        </div>

        <div className="system-status">

          <span
            className={`status-dot ${
              journeyStarted
                ? "moving-dot"
                : completed
                ? "completed-dot"
                : ""
            }`}
          />

          <div>

            <strong>
              {completed
                ? "JOURNEY COMPLETED"
                : journeyStarted
                ? "AMBULANCE EN ROUTE"
                : "SYSTEM READY"}
            </strong>

            <small>
              {journeyStarted
                ? `${currentFrom} → ${currentTo}`
                : completed
                ? "Hospital reached successfully"
                : "Ready for emergency journey"}
            </small>

          </div>

        </div>

      </header>

      {/* DASHBOARD */}

      <main className="dashboard">

        {/* LEFT */}

        <aside className="left-column">

          {/* JOURNEY */}

          <section className="panel">

            <div className="panel-heading">

              <div className="panel-icon">
                🚑
              </div>

              <div>
                <h2>
                  Journey Status
                </h2>

                <p>
                  Live ambulance monitoring
                </p>
              </div>

            </div>

            <div className="current-location-box">

              <span>
                CURRENT ROAD
              </span>

              <strong>
                {journeyStarted
                  ? currentRoad?.road_id ||
                    "--"
                  : completed
                  ? "J5"
                  : "J1"}
              </strong>

              <div className="journey-state">

                {completed
                  ? "🏥 HOSPITAL REACHED"
                  : journeyStarted
                  ? `🚑 ${currentFrom} → ${currentTo}`
                  : "READY"}

              </div>

            </div>

            <div className="journey-grid">

              <div>
                <span>
                  PROGRESS
                </span>

                <strong>
                  {progressPercent}%
                </strong>
              </div>

              <div>
                <span>
                  CONGESTION
                </span>

                <strong>
                  {journeyStarted
                    ? `${currentTraffic}%`
                    : "--"}
                </strong>
              </div>

              <div>
                <span>
                  SPEED
                </span>

                <strong>
                  {journeyStarted
                    ? `${Math.round(
                        getEffectiveSpeed(
                          currentRoad
                        )
                      )} km/h`
                    : "--"}
                </strong>
              </div>

              <div>
                <span>
                  NEXT
                </span>

                <strong>
                  {completed
                    ? "HOSPITAL"
                    : currentTo}
                </strong>
              </div>

            </div>

            <div className="progress-section">

              <div className="progress-header">

                <span>
                  JOURNEY PROGRESS
                </span>

                <strong>
                  {progressPercent}%
                </strong>

              </div>

              <div className="progress-track">

                <div
                  className="progress-fill"
                  style={{
                    width:
                      `${progressPercent}%`,
                  }}
                />

              </div>

            </div>

            <button
              className="primary-button"
              onClick={
                startJourney
              }
              disabled={
                journeyStarted
              }
            >
              {completed
                ? "✓ Journey Completed"
                : journeyStarted
                ? "🚑 Ambulance Moving..."
                : "🚑 Start Journey"}
            </button>

            <button
              className="secondary-button"
              onClick={
                resetJourney
              }
            >
              ↻ Reset Journey
            </button>

          </section>

          {/* TRAFFIC */}

          <section className="panel traffic-panel">

            <div className="panel-heading">

              <div className="panel-icon">
                🚦
              </div>

              <div>
                <h2>
                  Traffic Conditions
                </h2>

                <p>
                  Change congestion dynamically
                </p>
              </div>

            </div>

            <div className="traffic-list">

              {trafficData.map(
                (road) => {

                  const traffic =
                    Number(
                      road.traffic || 0
                    );

                  const current =
                    journeyStarted &&
                    road.road_id ===
                      currentRoad?.road_id;

                  const level =
                    getTrafficLevel(
                      traffic
                    );

                  return (
                    <div
                      key={
                        road.road_id
                      }
                      className={`traffic-item ${
                        current
                          ? "current-traffic"
                          : ""
                      }`}
                    >

                      <div className="traffic-top">

                        <div>

                          <strong>
                            {
                              road.road_id
                            }
                          </strong>

                          <span>
                            {
                              road.start
                            }{" "}
                            →{" "}
                            {
                              road.end
                            }
                          </span>

                        </div>

                        <b
                          className={level.toLowerCase()}
                        >
                          {traffic}%
                        </b>

                      </div>

                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={
                          traffic
                        }
                        onChange={(
                          e
                        ) =>
                          updateTraffic(
                            road.road_id,
                            e.target
                              .value
                          )
                        }
                      />

                      <div className="traffic-bottom">

                        <span>
                          {traffic}%
                          congestion
                        </span>

                        <span>
                          {
                            road.speed_kmph
                          } km/h
                        </span>

                      </div>

                      {current && (
                        <small>
                          🚑 Ambulance
                          currently on
                          this road
                        </small>
                      )}

                    </div>
                  );
                }
              )}

            </div>

          </section>

        </aside>

        {/* MAP */}

        <section className="center-column">

          <CityMap
            roads={
              trafficData
            }
            route={route}
            ambulanceProgress={
              ambulanceProgress
            }
            journeyStarted={
              journeyStarted
            }
            completed={
              completed
            }
          />

        </section>

        {/* RIGHT */}

        <aside className="right-column">

          {/* SIGNAL */}

          <section className="panel">

            <div className="panel-heading">

              <div className="panel-icon">
                🚦
              </div>

              <div>
                <h2>
                  Signal Priority
                </h2>

                <p>
                  Emergency green corridor
                </p>
              </div>

            </div>

            <div className="signal-list">

              {route.map(
                (
                  junction,
                  index
                ) => {

                  /*
                   * NEXT junction gets green.
                   *
                   * Example:
                   * J1 -> J2
                   * J2 signal = GREEN
                   */

                  const nextIndex =
                    currentSegment + 1;

                  const active =
                    journeyStarted &&
                    !completed &&
                    index ===
                      nextIndex;

                  const passed =
                    completed ||
                    index <
                      nextIndex;

                  return (
                    <div
                      key={
                        junction
                      }
                      className={`signal-item ${
                        active ||
                        passed
                          ? "signal-active"
                          : ""
                      }`}
                    >

                      <div className="signal-light">

                        <span
                          className={
                            active ||
                            passed
                              ? "green-light"
                              : ""
                          }
                        />

                      </div>

                      <div>

                        <strong>
                          {junction}
                        </strong>

                        <small>
                          {active
                            ? "Priority Active"
                            : passed
                            ? "Passed"
                            : "Standby"}
                        </small>

                      </div>

                      <b>
                        {active ||
                        passed
                          ? "GREEN"
                          : "NORMAL"}
                      </b>

                    </div>
                  );
                }
              )}

            </div>

            <div className="signal-message">
              🟢 Green signal prepared for
              the next junction
            </div>

          </section>

          {/* ROUTE */}

          <section className="panel">

            <div className="panel-heading">

              <div className="panel-icon">
                🧭
              </div>

              <div>
                <h2>
                  Route Agent
                </h2>

                <p>
                  Traffic-aware decision
                </p>
              </div>

            </div>

            <div className="route-result">

              <span>
                ACTIVE ROUTE
              </span>

              <strong>
                {route.join(
                  " → "
                )}
              </strong>

            </div>

          </section>

        </aside>

      </main>

    </div>
  );
}

export default App;