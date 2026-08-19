import { useMemo } from "react";
import "./CityMap.css";

const NODE_POSITIONS = {
  J1: { x: 100, y: 330 },
  J2: { x: 330, y: 150 },
  J3: { x: 330, y: 430 },
  J4: { x: 650, y: 150 },
  J5: { x: 900, y: 330 },
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

function getTrafficClass(
  traffic
) {
  if (traffic >= 70) {
    return "high";
  }

  if (traffic >= 40) {
    return "medium";
  }

  return "low";
}

function getRoadColor(
  traffic,
  emergency,
  current
) {
  if (
    current &&
    emergency
  ) {
    return "#00f5a0";
  }

  if (emergency) {
    return "#00d9a0";
  }

  if (traffic >= 70) {
    return "#ef4444";
  }

  if (traffic >= 40) {
    return "#f59e0b";
  }

  return "#28758a";
}

function findRoad(
  roads,
  from,
  to
) {
  return (
    roads.find(
      (road) =>
        (road.start === from &&
          road.end === to) ||
        (road.start === to &&
          road.end === from)
    ) || null
  );
}

function CityMap({
  route = [],
  roads = DEFAULT_ROADS,
  ambulanceProgress = 0,
  journeyStarted = false,
  completed = false,
}) {
  const cityRoads =
    roads?.length
      ? roads
      : DEFAULT_ROADS;

  const activeRoute =
    route?.length >= 2
      ? route
      : ["J1", "J2", "J4", "J5"];

  const currentSegment = Math.min(
    Math.floor(
      ambulanceProgress
    ),
    Math.max(
      activeRoute.length - 2,
      0
    )
  );

  const currentFrom =
    activeRoute[
      currentSegment
    ] || activeRoute[0];

  const currentTo =
    activeRoute[
      currentSegment + 1
    ] ||
    activeRoute[
      activeRoute.length - 1
    ];

  /*
    Fraction along current road.

    0   = start junction
    .5  = middle
    1   = destination junction
  */
  const segmentProgress =
    Math.max(
      0,
      Math.min(
        1,
        ambulanceProgress -
          currentSegment
      )
    );

  /*
    EXACT ambulance position.

    It uses the SAME coordinates as the road SVG.
    Therefore ambulance stays directly on the road.
  */
  const ambulancePosition =
    useMemo(() => {
      const destinationNode =
        activeRoute[
          activeRoute.length - 1
        ];

      if (completed) {
        return (
          NODE_POSITIONS[
            destinationNode
          ] ||
          NODE_POSITIONS.J5
        );
      }

      const from =
        NODE_POSITIONS[
          currentFrom
        ];

      const to =
        NODE_POSITIONS[
          currentTo
        ];

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
      currentFrom,
      currentTo,
      segmentProgress,
      completed,
    ]);

  function isEmergencyRoad(
    road
  ) {
    for (
      let index = 0;
      index <
      activeRoute.length - 1;
      index++
    ) {
      const from =
        activeRoute[index];

      const to =
        activeRoute[
          index + 1
        ];

      if (
        (road.start === from &&
          road.end === to) ||
        (road.start === to &&
          road.end === from)
      ) {
        return true;
      }
    }

    return false;
  }

  function isCurrentRoad(
    road
  ) {
    return (
      (road.start ===
        currentFrom &&
        road.end ===
          currentTo) ||
      (road.start ===
        currentTo &&
        road.end ===
          currentFrom)
    );
  }

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
        </div>

        <div className="map-status">
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
        <div className="district north">
          NORTH DISTRICT
        </div>

        <div className="district east">
          EAST DISTRICT
        </div>

        <div className="district west">
          WEST DISTRICT
        </div>

        {/* ROADS */}

        <svg
          className="road-svg"
          viewBox="0 0 1000 550"
          preserveAspectRatio="none"
        >
          {/* Road shadow layer */}

          {cityRoads.map(
            (road) => {
              const start =
                NODE_POSITIONS[
                  road.start
                ];

              const end =
                NODE_POSITIONS[
                  road.end
                ];

              if (!start || !end) {
                return null;
              }

              return (
                <line
                  key={`shadow-${road.road_id}`}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="#02080d"
                  strokeWidth="18"
                  strokeLinecap="round"
                />
              );
            }
          )}

          {/* Main roads */}

          {cityRoads.map(
            (road) => {
              const start =
                NODE_POSITIONS[
                  road.start
                ];

              const end =
                NODE_POSITIONS[
                  road.end
                ];

              if (!start || !end) {
                return null;
              }

              const emergency =
                isEmergencyRoad(
                  road
                );

              const current =
                isCurrentRoad(
                  road
                );

              const traffic =
                Number(
                  road.traffic
                ) || 0;

              const color =
                getRoadColor(
                  traffic,
                  emergency,
                  current
                );

              return (
                <g
                  key={road.road_id}
                >
                  {/* Outer road */}

                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke={color}
                    strokeWidth={
                      current &&
                      journeyStarted
                        ? 12
                        : emergency
                        ? 9
                        : 7
                    }
                    strokeLinecap="round"
                    opacity={
                      current &&
                      journeyStarted
                        ? 1
                        : emergency
                        ? 0.95
                        : 0.82
                    }
                  />

                  {/* Road center marking */}

                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeDasharray="12 14"
                    strokeLinecap="round"
                    opacity="0.35"
                  />

                  {/* Active emergency road glow */}

                  {current &&
                    journeyStarted && (
                      <line
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        stroke="#00f5a0"
                        strokeWidth="18"
                        strokeLinecap="round"
                        opacity="0.13"
                      />
                    )}
                </g>
              );
            }
          )}
        </svg>

        {/* ROAD LABELS */}

        {cityRoads.map(
          (road) => {
            const start =
              NODE_POSITIONS[
                road.start
              ];

            const end =
              NODE_POSITIONS[
                road.end
              ];

            if (!start || !end) {
              return null;
            }

            const x =
              (start.x + end.x) /
              2;

            const y =
              (start.y + end.y) /
              2;

            const emergency =
              isEmergencyRoad(
                road
              );

            const current =
              isCurrentRoad(
                road
              );

            const traffic =
              Number(
                road.traffic
              ) || 0;

            const trafficClass =
              getTrafficClass(
                traffic
              );

            return (
              <div
                key={`label-${road.road_id}`}
                className={`road-label ${
                  emergency
                    ? "emergency-road-label"
                    : ""
                } ${
                  current &&
                  journeyStarted
                    ? "current-road-label"
                    : ""
                }`}
                style={{
                  left: `${x / 10}%`,
                  top: `${y / 5.5}%`,
                  transform:
                    "translate(-50%, -50%)",
                }}
              >
                <strong>
                  {road.road_id}
                </strong>

                <span
                  className={`traffic-badge ${trafficClass}`}
                >
                  {Math.round(
                    traffic
                  )}
                  %
                </span>
              </div>
            );
          }
        )}

        {/* JUNCTIONS */}

        {Object.entries(
          NODE_POSITIONS
        ).map(
          ([
            junction,
            position,
          ]) => {
            const routeIndex =
              activeRoute.indexOf(
                junction
              );

            const isRoute =
              routeIndex !== -1;

            const currentIndex =
              Math.floor(
                ambulanceProgress
              );

            const isCurrent =
              journeyStarted &&
              !completed &&
              routeIndex ===
                currentIndex;

            const isPassed =
              completed ||
              (routeIndex !== -1 &&
                routeIndex <
                  currentIndex);

            const isDestination =
              junction ===
              activeRoute[
                activeRoute.length -
                  1
              ];

            return (
              <div
                key={junction}
                className={`junction ${
                  isRoute
                    ? "route-junction"
                    : ""
                } ${
                  isCurrent
                    ? "current-junction"
                    : ""
                } ${
                  isDestination
                    ? "hospital-junction"
                    : ""
                }`}
                style={{
                  left: `${position.x / 10}%`,
                  top: `${position.y / 5.5}%`,
                  transform:
                    "translate(-50%, -50%)",
                }}
              >
                <div className="junction-circle">
                  {isDestination
                    ? "🏥"
                    : junction.replace(
                        "J",
                        ""
                      )}
                </div>

                <strong>
                  {junction}
                </strong>

                <span>
                  {isDestination
                    ? "HOSPITAL"
                    : "JUNCTION"}
                </span>

                {isRoute &&
                  !isDestination && (
                    <div
                      className={`traffic-signal ${
                        isCurrent
                          ? "signal-green"
                          : ""
                      }`}
                    >
                      <span />
                      <span />
                      <span />
                    </div>
                  )}

                {isPassed &&
                  !isDestination && (
                    <div className="passed-indicator">
                      ✓
                    </div>
                  )}
              </div>
            );
          }
        )}

        {/* AMBULANCE */}

        <div
          className={`ambulance-marker ${
            journeyStarted
              ? "moving"
              : ""
          } ${
            completed
              ? "arrived"
              : ""
          }`}
          style={{
            left: `${ambulancePosition.x / 10}%`,
            top: `${ambulancePosition.y / 5.5}%`,
          }}
        >
          <div className="ambulance-glow" />

          <div className="ambulance-icon">
            🚑
          </div>

          <div className="ambulance-tag">
            {completed
              ? "ARRIVED"
              : journeyStarted
              ? `${currentFrom} → ${currentTo}`
              : "READY"}
          </div>
        </div>

        {/* MAP LEGEND */}

        <div className="map-legend">
          <h3>
            MAP LEGEND
          </h3>

          <div>
            <span className="legend-line emergency" />
            Emergency Corridor
          </div>

          <div>
            <span className="legend-line normal" />
            Normal Road
          </div>

          <div>
            <span className="legend-dot green" />
            Green Signal
          </div>

          <div>
            🚑 Ambulance
          </div>
        </div>

        {/* ACTIVE ROUTE */}

        <div className="active-route-box">
          <span>
            ACTIVE ROUTE
          </span>

          <strong>
            {activeRoute.join(
              " → "
            )}
          </strong>
        </div>
      </div>

      {/* FOOTER */}

      <div className="map-footer">
        <div>
          <span>
            CURRENT NODE
          </span>

          <strong>
            {completed
              ? activeRoute[
                  activeRoute.length -
                    1
                ]
              : currentFrom}
          </strong>
        </div>

        <div>
          <span>
            NEXT NODE
          </span>

          <strong>
            {completed
              ? "HOSPITAL"
              : currentTo}
          </strong>
        </div>

        <div>
          <span>
            CORRIDOR
          </span>

          <strong>
            {activeRoute.join(
              " → "
            )}
          </strong>
        </div>

        <div>
          <span>
            STATUS
          </span>

          <strong className="moving-status">
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
