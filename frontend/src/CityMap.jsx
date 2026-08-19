import { useMemo } from "react";
import "./CityMap.css";

const NODE_POSITIONS = {
  J1: { x: 90, y: 300 },
  J2: { x: 300, y: 130 },
  J3: { x: 300, y: 470 },
  J4: { x: 650, y: 130 },
  J5: { x: 910, y: 300 },
};

const DEFAULT_ROADS = [
  {
    road_id: "R1",
    start: "J1",
    end: "J2",
    traffic: 30,
  },
  {
    road_id: "R2",
    start: "J1",
    end: "J3",
    traffic: 70,
  },
  {
    road_id: "R3",
    start: "J2",
    end: "J3",
    traffic: 80,
  },
  {
    road_id: "R4",
    start: "J2",
    end: "J4",
    traffic: 20,
  },
  {
    road_id: "R5",
    start: "J3",
    end: "J5",
    traffic: 25,
  },
  {
    road_id: "R6",
    start: "J4",
    end: "J5",
    traffic: 35,
  },
];

function isSameRoad(
  road,
  a,
  b
) {
  return (
    (road.start === a &&
      road.end === b) ||
    (road.start === b &&
      road.end === a)
  );
}

function roadColor(traffic) {
  if (traffic >= 70) {
    return "#ef4444";
  }

  if (traffic >= 40) {
    return "#f59e0b";
  }

  return "#22c55e";
}

export default function CityMap({
  roads = DEFAULT_ROADS,
  route = [],
  progress = 0,
  journeyStarted = false,
  completed = false,
  nextJunction,
}) {
  const cityRoads =
    roads.length
      ? roads
      : DEFAULT_ROADS;

  const activeRoute =
    route.length >= 2
      ? route
      : ["J1", "J2", "J4", "J5"];

  /*
   * Which road is ambulance currently travelling on?
   */
  const segmentIndex =
    Math.min(
      Math.floor(progress),
      activeRoute.length - 2
    );

  const currentFrom =
    activeRoute[
      segmentIndex
    ];

  const currentTo =
    activeRoute[
      segmentIndex + 1
    ];

  const segmentProgress =
    Math.max(
      0,
      Math.min(
        1,
        progress -
          segmentIndex
      )
    );

  /*
   * Exact physical position.
   *
   * This is what makes the ambulance
   * follow the actual road.
   */
  const ambulancePosition =
    useMemo(() => {
      if (
        !journeyStarted &&
        !completed
      ) {
        return (
          NODE_POSITIONS[
            activeRoute[0]
          ] ||
          NODE_POSITIONS.J1
        );
      }

      if (completed) {
        return (
          NODE_POSITIONS[
            activeRoute[
              activeRoute.length - 1
            ]
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
      journeyStarted,
      completed,
    ]);

  /*
   * Determine active emergency road.
   */
  function isEmergencyRoad(
    road
  ) {
    for (
      let i = 0;
      i <
      activeRoute.length - 1;
      i++
    ) {
      if (
        isSameRoad(
          road,
          activeRoute[i],
          activeRoute[i + 1]
        )
      ) {
        return true;
      }
    }

    return false;
  }

  return (
    <div className="city-map-container">

      <div className="map-header">

        <div>
          <span className="map-eyebrow">
            LIVE CITY NETWORK
          </span>

          <h2>
            Emergency Corridor Map
          </h2>

          <p>
            Road-based dynamic ambulance navigation
          </p>
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

      <div className="city-map">

        <div className="district-label north">
          NORTH DISTRICT
        </div>

        <div className="district-label west">
          WEST DISTRICT
        </div>

        <div className="district-label east">
          EAST DISTRICT
        </div>

        {/* ROAD NETWORK */}

        <svg
          className="road-svg"
          viewBox="0 0 1000 600"
          preserveAspectRatio="none"
        >

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

              if (
                !start ||
                !end
              ) {
                return null;
              }

              const emergency =
                isEmergencyRoad(
                  road
                );

              const traffic =
                Number(
                  road.traffic || 0
                );

              const color =
                emergency
                  ? "#00f5a0"
                  : roadColor(
                      traffic
                    );

              return (
                <g
                  key={
                    road.road_id
                  }
                >

                  {/* ROAD SHADOW */}

                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="#000"
                    strokeWidth="32"
                    opacity="0.5"
                    strokeLinecap="round"
                  />

                  {/* ROAD BODY */}

                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="#172d38"
                    strokeWidth="24"
                    strokeLinecap="round"
                  />

                  {/* TRAFFIC LAYER */}

                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke={color}
                    strokeWidth={
                      emergency
                        ? "10"
                        : "7"
                    }
                    strokeLinecap="round"
                    opacity={
                      emergency
                        ? "1"
                        : "0.9"
                    }
                  />

                  {/* ROAD CENTER */}

                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="#d7f5f5"
                    strokeWidth="2"
                    strokeDasharray="14 14"
                    opacity="0.45"
                  />

                  {/* EMERGENCY FLOW */}

                  {emergency &&
                    journeyStarted && (
                      <line
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        stroke="#ffffff"
                        strokeWidth="3"
                        strokeDasharray="12 14"
                        opacity="0.9"
                      >
                        <animate
                          attributeName="stroke-dashoffset"
                          from="0"
                          to="-52"
                          dur="0.7s"
                          repeatCount="indefinite"
                        />
                      </line>
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

            if (
              !start ||
              !end
            ) {
              return null;
            }

            const midX =
              (start.x +
                end.x) /
              2;

            const midY =
              (start.y +
                end.y) /
              2;

            const traffic =
              Number(
                road.traffic || 0
              );

            const emergency =
              isEmergencyRoad(
                road
              );

            return (
              <div
                key={
                  `label-${road.road_id}`
                }
                className={`road-label ${
                  emergency
                    ? "emergency-road-label"
                    : ""
                }`}
                style={{
                  left:
                    `${midX / 10}%`,
                  top:
                    `${midY / 6}%`,
                }}
              >

                <strong>
                  {road.road_id}
                </strong>

                <span
                  className={
                    traffic >= 70
                      ? "traffic-high"
                      : traffic >= 40
                      ? "traffic-medium"
                      : "traffic-low"
                  }
                >
                  {traffic}%
                </span>

              </div>
            );
          }
        )}

        {/* JUNCTIONS */}

        {Object.entries(
          NODE_POSITIONS
        ).map(
          ([junction, position]) => {

            const routeIndex =
              activeRoute.indexOf(
                junction
              );

            const isNext =
              journeyStarted &&
              !completed &&
              junction ===
                nextJunction;

            const isCurrent =
              journeyStarted &&
              !completed &&
              junction ===
                currentFrom;

            const isHospital =
              junction === "J5";

            return (
              <div
                key={
                  junction
                }
                className={`junction ${
                  routeIndex !== -1
                    ? "route-junction"
                    : ""
                } ${
                  isCurrent
                    ? "current-junction"
                    : ""
                } ${
                  isNext
                    ? "next-junction"
                    : ""
                } ${
                  isHospital
                    ? "hospital-junction"
                    : ""
                }`}
                style={{
                  left:
                    `${position.x / 10}%`,
                  top:
                    `${position.y / 6}%`,
                }}
              >

                <div className="junction-circle">

                  {isHospital
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
                  {isHospital
                    ? "HOSPITAL"
                    : isNext
                    ? "GREEN PRIORITY"
                    : "JUNCTION"}
                </span>

                {/* SIGNAL */}

                {!isHospital && (
                  <div
                    className={`traffic-signal ${
                      isNext
                        ? "signal-green"
                        : ""
                    }`}
                  >

                    <span />
                    <span />
                    <span />

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
            left:
              `${ambulancePosition.x / 10}%`,
            top:
              `${ambulancePosition.y / 6}%`,
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
              ? "AMBULANCE"
              : "READY"}
          </div>

        </div>

        {/* ROUTE */}

        <div className="active-route-box">

          <span>
            ACTIVE EMERGENCY ROUTE
          </span>

          <strong>
            {activeRoute.join(
              " → "
            )}
          </strong>

        </div>

        {/* LEGEND */}

        <div className="map-legend">

          <h3>
            MAP LEGEND
          </h3>

          <div>
            <span className="legend-line green" />
            Emergency Route
          </div>

          <div>
            <span className="legend-line red" />
            Heavy Traffic
          </div>

          <div>
            <span className="legend-line yellow" />
            Medium Traffic
          </div>

          <div>
            <span className="legend-line low" />
            Low Traffic
          </div>

        </div>

      </div>

      <div className="map-footer">

        <div>
          <span>
            CURRENT ROAD
          </span>

          <strong>
            {currentFrom} → {currentTo}
          </strong>
        </div>

        <div>
          <span>
            NEXT JUNCTION
          </span>

          <strong>
            {completed
              ? "HOSPITAL"
              : nextJunction}
          </strong>
        </div>

        <div>
          <span>
            SIGNAL
          </span>

          <strong className="green-text">
            {journeyStarted &&
            !completed
              ? "GREEN PRIORITY"
              : "NORMAL"}
          </strong>
        </div>

        <div>
          <span>
            STATUS
          </span>

          <strong>
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
