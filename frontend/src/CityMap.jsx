import { useMemo } from "react";
import "./CityMap.css";

const NODE_POSITIONS = {
  J1: { x: 90, y: 300 },
  J2: { x: 300, y: 120 },
  J3: { x: 300, y: 430 },
  J4: { x: 610, y: 120 },
  J5: { x: 900, y: 300 },
};

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

function trafficColor(traffic) {
  const value = Number(traffic || 0);

  if (value >= 70) return "#ef4444";
  if (value >= 40) return "#f59e0b";
  return "#22c55e";
}

function findRoad(roads, from, to) {
  return roads.find(
    (road) =>
      (road.start === from && road.end === to) ||
      (road.start === to && road.end === from)
  );
}

function CityMap({
  route = [],
  roads = DEFAULT_ROADS,
  ambulanceProgress = 0,
  journeyStarted = false,
  completed = false,
}) {
  const cityRoads = roads?.length ? roads : DEFAULT_ROADS;

  const activeRoute =
    route?.length >= 2
      ? route
      : ["J1", "J2", "J4", "J5"];

  /*
   * Example:
   *
   * 0     = J1
   * 0.5   = halfway J1 -> J2
   * 1     = J2
   * 1.5   = halfway J2 -> J4
   * 2     = J4
   * 3     = J5
   */

  const safeProgress = Math.max(
    0,
    Math.min(
      ambulanceProgress,
      activeRoute.length - 1
    )
  );

  const segmentIndex = Math.min(
    Math.floor(safeProgress),
    activeRoute.length - 2
  );

  const fromNode =
    activeRoute[segmentIndex] ||
    activeRoute[0];

  const toNode =
    activeRoute[segmentIndex + 1] ||
    activeRoute[activeRoute.length - 1];

  const segmentProgress =
    safeProgress - Math.floor(safeProgress);

  /*
   * Current road.
   */

  const currentRoad = findRoad(
    cityRoads,
    fromNode,
    toNode
  );

  /*
   * Ambulance position is calculated using
   * EXACTLY the same coordinates as the road.
   */

  const ambulancePosition = useMemo(() => {
    if (completed) {
      const destination =
        NODE_POSITIONS[
          activeRoute[
            activeRoute.length - 1
          ]
        ];

      return destination || NODE_POSITIONS.J5;
    }

    const from =
      NODE_POSITIONS[fromNode];

    const to =
      NODE_POSITIONS[toNode];

    if (!from || !to) {
      return NODE_POSITIONS.J1;
    }

    return {
      x:
        from.x +
        (to.x - from.x) *
          segmentProgress,

      y:
        from.y +
        (to.y - from.y) *
          segmentProgress,
    };
  }, [
    activeRoute,
    completed,
    fromNode,
    toNode,
    segmentProgress,
  ]);

  /*
   * Which road belongs to emergency corridor?
   */

  function isRouteRoad(road) {
    for (
      let i = 0;
      i < activeRoute.length - 1;
      i++
    ) {
      const a = activeRoute[i];
      const b = activeRoute[i + 1];

      if (
        (road.start === a &&
          road.end === b) ||
        (road.start === b &&
          road.end === a)
      ) {
        return true;
      }
    }

    return false;
  }

  /*
   * Current road only.
   */

  function isCurrentRoad(road) {
    return (
      (road.start === fromNode &&
        road.end === toNode) ||
      (road.start === toNode &&
        road.end === fromNode)
    );
  }

  /*
   * NEXT junction.
   *
   * This is the junction that gets emergency green.
   */

  const nextJunction =
    completed
      ? null
      : activeRoute[
          Math.min(
            Math.floor(safeProgress) + 1,
            activeRoute.length - 1
          )
        ];

  /*
   * Current junction.
   */

  const currentJunction =
    activeRoute[
      Math.floor(safeProgress)
    ];

  /*
   * Current road speed.
   */

  const currentSpeed =
    Number(
      currentRoad?.speed_kmph || 0
    );

  const currentTraffic =
    Number(
      currentRoad?.traffic || 0
    );

  return (
    <div className="city-map-container">

      {/* HEADER */}

      <div className="map-header">
        <div>
          <span className="map-eyebrow">
            LIVE CITY NETWORK
          </span>

          <h2>
            Emergency Corridor Map
          </h2>

          <p className="map-subtitle">
            Traffic-aware ambulance navigation
          </p>
        </div>

        <div
          className={`map-status ${
            journeyStarted
              ? "status-moving"
              : completed
              ? "status-complete"
              : ""
          }`}
        >
          <span className="live-dot" />

          {completed
            ? "AMBULANCE ARRIVED"
            : journeyStarted
            ? "AMBULANCE MOVING"
            : "SYSTEM READY"}
        </div>
      </div>

      {/* MAP */}

      <div className="city-map">

        <div className="district district-north">
          NORTH DISTRICT
        </div>

        <div className="district district-west">
          WEST DISTRICT
        </div>

        <div className="district district-east">
          EAST DISTRICT
        </div>

        {/* SVG MAP */}

        <svg
          className="city-network"
          viewBox="0 0 1000 550"
          preserveAspectRatio="xMidYMid meet"
        >

          <defs>

            <filter
              id="greenGlow"
              x="-100%"
              y="-100%"
              width="300%"
              height="300%"
            >
              <feGaussianBlur
                stdDeviation="5"
                result="blur"
              />

              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter
              id="ambulanceGlow"
              x="-200%"
              y="-200%"
              width="400%"
              height="400%"
            >
              <feGaussianBlur
                stdDeviation="9"
                result="blur"
              />

              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

          </defs>

          {/* ROADS */}

          {cityRoads.map((road) => {
            const start =
              NODE_POSITIONS[road.start];

            const end =
              NODE_POSITIONS[road.end];

            if (!start || !end) {
              return null;
            }

            const routeRoad =
              isRouteRoad(road);

            const current =
              isCurrentRoad(road);

            const traffic =
              Number(road.traffic || 0);

            const color =
              trafficColor(traffic);

            return (
              <g key={road.road_id}>

                {/* ROAD SHADOW */}

                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="#000"
                  strokeWidth="20"
                  strokeLinecap="round"
                  opacity="0.55"
                />

                {/* ROAD BASE */}

                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke={
                    current &&
                    journeyStarted
                      ? "#00f5a0"
                      : "#29495a"
                  }
                  strokeWidth={
                    current &&
                    journeyStarted
                      ? 13
                      : routeRoad
                      ? 9
                      : 7
                  }
                  strokeLinecap="round"
                />

                {/* TRAFFIC COLOR */}

                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke={
                    current &&
                    journeyStarted
                      ? "#00f5a0"
                      : color
                  }
                  strokeWidth={
                    current &&
                    journeyStarted
                      ? 8
                      : 4
                  }
                  strokeLinecap="round"
                  opacity={
                    routeRoad
                      ? 1
                      : 0.65
                  }
                />

                {/* ROAD CENTER MARKING */}

                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="#d8f7ff"
                  strokeWidth="2"
                  strokeDasharray="14 14"
                  opacity="0.3"
                />

              </g>
            );
          })}

          {/* ROAD LABELS */}

          {cityRoads.map((road) => {
            const start =
              NODE_POSITIONS[road.start];

            const end =
              NODE_POSITIONS[road.end];

            if (!start || !end) {
              return null;
            }

            const x =
              (start.x + end.x) / 2;

            const y =
              (start.y + end.y) / 2;

            const traffic =
              Number(road.traffic || 0);

            const routeRoad =
              isRouteRoad(road);

            return (
              <g
                key={`label-${road.road_id}`}
                transform={`translate(${x}, ${y})`}
              >

                <rect
                  x="-38"
                  y="-16"
                  width="76"
                  height="32"
                  rx="8"
                  fill="#061923"
                  stroke={
                    routeRoad
                      ? "#00f5a0"
                      : "#1c5265"
                  }
                  strokeWidth="1.5"
                />

                <text
                  x="-27"
                  y="-1"
                  fill="#00d9ff"
                  fontSize="13"
                  fontWeight="700"
                >
                  {road.road_id}
                </text>

                <text
                  x="8"
                  y="-1"
                  fill={
                    traffic >= 70
                      ? "#ff5c67"
                      : traffic >= 40
                      ? "#ffbf3c"
                      : "#34e7a1"
                  }
                  fontSize="12"
                  fontWeight="700"
                >
                  {traffic}%
                </text>

                <text
                  x="0"
                  y="11"
                  textAnchor="middle"
                  fill="#6d8b9a"
                  fontSize="8"
                >
                  CONGESTION
                </text>

              </g>
            );
          })}

          {/* JUNCTIONS */}

          {Object.entries(
            NODE_POSITIONS
          ).map(
            ([junction, position]) => {

              const routeIndex =
                activeRoute.indexOf(
                  junction
                );

              const isRoute =
                routeIndex !== -1;

              const isDestination =
                junction ===
                activeRoute[
                  activeRoute.length - 1
                ];

              /*
               * ONLY next junction is green.
               */

              const isNext =
                journeyStarted &&
                !completed &&
                junction ===
                  nextJunction;

              const isCurrent =
                journeyStarted &&
                !completed &&
                junction ===
                  currentJunction;

              const isPassed =
                routeIndex !== -1 &&
                routeIndex <
                  Math.floor(
                    safeProgress
                  );

              return (
                <g
                  key={junction}
                  transform={`translate(${position.x}, ${position.y})`}
                >

                  {/* GLOW */}

                  {(isNext ||
                    isCurrent) && (
                    <circle
                      r="42"
                      fill="#00f5a0"
                      opacity="0.12"
                      filter="url(#greenGlow)"
                    />
                  )}

                  {/* NODE */}

                  <circle
                    r="30"
                    fill={
                      isDestination
                        ? "#123b66"
                        : "#071b27"
                    }
                    stroke={
                      isNext ||
                      isCurrent
                        ? "#00f5a0"
                        : isDestination
                        ? "#4b9cff"
                        : "#315264"
                    }
                    strokeWidth="4"
                  />

                  <text
                    x="0"
                    y="7"
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="21"
                    fontWeight="800"
                  >
                    {isDestination
                      ? "🏥"
                      : junction.replace(
                          "J",
                          ""
                        )}
                  </text>

                  {/* JUNCTION NAME */}

                  <text
                    x="0"
                    y="58"
                    textAnchor="middle"
                    fill="#dffaff"
                    fontSize="14"
                    fontWeight="800"
                  >
                    {junction}
                  </text>

                  <text
                    x="0"
                    y="75"
                    textAnchor="middle"
                    fill="#5f8798"
                    fontSize="9"
                    letterSpacing="2"
                  >
                    {isDestination
                      ? "HOSPITAL"
                      : "JUNCTION"}
                  </text>

                  {/* SIGNAL */}

                  {isRoute &&
                    !isDestination && (
                      <g
                        transform="translate(34,-27)"
                      >

                        <rect
                          x="0"
                          y="0"
                          width="16"
                          height="55"
                          rx="8"
                          fill="#08131b"
                          stroke="#27414e"
                          strokeWidth="2"
                        />

                        <circle
                          cx="8"
                          cy="10"
                          r="4"
                          fill={
                            isNext
                              ? "#00f5a0"
                              : "#24343c"
                          }
                          filter={
                            isNext
                              ? "url(#greenGlow)"
                              : undefined
                          }
                        />

                        <circle
                          cx="8"
                          cy="27"
                          r="4"
                          fill="#8b3030"
                        />

                        <circle
                          cx="8"
                          cy="44"
                          r="4"
                          fill="#b17825"
                        />

                      </g>
                    )}

                  {/* PASSED */}

                  {isPassed && (
                    <text
                      x="-40"
                      y="-35"
                      fill="#00f5a0"
                      fontSize="18"
                      fontWeight="900"
                    >
                      ✓
                    </text>
                  )}

                </g>
              );
            }
          )}

          {/* AMBULANCE */}

          <g
            transform={`translate(
              ${ambulancePosition.x},
              ${ambulancePosition.y}
            )`}
            className={
              journeyStarted
                ? "ambulance-svg moving"
                : "ambulance-svg"
            }
          >

            <circle
              r="34"
              fill="#00f5a0"
              opacity="0.12"
              filter="url(#ambulanceGlow)"
            />

            <circle
              r="25"
              fill="#071923"
              stroke="#00f5a0"
              strokeWidth="3"
            />

            <text
              x="0"
              y="8"
              textAnchor="middle"
              fontSize="25"
            >
              🚑
            </text>

            <rect
              x="-43"
              y="35"
              width="86"
              height="22"
              rx="8"
              fill="#001d25"
              stroke="#00f5a0"
            />

            <text
              x="0"
              y="50"
              textAnchor="middle"
              fill="#00f5a0"
              fontSize="9"
              fontWeight="800"
            >
              {completed
                ? "ARRIVED"
                : journeyStarted
                ? "AMBULANCE"
                : "READY"}
            </text>

          </g>

        </svg>

        {/* MAP INFO */}

        <div className="map-info-card">

          <div>
            <span>CURRENT ROAD</span>
            <strong>
              {currentRoad?.road_id ||
                "—"}
            </strong>
          </div>

          <div>
            <span>CONGESTION</span>
            <strong>
              {currentTraffic}%
            </strong>
          </div>

          <div>
            <span>SPEED</span>
            <strong>
              {currentSpeed} km/h
            </strong>
          </div>

          <div>
            <span>NEXT JUNCTION</span>
            <strong>
              {completed
                ? "HOSPITAL"
                : nextJunction ||
                  "—"}
            </strong>
          </div>

        </div>

        {/* ACTIVE ROUTE */}

        <div className="active-route-box">

          <span>
            ACTIVE ROUTE
          </span>

          <strong>
            {activeRoute.join(
              "  →  "
            )}
          </strong>

        </div>

        {/* LEGEND */}

        <div className="map-legend">

          <h3>MAP LEGEND</h3>

          <div>
            <span className="legend-road green" />
            Emergency Corridor
          </div>

          <div>
            <span className="legend-road normal" />
            Normal Road
          </div>

          <div>
            <span className="legend-road red" />
            Heavy Congestion
          </div>

          <div>
            <span className="legend-signal" />
            Emergency Green
          </div>

          <div>
            🚑 Ambulance
          </div>

        </div>

      </div>

      {/* FOOTER */}

      <div className="map-footer">

        <div>
          <span>CURRENT NODE</span>

          <strong>
            {completed
              ? activeRoute[
                  activeRoute.length - 1
                ]
              : currentJunction}
          </strong>
        </div>

        <div>
          <span>NEXT NODE</span>

          <strong>
            {completed
              ? "HOSPITAL"
              : nextJunction}
          </strong>
        </div>

        <div>
          <span>ROAD</span>

          <strong>
            {currentRoad?.road_id ||
              "—"}
          </strong>
        </div>

        <div>
          <span>STATUS</span>

          <strong
            className={
              completed
                ? "arrived"
                : journeyStarted
                ? "moving-status"
                : ""
            }
          >
            {completed
              ? "✓ ARRIVED"
              : journeyStarted
              ? "● MOVING"
              : "○ READY"}
          </strong>
        </div>

      </div>

    </div>
  );
}

export default CityMap;
