import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CityMap from "./CityMap";
import "./App.css";

const API = "http://127.0.0.1:8000";

const DEFAULT_ROADS = [
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

const START_NODE = "J1";
const DESTINATION_NODE = "J5";

/* -------------------------------------------------------
   ROAD HELPERS
------------------------------------------------------- */

function sameRoad(road, a, b) {
  return (
    (road.start === a && road.end === b) ||
    (road.start === b && road.end === a)
  );
}

function getRoad(roads, a, b) {
  return (
    roads.find((road) => sameRoad(road, a, b)) || null
  );
}

function getNeighbours(roads, node) {
  return roads
    .filter(
      (road) =>
        road.start === node ||
        road.end === node
    )
    .map((road) => ({
      node:
        road.start === node
          ? road.end
          : road.start,
      road,
    }));
}

/* -------------------------------------------------------
   TRAFFIC-AWARE DIJKSTRA
------------------------------------------------------- */

function calculateRoute(roads, start, destination) {
  if (!roads.length) {
    return [start, destination];
  }

  const nodes = new Set();

  roads.forEach((road) => {
    nodes.add(road.start);
    nodes.add(road.end);
  });

  const distance = {};
  const previous = {};
  const visited = new Set();

  nodes.forEach((node) => {
    distance[node] = Infinity;
    previous[node] = null;
  });

  distance[start] = 0;

  while (visited.size < nodes.size) {
    let current = null;
    let smallest = Infinity;

    nodes.forEach((node) => {
      if (
        !visited.has(node) &&
        distance[node] < smallest
      ) {
        smallest = distance[node];
        current = node;
      }
    });

    if (!current) break;

    visited.add(current);

    if (current === destination) {
      break;
    }

    getNeighbours(roads, current).forEach(
      ({ node, road }) => {
        const traffic = Math.max(
          0,
          Math.min(
            100,
            Number(road.traffic || 0)
          )
        );

        const distanceKm = Math.max(
          0.1,
          Number(road.distance_km || 1)
        );

        const speed = Math.max(
          10,
          Number(road.speed_kmph || 30)
        );

        /*
         * Base travel time.
         */
        const baseTime =
          distanceKm / speed;

        /*
         * Congestion penalty.
         *
         * 0%   -> 1x
         * 50%  -> 2x
         * 100% -> 4x
         */
        const congestionPenalty =
          1 +
          Math.pow(traffic / 100, 1.5) * 3;

        const cost =
          baseTime * congestionPenalty;

        const newDistance =
          distance[current] + cost;

        if (
          newDistance <
          distance[node]
        ) {
          distance[node] = newDistance;

          previous[node] = {
            node: current,
            road: road.road_id,
          };
        }
      }
    );
  }

  const path = [];

  let current = destination;

  while (current) {
    path.unshift(current);

    if (!previous[current]) {
      break;
    }

    current = previous[current].node;
  }

  if (path[0] !== start) {
    return [start];
  }

  return path;
}

/* -------------------------------------------------------
   APP
------------------------------------------------------- */

export default function App() {
  const [roads, setRoads] =
    useState(DEFAULT_ROADS);

  const roadsRef = useRef(DEFAULT_ROADS);

  const [route, setRoute] =
    useState(
      calculateRoute(
        DEFAULT_ROADS,
        START_NODE,
        DESTINATION_NODE
      )
    );

  const routeRef = useRef(route);

  const [progress, setProgress] =
    useState(0);

  const progressRef = useRef(0);

  const [moving, setMoving] =
    useState(false);

  const [completed, setCompleted] =
    useState(false);

  const animationRef =
    useRef(null);

  const lastTimeRef =
    useRef(null);

  /* -----------------------------------------------------
     LOAD CITY
  ----------------------------------------------------- */

  useEffect(() => {
    async function loadCity() {
      try {
        const response =
          await fetch(`${API}/city`);

        if (!response.ok) {
          throw new Error(
            "City API failed"
          );
        }

        const data =
          await response.json();

        if (
          Array.isArray(data.roads) &&
          data.roads.length
        ) {
          roadsRef.current =
            data.roads;

          setRoads(data.roads);

          /*
           * Immediately calculate route
           * using the real city data.
           */
          const newRoute =
            calculateRoute(
              data.roads,
              START_NODE,
              DESTINATION_NODE
            );

          routeRef.current =
            newRoute;

          setRoute(newRoute);
        }
      } catch (error) {
        console.warn(
          "Using local city data:",
          error
        );
      }
    }

    loadCity();
  }, []);

  /* -----------------------------------------------------
     CURRENT SEGMENT
  ----------------------------------------------------- */

  const getCurrentSegment = useCallback(
    (value, currentRoute = routeRef.current) => {
      if (currentRoute.length < 2) {
        return 0;
      }

      return Math.min(
        Math.floor(value),
        currentRoute.length - 2
      );
    },
    []
  );

  /* -----------------------------------------------------
     CURRENT ROAD
  ----------------------------------------------------- */

  const currentSegment =
    getCurrentSegment(progress);

  const currentFrom =
    route[currentSegment] ||
    START_NODE;

  const currentTo =
    route[currentSegment + 1] ||
    DESTINATION_NODE;

  const currentRoad =
    getRoad(
      roads,
      currentFrom,
      currentTo
    );

  /* -----------------------------------------------------
     TRAFFIC-AWARE RE-ROUTING
  ----------------------------------------------------- */

  const recalculateRoute =
    useCallback(
      (updatedRoads) => {
        const currentProgress =
          progressRef.current;

        const activeRoute =
          routeRef.current;

        /*
         * Find the junction at which the
         * ambulance will make its next decision.
         */
        const segment =
          getCurrentSegment(
            currentProgress,
            activeRoute
          );

        const currentNode =
          activeRoute[segment] ||
          START_NODE;

        /*
         * If already at hospital,
         * don't calculate another route.
         */
        if (
          currentNode ===
          DESTINATION_NODE
        ) {
          return;
        }

        /*
         * Calculate a fresh route from
         * current junction to hospital.
         */
        const newRoute =
          calculateRoute(
            updatedRoads,
            currentNode,
            DESTINATION_NODE
          );

        if (
          newRoute.length >= 2
        ) {
          /*
           * Preserve the current road segment
           * if ambulance is already travelling on it.
           */
          const currentRoad =
            activeRoute.length >= 2
              ? getRoad(
                  updatedRoads,
                  activeRoute[segment],
                  activeRoute[segment + 1]
                )
              : null;

          let finalRoute =
            newRoute;

          if (
            currentRoad &&
            activeRoute[segment + 1]
          ) {
            const nextNode =
              activeRoute[
                segment + 1
              ];

            /*
             * Finish current road first,
             * then use the new route.
             */
            if (
              newRoute[0] !==
              nextNode
            ) {
              finalRoute = [
                currentNode,
                nextNode,
                ...newRoute.slice(1),
              ].filter(
                (node, index, array) =>
                  index === 0 ||
                  node !== array[index - 1]
              );
            }
          }

          routeRef.current =
            finalRoute;

          setRoute(finalRoute);
        }
      },
      [getCurrentSegment]
    );

  /* -----------------------------------------------------
     CHANGE CONGESTION
  ----------------------------------------------------- */

  async function changeTraffic(
    roadId,
    value
  ) {
    const traffic = Math.max(
      0,
      Math.min(
        100,
        Number(value)
      )
    );

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

    /*
     * IMPORTANT:
     * Update ref FIRST.
     */
    roadsRef.current =
      updatedRoads;

    setRoads(updatedRoads);

    /*
     * Immediately recalculate
     * emergency route.
     */
    recalculateRoute(
      updatedRoads
    );

    /*
     * Also notify backend.
     */
    try {
      await fetch(
        `${API}/update-traffic?road_id=${encodeURIComponent(
          roadId
        )}&traffic=${traffic}`
      );
    } catch (error) {
      console.warn(
        "Backend traffic update failed:",
        error
      );
    }
  }

  /* -----------------------------------------------------
     AMBULANCE SPEED
  ----------------------------------------------------- */

  function getSpeedMultiplier(
    road
  ) {
    if (!road) {
      return 0.25;
    }

    const traffic =
      Math.max(
        0,
        Math.min(
          100,
          Number(
            road.traffic || 0
          )
        )
      );

    /*
     * Ambulance is still allowed through
     * heavy traffic, but movement slows.
     */
    return (
      0.48 -
      (traffic / 100) * 0.25
    );
  }

  /* -----------------------------------------------------
     CONTINUOUS ROAD-BASED ANIMATION
  ----------------------------------------------------- */

  useEffect(() => {
    if (!moving) {
      if (
        animationRef.current
      ) {
        cancelAnimationFrame(
          animationRef.current
        );

        animationRef.current =
          null;
      }

      lastTimeRef.current =
        null;

      return;
    }

    if (
      animationRef.current
    ) {
      return;
    }

    lastTimeRef.current =
      null;

    const animate = (
      timestamp
    ) => {
      if (
        lastTimeRef.current ===
        null
      ) {
        lastTimeRef.current =
          timestamp;
      }

      const delta =
        Math.min(
          0.05,
          (timestamp -
            lastTimeRef.current) /
            1000
        );

      lastTimeRef.current =
        timestamp;

      const activeRoute =
        routeRef.current;

      const destinationIndex =
        activeRoute.length - 1;

      if (
        destinationIndex <= 0
      ) {
        return;
      }

      const oldProgress =
        progressRef.current;

      if (
        oldProgress >=
        destinationIndex
      ) {
        progressRef.current =
          destinationIndex;

        setProgress(
          destinationIndex
        );

        setMoving(false);
        setCompleted(true);

        animationRef.current =
          null;

        return;
      }

      const segment =
        getCurrentSegment(
          oldProgress,
          activeRoute
        );

      const from =
        activeRoute[segment];

      const to =
        activeRoute[segment + 1];

      /*
       * Read latest traffic EVERY FRAME.
       */
      const road =
        getRoad(
          roadsRef.current,
          from,
          to
        );

      const speed =
        getSpeedMultiplier(road);

      let nextProgress =
        oldProgress +
        speed *
        delta;

      /*
       * Never jump over a junction.
       */
      const segmentEnd =
        segment + 1;

      if (
        nextProgress >
          segmentEnd &&
        segmentEnd <
          destinationIndex
      ) {
        nextProgress =
          segmentEnd;
      }

      if (
        nextProgress >=
        destinationIndex
      ) {
        nextProgress =
          destinationIndex;

        progressRef.current =
          nextProgress;

        setProgress(
          nextProgress
        );

        setMoving(false);
        setCompleted(true);

        animationRef.current =
          null;

        return;
      }

      progressRef.current =
        nextProgress;

      setProgress(
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

        animationRef.current =
          null;
      }
    };
  }, [
    moving,
    getCurrentSegment,
  ]);

  /* -----------------------------------------------------
     START
  ----------------------------------------------------- */

  function startJourney() {
    if (
      routeRef.current.length <
      2
    ) {
      return;
    }

    if (
      animationRef.current
    ) {
      cancelAnimationFrame(
        animationRef.current
      );

      animationRef.current =
        null;
    }

    /*
     * Recalculate one final time
     * before starting.
     */
    const freshRoute =
      calculateRoute(
        roadsRef.current,
        START_NODE,
        DESTINATION_NODE
      );

    routeRef.current =
      freshRoute;

    setRoute(
      freshRoute
    );

    progressRef.current =
      0;

    setProgress(0);

    setCompleted(false);

    /*
     * This starts movement.
     * CityMap will immediately show
     * the next junction as GREEN.
     */
    setMoving(true);
  }

  /* -----------------------------------------------------
     RESET
  ----------------------------------------------------- */

  function resetJourney() {
    if (
      animationRef.current
    ) {
      cancelAnimationFrame(
        animationRef.current
      );

      animationRef.current =
        null;
    }

    const freshRoute =
      calculateRoute(
        roadsRef.current,
        START_NODE,
        DESTINATION_NODE
      );

    routeRef.current =
      freshRoute;

    setRoute(
      freshRoute
    );

    progressRef.current =
      0;

    setProgress(0);

    setMoving(false);

    setCompleted(false);
  }

  /* -----------------------------------------------------
     CURRENT DATA
  ----------------------------------------------------- */

  const currentTraffic =
    Number(
      currentRoad?.traffic || 0
    );

  const nextJunction =
    completed
      ? "HOSPITAL"
      : route[
          currentSegment + 1
        ] || DESTINATION_NODE;

  const progressPercent =
    route.length > 1
      ? Math.round(
          Math.min(
            100,
            (progress /
              (route.length - 1)) *
              100
          )
        )
      : 0;

  const averageTraffic =
    roads.length
      ? Math.round(
          roads.reduce(
            (sum, road) =>
              sum +
              Number(
                road.traffic || 0
              ),
            0
          ) / roads.length
        )
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
              Dynamic Ambulance Route Management
            </p>
          </div>
        </div>

        <div className="system-status">

          <span className="status-dot" />

          <div>
            <strong>
              {completed
                ? "JOURNEY COMPLETED"
                : moving
                ? "AMBULANCE EN ROUTE"
                : "SYSTEM READY"}
            </strong>

            <small>
              {moving
                ? `${currentFrom} → ${nextJunction}`
                : completed
                ? "Hospital reached"
                : "Ready to start"}
            </small>
          </div>

        </div>

      </header>

      <main className="dashboard">

        {/* LEFT */}

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
                  Live ambulance monitoring
                </p>
              </div>

            </div>

            <div className="current-location-box">

              <span>
                CURRENT LOCATION
              </span>

              <strong>
                {completed
                  ? DESTINATION_NODE
                  : currentFrom}
              </strong>

              <div className="journey-state">
                {completed
                  ? "🏥 HOSPITAL REACHED"
                  : moving
                  ? "🚑 EN ROUTE"
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
                  CURRENT ROAD
                </span>

                <strong>
                  {currentRoad?.road_id ||
                    "--"}
                </strong>
              </div>

              <div>
                <span>
                  CONGESTION
                </span>

                <strong>
                  {currentTraffic}%
                </strong>
              </div>

              <div>
                <span>
                  NEXT
                </span>

                <strong>
                  {nextJunction}
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
              disabled={moving}
            >
              {moving
                ? "🚑 Ambulance Moving..."
                : completed
                ? "✓ Journey Completed"
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
                  Change congestion to test dynamic routing
                </p>
              </div>

            </div>

            <div className="traffic-list">

              {roads.map((road) => {

                const traffic =
                  Number(
                    road.traffic || 0
                  );

                const isCurrent =
                  road.road_id ===
                  currentRoad?.road_id;

                const isRoute =
                  route.some(
                    (node, index) => {
                      if (
                        index >=
                        route.length - 1
                      ) {
                        return false;
                      }

                      return sameRoad(
                        road,
                        route[index],
                        route[index + 1]
                      );
                    }
                  );

                return (
                  <div
                    className={`traffic-item ${
                      isCurrent
                        ? "current-traffic"
                        : ""
                    }`}
                    key={
                      road.road_id
                    }
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
                        {traffic}%
                      </b>

                    </div>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={
                        traffic
                      }
                      onChange={(e) =>
                        changeTraffic(
                          road.road_id,
                          e.target.value
                        )
                      }
                    />

                    <div className="traffic-bottom">

                      <span>
                        {traffic < 40
                          ? "LOW"
                          : traffic < 70
                          ? "MEDIUM"
                          : "HIGH"}
                      </span>

                      <span>
                        {road.speed_kmph ||
                          40} km/h
                      </span>

                    </div>

                    {isRoute && (
                      <small className="route-active">
                        🚑 ACTIVE EMERGENCY ROUTE
                      </small>
                    )}

                  </div>
                );
              })}

            </div>

          </section>

        </aside>

        {/* MAP */}

        <section className="center-column">

          <CityMap
            roads={roads}
            route={route}
            progress={progress}
            journeyStarted={
              moving
            }
            completed={
              completed
            }
            nextJunction={
              nextJunction
            }
          />

        </section>

        {/* RIGHT */}

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
                  Traffic-aware routing
                </p>
              </div>

            </div>

            <div className="route-result">

              <span>
                ACTIVE ROUTE
              </span>

              <strong>
                {route.length
                  ? route.join(
                      " → "
                    )
                  : "Calculating..."}
              </strong>

            </div>

            <div className="route-info">

              <div>
                <span>
                  AVERAGE TRAFFIC
                </span>

                <b>
                  {averageTraffic}%
                </b>
              </div>

              <div>
                <span>
                  NEXT DECISION
                </span>

                <b>
                  {nextJunction}
                </b>
              </div>

            </div>

          </section>

          {/* SIGNALS */}

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

            {route.map(
              (junction, index) => {

                /*
                 * ONLY THE NEXT JUNCTION
                 * gets GREEN.
                 */
                const isNext =
                  moving &&
                  !completed &&
                  index ===
                    currentSegment + 1;

                const isCurrent =
                  !completed &&
                  index ===
                    currentSegment;

                return (
                  <div
                    className={`signal-item ${
                      isNext
                        ? "signal-priority"
                        : ""
                    }`}
                    key={
                      `${junction}-${index}`
                    }
                  >

                    <div className="signal-light">

                      <span
                        className={
                          isNext
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
                        {isNext
                          ? "Emergency priority"
                          : isCurrent
                          ? "Ambulance here"
                          : "Standby"}
                      </small>

                    </div>

                    <b>
                      {isNext
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
