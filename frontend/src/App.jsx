import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CityMap from "./CityMap";
import "./App.css";

const API = "http://127.0.0.1:8000";

const START_NODE = "J1";
const DESTINATION_NODE = "J5";

// Simulation multiplier.
// Higher = faster ambulance simulation.
const SIMULATION_SPEED = 35;

// How often we ask backend for a fresh route while traffic changes.
const ROUTE_DEBOUNCE_MS = 350;

function normalizeRoute(data) {
  const possibleRoutes = [
    data?.emergency_route,
    data?.route,
    data?.path,
    data?.nodes,
  ];

  const found = possibleRoutes.find(
    (value) => Array.isArray(value) && value.length >= 2
  );

  if (!found) {
    return [];
  }

  return found.map(String);
}

function findRoad(roads, from, to) {
  return (
    roads.find(
      (road) =>
        (road.start === from && road.end === to) ||
        (road.start === to && road.end === from)
    ) || null
  );
}

/*
  Local traffic-aware fallback.

  This is important:
  Even if the backend route response does not immediately change,
  the frontend can still calculate a traffic-aware route from the
  current road data.

  Weight = estimated travel time.
*/
function calculateLocalRoute(roads, start, destination) {
  if (!start || !destination) {
    return [];
  }

  if (start === destination) {
    return [start];
  }

  const graph = {};

  roads.forEach((road) => {
    if (!graph[road.start]) graph[road.start] = [];
    if (!graph[road.end]) graph[road.end] = [];

    const traffic = Math.max(
      0,
      Math.min(100, Number(road.traffic) || 0)
    );

    const distance = Math.max(
      0.1,
      Number(road.distance_km) || 1
    );

    const baseSpeed = Math.max(
      5,
      Number(road.speed_kmph) || 30
    );

    /*
      Congestion reduces effective speed.

      0% traffic  -> 100% speed
      50% traffic -> ~67.5% speed
      100%        -> ~35% speed
    */
    const congestionFactor = Math.max(
      0.35,
      1 - (0.65 * traffic) / 100
    );

    const effectiveSpeed = Math.max(
      5,
      baseSpeed * congestionFactor
    );

    const travelTime =
      distance / effectiveSpeed;

    graph[road.start].push({
      node: road.end,
      weight: travelTime,
    });

    graph[road.end].push({
      node: road.start,
      weight: travelTime,
    });
  });

  const distances = {};
  const previous = {};
  const unvisited = new Set(Object.keys(graph));

  Object.keys(graph).forEach((node) => {
    distances[node] = Infinity;
    previous[node] = null;
  });

  if (!distances[start]) {
    distances[start] = 0;
    unvisited.add(start);
  }

  distances[start] = 0;

  while (unvisited.size > 0) {
    let current = null;
    let bestDistance = Infinity;

    for (const node of unvisited) {
      if (distances[node] < bestDistance) {
        bestDistance = distances[node];
        current = node;
      }
    }

    if (!current) {
      break;
    }

    unvisited.delete(current);

    if (current === destination) {
      break;
    }

    const neighbors = graph[current] || [];

    for (const neighbor of neighbors) {
      const candidate =
        distances[current] + neighbor.weight;

      if (candidate < (distances[neighbor.node] ?? Infinity)) {
        distances[neighbor.node] = candidate;
        previous[neighbor.node] = current;
      }
    }
  }

  if (
    destination !== start &&
    previous[destination] === null
  ) {
    return [];
  }

  const result = [];
  let current = destination;

  while (current) {
    result.unshift(current);

    if (current === start) {
      break;
    }

    current = previous[current];
  }

  if (result[0] !== start) {
    return [];
  }

  return result;
}

function App() {
  const [roads, setRoads] = useState([]);
  const [route, setRoute] = useState([]);

  /*
    progress is segment based.

    Example:
      0.0 = J1
      0.5 = halfway J1 -> J2
      1.0 = J2
      1.5 = halfway J2 -> J4
      2.0 = J4
      3.0 = J5
  */
  const [progress, setProgress] = useState(0);

  const [moving, setMoving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rerouting, setRerouting] = useState(false);
  const [error, setError] = useState("");

  /*
    If traffic changes while ambulance is between two junctions,
    we DON'T teleport it to another road.

    We store the new route and apply it when the ambulance reaches
    the next junction.
  */
  const pendingRouteRef = useRef(null);

  const animationRef = useRef(null);
  const lastFrameRef = useRef(null);

  const trafficTimerRef = useRef(null);
  const routeRequestIdRef = useRef(0);

  /*
    Used to avoid unnecessary duplicate route requests.
  */
  const lastRouteStartRef = useRef(START_NODE);

  const loadCity = useCallback(async () => {
    try {
      const response = await fetch(`${API}/city`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`City API error: ${response.status}`);
      }

      const data = await response.json();

      const incomingRoads =
        Array.isArray(data?.roads)
          ? data.roads
          : [];

      setRoads(incomingRoads);
      setError("");

      return incomingRoads;
    } catch (err) {
      console.error("City error:", err);
      setError("Unable to load city traffic.");
      return [];
    }
  }, []);

  const loadRoute = useCallback(
    async (startNode = START_NODE) => {
      const requestId =
        ++routeRequestIdRef.current;

      try {
        setRerouting(true);

        const url =
          `${API}/green-corridor` +
          `?start=${encodeURIComponent(startNode)}` +
          `&destination=${encodeURIComponent(
            DESTINATION_NODE
          )}`;

        const response = await fetch(url, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(
            `Route API error: ${response.status}`
          );
        }

        const data = await response.json();

        const backendRoute =
          normalizeRoute(data);

        /*
          If backend gives a valid route, use it.
        */
        if (
          backendRoute.length >= 2 &&
          requestId === routeRequestIdRef.current
        ) {
          lastRouteStartRef.current =
            backendRoute[0];

          return backendRoute;
        }

        return [];
      } catch (err) {
        console.error("Route error:", err);
        return [];
      } finally {
        if (
          requestId === routeRequestIdRef.current
        ) {
          setRerouting(false);
        }
      }
    },
    []
  );

  /*
    Initial city + route.
  */
  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      setLoading(true);

      const loadedRoads =
        await loadCity();

      const backendRoute =
        await loadRoute(START_NODE);

      if (cancelled) {
        return;
      }

      /*
        Backend route is preferred.
        If backend route is unavailable, local traffic-aware
        Dijkstra route is used.
      */
      const fallbackRoute =
        calculateLocalRoute(
          loadedRoads,
          START_NODE,
          DESTINATION_NODE
        );

      const finalRoute =
        backendRoute.length >= 2
          ? backendRoute
          : fallbackRoute;

      setRoute(finalRoute);

      setProgress(0);
      setCompleted(false);
      setMoving(false);
      setLoading(false);
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, [loadCity, loadRoute]);

  /*
    Get the road currently being travelled.
  */
  const currentSegmentIndex = useMemo(() => {
    if (route.length < 2) {
      return 0;
    }

    return Math.min(
      Math.floor(progress),
      route.length - 2
    );
  }, [progress, route]);

  const currentFrom =
    route[currentSegmentIndex] || START_NODE;

  const currentTo =
    route[currentSegmentIndex + 1] ||
    DESTINATION_NODE;

  const currentRoad = useMemo(
    () =>
      findRoad(
        roads,
        currentFrom,
        currentTo
      ),
    [roads, currentFrom, currentTo]
  );

  /*
    Movement duration for the current road.

    This makes congestion actually affect ambulance speed.
  */
  const getSegmentDuration = useCallback(
    (from, to) => {
      const road = findRoad(
        roads,
        from,
        to
      );

      if (!road) {
        /*
          Fallback duration if road data is missing.
        */
        return 4500;
      }

      const distance = Math.max(
        0.1,
        Number(road.distance_km) || 1
      );

      const speed = Math.max(
        5,
        Number(road.speed_kmph) || 30
      );

      const traffic = Math.max(
        0,
        Math.min(
          100,
          Number(road.traffic) || 0
        )
      );

      /*
        Same traffic model used by route calculation.
      */
      const congestionFactor = Math.max(
        0.35,
        1 - (0.65 * traffic) / 100
      );

      const effectiveSpeed = Math.max(
        5,
        speed * congestionFactor
      );

      /*
        Real-world travel time converted into
        a faster UI simulation.
      */
      const realSeconds =
        (distance / effectiveSpeed) * 3600;

      const simulatedMilliseconds =
        (realSeconds / SIMULATION_SPEED) *
        1000;

      return Math.max(
        1800,
        simulatedMilliseconds
      );
    },
    [roads]
  );

  /*
    Apply a newly calculated route.

    If ambulance is moving:
      - don't teleport
      - save as pending route
      - apply after current road is completed

    If ambulance isn't moving:
      - apply immediately
  */
  const applyNewRoute = useCallback(
    (newRoute) => {
      if (!Array.isArray(newRoute)) {
        return;
      }

      if (newRoute.length < 2) {
        return;
      }

      if (!moving) {
        setRoute(newRoute);
        setProgress(0);
        setCompleted(false);
        return;
      }

      pendingRouteRef.current =
        newRoute;
    },
    [moving]
  );

  /*
    Recalculate route after traffic changes.
  */
  const recalculateRoute = useCallback(
    async (latestRoads = roads) => {
      if (!latestRoads.length) {
        return;
      }

      /*
        While moving, continue to the next junction first.
      */
      let routeStart = START_NODE;

      if (moving) {
        routeStart = currentTo;
      }

      /*
        First try backend.
      */
      const backendRoute =
        await loadRoute(routeStart);

      /*
        Always calculate local traffic-aware route too.
        This guarantees the UI reacts to the slider even
        if backend route logic returns an unchanged path.
      */
      const localRoute =
        calculateLocalRoute(
          latestRoads,
          routeStart,
          DESTINATION_NODE
        );

      /*
        Prefer backend when it actually gives a usable route.
        Otherwise local route is used.
      */
      const selectedRoute =
        backendRoute.length >= 2
          ? backendRoute
          : localRoute;

      if (selectedRoute.length >= 2) {
        applyNewRoute(selectedRoute);
      }
    },
    [
      roads,
      moving,
      currentTo,
      loadRoute,
      applyNewRoute,
    ]
  );

  /*
    Traffic slider handler.

    Important:
    We update the screen immediately, then send the API request.
    This makes the ambulance speed react without waiting for the server.
  */
  async function changeTraffic(
    roadId,
    value
  ) {
    const numericValue = Math.max(
      0,
      Math.min(100, Number(value) || 0)
    );

    /*
      Optimistic update.
    */
    let updatedRoads = [];

    setRoads((previousRoads) => {
      updatedRoads = previousRoads.map(
        (road) =>
          road.road_id === roadId
            ? {
                ...road,
                traffic: numericValue,
              }
            : road
      );

      return updatedRoads;
    });

    /*
      Debounce route calculation.
      Without this, moving a slider would send dozens
      of route requests.
    */
    if (trafficTimerRef.current) {
      clearTimeout(
        trafficTimerRef.current
      );
    }

    trafficTimerRef.current =
      setTimeout(async () => {
        try {
          await fetch(
            `${API}/update-traffic` +
              `?road_id=${encodeURIComponent(
                roadId
              )}` +
              `&traffic=${numericValue}`,
            {
              cache: "no-store",
            }
          );

          /*
            Get authoritative traffic data from backend.
          */
          const freshRoads =
            await loadCity();

          /*
            Recalculate using fresh server data.
          */
          await recalculateRoute(
            freshRoads.length
              ? freshRoads
              : updatedRoads
          );
        } catch (err) {
          console.error(
            "Traffic update error:",
            err
          );

          /*
            Even if backend update fails,
            local traffic-aware routing still works.
          */
          await recalculateRoute(
            updatedRoads
          );
        }
      }, ROUTE_DEBOUNCE_MS);
  }

  /*
    Start ambulance journey.
  */
  function startJourney() {
    if (route.length < 2) {
      console.warn(
        "No valid route available."
      );
      return;
    }

    pendingRouteRef.current = null;

    setProgress(0);
    setCompleted(false);
    setMoving(true);

    lastFrameRef.current = null;
  }

  /*
    Reset.
  */
  function resetJourney() {
    if (animationRef.current) {
      cancelAnimationFrame(
        animationRef.current
      );
    }

    pendingRouteRef.current = null;
    lastFrameRef.current = null;

    setProgress(0);
    setMoving(false);
    setCompleted(false);
  }

  /*
    MAIN AMBULANCE ENGINE

    requestAnimationFrame gives smooth movement.

    Unlike the old:
      progress + 0.015

    this version calculates movement based on:
      road distance
      road speed
      congestion
  */
  useEffect(() => {
    if (!moving || completed) {
      return;
    }

    if (route.length < 2) {
      return;
    }

    function animate(timestamp) {
      if (!lastFrameRef.current) {
        lastFrameRef.current =
          timestamp;
      }

      const delta =
        timestamp -
        lastFrameRef.current;

      lastFrameRef.current =
        timestamp;

      setProgress((previousProgress) => {
        const segmentIndex =
          Math.min(
            Math.floor(previousProgress),
            route.length - 2
          );

        const from =
          route[segmentIndex];

        const to =
          route[segmentIndex + 1];

        const duration =
          getSegmentDuration(
            from,
            to
          );

        const increment =
          delta / duration;

        let nextProgress =
          previousProgress +
          increment;

        /*
          Current road completed.
        */
        if (
          nextProgress >=
          segmentIndex + 1
        ) {
          nextProgress =
            segmentIndex + 1;

          /*
            If a new route was waiting because
            traffic changed during this road,
            apply it HERE.

            Ambulance reaches junction first,
            then takes the new route.
          */
          const pending =
            pendingRouteRef.current;

          if (
            pending &&
            pending.length >= 2
          ) {
            pendingRouteRef.current =
              null;

            setRoute(pending);
            setProgress(0);

            return 0;
          }

          /*
            Destination reached.
          */
          if (
            segmentIndex >=
            route.length - 2
          ) {
            setMoving(false);
            setCompleted(true);

            lastFrameRef.current =
              null;

            return route.length - 1;
          }
        }

        return nextProgress;
      });

      animationRef.current =
        requestAnimationFrame(
          animate
        );
    }

    animationRef.current =
      requestAnimationFrame(
        animate
      );

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(
          animationRef.current
        );
      }

      animationRef.current = null;
      lastFrameRef.current = null;
    };
  }, [
    moving,
    completed,
    route,
    getSegmentDuration,
  ]);

  /*
    Cleanup debounce timer.
  */
  useEffect(() => {
    return () => {
      if (trafficTimerRef.current) {
        clearTimeout(
          trafficTimerRef.current
        );
      }
    };
  }, []);

  const progressPercent =
    route.length > 1
      ? Math.min(
          100,
          Math.round(
            (progress /
              (route.length - 1)) *
              100
          )
        )
      : 0;

  const currentTraffic =
    currentRoad
      ? Number(currentRoad.traffic) || 0
      : 0;

  const currentSpeed =
    currentRoad
      ? Number(currentRoad.speed_kmph) || 0
      : 0;

  return (
    <div className="app">
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
          <span className="status-dot" />

          <div>
            <strong>
              {completed
                ? "JOURNEY COMPLETED"
                : rerouting
                ? "RECALCULATING ROUTE"
                : moving
                ? "AMBULANCE EN ROUTE"
                : "SYSTEM READY"}
            </strong>

            <small>
              Route:{" "}
              {route.length
                ? route.join(" → ")
                : "Loading..."}
            </small>
          </div>
        </div>
      </header>

      <main className="dashboard">
        <aside className="left-column">
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
                  Live ambulance
                  monitoring
                </p>
              </div>
            </div>

            <div className="current-location-box">
              <span>
                JOURNEY PROGRESS
              </span>

              <strong>
                {progressPercent}%
              </strong>

              <div className="journey-state">
                {completed
                  ? "🏥 HOSPITAL REACHED"
                  : moving
                  ? `🚑 ${currentFrom} → ${currentTo}`
                  : "READY"}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1fr 1fr",
                gap: "10px",
                marginBottom: "12px",
              }}
            >
              <div>
                <small>
                  CONGESTION
                </small>

                <strong>
                  {currentTraffic}%
                </strong>
              </div>

              <div>
                <small>
                  ROAD SPEED
                </small>

                <strong>
                  {currentSpeed} km/h
                </strong>
              </div>
            </div>

            <button
              className="primary-button"
              onClick={startJourney}
              disabled={
                moving ||
                loading ||
                route.length < 2
              }
            >
              {moving
                ? "🚑 Ambulance Moving..."
                : completed
                ? "✓ Journey Completed"
                : loading
                ? "Loading Route..."
                : "🚑 Start Journey"}
            </button>

            {(moving || completed) && (
              <button
                className="secondary-button"
                onClick={resetJourney}
                style={{
                  width: "100%",
                  marginTop: "10px",
                }}
              >
                ↻ Reset Journey
              </button>
            )}

            {error && (
              <p
                style={{
                  color: "#ff6b6b",
                  marginTop: "12px",
                }}
              >
                {error}
              </p>
            )}
          </section>

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
                  Change congestion
                  dynamically
                </p>
              </div>
            </div>

            <div className="traffic-list">
              {roads.map((road) => {
                const traffic =
                  Number(
                    road.traffic
                  ) || 0;

                return (
                  <div
                    className="traffic-item"
                    key={road.road_id}
                  >
                    <div className="traffic-top">
                      <div>
                        <strong>
                          {road.road_id}
                        </strong>

                        <span>
                          {road.start} →{" "}
                          {road.end}
                        </span>
                      </div>

                      <b>
                        {Math.round(
                          traffic
                        )}
                        %
                      </b>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={traffic}
                      onChange={(e) =>
                        changeTraffic(
                          road.road_id,
                          e.target.value
                        )
                      }
                    />

                    <div className="traffic-bottom">
                      <span>
                        {Math.round(
                          traffic
                        )}
                        % congestion
                      </span>

                      <span>
                        {road.speed_kmph}{" "}
                        km/h
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>

        <section className="center-column">
          <CityMap
            roads={roads}
            route={route}
            ambulanceProgress={
              progress
            }
            journeyStarted={moving}
            completed={completed}
          />
        </section>

        <aside className="right-column">
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
                  Traffic-aware
                  decision
                </p>
              </div>
            </div>

            <div className="route-result">
              <span>
                BEST ROUTE
              </span>

              <strong>
                {route.length
                  ? route.join(
                      " → "
                    )
                  : "Loading route..."}
              </strong>

              {rerouting && (
                <small>
                  Recalculating based
                  on congestion...
                </small>
              )}
            </div>
          </section>

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
                  Emergency green
                  corridor
                </p>
              </div>
            </div>

            {route.map(
              (junction, index) => {
                const current =
                  Math.floor(
                    progress
                  ) === index &&
                  !completed;

                const passed =
                  completed ||
                  progress > index;

                return (
                  <div
                    className="signal-item"
                    key={`${junction}-${index}`}
                  >
                    <div className="signal-light">
                      <span
                        className={
                          current ||
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
                        {passed
                          ? "Passed"
                          : current
                          ? "Priority Active"
                          : "Standby"}
                      </small>
                    </div>

                    <b>
                      {current ||
                      passed
                        ? "GREEN"
                        : "NORMAL"}
                    </b>
                  </div>
                );
              }
            )}
          </section>
        </aside>
      </main>
    </div>
  );
}

export default App;
