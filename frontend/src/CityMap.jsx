import { useMemo } from "react";
import "./CityMap.css";

const NODE_POSITIONS = {
  J1: { x: 8, y: 58 },
  J2: { x: 30, y: 25 },
  J3: { x: 30, y: 75 },
  J4: { x: 62, y: 25 },
  J5: { x: 92, y: 58 },
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

function getRoadClass(traffic, emergency, current) {
  if (current) return "road-current";
  if (emergency) return "road-emergency";
  if (traffic >= 70) return "road-high";
  if (traffic >= 40) return "road-medium";
  return "road-low";
}

function CityMap({
  route = [],
  roads = [],
  ambulanceProgress = 0,
  journeyStarted = false,
  completed = false,
}) {
  const cityRoads =
    roads && roads.length > 0 ? roads : DEFAULT_ROADS;

  const activeRoute =
    route && route.length >= 2
      ? route
      : ["J1", "J2", "J3", "J5"];

  const currentSegment = Math.min(
    Math.floor(ambulanceProgress),
    activeRoute.length - 2
  );

  const currentFrom =
    activeRoute[currentSegment] || activeRoute[0];

  const currentTo =
    activeRoute[currentSegment + 1] ||
    activeRoute[activeRoute.length - 1];

  const segmentProgress =
    ambulanceProgress - Math.floor(ambulanceProgress);

  const ambulancePosition = useMemo(() => {
    if (completed) {
      const last =
        NODE_POSITIONS[
          activeRoute[activeRoute.length - 1]
        ];

      return last || NODE_POSITIONS.J5;
    }

    const from =
      NODE_POSITIONS[currentFrom] ||
      NODE_POSITIONS.J1;

    const to =
      NODE_POSITIONS[currentTo] ||
      NODE_POSITIONS.J2;

    return {
      x: from.x + (to.x - from.x) * segmentProgress,
      y: from.y + (to.y - from.y) * segmentProgress,
    };
  }, [
    activeRoute,
    currentFrom,
    currentTo,
    segmentProgress,
    completed,
  ]);

  function isEmergencyRoad(road) {
    for (let i = 0; i < activeRoute.length - 1; i++) {
      const a = activeRoute[i];
      const b = activeRoute[i + 1];

      if (
        (road.start === a && road.end === b) ||
        (road.start === b && road.end === a)
      ) {
        return true;
      }
    }

    return false;
  }

  function isCurrentRoad(road) {
    return (
      (road.start === currentFrom &&
        road.end === currentTo) ||
      (road.start === currentTo &&
        road.end === currentFrom)
    );
  }

  function roadStyle(road) {
    const start = NODE_POSITIONS[road.start];
    const end = NODE_POSITIONS[road.end];

    const dx = end.x - start.x;
    const dy = end.y - start.y;

    const length = Math.sqrt(dx * dx + dy * dy);

    const angle =
      Math.atan2(dy, dx) * (180 / Math.PI);

    return {
      left: `${start.x}%`,
      top: `${start.y}%`,
      width: `${length}%`,
      transform: `rotate(${angle}deg)`,
    };
  }

  return (
    <div className="city-map-container">

      {/* HEADER */}

      <div className="map-header">
        <div>
          <span className="map-eyebrow">
            LIVE CITY NETWORK
          </span>

          <h2>Emergency Corridor Map</h2>
        </div>

        <div className="map-status">
          <span className="live-dot" />

          {completed
            ? "AMBULANCE ARRIVED"
            : journeyStarted
            ? `AMBULANCE MOVING • ${currentFrom} → ${currentTo}`
            : "SYSTEM READY"}
        </div>
      </div>

      {/* MAP */}

      <div className="city-map">

        <div className="district north">
          NORTH DISTRICT
        </div>

        <div className="district west">
          WEST DISTRICT
        </div>

        <div className="district east">
          EAST DISTRICT
        </div>

        {/* ROADS */}

        <div className="roads-layer">

          {cityRoads.map((road) => {
            const emergency =
              isEmergencyRoad(road);

            const current =
              journeyStarted &&
              isCurrentRoad(road);

            const roadClass = getRoadClass(
              Number(road.traffic || 0),
              emergency,
              current
            );

            return (
              <div
                key={road.road_id}
                className={`road-wrapper ${roadClass}`}
                style={roadStyle(road)}
              >
                <div className="road-shadow" />
                <div className="road-line" />
                <div className="road-center-line" />
              </div>
            );
          })}

        </div>

        {/* ROAD LABELS */}

        <div className="road-labels-layer">

          {cityRoads.map((road) => {
            const start =
              NODE_POSITIONS[road.start];

            const end =
              NODE_POSITIONS[road.end];

            const x =
              (start.x + end.x) / 2;

            const y =
              (start.y + end.y) / 2;

            const emergency =
              isEmergencyRoad(road);

            const current =
              journeyStarted &&
              isCurrentRoad(road);

            return (
              <div
                key={`label-${road.road_id}`}
                className={`road-label ${
                  emergency
                    ? "emergency-label"
                    : ""
                } ${
                  current
                    ? "current-label"
                    : ""
                }`}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                }}
              >
                <strong>
                  {road.road_id}
                </strong>

                <span>
                  {Math.round(
                    Number(road.traffic || 0)
                  )}
                  %
                </span>
              </div>
            );
          })}

        </div>

        {/* JUNCTIONS */}

        <div className="junctions-layer">

          {Object.entries(
            NODE_POSITIONS
          ).map(([junction, position]) => {

            const routeIndex =
              activeRoute.indexOf(junction);

            const isRoute =
              routeIndex !== -1;

            const currentIndex =
              Math.floor(ambulanceProgress);

            const isCurrent =
              journeyStarted &&
              !completed &&
              routeIndex === currentIndex;

            const isPassed =
              isRoute &&
              routeIndex < currentIndex;

            const isDestination =
              junction ===
              activeRoute[
                activeRoute.length - 1
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
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                }}
              >

                <div className="junction-circle">

                  {isDestination
                    ? "🏥"
                    : junction.replace("J", "")}

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
                      <i />
                      <i />
                      <i />
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
          })}

        </div>

        {/* AMBULANCE */}

        <div
          className={`ambulance-marker ${
            journeyStarted ? "moving" : ""
          } ${completed ? "arrived" : ""}`}
          style={{
            left: `${ambulancePosition.x}%`,
            top: `${ambulancePosition.y}%`,
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

        {/* LEGEND */}

        <div className="map-legend">

          <h3>MAP LEGEND</h3>

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

          <div>🚑 Ambulance</div>

        </div>

        {/* ACTIVE ROUTE */}

        <div className="active-route-box">
          <span>ACTIVE ROUTE</span>

          <strong>
            {activeRoute.join(" → ")}
          </strong>
        </div>

      </div>

      {/* FOOTER */}

      <div className="map-footer">

        <div>
          <span>CURRENT ROAD</span>

          <strong>
            {completed
              ? "ARRIVED"
              : cityRoads.find(
                  (r) =>
                    (r.start === currentFrom &&
                      r.end === currentTo) ||
                    (r.start === currentTo &&
                      r.end === currentFrom)
                )?.road_id || "—"}
          </strong>
        </div>

        <div>
          <span>CURRENT NODE</span>

          <strong>
            {completed
              ? activeRoute[
                  activeRoute.length - 1
                ]
              : currentFrom}
          </strong>
        </div>

        <div>
          <span>NEXT NODE</span>

          <strong>
            {completed
              ? "HOSPITAL"
              : currentTo}
          </strong>
        </div>

        <div>
          <span>STATUS</span>

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